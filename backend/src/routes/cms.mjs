import { requireIdentity, requirePermission } from "../auth/identity.mjs";
import { parseCmsCreate, parseLandingSettings, validId } from "../cms/input.mjs";
import { nextOrder, readCmsContent } from "../cms/queries.mjs";
import { normalizeObjectPath } from "../storage/path.mjs";

const kinds = new Set(["faqs", "testimonials", "galleries", "articles"]);

async function ownedImage(client, identity, bucket, objectPath) {
  if (!objectPath) return true;
  let normalized;
  try { normalized = normalizeObjectPath(objectPath); }
  catch { return false; }
  if (normalized !== objectPath) return false;
  const result = await client.query(
    "select 1 from academy_storage.objects where bucket_id = $1 and name = $2 and owner_id = $3 and deleted_at is null and mime_type like 'image/%'",
    [bucket, normalized, identity.id],
  );
  return Boolean(result.rows[0]);
}

export async function cmsRoutes(app, { db }) {
  app.get("/v1/cms/site/default", async (_request, reply) => {
    const result = await db.apiTransaction((client) => client.query("select id, name, slug, domain, created_at, updated_at from utero_academy.cms_sites where slug = 'utero-academy'"));
    if (!result.rows[0]) return reply.code(404).send({ error: "site_not_found" });
    return { site: result.rows[0] };
  });

  app.get("/v1/cms/sites/:siteId/content", async (request, reply) => {
    if (!validId(request.params.siteId)) return reply.code(400).send({ error: "invalid_site_id" });
    const wantsDrafts = request.query?.includeDrafts === "true";
    if (wantsDrafts && !requirePermission(request, reply, ["cms.read"])) return;
    const content = wantsDrafts
      ? await db.transaction(request.identity, (client) => readCmsContent(client, request.params.siteId, false))
      : await db.apiTransaction((client) => readCmsContent(client, request.params.siteId, true));
    return content;
  });

  app.get("/v1/cms/articles", async (request, reply) => {
    const page = Number(request.query?.page || 1);
    const limit = Math.min(50, Number(request.query?.limit || 10));
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) return reply.code(400).send({ error: "invalid_pagination" });
    const offset = (page - 1) * limit;
    const result = await db.apiTransaction((client) => client.query(
      `select a.*, p.full_name as author_name from utero_academy.articles a left join utero_academy.user_profiles p on p.id = a.author_id
       where a.status = 'published' order by coalesce(a.published_at, a.created_at) desc limit $1 offset $2`, [limit, offset]));
    const count = await db.apiTransaction((client) => client.query("select count(*)::int total from utero_academy.articles where status = 'published'"));
    return { articles: result.rows, meta: { page, limit, total: count.rows[0].total } };
  });

  app.get("/v1/cms/articles/:slug", async (request, reply) => {
    const slug = String(request.params.slug || "");
    if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug)) return reply.code(400).send({ error: "invalid_slug" });
    const result = await db.apiTransaction((client) => client.query(
      `select a.*, p.full_name as author_name from utero_academy.articles a left join utero_academy.user_profiles p on p.id = a.author_id
       where a.slug = $1 and a.status = 'published'`, [slug]));
    if (!result.rows[0]) return reply.code(404).send({ error: "article_not_found" });
    return { article: result.rows[0] };
  });

  app.get("/v1/cms/landing", async () => {
    const result = await db.apiTransaction((client) => client.query("select * from utero_academy.landing_page_settings where id = '00000000-0000-0000-0000-000000000002'"));
    return { settings: result.rows[0] || null };
  });

  app.post("/v1/cms/:kind", async (request, reply) => {
    const identity = requirePermission(request, reply, ["cms.write"]);
    if (!identity || !kinds.has(request.params.kind)) return identity && reply.code(404).send({ error: "cms_kind_not_found" });
    const value = parseCmsCreate(request.params.kind, request.body);
    if (!value) return reply.code(400).send({ error: "invalid_cms_content" });
    const row = await db.transaction(identity, async (client) => {
      const image = request.params.kind === "articles" ? ["article", value.coverPath] : request.params.kind === "galleries" ? ["gallery", value.imagePath] : request.params.kind === "testimonials" ? ["gallery", value.photoPath] : null;
      if (image && !(await ownedImage(client, identity, ...image))) return null;
      if (request.params.kind === "faqs") return (await client.query("insert into utero_academy.faqs (site_id, question, answer, order_index, status) values ($1,$2,$3,$4,'published') returning *", [value.siteId, value.question, value.answer, await nextOrder(client, "faqs", value.siteId)])).rows[0];
      if (request.params.kind === "testimonials") return (await client.query("insert into utero_academy.testimonials (site_id, name, role, quote, photo_path, order_index, status) values ($1,$2,$3,$4,$5,$6,'published') returning *", [value.siteId, value.name, value.role, value.quote, value.photoPath, await nextOrder(client, "testimonials", value.siteId)])).rows[0];
      if (request.params.kind === "galleries") return (await client.query("insert into utero_academy.galleries (site_id, title, description, image_path, order_index, status) values ($1,$2,$3,$4,$5,'published') returning *", [value.siteId, value.title, value.description, value.imagePath, await nextOrder(client, "galleries", value.siteId)])).rows[0];
      return (await client.query("insert into utero_academy.articles (site_id, title, slug, excerpt, content, cover_path, status, author_id, published_at) values ($1,$2,$3,$4,$5,$6,'published',$7,now()) returning *", [value.siteId, value.title, value.slug, value.excerpt, { text: value.content }, value.coverPath, identity.id])).rows[0];
    });
    if (!row) return reply.code(400).send({ error: "invalid_image_path" });
    return reply.code(201).send({ item: row });
  });

  app.delete("/v1/cms/:kind/:id", async (request, reply) => {
    const identity = requirePermission(request, reply, ["cms.write"]);
    if (!identity || !kinds.has(request.params.kind)) return identity && reply.code(404).send({ error: "cms_kind_not_found" });
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_cms_id" });
    const result = await db.transaction(identity, (client) => client.query(`delete from utero_academy.${request.params.kind} where id = $1`, [request.params.id]));
    if (!result.rowCount) return reply.code(404).send({ error: "cms_item_not_found" });
    return reply.code(204).send();
  });

  app.patch("/v1/cms/testimonials/:id/publish", async (request, reply) => {
    const identity = requirePermission(request, reply, ["cms.write"]);
    if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_cms_id" });
    const result = await db.transaction(identity, (client) => client.query("update utero_academy.testimonials set status = 'published' where id = $1", [request.params.id]));
    if (!result.rowCount) return reply.code(404).send({ error: "cms_item_not_found" });
    return { ok: true };
  });

  app.post("/v1/cms/testimonials/intern", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const quote = typeof request.body?.quote === "string" ? request.body.quote.trim() : "";
    if (!validId(request.body?.siteId) || !quote || quote.length > 5_000) return reply.code(400).send({ error: "invalid_testimonial" });
    const created = await db.transaction(identity, async (client) => {
      const profile = await client.query("select id, full_name, status, major from utero_academy.intern_profiles where user_id = $1", [identity.id]);
      if (profile.rows[0]?.status !== "completed") return null;
      const item = profile.rows[0];
      return (await client.query("insert into utero_academy.testimonials (site_id, name, role, quote, photo_path, order_index, status, intern_id) values ($1,$2,$3,$4,$5,$6,'draft',$7) returning *", [request.body.siteId, item.full_name, `Alumni Magang - ${item.major || "Utero Academy"}`, quote, request.body.photoPath || null, await nextOrder(client, "testimonials", request.body.siteId), item.id])).rows[0];
    });
    if (!created) return reply.code(403).send({ error: "internship_not_completed" });
    return reply.code(201).send({ item: created });
  });

  app.put("/v1/cms/landing", async (request, reply) => {
    const identity = requirePermission(request, reply, ["cms.write"]);
    if (!identity) return;
    const value = parseLandingSettings(request.body);
    if (!value) return reply.code(400).send({ error: "invalid_landing_settings" });
    if (value.heroImagePath) {
      const valid = await db.apiTransaction((client) => ownedImage(client, identity, "gallery", value.heroImagePath));
      if (!valid) return reply.code(400).send({ error: "invalid_image_path" });
    }
    await db.transaction(identity, (client) => client.query(
      `insert into utero_academy.landing_page_settings (id, hero_title, hero_description, hero_image_path, skills, expertisers, about_text, contact_email, contact_phone, contact_address, terms_content, partnerships)
       values ('00000000-0000-0000-0000-000000000002',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set hero_title=excluded.hero_title, hero_description=excluded.hero_description, hero_image_path=excluded.hero_image_path, skills=excluded.skills, expertisers=excluded.expertisers, about_text=excluded.about_text, contact_email=excluded.contact_email, contact_phone=excluded.contact_phone, contact_address=excluded.contact_address, terms_content=excluded.terms_content, partnerships=excluded.partnerships, updated_at=now()`,
      [value.heroTitle, value.heroDescription, value.heroImagePath, value.skills, value.expertisers, value.aboutText, value.contactEmail, value.contactPhone, value.contactAddress, value.termsContent, value.partnerships]));
    return { ok: true };
  });
}
