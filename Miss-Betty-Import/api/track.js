/* global process, Buffer */
// Receives one page view from the site's AnalyticsTracker and stores it via record_page_view.
// Privacy: the IP address and raw user agent are only read here to derive country/device/
// browser/OS labels; neither is stored.

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed|preview|python|curl|wget|httpclient|java\/|go-http|axios|node-fetch|phantom|selenium|puppeteer|playwright/i;

function deviceOf(ua, touch) {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Macintosh/i.test(ua) && touch) return "tablet"; // iPadOS reports itself as a Mac
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

function browserOf(ua) {
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook App";
  if (/Instagram/i.test(ua)) return "Instagram App";
  if (/Edg(e|A|iOS)?\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera|OPiOS/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/UCBrowser/i.test(ua)) return "UC Browser";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/Chrome|CriOS|CrMo/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Other";
}

function osOf(ua, touch) {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touch)) return "iOS";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

const SEARCH_RE = /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|ask|aol|brave)\.|googlequicksearchbox/i;
const SOCIAL_RE = /(^|\.)(facebook|fb|instagram|twitter|x|t|tiktok|linkedin|lnkd|pinterest|youtube|youtu|snapchat|reddit|telegram|whatsapp|wa|threads)\.|^t\.me$|^wa\.me$|com\.(facebook|instagram|whatsapp|twitter)/i;

// "Where did this visit come from": referrer domain (or utm_source) → a category + a host label.
function sourceOf(referrer, utm, ownHost) {
  let host = "";
  if (referrer) {
    const m = String(referrer).match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i);
    host = m ? m[1].toLowerCase().replace(/^www\./, "") : "";
  }
  if (host && ownHost && (host === ownHost || host.endsWith(".vercel.app") || host === "missbettyimport.com")) host = "";
  if (!host && utm) host = String(utm).toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 60);
  if (!host) return { source: "direct", host: null };
  if (SEARCH_RE.test(host) || /^(google|bing)$/.test(host)) return { source: "search", host };
  if (SOCIAL_RE.test(host) || /^(facebook|instagram|whatsapp|tiktok|twitter|x|telegram|youtube|snapchat)$/.test(host)) return { source: "social", host };
  return { source: "referral", host };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(204).end();
    const ua = String(req.headers["user-agent"] ?? "");
    if (!ua || BOT_RE.test(ua)) return res.status(204).end();

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    if (Buffer.isBuffer?.(body)) { try { body = JSON.parse(body.toString("utf8")); } catch { body = null; } }
    if (!body || typeof body !== "object") return res.status(204).end();

    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { v, s, p, f, r, u, t } = body;
    if (!uuid.test(v ?? "") || !uuid.test(s ?? "") || typeof p !== "string") return res.status(204).end();

    const touch = Boolean(t);
    const ownHost = String(req.headers.host ?? "").toLowerCase().replace(/^www\./, "");
    const src = f ? sourceOf(r, u, ownHost) : { source: null, host: null };

    const country = String(req.headers["x-vercel-ip-country"] ?? "").slice(0, 2) || null;
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    await fetch(`${url}/rest/v1/rpc/record_page_view`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_visitor: v,
        p_session: s,
        p_path: p.slice(0, 300),
        p_source: src.source,
        p_referrer_host: src.host,
        p_country: country,
        p_device: deviceOf(ua, touch),
        p_browser: browserOf(ua),
        p_os: osOf(ua, touch),
      }),
    });
  } catch (err) {
    console.error("[track]", err?.message ?? err);
  }
  return res.status(204).end();
}
