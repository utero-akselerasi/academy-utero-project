import pg from "pg";

export function createDatabase(databaseUrl) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_SIZE || 15),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    pool,
    query(text, values) {
      return pool.query(text, values);
    },
    async transaction(identity, callback) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('app.user_id', $1, true)", [identity?.userId || ""]);
        await client.query("select set_config('app.user_roles', $1, true)", [JSON.stringify(identity?.roles || [])]);
        await client.query(`set local role ${identity ? "authenticated" : "anon"}`);
        const result = await callback(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async apiTransaction(callback) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await callback(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close() {
      return pool.end();
    },
  };
}
