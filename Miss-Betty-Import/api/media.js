/* global process, Buffer */
// Product media on Cloudflare R2. Admin-only (verified against Supabase on every call).
//
//  sign     → short-lived upload links; the browser PUTs files straight to R2. The type,
//             exact size and cache header are part of the signature, so R2 rejects anything
//             else. (Uploading directly also avoids Vercel's 4.5 MB request-body limit.)
//  delete   → remove files we host (only URLs under R2_PUBLIC_URL).
//  migrate  → copy existing Supabase Storage product media to R2 and repoint products.
//  cleanup  → delete the old Supabase copies of media that has been moved.
//  sweep    → delete R2 files no product references (older than 24 h); dry run by default.
import { AwsClient } from "aws4fetch";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
const BUCKET = process.env.R2_BUCKET;
const ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}`;
const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  service: "s3",
  region: "auto",
});

const CACHE = "public, max-age=31536000, immutable";
const MB = 1024 * 1024;
const RULES = {
  image:  { folder: "products", max: 10 * MB,  types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } },
  video:  { folder: "videos",   max: 200 * MB, types: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } },
  poster: { folder: "posters",  max: 2 * MB,   types: { "image/jpeg": "jpg", "image/webp": "webp" } },
};
const SUPABASE_MEDIA = /\/storage\/v1\/object\/public\/(product-images|product-videos)\/(.+)$/;
const MEDIA_COLUMNS = "product_id,product_image_url,product_image_url_2,variant_images,extra_image_urls,product_videos";

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function requireAdmin(req) {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Please log in as an admin.");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  const user = res.ok ? await res.json() : null;
  if (user?.app_metadata?.role !== "admin") throw new HttpError(403, "Only admins can manage product media.");
  return token;
}

// Supabase REST as the logged-in admin, so the usual admin-only RLS applies.
async function db(token, path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Database ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

const keyFromUrl = (url) =>
  typeof url === "string" && PUBLIC_URL && url.startsWith(`${PUBLIC_URL}/`) ? decodeURIComponent(url.slice(PUBLIC_URL.length + 1)) : null;
const objectUrl = (key) => `${ENDPOINT}/${key.split("/").map(encodeURIComponent).join("/")}`;
const publicUrlFor = (key) => `${PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;

// Every media URL a product references (main, image 2, extras, colour/size photos, videos, posters).
function productUrls(p) {
  const urls = [p.product_image_url, p.product_image_url_2, ...(p.extra_image_urls ?? [])];
  for (const group of ["colours", "sizes", "combos"]) urls.push(...Object.values(p.variant_images?.[group] ?? {}));
  for (const v of p.product_videos ?? []) urls.push(v?.url, v?.poster_url);
  return urls.filter(u => typeof u === "string" && u);
}

// ── sign ─────────────────────────────────────────────────────────────────────────
async function sign(body) {
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length || files.length > 20) throw new HttpError(400, "Send between 1 and 20 files.");
  const month = new Date().toISOString().slice(0, 7).replace("-", "/");
  return Promise.all(files.map(async (f) => {
    const rule = RULES[f.kind];
    const ext = rule?.types[f.type];
    const size = Number(f.size);
    if (!rule || !ext) throw new HttpError(400, `This file type isn't allowed (${f.type || "unknown"}).`);
    if (!Number.isInteger(size) || size <= 0 || size > rule.max) {
      throw new HttpError(400, `File too large: the limit is ${rule.max / MB} MB for ${f.kind}s.`);
    }
    const key = `${rule.folder}/${month}/${randomUUID()}.${ext}`;
    const headers = { "content-type": f.type, "content-length": String(size), "cache-control": CACHE };
    const signed = await r2.sign(new Request(`${objectUrl(key)}?X-Amz-Expires=300`, { method: "PUT", headers }), {
      aws: { signQuery: true, allHeaders: true },
    });
    return { uploadUrl: signed.url, publicUrl: publicUrlFor(key), headers: { "Content-Type": f.type, "Cache-Control": CACHE } };
  }));
}

// ── delete ───────────────────────────────────────────────────────────────────────
async function remove(body) {
  const keys = [...new Set((Array.isArray(body.urls) ? body.urls : []).map(keyFromUrl).filter(Boolean))].slice(0, 100);
  const results = await Promise.all(keys.map(async (key) => {
    const res = await r2.fetch(objectUrl(key), { method: "DELETE" });
    return { key, ok: res.ok || res.status === 404 };
  }));
  return { deleted: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).map(r => r.key) };
}

// ── migrate: Supabase Storage → R2, a batch of products per call ───────────────────
// Each file gets a fixed key (migrated/<bucket>/<path>), so re-running is safe.
async function copyToR2(url) {
  const m = url.match(SUPABASE_MEDIA);
  if (!m) return url;
  const key = `migrated/${m[1]}/${decodeURIComponent(m[2])}`;
  const head = await r2.fetch(objectUrl(key), { method: "HEAD" });
  if (!head.ok) {
    const src = await fetch(url);
    if (!src.ok) throw new Error(`download failed (${src.status})`);
    const buf = Buffer.from(await src.arrayBuffer());
    const put = await r2.fetch(objectUrl(key), {
      method: "PUT",
      body: buf,
      headers: { "content-type": src.headers.get("content-type") ?? "application/octet-stream", "cache-control": CACHE },
    });
    if (!put.ok) throw new Error(`upload failed (${put.status})`);
  }
  return publicUrlFor(key);
}

