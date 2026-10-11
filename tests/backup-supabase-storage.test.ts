import { describe, expect, it } from "vitest";

const modulePath = "../scripts/backup-supabase-storage.mjs";
const { assertMatching, diffHashes, encodePathList, parseHashes, parseOptions, remoteCommands } = await import(modulePath) as {
  assertMatching(expected: Map<string, string>, actual: Map<string, string>): void;
  diffHashes(remote: Map<string, string>, local: Map<string, string>): { transfer: string[]; extra: string[] };
  encodePathList(paths: string[]): Buffer;
  parseHashes(output: Buffer): Map<string, string>;
  parseOptions(args: string[]): Record<string, unknown>;
  remoteCommands(source: string): { types: string; hashes: string; archive: string };
};

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);

describe("parseOptions", () => {
  it("menerima backup develop dengan path absolut", () => {
    expect(parseOptions([
      "--target", "develop", "--source", "/var/lib/storage", "--destination", "C:\\backups",
      "--user", "backup_reader", "--run-id", "20261011-120000",
    ])).toMatchObject({ target: "develop", source: "/var/lib/storage", user: "backup_reader", verify: false });
  });

  it("menerima verifikasi lokal tanpa kredensial SSH", () => {
    expect(parseOptions([
      "--verify", "true", "--target", "production", "--destination", "C:\\backups", "--run-id", "20261011-120000",
    ])).toMatchObject({ target: "production", verify: true });
  });

  it.each([
    ["target salah", ["--target", "prod", "--destination", "C:\\backups", "--run-id", "20261011-120000", "--verify", "true"]],
    ["source root", ["--target", "develop", "--source", "/", "--destination", "C:\\backups", "--user", "reader", "--run-id", "20261011-120000"]],
    ["source traversal", ["--target", "develop", "--source", "/srv/../secret", "--destination", "C:\\backups", "--user", "reader", "--run-id", "20261011-120000"]],
    ["destination relatif", ["--target", "develop", "--source", "/srv/storage", "--destination", "backup", "--user", "reader", "--run-id", "20261011-120000"]],
    ["run id bebas", ["--target", "develop", "--source", "/srv/storage", "--destination", "C:\\backups", "--user", "reader", "--run-id", "latest"]],
  ])("menolak %s", (_, args) => expect(() => parseOptions(args)).toThrow());
});

describe("parseHashes", () => {
  it("membaca keluaran sha256sum NUL-delimited tanpa mencetak path", () => {
    expect([...parseHashes(Buffer.from(`${digestA}  ./bucket/file one.jpg\0${digestB}  ./bucket/two.pdf\0`))]).toEqual([
      ["./bucket/file one.jpg", digestA], ["./bucket/two.pdf", digestB],
    ]);
  });

  it.each([
    Buffer.from(`${digestA}  ./file`),
    Buffer.from(`${digestA}  ./file\0${digestB}  ./file\0`),
    Buffer.from(`${digestA}  ./../secret\0`),
    Buffer.from(`${digestA}  ./bucket/CON.txt\0`),
    Buffer.from(`${digestA}  ./bucket/file:stream\0`),
  ])("menolak daftar hash rusak", (value) => expect(() => parseHashes(value)).toThrow());
});

describe("remoteCommands", () => {
  it("membatasi archive ke file reguler dengan daftar NUL", () => {
    const commands = remoteCommands("/var/lib/storage");
    expect(commands.types).toContain("! -type f ! -type d");
    expect(commands.archive).toContain("tar --verbatim-files-from --null --files-from=- --no-recursion -cf -");
    expect(commands.archive).not.toContain("find .");
  });

  it.each([
    "/", "/srv/../secret", "/srv/storage;id", "/srv/storage'", "relative/storage", "C:\\storage",
  ])("menolak source yang dapat mengubah remote command: %s", (source) => {
    expect(() => remoteCommands(source)).toThrow("Source tidak aman");
  });
});

describe("diffHashes", () => {
  it("memilih hanya file missing/changed dan memisahkan extra lokal", () => {
    const remote = new Map([["./same", digestA], ["./changed", digestB], ["./missing", digestA]]);
    const local = new Map([["./same", digestA], ["./changed", digestA], ["./extra", digestB]]);
    expect(diffHashes(remote, local)).toEqual({
      transfer: ["./changed", "./missing"],
      extra: ["./extra"],
    });
  });

  it("tidak mentransfer ulang staging yang sudah cocok", () => {
    const hashes = new Map([["./file", digestA]]);
    expect(diffHashes(hashes, new Map(hashes))).toEqual({ transfer: [], extra: [] });
  });
});

describe("encodePathList", () => {
  it("menulis path NUL-delimited tanpa shell quoting", () => {
    expect(encodePathList(["./bucket/one file.jpg", "./bucket/-option"])).toEqual(
      Buffer.from("./bucket/one file.jpg\0./bucket/-option\0"),
    );
  });

  it("menolak path traversal dan path Windows berbahaya", () => {
    expect(() => encodePathList(["./../outside"])).toThrow("Path file tidak aman");
    expect(() => encodePathList(["./bucket/file:stream"])).toThrow("Path file tidak aman");
  });
});

describe("assertMatching", () => {
  it("menerima set file dan hash identik", () => {
    expect(() => assertMatching(new Map([["./file", digestA]]), new Map([["./file", digestA]]))).not.toThrow();
  });

  it("menolak file hilang atau berubah", () => {
    expect(() => assertMatching(new Map([["./file", digestA]]), new Map([["./file", digestB]]))).toThrow("Integritas gagal");
  });
});
