/* global process */
// Server-rendered SEO for the main public pages: /, /shop, /shop/:id-slug (and old /product/:id).
// Serves the built index.html with page-specific <title>, description, canonical, Open Graph,
// JSON-LD structured data and a light HTML snapshot inside #root (React replaces it on load).
// Everyone — people and search engines — gets the same HTML.
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, metaDescription, productPath } from "../src/lib/seo.js";
import { thumbUrl } from "../src/lib/imageUrl.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const LOGO = `${SITE_URL}/icon-512.png`;
const WHATSAPP = "+233202697541";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ldJson = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
const money = (n) => `GHS ${Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

let template = null;
async function getTemplate(req) {
  if (template) return template;
  const res = await fetch(`https://${req.headers.host}/app.html`, { headers: { "x-seo-template": "1" } });
  if (!res.ok) throw new Error(`template ${res.status}`);
  template = await res.text();
  return template;
}

async function db(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  if (!res.ok) throw new Error(`db ${res.status}`);
  return res.json();
}

// Current selling price, same rules as the storefront (size pricing → lowest size price).
function pricing(p) {
  const sp = Array.isArray(p.size_pricing) && p.size_pricing.length ? p.size_pricing : null;
  const unit = Number(p.unit_price ?? 0);
  if (sp) {
    const prices = sp.map(r => Number(r.discount_price ?? r.selling_price ?? 0)).filter(n => n > 0);
    const regular = sp.map(r => Number(r.selling_price ?? 0)).filter(n => n > 0);
    return { price: prices.length ? Math.min(...prices) : unit, regular: regular.length ? Math.min(...regular) : unit, from: true };
  }
  const disc = p.discount_price != null ? Number(p.discount_price) : null;
  const onSale = disc != null && disc > 0 && disc < unit;
  return { price: onSale ? disc : unit, regular: unit, from: false };
}

function availability(p) {
  const status = p.product_status?.status_name ?? "Available";
  if (!/^available$/i.test(status)) return { schema: "https://schema.org/PreOrder", label: "Pre-order" };
  const stock = p.product_variant_stock ?? [];
  if (stock.length && !stock.some(r => r.stock_quantity > 0)) return { schema: "https://schema.org/OutOfStock", label: "Out of stock" };
  return { schema: "https://schema.org/InStock", label: "In stock in Ghana" };
}

const organization = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: LOGO,
  contactPoint: [{ "@type": "ContactPoint", telephone: WHATSAPP, contactType: "customer service", areaServed: "GH", availableLanguage: ["en"] }],
  sameAs: ["https://wa.me/233202697541"],
};

function render(tpl, { title, description, canonical, image, type = "website", jsonLd = [], content = "", noindex = false }) {
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    noindex ? `<meta name="robots" content="noindex, follow" />` : `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : "",
    `<meta property="og:image" content="${esc(image || LOGO)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image || LOGO)}" />`,
    ...jsonLd.map(ldJson),
  ].filter(Boolean).join("\n    ");
  return tpl
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, head)
    .replace("<!--seo:content-->", content);
}

// A simple, styled first view (replaced by the app as soon as it starts).
const shell = (inner) => `<div class="min-h-screen bg-gray-50"><div class="max-w-7xl mx-auto px-3 sm:px-6 py-4">${inner}</div></div>`;
const productLinks = (products) => `<ul class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">${products.map(p => {
  const { price, from } = pricing(p);
  return `<li class="bg-white rounded-2xl shadow-sm p-3"><a href="${productPath(p)}" class="text-sm font-semibold text-[#1e2d3d]">${esc(p.product_name)}</a><p class="text-sm font-bold text-[#DC2626]">${from ? "From " : ""}${money(price)}</p></li>`;
}).join("")}</ul>`;

const LIST_COLUMNS = "product_id,product_name,unit_price,discount_price,size_pricing";

async function homePage(tpl) {
  const products = await db(`products?select=${LIST_COLUMNS}&archived_at=is.null&order=product_id.desc&limit=24`);
  return {
    status: 200,
    html: render(tpl, {
      title: `${SITE_NAME} | Quality Imported Products in Ghana`,
      description: DEFAULT_DESCRIPTION,
      canonical: `${SITE_URL}/`,
      jsonLd: [{ "@context": "https://schema.org", "@graph": [organization, { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: `${SITE_URL}/`, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en-GH" }] }],
      content: shell(`<h1 class="text-xl font-bold text-[#1e2d3d]">Miss Betty Import: quality imported products in Ghana</h1>
<p class="text-sm text-gray-500 mt-1">Buy in-stock goods or pre-order from China. Pay securely with Mobile Money or card, with delivery across Ghana.</p>
<h2 class="text-base font-bold text-[#1e2d3d] mt-5">New arrivals</h2>${productLinks(products)}
<p class="mt-4"><a href="/shop" class="text-[#F2AA25] font-semibold">Browse the full shop →</a></p>`),
    }),
  };
}

async function shopPage(tpl) {
  const products = await db(`products?select=${LIST_COLUMNS},category(category_name)&archived_at=is.null&order=product_id.desc`);
  const cats = [...new Set(products.map(p => p.category?.category_name).filter(Boolean))].sort();
  return {
    status: 200,
    html: render(tpl, {
      title: `Shop Imported Products in Ghana | ${SITE_NAME}`,
      description: "Browse kitchen appliances, sneakers, bags, fashion, home and baby products. Buy in-stock items or pre-order from China, with delivery across Ghana.",
      canonical: `${SITE_URL}/shop`,
      jsonLd: [{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Shop",
        url: `${SITE_URL}/shop`,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.slice(0, 60).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + productPath(p), name: p.product_name })),
        },
      }],
      content: shell(`<h1 class="text-xl font-bold text-[#1e2d3d]">Shop imported products in Ghana</h1>
