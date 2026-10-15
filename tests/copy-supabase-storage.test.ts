import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const modulePath = "../scripts/copy-supabase-storage.mjs";
type CopyOptions = {
  apply: boolean;
  overwrite: boolean;
  envNames: Record<string, string>;
  sourceBucket: string;
  targetBucket: string;
  prefix: string;
  pathList?: string;
  state?: string;
  maxBytes: number;
};
type CopyDependencies = { env: Record<string, string>; fetch: typeof fetch };
const { copyStorage, digestBuffer, digestPath, parseOptions, readPathList } = await import(modulePath) as {
  copyStorage(options: CopyOptions, dependencies: CopyDependencies): Promise<Record<string, number | string>>;
  digestBuffer(value: Buffer): string;
  digestPath(value: string): string;
  parseOptions(args: string[]): CopyOptions;
  readPathList(file: string): Promise<Array<{ name: string; listedSize: number }>>;
};

const baseArgs = ["--source-url-env", "SOURCE_URL", "--source-key-env", "SOURCE_KEY",
  "--target-url-env", "TARGET_URL", "--target-key-env", "TARGET_KEY",
  "--source-bucket", "avatars", "--target-bucket", "academy-private"];
const env = { SOURCE_URL: "https://source.invalid", SOURCE_KEY: "source-secret",
  TARGET_URL: "https://target.invalid", TARGET_KEY: "target-secret" };

describe("parseOptions", () => {
  it("memakai dry-run sebagai default", () => {
    expect(parseOptions(baseArgs)).toMatchObject({ apply: false, overwrite: false, prefix: "" });
  });

  it("mewajibkan state absolut untuk apply", () => {
    expect(() => parseOptions([...baseArgs, "--apply", "true"])).toThrow("--state path absolut");
    expect(() => parseOptions([...baseArgs, "--apply", "true", "--state", "relative.json"])).toThrow();
  });

  it("mewajibkan path-list untuk apply avatars ke academy-private", () => {
    const state = path.join(tmpdir(), "copy-state.json");
    expect(() => parseOptions([...baseArgs, "--apply", "true", "--state", state])).toThrow("wajib memakai --path-list");
  });

  it("menolak nama target selain academy-private saat source avatars", () => {
    const state = path.join(tmpdir(), "copy-state.json");
    const pathList = path.join(tmpdir(), "copy-paths.txt");
    const wrongTarget = baseArgs.map((item) => item === "academy-private" ? "academy-avatars" : item);
    expect(() => parseOptions([...wrongTarget, "--apply", "true", "--state", state, "--path-list", pathList]))
      .toThrow("wajib academy-private");
  });

  it.each(["../secret", "/root", "folder/", "folder//file"])("menolak prefix tidak aman: %s", (prefix) => {
    expect(() => parseOptions([...baseArgs, "--prefix", prefix])).toThrow("Object path tidak aman");
  });
});

describe("readPathList", () => {
  it("membaca path unik dan tervalidasi", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "storage-paths-"));
    const file = path.join(directory, "paths.txt");
    await writeFile(file, "academy/two.pdf\nacademy/one.jpg\n");
    expect((await readPathList(file)).map(({ name }) => name)).toEqual(["academy/one.jpg", "academy/two.pdf"]);
  });

  it("menolak duplikat, path rusak, dan symlink", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "storage-paths-"));
    const file = path.join(directory, "paths.txt");
    await writeFile(file, "academy/one.jpg\nacademy/one.jpg\n");
    await expect(readPathList(file)).rejects.toThrow("duplikat");
    await writeFile(file, "../secret\n");
    await expect(readPathList(file)).rejects.toThrow("tidak aman");
    const link = path.join(directory, "link.txt");
    try {
      await symlink(file, link);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await expect(readPathList(link)).rejects.toThrow("non-symlink");
  });
});

describe("digest", () => {
  it("menghasilkan SHA-256 stabil", () => {
    expect(digestBuffer(Buffer.from("academy"))).toHaveLength(64);
    expect(digestPath("private/user/file.pdf")).toBe(digestPath("private/user/file.pdf"));
  });
});

