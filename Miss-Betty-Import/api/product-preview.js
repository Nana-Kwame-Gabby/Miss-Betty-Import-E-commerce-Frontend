import { createClient } from "@supabase/supabase-js";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default async function handler(req, res) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const id = req.query.id;

  const { data: product } = await supabase
    .from("products")
    .select("product_name, product_image_url, description")
    .eq("product_id", id)
    .single();

  const title = product?.product_name ?? "Miss Betty Import";
  const image = product?.product_image_url ?? "https://www.missbettyimport.com/logo.png";
  const description = product?.description || "Shop quality imported products on Miss Betty Import.";
  const url = `https://www.missbettyimport.com/product/${id}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
  res.status(200).send(`<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="product" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head><body><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></body></html>`);
}