<p class="text-sm text-gray-500 mt-1">${products.length} products${cats.length ? ` in ${cats.map(esc).join(", ")}` : ""}. Newest first.</p>${productLinks(products.slice(0, 60))}`),
    }),
  };
}

async function productPage(tpl, idParam) {
  const id = parseInt(idParam, 10);
  const rows = Number.isFinite(id)
    ? await db(`products?select=product_id,product_name,description,unit_price,discount_price,size_pricing,product_image_url,product_image_url_2,extra_image_urls,archived_at,category(category_name),product_status(status_name),product_variant_stock(stock_quantity)&product_id=eq.${id}`)
    : [];
  const p = rows[0];
  if (!p || p.archived_at) {
    return {
      status: 404,
      html: render(tpl, {
        title: `Product not available | ${SITE_NAME}`,
        description: "This product is no longer available. Browse other imported products on Miss Betty Import.",
        noindex: true,
        content: shell(`<h1 class="text-xl font-bold text-[#1e2d3d]">This product is no longer available</h1><p class="mt-3"><a href="/shop" class="text-[#F2AA25] font-semibold">Browse the shop →</a></p>`),
      }),
    };
  }

  const path = productPath(p);
  const canonical = SITE_URL + path;
  const reviews = await db(`reviews?select=rating,comment,reviewer_name,created_at&product_id=eq.${id}&order=created_at.desc&limit=20`).catch(() => []);
  const { price, regular, from } = pricing(p);
  const avail = availability(p);
  const category = p.category?.category_name ?? null;
  const images = [p.product_image_url, p.product_image_url_2, ...(p.extra_image_urls ?? [])].filter(Boolean);
  const description = metaDescription(p.description,
    `Buy ${p.product_name} from ${SITE_NAME}${category ? ` (${category})` : ""}. ${avail.label === "Pre-order" ? "Pre-order from China" : "In stock in Ghana"}, with delivery across Ghana.`);

  const product = {
    "@type": "Product",
    "@id": `${canonical}#product`,
    name: p.product_name,
    sku: String(p.product_id),
    url: canonical,
    ...(images.length ? { image: images } : {}),
    description: metaDescription(p.description, description, 5000),
    ...(category ? { category } : {}),
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "GHS",
      price: price.toFixed(2),
      availability: avail.schema,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${SITE_URL}/#organization` },
    },
  };
  const rated = reviews.filter(r => r.rating >= 1 && r.rating <= 5);
  if (rated.length) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1),
      reviewCount: rated.length,
      bestRating: 5,
      worstRating: 1,
    };
    product.review = rated.slice(0, 5).map(r => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.reviewer_name || "Customer" },
      datePublished: String(r.created_at).slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.comment ? { reviewBody: r.comment } : {}),
    }));
  }
  const crumbs = [
    { name: "Home", url: `${SITE_URL}/` },
    { name: "Shop", url: `${SITE_URL}/shop` },
    { name: p.product_name, url: canonical },
  ];

  const priceHtml = `<p class="text-2xl font-bold text-[#DC2626] mt-2">${from ? "From " : ""}${money(price)}${regular > price ? ` <span class="text-base text-gray-400 line-through font-normal">${money(regular)}</span>` : ""}</p>`;
  return {
    status: 200,
    path,
    html: render(tpl, {
      title: `${p.product_name} | ${SITE_NAME}`,
      description,
      canonical,
      image: images[0],
      type: "product",
      jsonLd: [{
        "@context": "https://schema.org",
        "@graph": [
          product,
          { "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })) },
          organization,
        ],
      }],
      content: shell(`<nav class="text-xs text-gray-400 mb-3"><a href="/">Home</a> / <a href="/shop">Shop</a>${category ? ` / ${esc(category)}` : ""}</nav>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
${images[0] ? `<img src="${esc(thumbUrl(images[0], 1000))}" fetchpriority="high" alt="${esc(p.product_name)}" class="w-full h-64 sm:h-80 object-cover rounded-2xl bg-white" />` : ""}
<div><h1 class="text-xl sm:text-2xl font-bold text-[#1e2d3d]">${esc(p.product_name)}</h1>${priceHtml}
<p class="text-sm text-gray-500 mt-1">${esc(avail.label)}${category ? ` · ${esc(category)}` : ""}</p>
${p.description ? `<p class="text-sm text-gray-600 mt-3 whitespace-pre-line">${esc(p.description)}</p>` : ""}</div></div>`),
    }),
  };
}

export default async function handler(req, res) {
  const route = String(req.query.route ?? "home");
  try {
    const tpl = await getTemplate(req);
    let out;
    if (route === "product") {
      out = await productPage(tpl, String(req.query.slug ?? ""));
      // One URL per product: old /shop/686, /product/686 and outdated slugs 301 to the canonical path.
      const requested = String(req.query.legacy ? "" : `/shop/${req.query.slug ?? ""}`);
      if (out.status === 200 && requested !== out.path) {
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
        return res.redirect(301, out.path);
      }
    } else if (route === "shop") {
      out = await shopPage(tpl);
    } else {
      out = await homePage(tpl);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
    return res.status(out.status).send(out.html);
  } catch (err) {
    console.error("[seo]", err);
    // Never break the site: fall back to the plain app shell.
    try {
      const tpl = await getTemplate(req);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(tpl.replace("<!--seo:content-->", ""));
    } catch {
      return res.status(500).send("Temporarily unavailable");
    }
  }
}

