import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { assessmentsRoutes } from "../routes/assessments.mjs";
import { certificatesRoutes } from "../routes/certificates.mjs";
import { parseAssessment, validId } from "./input.mjs";

test("assessment input rejects invalid score, payload, and identifier", () => {
  assert.equal(validId("../../admin"), false);
  assert.equal(parseAssessment({ submitType: "finalize", score: {}, finalScore: null }), null);
  assert.equal(parseAssessment({ submitType: "finalize", score: {}, finalScore: 101 }), null);
  assert.equal(parseAssessment({ submitType: "draft", score: { technical: 80 }, finalScore: 80 })?.finalScore, 80);
});

test("assessment and certificate routes reject unauthenticated access", async () => {
  const app = Fastify();
  const db = { transaction() { throw new Error("Unauthorized request reached database"); } };
  await app.register(assessmentsRoutes, { db });
  await app.register(certificatesRoutes, { db });
  for (const [method, url] of [
    ["GET", "/v1/assessments/interns"],
    ["GET", "/v1/assessments/settings"],
    ["PUT", "/v1/assessments/00000000-0000-4000-8000-000000000001"],
    ["GET", "/v1/certificates/00000000-0000-4000-8000-000000000001"],
    ["GET", "/v1/certificates/00000000-0000-4000-8000-000000000001/context"],
  ]) {
    const response = await app.inject({ method, url, payload: method === "PUT" ? { submitType: "draft", finalScore: 80, score: {} } : undefined });
    assert.equal(response.statusCode, 401, `${method} ${url}`);
  }
  await app.close();
});
