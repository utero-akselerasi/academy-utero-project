#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const forbiddenFragments = [
  "/data/supabase/instances/supabase-01/",
  "/data/supabase/instances/supabase-02/",
  "supabase-02-db",
  "supabase-02-auth",
  "supabase-02-storage",
  "127.0.0.1:8100",
  "127.0.0.1:5532",
  "127.0.0.1:6643",
  "supabase.carubra.com",
  "supabase.carubra.space",
  "20.20.20.3",
  "20.20.20.173",
];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

function normalizedRoot(value) {
  const root = path.posix.resolve(value ?? "");
  if (!root.startsWith("/home/maskhar/supabase-replacements/supabase-02-rollback-")) {
    throw new Error("Root replacement tidak berada di tree rollback yang diizinkan");
  }
  return root;
}

function environmentFor(service) {
  if (!service.environment) return {};
  if (Array.isArray(service.environment)) return Object.fromEntries(service.environment.map((entry) => {
    const separator = entry.indexOf("=");
    return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
  return service.environment;
}

export function validateRollbackCompose(compose, evidence) {
  if (!evidence || !/^supabase-02-rollback-[a-z0-9-]+$/.test(evidence.project ?? "")) {
    throw new Error("Nama project replacement tidak valid");
  }
  const root = normalizedRoot(evidence.root);
  if (root !== "/home/maskhar/supabase-replacements/" + evidence.project) {
    throw new Error("Root replacement tidak sesuai project");
  }
  if (evidence.gatewayOrigin !== "http://127.0.0.1:8200" || evidence.appOrigin !== "http://127.0.0.1:3100") {
    throw new Error("Origin replacement tidak sesuai port terisolasi");
  }
  if (compose?.name !== evidence.project) throw new Error("Nama project Compose tidak sesuai replacement");
  const services = Object.entries(compose?.services ?? {});
  if (services.length < 8) throw new Error("Service replacement tidak lengkap");
  if (forbiddenFragments.some((fragment) => JSON.stringify(compose).includes(fragment))) {
    throw new Error("Compose replacement masih menunjuk source atau production");
  }

  const containers = new Set();
  const mounts = new Set();
  const namedVolumes = new Set();
  const publishedPorts = new Set();
  const networkNames = new Set();
  const allEnvironment = {};

  for (const [serviceName, service] of services) {
    if (service.network_mode || service.privileged || service.build || service.pid === "host" || service.ipc === "host" ||
        service.cgroup === "host" || service.userns_mode === "host" ||
        ["volumes_from", "external_links", "devices", "cap_add", "security_opt", "secrets", "configs",
          "extra_hosts", "dns", "dns_search"].some((key) => service[key] != null)) {
      throw new Error("Service replacement memakai host privilege atau resource di luar isolasi yang diaudit");
    }
    if (typeof service.image !== "string" || !/@sha256:[a-f0-9]{64}$/.test(service.image)) {
      throw new Error("Image replacement wajib immutable dan dipin dengan sha256 digest");
    }
    const container = service.container_name;
    if (typeof container !== "string" || !container.startsWith(evidence.project + "-") || containers.has(container)) {
      throw new Error("Nama container replacement tidak unik atau masih berbenturan");
    }
    containers.add(container);

    for (const port of service.ports ?? []) {
      const hostIp = port.host_ip ?? port.hostIp;
      const published = String(port.published ?? "");
      if (hostIp !== "127.0.0.1" || !["8200", "5632", "6743"].includes(published)) {
        throw new Error("Port replacement wajib loopback dan berada pada allowlist");
      }
      const endpoint = hostIp + ":" + published;
      if (publishedPorts.has(endpoint)) throw new Error("Port host replacement dipakai ganda");
      publishedPorts.add(endpoint);
    }

    for (const volume of service.volumes ?? []) {
      if (typeof volume.source !== "string") throw new Error("Source volume replacement tidak valid");
      if (volume.type === "bind") {
        const source = path.posix.resolve(volume.source);
        if (!source.startsWith(root + "/")) throw new Error("Bind mount keluar root replacement");
        mounts.add(source);
      } else if (volume.type === "volume") namedVolumes.add(volume.source);
      else throw new Error("Tipe volume replacement tidak dikenal");
    }

    const networks = Array.isArray(service.networks) ? service.networks : Object.keys(service.networks ?? {});
    if (!networks.length) throw new Error("Service replacement tanpa network terisolasi");
    for (const network of networks) networkNames.add(network);
    Object.assign(allEnvironment, Object.fromEntries(Object.entries(environmentFor(service)).map(([key, value]) => [serviceName + "." + key, String(value)])));
  }

  const expectedPorts = ["127.0.0.1:8200", "127.0.0.1:5632", "127.0.0.1:6743"];
  if (expectedPorts.some((value) => !publishedPorts.has(value)) || publishedPorts.size !== expectedPorts.length) {
    throw new Error("Set port replacement tidak lengkap atau memiliki port tambahan");
  }
  if (mounts.size < 2) throw new Error("Bind mount replacement belum lengkap");

  const networks = compose.networks ?? {};
  if (!networkNames.size || [...networkNames].some((name) => {
    const definition = networks[name];
    const resolvedName = definition?.name ?? name;
    return !definition || definition.external === true ||
      !(resolvedName.startsWith(evidence.project + "-") || resolvedName.startsWith(evidence.project + "_"));
  })) throw new Error("Network replacement tidak terisolasi");

  const volumes = compose.volumes ?? {};
  if ([...namedVolumes].some((name) => {
    const definition = volumes[name];
    const resolvedName = definition?.name ?? name;
    return !definition || definition.external === true ||
      !(resolvedName.startsWith(evidence.project + "-") || resolvedName.startsWith(evidence.project + "_"));
  })) throw new Error("Named volume replacement tidak terisolasi");

  const valuesFor = (name) => Object.entries(allEnvironment)
    .filter(([key]) => key.endsWith("." + name)).map(([, value]) => value);
  const siteUrls = valuesFor("GOTRUE_SITE_URL");
  const redirectLists = [...valuesFor("GOTRUE_URI_ALLOW_LIST"), ...valuesFor("ADDITIONAL_REDIRECT_URLS")];
  const gatewayUrls = [...valuesFor("API_EXTERNAL_URL"), ...valuesFor("SUPABASE_PUBLIC_URL")];
  if (siteUrls.length !== 1 || siteUrls[0] !== evidence.appOrigin ||
      !redirectLists.length || !redirectLists.every((value) => value.includes(evidence.appOrigin)) ||
      !gatewayUrls.length || !gatewayUrls.every((value) => value === evidence.gatewayOrigin)) {
    throw new Error("Callback app atau public gateway replacement belum terikat");
  }

  const digest = createHash("sha256").update(JSON.stringify(canonical(compose))).digest("hex");
  return { ready: true, project: evidence.project, serviceCount: services.length, containerCount: containers.size,
    mountCount: mounts.size, namedVolumeCount: namedVolumes.size, publishedPorts: expectedPorts,
    networkCount: networkNames.size, composeSha256: digest };
}

async function regularJson(file, label) {
  if (file === "-" && label === "Compose JSON") {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) throw new Error("Compose JSON stdin terlalu besar");
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new Error("Compose JSON stdin tidak valid"); }
  }
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(label + " wajib file reguler non-symlink");
  return JSON.parse(await readFile(file, "utf8"));
}

async function main() {
  if (process.argv.length !== 4) throw new Error("Gunakan: node scripts/validate-phase13-rollback-compose.mjs compose.json|- evidence.json");
  const compose = await regularJson(process.argv[2], "Compose JSON");
  const evidence = await regularJson(process.argv[3], "Evidence");
  process.stdout.write(JSON.stringify(validateRollbackCompose(compose, evidence)) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write("Compose replacement NO-GO: " + error.message + "\n"); process.exitCode = 1; });
}
