import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// Website Visitors: first-party, privacy-friendly analytics (see components/AnalyticsTracker
// and api/track.js). All counting happens in get_site_analytics; this page only displays it.

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "custom", label: "Custom" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const toInputDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromInputDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

// [from, to) for a preset; "to" is the start of tomorrow so today is always included.
function rangeFor(preset, custom) {
  const tomorrow = new Date(startOfDay(new Date()).getTime() + DAY_MS);
  if (preset === "today") return { from: startOfDay(new Date()), to: tomorrow };
  if (preset === "7d") return { from: new Date(tomorrow.getTime() - 7 * DAY_MS), to: tomorrow };
  if (preset === "30d") return { from: new Date(tomorrow.getTime() - 30 * DAY_MS), to: tomorrow };
  const from = fromInputDate(custom.from);
  const to = new Date(fromInputDate(custom.to).getTime() + DAY_MS);
  return { from, to };
}

async function fetchAnalytics(from, to) {
  const { data, error } = await supabase.rpc("get_site_analytics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return data;
}

const nf = new Intl.NumberFormat("en-GB");
const fmt = (n) => nf.format(Number(n ?? 0));

const PAGE_NAMES = {
  "/": "Home", "/shop": "Shop", "/cart": "Cart", "/checkout": "Checkout",
  "/order-confirmation": "Order Confirmation", "/my-orders": "My Orders",
  "/my-referrals": "My Referrals", "/shipping-fees": "Shipping Fees",
  "/product-requests": "Product Requests", "/login": "Log In", "/signup": "Sign Up",
  "/forgot-password": "Forgot Password", "/reset-password": "Reset Password",
  "/contact": "Contact", "/terms": "Terms & Conditions", "/privacy-policy": "Privacy Policy",
};
function pageName(p) {
  if (PAGE_NAMES[p.path]) return PAGE_NAMES[p.path];
  const m = p.path.match(/^\/shop\/(\d+)$/);
  if (m) return p.product_name ?? `Product #${m[1]}`;
  return p.path;
}

const SOURCE_NAMES = { direct: "Direct / typed in", search: "Search engines", social: "Social media", referral: "Other websites" };
const DEVICE_NAMES = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };

let regionNames = null;
try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* old browser */ }
function countryName(code) {
  if (!code || code === "??") return "Unknown";
  const flag = String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
  let name = code;
  try { name = regionNames?.of(code) ?? code; } catch { /* unknown code */ }
  return `${flag} ${name}`;
}