async function migrate(token, body) {
  const batch = Math.min(Math.max(Number(body.batch) || 8, 1), 20);
  const products = await db(token, `products?select=${MEDIA_COLUMNS}&order=product_id`);
  const pending = products.filter(p => productUrls(p).some(u => SUPABASE_MEDIA.test(u)));
  const errors = [];
  let moved = 0;
  for (const p of pending.slice(0, batch)) {
    try {
      const map = {};
      for (const u of productUrls(p)) if (SUPABASE_MEDIA.test(u) && !map[u]) map[u] = await copyToR2(u);
      const swap = (u) => (typeof u === "string" && map[u]) || u;
      const variant = p.variant_images
        ? Object.fromEntries(Object.entries(p.variant_images).map(([g, v]) =>
            [g, v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, u]) => [k, swap(u)])) : v]))
        : p.variant_images;
      await db(token, `products?product_id=eq.${p.product_id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          product_image_url: swap(p.product_image_url),
          product_image_url_2: swap(p.product_image_url_2),
          variant_images: variant,
          extra_image_urls: (p.extra_image_urls ?? []).map(swap),
          product_videos: (p.product_videos ?? []).map(v => ({ ...v, url: swap(v.url), poster_url: swap(v.poster_url) })),
        }),
      });
      moved++;
    } catch (err) {
      errors.push({ product_id: p.product_id, error: String(err.message ?? err).slice(0, 200) });
    }
  }
  return { moved, remaining: pending.length - moved, total: products.length, errors };
}

// ── listing R2 (for cleanup and sweep) ──────────────────────────────────────────────
async function listObjects(prefix = "") {
  const out = [];
  let token = "";
  do {
    const qs = new URLSearchParams({ "list-type": "2", "max-keys": "1000", ...(prefix ? { prefix } : {}), ...(token ? { "continuation-token": token } : {}) });
    const res = await r2.fetch(`${ENDPOINT}?${qs}`);
    if (!res.ok) throw new Error(`R2 list failed (${res.status})`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = m[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1]?.replace(/&amp;/g, "&");
      const modified = m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1];
      if (key) out.push({ key, modified: modified ? Date.parse(modified) : 0 });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? "") : "";
  } while (token);
  return out;
}

// ── cleanup: delete old Supabase copies once no product uses them ──────────────────
async function cleanup(token, body) {
  const products = await db(token, `products?select=${MEDIA_COLUMNS}`);
  const stillUsed = new Set(products.flatMap(productUrls).map(u => u.match(SUPABASE_MEDIA)).filter(Boolean).map(m => `${m[1]}/${decodeURIComponent(m[2])}`));
  const moved = (await listObjects("migrated/")).map(o => o.key.slice("migrated/".length)).filter(k => !stillUsed.has(k));
  if (body.dryRun !== false) return { dryRun: true, deletable: moved.length };
  let deleted = 0;
  const errors = [];
  for (const bucket of ["product-images", "product-videos"]) {
    const paths = moved.filter(k => k.startsWith(`${bucket}/`)).map(k => k.slice(bucket.length + 1));
    for (let i = 0; i < paths.length; i += 100) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }),
      });
      if (res.ok) deleted += (await res.json()).length ?? 0;
      else errors.push(`${bucket}: ${res.status} ${(await res.text()).slice(0, 150)}`);
    }
  }
  return { dryRun: false, deleted, errors };
}

// ── sweep: R2 files that no product references ─────────────────────────────────────
async function sweep(token, body) {
  const products = await db(token, `products?select=${MEDIA_COLUMNS}`);
  const used = new Set(products.flatMap(productUrls).map(keyFromUrl).filter(Boolean));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const orphans = (await listObjects()).filter(o => !used.has(o.key) && o.modified < cutoff);
  if (body.dryRun !== false) return { dryRun: true, orphans: orphans.length, sample: orphans.slice(0, 10).map(o => o.key) };
  let deleted = 0;
  for (const o of orphans) {
    const res = await r2.fetch(objectUrl(o.key), { method: "DELETE" });
    if (res.ok || res.status === 404) deleted++;
  }
  return { dryRun: false, deleted, orphans: orphans.length };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    if (!process.env.R2_ACCOUNT_ID || !BUCKET || !PUBLIC_URL || !process.env.R2_ACCESS_KEY_ID) {
      throw new HttpError(503, "Cloudflare R2 isn't configured yet (missing R2_* settings on Vercel).");
    }
    const token = await requireAdmin(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    const actions = {
      sign: () => sign(body),
      delete: () => remove(body),
      migrate: () => migrate(token, body),
      cleanup: () => cleanup(token, body),
      sweep: () => sweep(token, body),
    };
    const run = actions[body.action];
    if (!run) throw new HttpError(400, "Unknown action");
    return res.status(200).json(await run());
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error("[media]", err);
    return res.status(status).json({ error: err.message ?? String(err) });
  }
}
