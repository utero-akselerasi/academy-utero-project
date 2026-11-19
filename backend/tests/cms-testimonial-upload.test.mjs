import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { cmsRoutes } from "../src/routes/cms.mjs";

const siteId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const internId = "33333333-3333-4333-8333-333333333333";
const photoPath = "testimonial/44444444-4444-4444-8444-444444444444.png";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function multipartPayload(bytes, mime = "image/png") {
  const form = new FormData();
  form.set("siteId", siteId);
  form.set("quote", "Program ini membantu saya berkembang.");
  form.set("photo", new File([bytes], "alumni.png", { type: mime }));
  const request = new Request("http://localhost", { method: "POST", body: form });
  return {
    payload: Buffer.from(await request.arrayBuffer()),
    contentType: request.headers.get("content-type"),
  };
}

async function fixture(storageRoot, query) {
  const app = Fastify();
  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = { id: userId, roles: ["intern"], permissions: [] };
  });
  await app.register(multipart, { throwFileSizeLimit: true });
  const client = { query };
  await app.register(cmsRoutes, {
    storageRoot,
    db: {
      apiTransaction: async (callback) => callback(client),
      transaction: async (_identity, callback) => callback(client),
    },
  });
  return app;
}

test("testimoni peserta lokal menyimpan foto tervalidasi dan object path", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-cms-"));
  const calls = [];
  const app = await fixture(storageRoot, async (statement, values) => {
    calls.push({ statement, values });
    if (statement.includes("from utero_academy.intern_profiles")) {
      return { rows: [{ id: internId, full_name: "Sari", status: "completed", major: "RPL" }], rowCount: 1 };
    }
    if (statement.includes("coalesce(max(order_index)")) return { rows: [{ value: 2 }], rowCount: 1 };
    if (statement.includes("insert into utero_academy.testimonials")) return { rows: [{ id: "55555555-5555-4555-8555-555555555555", photo_path: values[4] }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });

  try {
    const body = await multipartPayload(png);
    const response = await app.inject({
      method: "POST",
      url: "/v1/cms/testimonials/intern",
      headers: { "content-type": body.contentType, "x-object-path": photoPath },
      payload: body.payload,
    });
    assert.equal(response.statusCode, 201, response.body);
    assert.equal(response.json().item.photo_path, photoPath);
    await access(path.join(storageRoot, "gallery", ...photoPath.split("/")));
    const storageInsert = calls.find(({ statement }) => statement.includes("insert into academy_storage.objects"));
    const testimonialInsert = calls.find(({ statement }) => statement.includes("insert into utero_academy.testimonials"));
    assert.deepEqual(storageInsert.values.slice(0, 2), [photoPath, userId]);
    assert.equal(storageInsert.values[3], "image/png");
    assert.equal(testimonialInsert.values[4], photoPath);
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
});

test("testimoni peserta lokal menolak berkas yang menyamar sebagai gambar", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-cms-"));
  let queryCount = 0;
  const app = await fixture(storageRoot, async () => {
    queryCount += 1;
    return { rows: [], rowCount: 0 };
  });

  try {
    const body = await multipartPayload(Buffer.from("bukan gambar"));
    const response = await app.inject({
      method: "POST",
      url: "/v1/cms/testimonials/intern",
      headers: { "content-type": body.contentType, "x-object-path": photoPath },
      payload: body.payload,
    });
    assert.equal(response.statusCode, 415, response.body);
    assert.equal(response.json().error, "unsupported_media_type");
    assert.equal(queryCount, 0);
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
});
