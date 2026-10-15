import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const modulePath = "../scripts/copy-phase13-storage-backup.mjs";
const { assertCloneDatabaseUrl, copyBackup, parseOptions } = await import(modulePath);
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "phase13-backup-"));
  const backupRoot = root;
  const filesRoot = path.join(root, "files");
  const names = Array.from({ length: 417 }, (_, index) => "academy/avatar-" + String(index).padStart(3, "0") + ".jpg");
  const files = [];
  for (const [index, name] of names.entries()) {
    const id = "id-" + index;
    const content = Buffer.from("image-" + index);
    const relative = "./stub/stub/avatars/" + name + "/" + id;
    const file = path.join(filesRoot, ...relative.slice(2).split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    files.push({ pathDigest: sha(relative), sha256: sha(content) });
  }
  const allowlist = path.join(root, "allowlist.txt");
  const manifest = path.join(root, "manifest.json");
  const state = path.join(root, "state.json");
  await writeFile(allowlist, names.join("\n") + "\n");
  await writeFile(manifest, JSON.stringify({ version: 1, target: "production", algorithm: "sha256", fileCount: files.length, files }));
  const options = parseOptions(["--allowlist", allowlist, "--backup-root", backupRoot, "--manifest", manifest,
    "--database-url-env", "CLONE_URL", "--target-url-env", "STAGING_URL", "--target-key-env", "STAGING_KEY",
    "--state", state, "--apply", "true"]);
  const env = { CLONE_URL: "postgresql://reader:secret@localhost:5432/phase13_current_prod",
    STAGING_URL: "http://127.0.0.1:18100", STAGING_KEY: "secret" };
  const queryMappings = vi.fn(async () => names.map((name, index) => ({ name, id: "id-" + index })));
  return { names, options, env, queryMappings, state };
}

describe("copy-phase13-storage-backup", () => {
  it("menolak database non-localhost atau nama clone salah", () => {
    expect(() => assertCloneDatabaseUrl("postgresql://x@20.20.20.3/phase13_current_prod")).toThrow("localhost");
    expect(() => assertCloneDatabaseUrl("postgresql://x@localhost/production")).toThrow("phase13_current_prod");
  });

  it("menolak target selain tunnel staging sebelum membaca database", async () => {
    const data = await fixture();
    await expect(copyBackup(data.options, { env: { ...data.env, STAGING_URL: "https://supabase.carubra.space" },
      queryMappings: data.queryMappings, fetch: vi.fn() })).rejects.toThrow("tunnel staging");
    expect(data.queryMappings).not.toHaveBeenCalled();
  });

  it("memverifikasi manifest, upload tanpa upsert, verifikasi target, dan state tanpa PII", async () => {
    const data = await fixture();
    const stored = new Map<string, Buffer>();
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const name = url.pathname.split("/academy-private/")[1].split("/").map(decodeURIComponent).join("/");
      if (init?.method === "POST") {
        stored.set(name, Buffer.from(await new Response(init.body).arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      const value = stored.get(name);
      return value ? new Response(Uint8Array.from(value), { status: 200, headers: { "content-length": String(value.length) } })
        : new Response(JSON.stringify({ statusCode: "404", code: "NoSuchKey" }), { status: 400 });
    });
    const result = await copyBackup(data.options, { env: data.env, queryMappings: data.queryMappings, fetch: fetchMock });
    expect(result).toEqual({ mode: "apply", discovered: 417, copied: 417, verified: 417, skipped: 0 });
    const posts = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST");
    expect(posts).toHaveLength(417);
    expect(posts[0][1]?.headers).toMatchObject({ "x-upsert": "false" });
    const stateText = await readFile(data.state, "utf8");
    expect(stateText).not.toContain(data.names[0]);
    expect(Object.keys(JSON.parse(stateText).completed)).toHaveLength(417);

    const resumed = await copyBackup(data.options, { env: data.env, queryMappings: data.queryMappings, fetch: fetchMock });
    expect(resumed).toMatchObject({ copied: 0, skipped: 417, verified: 417 });
  }, 30_000);

  it("menolak target berbeda tanpa overwrite", async () => {
    const data = await fixture();
    const fetchMock = vi.fn(async () => new Response("different", { status: 200 }));
    await expect(copyBackup(data.options, { env: data.env, queryMappings: data.queryMappings,
      fetch: fetchMock })).rejects.toThrow("overwrite ditolak");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gagal bila file backup tidak cocok dengan SHA-256 manifest", async () => {
    const data = await fixture();
    const first = path.join(data.options.backupRoot, "files", "stub", "stub", "avatars", ...data.names[0].split("/"), "id-0");
    await writeFile(first, "tampered");
    await expect(copyBackup(data.options, { env: data.env, queryMappings: data.queryMappings,
      fetch: vi.fn() })).rejects.toThrow("manifest");
  });

  it("tidak mengandalkan storage.objects.id sebagai nama file backup", async () => {
    const data = await fixture();
    const firstDirectory = path.join(data.options.backupRoot, "files", "stub", "stub", "avatars", ...data.names[0].split("/"));
    await rename(path.join(firstDirectory, "id-0"), path.join(firstDirectory, "version-0"));
    const manifest = JSON.parse(await readFile(data.options.manifest, "utf8"));
    const oldDigest = sha(`./stub/stub/avatars/${data.names[0]}/id-0`);
    const entry = manifest.files.find((item: { pathDigest: string }) => item.pathDigest === oldDigest);
    entry.pathDigest = sha(`./stub/stub/avatars/${data.names[0]}/version-0`);
    await writeFile(data.options.manifest, JSON.stringify(manifest));
    const stored = new Map<string, Buffer>();
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const name = String(input).split("/academy-private/")[1];
      if (init?.method === "POST") {
        stored.set(name, Buffer.from(await new Response(init.body).arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      const value = stored.get(name);
      return value ? new Response(Uint8Array.from(value)) : new Response(null, { status: 404 });
    });
    await expect(copyBackup(data.options, { env: data.env, queryMappings: data.queryMappings, fetch: fetchMock }))
      .resolves.toMatchObject({ verified: 417 });
  });
});