function Change({ now, before }) {
  if (!before) return <span className="text-xs text-gray-400">no earlier data</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% <span className="font-normal text-gray-400">vs previous</span>
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? "text-[#1e2d3d]"}`}>{value}</p>
      <div className="mt-1 min-h-4">{sub}</div>
    </div>
  );
}

function bucketLabel(t, bucket) {
  const [date, time] = t.split("T");
  if (bucket === "hour") return time;
  const d = fromInputDate(date);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Visitors as bars, page views as a line. Tap/hover a column for its numbers.
function TrendChart({ series, bucket }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 200, padL = 32, padB = 22, padT = 10;
  const n = series.length;
  const max = Math.max(1, ...series.map(s => Math.max(s.views, s.visitors)));
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const colW = (W - padL) / Math.max(n, 1);
  const y = (v) => padT + (H - padT - padB) * (1 - v / niceMax);
  const x = (i) => padL + colW * i + colW / 2;
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const line = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.views).toFixed(1)}`).join(" ");
  const shown = hover != null ? series[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-h-5">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#F2AA25]" /> Visitors</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#1e2d3d]" /> Page views</span>
        </div>
        {shown && (
          <p className="text-xs text-[#1e2d3d]">
            <span className="font-semibold">{bucketLabel(shown.t, bucket)}</span>
            {" · "}{fmt(shown.visitors)} visitors · {fmt(shown.sessions)} visits · {fmt(shown.views)} page views
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Visitors and page views over time" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={padL} x2={W} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="#eef0f3" />
            <text x={padL - 6} y={y(niceMax * f) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{fmt(Math.round(niceMax * f))}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const bw = Math.max(2, Math.min(28, colW * 0.6));
          return (
            <g key={s.t}>
              {hover === i && <rect x={padL + colW * i} y={padT} width={colW} height={H - padT - padB} fill="#f8fafc" />}
              <rect x={x(i) - bw / 2} y={y(s.visitors)} width={bw} height={Math.max(0, H - padB - y(s.visitors))} rx="2" fill="#F2AA25" />
              {i % labelEvery === 0 && (
                <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">{bucketLabel(s.t, bucket)}</text>
              )}
            </g>
          );
        })}
        <path d={line} fill="none" stroke="#1e2d3d" strokeWidth="2" strokeLinejoin="round" />
        {n <= 40 && series.map((s, i) => <circle key={s.t} cx={x(i)} cy={y(s.views)} r="2.5" fill="#1e2d3d" />)}
        {series.map((s, i) => (
          <rect key={s.t} x={padL + colW * i} y={0} width={colW} height={H} fill="transparent"
            onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
    </div>
  );
}

function BarList({ title, note, items, labelOf, empty = "No data yet" }) {
  const total = items.reduce((s, i) => s + Number(i.count), 0);
  const max = Math.max(1, ...items.map(i => Number(i.count)));
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-[#1e2d3d]">{title}</h2>
        {note && <span className="text-[11px] text-gray-400">{note}</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(i => (
            <li key={i.label}>
              <div className="flex items-center justify-between gap-3 text-sm mb-1">
                <span className="truncate text-gray-700">{labelOf ? labelOf(i.label) : i.label}</span>
                <span className="flex-shrink-0 font-semibold text-[#1e2d3d]">
                  {fmt(i.count)} <span className="font-normal text-gray-400 text-xs">{total ? Math.round((i.count / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-[#F2AA25]" style={{ width: `${(Number(i.count) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const today = toInputDate(new Date());
  const [preset, setPreset] = useState("7d");
  const [custom, setCustom] = useState({ from: toInputDate(new Date(Date.now() - 13 * DAY_MS)), to: today });
  const [result, setResult] = useState({ key: null, data: null, error: "" });

  const customValid = custom.from && custom.to && custom.from <= custom.to;
  const { from, to } = preset === "custom" && !customValid ? rangeFor("7d") : rangeFor(preset, custom);
  const key = `${from.toISOString()}|${to.toISOString()}`;
  const loading = result.key !== key;

  useEffect(() => {
    let cancelled = false;
    fetchAnalytics(from, to)
      .then(data => { if (!cancelled) setResult({ key, data, error: "" }); })
      .catch(err => { if (!cancelled) setResult({ key, data: null, error: err.message }); });
    return () => { cancelled = true; };
    // from/to are derived from key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const d = result.data;
  const t = d?.totals ?? { views: 0, visitors: 0, sessions: 0 };
  const prev = d?.previous ?? { views: 0, visitors: 0, sessions: 0 };
  const perVisit = t.sessions ? (t.views / t.sessions).toFixed(1) : "0";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-[#1e2d3d]">Website Visitors</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-white rounded-xl shadow-sm p-1">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${preset === p.id ? "bg-[#1e2d3d] text-white" : "text-gray-500 hover:text-[#1e2d3d]"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Anonymous visits to the website. Admins, bots and visitors who opt out of tracking aren't counted.
      </p>

      {preset === "custom" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-gray-500">From
            <input type="date" value={custom.from} max={custom.to || today}
              onChange={e => setCustom(c => ({ ...c, from: e.target.value }))}
              className="block mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1e2d3d]" />
          </label>
          <label className="text-xs font-semibold text-gray-500">To
            <input type="date" value={custom.to} min={custom.from} max={today}
              onChange={e => setCustom(c => ({ ...c, to: e.target.value }))}
              className="block mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1e2d3d]" />
          </label>
          {!customValid && <p className="text-xs text-red-500 pb-2">Choose a start date on or before the end date.</p>}
        </div>
      )}

      {result.error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-4">
          Could not load analytics: {result.error}
        </div>
      )}

      <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <StatCard label="Unique Visitors" value={fmt(t.visitors)} sub={<Change now={t.visitors} before={prev.visitors} />} />
          <StatCard label="Visits" value={fmt(t.sessions)} sub={<Change now={t.sessions} before={prev.sessions} />} />
          <StatCard label="Page Views" value={fmt(t.views)} sub={<Change now={t.views} before={prev.views} />} />
          <StatCard label="Pages per Visit" value={perVisit} />
          <StatCard label="New / Returning" value={`${fmt(d?.new_visitors)} / ${fmt(d?.returning_visitors)}`}
            sub={<span className="text-xs text-gray-400">visitors in this period</span>} />
          <StatCard label="All-time Visitors" value={fmt(d?.all_time_visitors)} accent="text-[#F2AA25]"
            sub={<span className="text-xs text-gray-400">since tracking began</span>} />
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="text-sm font-bold text-[#1e2d3d] mb-2">
            Visitor Trend <span className="font-normal text-gray-400 text-xs">({d?.bucket === "hour" ? "per hour" : "per day"})</span>
          </h2>
          {d?.series?.length ? <TrendChart series={d.series} bucket={d.bucket} /> : (
            <p className="text-sm text-gray-400 py-10 text-center">{loading ? "Loading…" : "No data yet"}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-[#1e2d3d]">Most Visited Pages</h2>
            <span className="text-[11px] text-gray-400">page views · visitors</span>
          </div>
          {(d?.pages ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No data yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {d.pages.map(p => (
                <li key={p.path} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-gray-700">{pageName(p)}</p>
                    <p className="truncate text-[11px] text-gray-400">{p.path}</p>
                  </div>
                  <p className="flex-shrink-0 text-right">
                    <span className="font-semibold text-[#1e2d3d]">{fmt(p.views)}</span>
                    <span className="text-gray-400 text-xs"> · {fmt(p.visitors)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          <BarList title="How Visitors Found Us" note="visits" items={d?.sources ?? []} labelOf={l => SOURCE_NAMES[l] ?? l} />
          <BarList title="Top Referring Sites" note="visits" items={d?.referrers ?? []} empty="No referring sites yet" />
          <BarList title="Countries" note="visitors" items={d?.countries ?? []} labelOf={countryName} />
          <BarList title="Devices" note="visitors" items={d?.devices ?? []} labelOf={l => DEVICE_NAMES[l] ?? l} />
          <BarList title="Browsers" note="visitors" items={d?.browsers ?? []} />
          <BarList title="Operating Systems" note="visitors" items={d?.os ?? []} />
        </div>
      </div>
    </div>
  );
}
