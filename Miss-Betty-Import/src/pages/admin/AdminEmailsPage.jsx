import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// History of every automated email: what was sent, to whom, when, and what failed.
// Rows come from the email_messages outbox (admins only, via RLS).

const KIND_LABELS = {
  order_confirmation: "Order confirmation",
  shipping_payment:   "Shipping fee payment",
  request_sourced:    "Request sourced",
  period_closed:      "Period closed",
  period_opened:      "New period open",
};
const STATUS_STYLES = {
  sent:    "bg-green-100 text-green-700",
  failed:  "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  sending: "bg-blue-100 text-blue-700",
};
const PAGE_SIZE = 100;

const fmt = (d) => d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

async function fetchEmails({ kind, status, search }) {
  let q = supabase.from("email_messages")
    .select("id, kind, recipient, recipient_name, subject, status, attempts, last_error, created_at, sent_at, next_attempt_at, is_test, campaign_id, data")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (kind) q = q.eq("kind", kind);
  if (status === "waiting") q = q.in("status", ["pending", "sending"]);
  else if (status) q = q.eq("status", status);
  const term = search.trim().replace(/[%,()]/g, "");
  if (term) q = q.or(`recipient.ilike.%${term}%,recipient_name.ilike.%${term}%,subject.ilike.%${term}%`);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const count = (st) => supabase.from("email_messages").select("id", { count: "exact", head: true }).in("status", st).gte("created_at", since);
  const [{ data, error }, sent, failed, waiting, { data: campaigns }] = await Promise.all([
    q, count(["sent"]), count(["failed"]), count(["pending", "sending"]),
    supabase.from("email_campaigns").select("id, kind, subject, recipient_count, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  if (error) throw new Error(error.message);

  let campaignStats = {};
  if (campaigns?.length) {
    const { data: rows } = await supabase.from("email_messages").select("campaign_id, status").in("campaign_id", campaigns.map(c => c.id));
    campaignStats = (rows ?? []).reduce((acc, r) => {
      acc[r.campaign_id] ??= { sent: 0, failed: 0, waiting: 0 };
      acc[r.campaign_id][r.status === "sent" ? "sent" : r.status === "failed" ? "failed" : "waiting"]++;
      return acc;
    }, {});
  }
  return {
    rows: data ?? [],
    totals: { sent: sent.count ?? 0, failed: failed.count ?? 0, waiting: waiting.count ?? 0 },
    campaigns: (campaigns ?? []).map(c => ({ ...c, stats: campaignStats[c.id] ?? { sent: 0, failed: 0, waiting: 0 } })),
  };
}

function reference(m) {
  return m.data?.order_id ?? m.data?.shp_ref ?? (m.data?.request_id ? `REQ-${String(m.data.request_id).slice(0, 8).toUpperCase()}` : null);
}

export default function AdminEmailsPage() {
  const [filters, setFilters] = useState({ kind: "", status: "", search: "" });
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState({ key: null, rows: [], totals: null, campaigns: [], error: "" });
  const [retrying, setRetrying] = useState(null);
  const [notice, setNotice] = useState("");

  const key = JSON.stringify({ ...filters, tick });
  const loading = result.key !== key;

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetchEmails(filters)
        .then(r => { if (!cancelled) setResult({ key, ...r, error: "" }); })
        .catch(err => { if (!cancelled) setResult(prev => ({ ...prev, key, error: err.message })); });
    }, filters.search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(t); };
    // filters are part of key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Keep refreshing while emails are on their way.
  const waiting = result.totals?.waiting ?? 0;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, [waiting]);

  async function retry(id) {
    setRetrying(id);
    setNotice("");
    const { error } = await supabase.rpc("retry_email", { p_id: id });
    setRetrying(null);
    setNotice(error ? `Retry failed: ${error.message}` : "Email queued again. It will be sent within a minute.");
    setTick(t => t + 1);
  }

  const setFilter = (patch) => setFilters(f => ({ ...f, ...patch }));
  const t = result.totals;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-[#1e2d3d]">Emails</h1>
        <button onClick={() => setTick(x => x + 1)} className="text-xs font-semibold text-gray-500 hover:text-[#1e2d3d] border border-gray-200 rounded-xl px-3 py-1.5 bg-white">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Automated emails to customers: order confirmations, shipping fee payments, sourced requests and order period announcements.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ["Sent", t?.sent, "text-green-600"],
          ["Failed", t?.failed, "text-red-500"],
          ["Waiting to send", t?.waiting, "text-yellow-600"],
        ].map(([label, n, color]) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{n ?? "–"}</p>
            <p className="text-[11px] text-gray-400">last 30 days</p>
          </div>
        ))}
      </div>

      {result.campaigns.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="text-sm font-bold text-[#1e2d3d] mb-2">Recent announcements</h2>
          <ul className="divide-y divide-gray-50">
            {result.campaigns.map(c => (
              <li key={c.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1e2d3d] truncate">{c.subject}</p>
                  <p className="text-[11px] text-gray-400">{KIND_LABELS[c.kind]} · {fmt(c.created_at)} · {c.recipient_count} recipients</p>
                </div>
                <p className="text-xs whitespace-nowrap">
                  <span className="text-green-600 font-semibold">{c.stats.sent} sent</span>
                  {c.stats.failed > 0 && <span className="text-red-500 font-semibold"> · {c.stats.failed} failed</span>}
                  {c.stats.waiting > 0 && <span className="text-yellow-600 font-semibold"> · {c.stats.waiting} waiting</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={filters.kind} onChange={e => setFilter({ kind: e.target.value })}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-[#F2AA25]">
          <option value="">All types</option>
          {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter({ status: e.target.value })}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-[#F2AA25]">
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="waiting">Waiting</option>
        </select>
        <input value={filters.search} onChange={e => setFilter({ search: e.target.value })} placeholder="Search customer, email or subject…"
          className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-[#F2AA25]" />
      </div>

      {(result.error || notice) && (
        <div className={`text-sm rounded-2xl px-4 py-3 mb-3 border ${result.error || notice.startsWith("Retry failed") ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {result.error ? `Could not load emails: ${result.error}` : notice}
        </div>
      )}

      <div className={`bg-white rounded-2xl shadow-sm overflow-hidden mb-8 transition-opacity ${loading && result.key ? "opacity-60" : ""}`}>
        {!result.key ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" /></div>
        ) : result.rows.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-14">No emails yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {result.rows.map(m => (
              <li key={m.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[m.status]}`}>{m.status === "pending" ? "waiting" : m.status}</span>
                    <span className="text-xs font-semibold text-gray-500">{KIND_LABELS[m.kind]}</span>
                    {m.is_test && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">TEST</span>}
                    {reference(m) && <span className="text-[11px] text-gray-400">{reference(m)}</span>}
                  </div>
                  <p className="text-sm font-semibold text-[#1e2d3d] truncate mt-1">{m.subject ?? "(subject set when sent)"}</p>
                  <p className="text-xs text-gray-500 truncate">To: {m.recipient_name ? `${m.recipient_name} · ` : ""}{m.recipient}</p>
                  {m.status === "failed" && m.last_error && (
                    <p className="text-[11px] text-red-500 mt-0.5 break-words">{m.last_error}</p>
                  )}
                </div>
                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0">
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {m.status === "sent" ? `Sent ${fmt(m.sent_at)}` : `Queued ${fmt(m.created_at)}`}
                  </p>
                  {m.attempts > 1 && <p className="text-[11px] text-gray-400">{m.attempts} attempts</p>}
                  {m.status === "failed" && m.next_attempt_at && (
                    <p className="text-[11px] text-gray-400">Auto-retry {fmt(m.next_attempt_at)}</p>
                  )}
                  {m.status === "failed" && m.recipient.includes("@") && (
                    <button onClick={() => retry(m.id)} disabled={retrying === m.id}
                      className="text-xs font-semibold text-[#1e2d3d] border border-gray-300 rounded-lg px-2.5 py-1 hover:border-[#1e2d3d] disabled:opacity-50">
                      {retrying === m.id ? "Retrying…" : "Retry now"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
