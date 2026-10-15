import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateRollbackCompose } from "../scripts/validate-phase13-rollback-compose.mjs";

const evidence = { project: "supabase-02-rollback-drill", root: "/home/maskhar/supabase-replacements/supabase-02-rollback-drill",
  gatewayOrigin: "http://127.0.0.1:8200", appOrigin: "http://127.0.0.1:3100" };

function compose(): any {
  const services = Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
    const name = index === 0 ? "gateway" : index === 1 ? "db" : index === 2 ? "analytics" : "service" + index;
    return [name, { image: "registry.example/" + name + "@sha256:" + String(index + 1).repeat(64),
      container_name: evidence.project + "-" + name, networks: ["replacement"],
      volumes: index < 2 ? [{ type: "bind", source: evidence.root + "/data/" + name, target: "/data" }] : [],
      ports: index === 0 ? [{ host_ip: "127.0.0.1", published: "8200", target: 8000 }]
        : index === 1 ? [{ host_ip: "127.0.0.1", published: "5632", target: 5432 }]
          : index === 2 ? [{ host_ip: "127.0.0.1", published: "6743", target: 4000 }] : [],
      environment: index === 0 ? { API_EXTERNAL_URL: evidence.gatewayOrigin }
        : index === 3 ? { GOTRUE_SITE_URL: evidence.appOrigin, GOTRUE_URI_ALLOW_LIST: evidence.appOrigin + "/**" } : {} }];
  }));
  return { name: evidence.project, services, networks: { replacement: { name: evidence.project + "-network" } } };
}

describe("validate rollback replacement compose", () => {
  it("menerima compose replacement yang terisolasi", () => {
    expect(validateRollbackCompose(compose(), evidence)).toMatchObject({ ready: true, serviceCount: 8, containerCount: 8,
      mountCount: 2, publishedPorts: ["127.0.0.1:8200", "127.0.0.1:5632", "127.0.0.1:6743"] });
  });

  it("menolak container, port, mount, dan network source", () => {
    const sourceProject = compose(); sourceProject.name = "supabase-02";
    expect(() => validateRollbackCompose(sourceProject, evidence)).toThrow();
    const sourceContainer = compose(); sourceContainer.services.db.container_name = "supabase-02-db";
    expect(() => validateRollbackCompose(sourceContainer, evidence)).toThrow();
    const sourcePort = compose(); sourcePort.services.db.ports[0].published = "5532";
    expect(() => validateRollbackCompose(sourcePort, evidence)).toThrow();
    const sourceMount = compose(); sourceMount.services.db.volumes[0].source = "/data/supabase/instances/supabase-02/db";
    expect(() => validateRollbackCompose(sourceMount, evidence)).toThrow();
    const externalNetwork = compose(); externalNetwork.networks.replacement.external = true;
    expect(() => validateRollbackCompose(externalNetwork, evidence)).toThrow();
  });

  it("menolak callback source, named volume, dan port tambahan", () => {
    const callback = compose(); callback.services.service3.environment.GOTRUE_SITE_URL = "http://127.0.0.1:3000";
    expect(() => validateRollbackCompose(callback, evidence)).toThrow();
    const named = compose(); named.services.db.volumes[0] = { type: "volume", source: "source-db", target: "/data" };
    expect(() => validateRollbackCompose(named, evidence)).toThrow();
    const extraPort = compose(); extraPort.services.service4.ports = [{ host_ip: "127.0.0.1", published: "9999", target: 9999 }];
    expect(() => validateRollbackCompose(extraPort, evidence)).toThrow();
  });

  it("menolak image tag mutable dan build lokal", () => {
    const tagged = compose(); tagged.services.db.image = "postgres:15";
    expect(() => validateRollbackCompose(tagged, evidence)).toThrow();
    const built = compose(); built.services.db.build = { context: "/tmp" };
    expect(() => validateRollbackCompose(built, evidence)).toThrow();
  });

  it("menerima resolved Compose lewat stdin tanpa mencetak environment", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase13-compose-stdin-"));
    try {
      const evidenceFile = join(directory, "evidence.json");
      writeFileSync(evidenceFile, JSON.stringify(evidence));
      const replacement = compose();
      replacement.services.db.environment = { PRIVATE_TEST_SECRET: "must-not-leak" };
      const script = join(import.meta.dirname, "..", "scripts", "validate-phase13-rollback-compose.mjs");
      const result = spawnSync(process.execPath, [script, "-", evidenceFile], {
        encoding: "utf8", input: JSON.stringify(replacement), timeout: 10000,
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).ready).toBe(true);
      expect(result.stdout + result.stderr).not.toContain("must-not-leak");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("menolak environment yang masih menunjuk source", () => {
    const source = compose(); source.services.service4.environment = { DB_HOST: "supabase-02-db" };
    expect(() => validateRollbackCompose(source, evidence)).toThrow();
    const production = compose(); production.services.service4.environment = { API_URL: "https://supabase.carubra.space" };
    expect(() => validateRollbackCompose(production, evidence)).toThrow();
  });

  it("menolak referensi source di command, label, dan healthcheck", () => {
    const command = compose(); command.services.db.command = ["--host", "supabase-02-db"];
    expect(() => validateRollbackCompose(command, evidence)).toThrow();
    const label = compose(); label.services.gateway.labels = { app: "supabase.carubra.space" };
    expect(() => validateRollbackCompose(label, evidence)).toThrow();
    const healthcheck = compose(); healthcheck.services.db.healthcheck = { test: ["CMD", "curl", "127.0.0.1:5532"] };
    expect(() => validateRollbackCompose(healthcheck, evidence)).toThrow();
  });

  it("menolak host networking, privilege, dan resource eksternal yang tidak diaudit", () => {
    for (const [property, value] of Object.entries({
      network_mode: "host", privileged: true, build: { context: "/tmp" }, pid: "host", ipc: "host", cgroup: "host",
      userns_mode: "host", volumes_from: ["supabase-02-db"], external_links: ["source"],
      devices: ["/dev/kvm:/dev/kvm"], cap_add: ["SYS_ADMIN"],
      security_opt: ["apparmor:unconfined"], secrets: ["source-secret"], configs: ["source-config"],
      extra_hosts: { source: "10.0.0.1" }, dns: ["20.20.20.3"], dns_search: ["carubra.space"],
    })) {
      const unsafe = compose();
      unsafe.services.db[property] = value;
      expect(() => validateRollbackCompose(unsafe, evidence), property).toThrow();
    }
  });
});
