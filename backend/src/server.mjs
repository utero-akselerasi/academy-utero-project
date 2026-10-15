import { loadConfig } from "./config.mjs";
import { createDatabase } from "./db.mjs";
import { buildApp } from "./app.mjs";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const app = await buildApp({ db, config });

const shutdown = async () => {
  await app.close();
  await db.close();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: config.host, port: config.port });
