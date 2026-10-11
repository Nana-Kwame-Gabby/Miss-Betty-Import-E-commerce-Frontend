/* global process */
// /sitemap.xml — every public page and every product in the shop, with product photos
// (image sitemap) so Google can index them. Generated from the database on request.
import { SITE_URL, productPath } from "../src/lib/seo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

export default async function handler(req, res) {
  try {
    const r = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/products?select=product_id,product_name,product_image_url,product_image_url_2,extra_image_urls&archived_at=is.null&order=product_id.desc`,
      { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` } },
    );
    if (!r.ok) throw new Error(`db ${r.status}`);
    const products = await r.json();

    const pages = [
      { loc: `${SITE_URL}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${SITE_URL}/shop`, changefreq: "daily", priority: "0.9" },
      { loc: `${SITE_URL}/contact`, changefreq: "monthly", priority: "0.4" },
      { loc: `${SITE_URL}/terms`, changefreq: "yearly", priority: "0.2" },
      { loc: `${SITE_URL}/privacy-policy`, changefreq: "yearly", priority: "0.2" },
    ];
    const urls = [
      ...pages.map(p => `  <url><loc>${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`),
      ...products.map(p => {
        const images = [p.product_image_url, p.product_image_url_2, ...(p.extra_image_urls ?? [])].filter(Boolean).slice(0, 10);
        return `  <url><loc>${esc(SITE_URL + productPath(p))}</loc><changefreq>weekly</changefreq><priority>0.8</priority>${
          images.map(u => `<image:image><image:loc>${esc(u)}</image:loc></image:image>`).join("")
        }</url>`;
      }),
    ];
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>
`);
  } catch (err) {
    console.error("[sitemap]", err);
    return res.status(503).send("Sitemap temporarily unavailable");
  }
}
