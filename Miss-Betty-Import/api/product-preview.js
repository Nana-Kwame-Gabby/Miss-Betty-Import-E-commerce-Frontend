import { createClient } from "@supabase/supabase-js";
import { getEffectivePrice, hasDiscount } from "../src/lib/priceUtils.js";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mirrors mapProduct() on the Shop/Home pages: size-priced products use the
// lowest size discount, others use the product-level discount.
function priceLine(p) {
  const sizes = Array.isArray(p.size_pricing) && p.size_pricing.length > 0 ? p.size_pricing : null;
  const sizeDiscounts = (sizes ?? []).filter(r => r.discount_price != null).map(r => Number(r.discount_price));
  const priced = {
    unit_price: Number(p.unit_price ?? 0),
    discount_price: sizes
      ? (sizeDiscounts.length ? Math.min(...sizeDiscounts) : null)
      : (p.discount_price != null ? Number(p.discount_price) : null),
  };
  const current = `${sizes ? "From " : ""}GHS ${getEffectivePrice(priced).toLocaleString()}`;
  return hasDiscount(priced)
    ? `${current} (was GHS ${priced.unit_price.toLocaleString()}) – SALE`
    : current;
}

export default async function handler(req, res) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const id = req.query.id;

  const { data: product } = await supabase
    .from("products")
    .select("product_name, product_image_url, description, unit_price, discount_price, size_pricing")
    .eq("product_id", id)
    .single();

  const title = product?.product_name ?? "Miss Betty Import";
  const image = product?.product_image_url ?? "https://www.missbettyimport.com/logo.png";
  const baseDescription = product?.description || "Shop quality imported products on Miss Betty Import.";
  const description = product ? `${priceLine(product)} · ${baseDescription}` : baseDescription;
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
