import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { dailyReportRoutes } from "../src/routes/daily-reports.mjs";

const actorId = "11111111-1111-4111-8111-111111111111";
const internId = "22222222-2222-4222-8222-222222222222";
const reportId = "33333333-3333-4333-8333-333333333333";

test("upload laporan membersihkan lampiran tersimpan ketika lampiran berikutnya gagal", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-report-cleanup-"));
  const objectQueries = [];
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = { id: actorId, roles: ["intern"], permissions: ["daily_reports.submit"] };
  });
  const db = {
    query: async (sql, values) => {
      objectQueries.push([sql, values]);
      return { rows: [], rowCount: 1 };
    },
    transaction: async (_identity, callback) => callback({
      query: async (sql) => {
        if (sql.includes("from utero_academy.intern_profiles")) return { rows: [{ id: internId }] };
        if (sql.includes("insert into utero_academy.daily_reports")) return { rows: [{ id: reportId }] };
        throw new Error("query tidak diharapkan: " + sql);
      },
    }),
  };
  await app.register(dailyReportRoutes, { db, config: { storageRoot } });

  try {
    const response = await app.inject({ method: "POST", url: "/v1/daily-reports", payload: {
      reportDate: "2026-10-29",
      todayWork: "Menyelesaikan laporan harian",
      attachments: [
        { fileName: "laporan.pdf", dataUrl: "data:application/pdf;base64,JVBERi0xLjcKMTIz" },
        { fileName: "tidak-valid.txt", dataUrl: "data:text/plain;base64,SGVsbG8=" },
      ],
    } });

    assert.equal(response.statusCode, 415);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const files = (await readdir(storageRoot, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile());
    assert.equal(files.length, 0);
    assert.ok(objectQueries.some(([sql]) => sql.includes("deleted_at = now()")));
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
});
