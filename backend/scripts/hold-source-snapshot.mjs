import { writeFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.SOURCE_DATABASE_URL;
const snapshotFile = process.argv[2];
if (!databaseUrl || !snapshotFile) throw new Error("SOURCE_DATABASE_URL dan path snapshot wajib diisi");

let release;
let stopped = false;
const stop = () => {
  stopped = true;
  release?.();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("begin isolation level repeatable read read only");
  const result = await client.query("select pg_export_snapshot() snapshot");
  const snapshot = result.rows[0]?.snapshot;
  if (typeof snapshot !== "string" || !/^[0-9A-Fa-f-]+$/.test(snapshot)) {
    throw new Error("Snapshot source database tidak valid");
  }
  await writeFile(snapshotFile, `${snapshot}\n`, { flag: "wx", mode: 0o600 });
  if (!stopped) await new Promise((resolve) => { release = resolve; });
  await client.query("rollback");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
