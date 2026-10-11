// SEO helpers shared by the app and (by copy) the server-side page renderer api/seo.js.

export const SITE_URL = "https://www.missbettyimport.com";
export const SITE_NAME = "Miss Betty Import";
export const DEFAULT_DESCRIPTION =
  "Shop quality imported products in Ghana: kitchen appliances, sneakers, bags, fashion, home and baby items. " +
  "Buy in-stock goods or pre-order from China, pay securely with Mobile Money or card, with delivery across Ghana.";

// "Rechargeable Fan (2 pack)!" -> "rechargeable-fan-2-pack"
export function slugify(text) {
  return String(text ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
}

// Canonical product URL path: /shop/686-rechargeable-fan (old /shop/686 links still work).
export function productPath(product) {
  const id = product.id ?? product.product_id;
  const slug = slugify(product.product_name ?? product.name);
  return slug ? `/shop/${id}-${slug}` : `/shop/${id}`;
}

// Short, clean meta description from free text.
export function metaDescription(text, fallback = DEFAULT_DESCRIPTION, max = 158) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length <= max ? clean : clean.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}