function response(body: BodyInit | null, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("copyStorage", () => {
  it("dry-run hanya mendaftar objek dan tidak membocorkan path", async () => {
    const fetchMock = vi.fn(async () => response(JSON.stringify([
      { id: "one", name: "user@example.com/avatar.jpg", metadata: { size: 3 } },
    ]), 200, { "content-type": "application/json" }));
    const summary = await copyStorage(parseOptions(baseArgs), { env, fetch: fetchMock });
    expect(summary).toEqual({ mode: "dry-run", discovered: 1, copied: 0, verified: 0, skipped: 0 });
    expect(JSON.stringify(summary)).not.toContain("user@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("copy, verifikasi, lalu resume secara idempoten", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "storage-copy-"));
    const statePath = path.join(directory, "state.json");
    const pathList = path.join(directory, "paths.txt");
    await writeFile(pathList, "private/person/avatar.jpg\n");
    const payload = Buffer.from("abc");
    let targetPayload: Buffer | null = null;
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/object/list/")) throw new Error("path-list tidak boleh enumerate bucket");
      if (url.includes("source.invalid/storage/v1/object/")) return response(Uint8Array.from(payload), 200,
        { "content-length": String(payload.length), "content-type": "image/jpeg" });
      if (url.includes("target.invalid/storage/v1/object/") && init?.method === "POST") {
        targetPayload = Buffer.from(init.body as Buffer); return response("{}", 200);
      }
      if (url.includes("target.invalid/storage/v1/object/") && targetPayload) return response(Uint8Array.from(targetPayload), 200,
        { "content-length": String(targetPayload.length), "content-type": "image/jpeg" });
      if (url.includes("target.invalid/storage/v1/object/")) return response("missing", 404);
      throw new Error("request unexpected");
    });
    const options = parseOptions([...baseArgs, "--apply", "true", "--state", statePath, "--path-list", pathList]);
    expect(await copyStorage(options, { env, fetch: fetchMock })).toMatchObject({ copied: 1, verified: 1 });
    expect(await copyStorage(options, { env, fetch: fetchMock })).toMatchObject({ copied: 0, skipped: 1, verified: 1 });
    const state = JSON.parse(await readFile(statePath, "utf8"));
    expect(state.completed[digestPath("private/person/avatar.jpg")]).toMatchObject({ size: 3, sha256: digestBuffer(payload) });
    const sourceCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes("source.invalid"));
    expect(sourceCalls.length).toBeGreaterThan(0);
    expect(sourceCalls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  it("menerima NoSuchKey berstatus HTTP 400 sebagai objek target belum ada", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "storage-copy-"));
    const pathList = path.join(directory, "paths.txt");
    await writeFile(pathList, "private/person/avatar.jpg\n");
    let uploaded = false;
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("source.invalid")) return response("abc", 200, { "content-type": "image/jpeg" });
      if (init?.method === "POST") { uploaded = true; return response("{}", 200); }
      if (uploaded) return response("abc", 200, { "content-type": "image/jpeg" });
      return response(JSON.stringify({ statusCode: "404", code: "NoSuchKey" }), 400,
        { "content-type": "application/json" });
    });
    const options = parseOptions([...baseArgs, "--apply", "true", "--state", path.join(directory, "state.json"),
      "--path-list", pathList]);
    expect(await copyStorage(options, { env, fetch: fetchMock })).toMatchObject({ copied: 1, verified: 1 });
  });

  it("menolak overwrite objek berbeda dan meredaksi token, URL, serta path", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "storage-copy-"));
    const pathList = path.join(directory, "paths.txt");
    await writeFile(pathList, "pii/person.jpg\n");
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/object/list/")) throw new Error("path-list tidak boleh enumerate bucket");
      if (url.includes("source.invalid")) return response("abc", 200, { "content-length": "3" });
      return response("xyz", 200, { "content-length": "3" });
    });
    const options = parseOptions([...baseArgs, "--apply", "true", "--state", path.join(directory, "state.json"),
      "--path-list", pathList]);
    let message = "";
    try { await copyStorage(options, { env, fetch: fetchMock }); } catch (error) { message = String(error); }
    expect(message).toContain("Objek target berbeda");
    expect(message).not.toContain("source-secret");
    expect(message).not.toContain("source.invalid");
    expect(message).not.toContain("pii/person.jpg");
  });

  it("menolak source URL dan bucket identik sebelum request jaringan", async () => {
    const sameEnv = { ...env, TARGET_URL: "https://source.invalid/" };
    const sameBucketArgs = baseArgs.map((item) => item === "academy-private" ? "avatars" : item);
    const fetchMock = vi.fn();
    await expect(copyStorage(parseOptions(sameBucketArgs), { env: sameEnv, fetch: fetchMock }))
      .rejects.toThrow("tidak boleh identik");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
