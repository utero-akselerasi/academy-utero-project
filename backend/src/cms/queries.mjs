export async function readCmsContent(client, siteId, publishedOnly) {
  const status = publishedOnly ? " and status = 'published'" : "";
  const [faqs, testimonials, galleries, articles] = await Promise.all([
    client.query(`select * from utero_academy.faqs where site_id = $1${status} order by order_index`, [siteId]),
    client.query(`select * from utero_academy.testimonials where site_id = $1${status} order by order_index`, [siteId]),
    client.query(`select * from utero_academy.galleries where site_id = $1${status} order by order_index`, [siteId]),
    client.query(`select id, site_id, category_id, title, slug, excerpt, content, cover_path, status, author_id, published_at, created_at, updated_at from utero_academy.articles where site_id = $1${status} order by created_at desc`, [siteId]),
  ]);
  return { faqs: faqs.rows, testimonials: testimonials.rows, galleries: galleries.rows, articles: articles.rows };
}

export async function nextOrder(client, table, siteId) {
  const result = await client.query(`select coalesce(max(order_index), -1) + 1 as value from utero_academy.${table} where site_id = $1`, [siteId]);
  return result.rows[0].value;
}
