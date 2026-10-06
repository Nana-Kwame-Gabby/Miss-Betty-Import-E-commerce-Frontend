import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// Bulk Email: compose a branded announcement and send it to every customer with a valid
// email. Each customer gets their own email (no shared recipient list); sending runs in
// batches in the background via the email outbox, so this page only queues and reports.

const DRAFT_KEY = "mbi_bulk_email_draft";
const DAILY_LIMIT = 300; // Brevo free plan
const KIND_LABELS = { announcement: "Bulk email", period_closed: "Period closed", period_opened: "New period open" };
const EMPTY = { subject: "", message: "", buttonLabel: "", buttonUrl: "" };

const fmt = (d) => d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const nf = new Intl.NumberFormat("en-GB");

function loadDraft() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") }; } catch { return EMPTY; }
}
function saveDraft(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage blocked */ }
}

async function fetchHistory() {
  const { data, error } = await supabase.rpc("get_bulk_email_history", { p_limit: 50 });
  if (error) throw new Error(error.message);
  return data ?? [];
}
async function fetchFailures(campaignId) {
  const { data } = await supabase.from("email_messages")
    .select("id, recipient, recipient_name, last_error, status")
    .eq("campaign_id", campaignId).eq("status", "failed").order("id").limit(200);
  return data ?? [];
}
async function renderPreview(body) {
  const { data, error } = await supabase.functions.invoke("send-emails", { body: { action: "preview", ...body } });
  if (error || data?.error) throw new Error(data?.error ?? error.message);
  return data.html;
}

function Counts({ c }) {
  return (
    <span className="text-xs whitespace-nowrap">
      <span className="text-green-600 font-semibold">{nf.format(c.sent)} sent</span>
      {c.failed > 0 && <span className="text-red-500 font-semibold"> · {nf.format(c.failed)} failed</span>}
      {c.waiting > 0 && <span className="text-yellow-600 font-semibold"> · {nf.format(c.waiting)} sending</span>}
    </span>
  );
}

function Modal({ children, onClose, wide = false }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} shadow-xl max-h-[94vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// A previously sent email: rendered as sent, delivery counts and failed recipients.
function HistoryDetail({ campaign, onClose }) {
  const [html, setHtml] = useState(null);
  const [failures, setFailures] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    renderPreview({ campaign_id: campaign.id }).then(setHtml).catch(e => setError(e.message));
    fetchFailures(campaign.id).then(setFailures);
  }, [campaign.id]);
  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase">{KIND_LABELS[campaign.kind]}</p>
          <h2 className="text-base font-bold text-[#1e2d3d] break-words">{campaign.subject}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmt(campaign.created_at)} · {nf.format(campaign.recipient_count)} recipients{campaign.created_by_email ? ` · sent by ${campaign.created_by_email}` : ""}
          </p>
          <div className="mt-1"><Counts c={campaign} /></div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 text-xl leading-none flex-shrink-0">×</button>
      </div>
      <div className="overflow-y-auto px-5 py-4">
        {error && <p className="text-sm text-red-600 mb-3">Could not load the email: {error}</p>}
        {html
          ? <iframe title="Sent email" srcDoc={html} sandbox="" className="w-full h-[460px] bg-gray-100 rounded-xl border border-gray-200" />
          : !error && <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>}
        {failures.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-[#1e2d3d] mb-2">Failed recipients ({failures.length})</h3>
            <ul className="divide-y divide-gray-50 text-sm">
              {failures.map(f => (
                <li key={f.id} className="py-2">
                  <p className="text-[#1e2d3d]">{f.recipient_name ? `${f.recipient_name} · ` : ""}{f.recipient}</p>
                  <p className="text-[11px] text-red-500 break-words">{f.last_error}</p>
                </li>
              ))}
            </ul>
            <Link to="/admin/emails" className="text-xs font-semibold text-[#1e2d3d] underline">Retry failed emails on the Emails page</Link>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function AdminBulkEmailPage() {
  const [draft, setDraft] = useState(loadDraft);
  const [recipients, setRecipients] = useState(null);
  const [history, setHistory] = useState({ rows: [], loaded: false, error: "" });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");          // preview | test | send
  const [notice, setNotice] = useState(null);    // { type, text }
  const [confirming, setConfirming] = useState(false);
  const [activeId, setActiveId] = useState(null); // campaign just sent (progress panel)
  const [activeFailures, setActiveFailures] = useState([]);
  const [opened, setOpened] = useState(null);
  const textRef = useRef(null);

  const refreshHistory = () =>
    fetchHistory()
      .then(rows => setHistory({ rows, loaded: true, error: "" }))
      .catch(err => setHistory(h => ({ ...h, loaded: true, error: err.message })));

  useEffect(() => {
    supabase.rpc("email_campaign_recipient_count").then(({ data }) => setRecipients(data ?? 0));
    refreshHistory();
  }, []);

  // Live progress for the email just sent, until nothing is left to send.
  const active = history.rows.find(r => r.id === activeId) ?? null;
  const activeWaiting = active ? active.waiting : activeId ? 1 : 0;
  useEffect(() => {
    if (!activeId || activeWaiting === 0) return;
    const t = setInterval(refreshHistory, 4000);
    return () => clearInterval(t);
  }, [activeId, activeWaiting]);
  useEffect(() => {
    if (activeId && active && active.waiting === 0 && active.failed > 0) fetchFailures(activeId).then(setActiveFailures);
  }, [activeId, active?.waiting, active?.failed]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch) => {
    setDraft(d => { const next = { ...d, ...patch }; saveDraft(next); return next; });
    setPreview(null);
  };

  const subjectOk = draft.subject.trim().length >= 3;
  const messageOk = draft.message.trim().length > 0;
  const urlOk = !draft.buttonUrl.trim() || /^https:\/\/[^\s<>"]+$/.test(draft.buttonUrl.trim());
  const valid = subjectOk && messageOk && urlOk;
  const payload = {
    p_kind: "announcement", p_subject: draft.subject, p_message: draft.message,
    p_button_label: draft.buttonLabel.trim() || null, p_button_url: draft.buttonUrl.trim() || null,
  };

  // Formatting helpers: wrap the selection in **bold**, or prefix lines with "- ".
  function format(kind) {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    let next, caret;
    if (kind === "bold") {
      const sel = value.slice(a, b) || "bold text";
      next = `${value.slice(0, a)}**${sel}**${value.slice(b)}`;
      caret = [a + 2, a + 2 + sel.length];
    } else if (kind === "list") {
      const lineStart = value.lastIndexOf("\n", a - 1) + 1;
      const block = value.slice(lineStart, b) || "List item";
      const listed = block.split("\n").map(l => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
      next = `${value.slice(0, lineStart)}${listed}${value.slice(Math.max(b, lineStart))}`;
      caret = [lineStart, lineStart + listed.length];
    } else {
      const url = "https://www.missbettyimport.com/shop";
      next = `${value.slice(0, a)}${url}${value.slice(b)}`;
      caret = [a, a + url.length];
    }
    update({ message: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret[0], caret[1]); });
  }

  async function showPreview() {
    setBusy("preview");
    setNotice(null);
    try {
      setPreview(await renderPreview({
        kind: "announcement", subject: draft.subject, message: draft.message,
        button_label: draft.buttonLabel.trim() || null, button_url: draft.buttonUrl.trim() || null,
      }));
    } catch (err) {
      setNotice({ type: "error", text: `Preview failed: ${err.message}` });
    }
    setBusy("");
  }

  async function sendTest() {
    setBusy("test");
    setNotice(null);
    const { data, error } = await supabase.rpc("queue_email_campaign", { ...payload, p_test: true });
    setBusy("");
    setNotice(error
      ? { type: "error", text: error.message }
      : { type: "success", text: `Test email sent to ${data.recipient}. Check your inbox (and spam folder) in a minute.` });
  }

  async function sendAll() {
    setConfirming(false);
    setBusy("send");
    setNotice(null);
    setActiveFailures([]);
    const { data, error } = await supabase.rpc("queue_email_campaign", { ...payload, p_test: false });
    setBusy("");
    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }
    setActiveId(data.campaign_id);
    setNotice({ type: "success", text: `Sending to ${nf.format(data.recipients)} customers. Progress updates below.` });
    update(EMPTY);
    refreshHistory();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Bulk Email</h1>
      <p className="text-sm text-gray-400 mb-4">
        Send an announcement, promotion or update to every customer. Each customer receives their own copy; nobody sees other customers' addresses.
      </p>

      {activeId && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 border-l-4 border-[#F2AA25]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase">{active?.waiting ? "Sending…" : "Finished"}</p>
              <p className="text-sm font-bold text-[#1e2d3d] truncate">{active?.subject ?? "…"}</p>
            </div>
            {active && <Counts c={active} />}
          </div>
          {active && (
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3 flex">
              <div className="bg-green-500" style={{ width: `${(active.sent / Math.max(1, active.recipient_count)) * 100}%` }} />
              <div className="bg-red-400" style={{ width: `${(active.failed / Math.max(1, active.recipient_count)) * 100}%` }} />
            </div>
          )}
          {activeFailures.length > 0 && (
            <div className="mt-3 text-xs">
              <p className="font-semibold text-red-600 mb-1">{activeFailures.length} could not be delivered:</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {activeFailures.map(f => <li key={f.id} className="text-gray-600 break-words">{f.recipient}: <span className="text-red-500">{f.last_error}</span></li>)}
              </ul>
              <Link to="/admin/emails" className="inline-block mt-2 font-semibold text-[#1e2d3d] underline">Retry on the Emails page</Link>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-[#1e2d3d]">New email</h2>
          <p className="text-xs text-gray-500">
            Will be sent to <span className="font-bold text-[#1e2d3d]">{recipients == null ? "…" : nf.format(recipients)}</span> customers
          </p>
        </div>

        {recipients > DAILY_LIMIT && (
          <p className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl px-3 py-2 mb-3">
            Your Brevo plan sends up to {DAILY_LIMIT} emails per day. Emails over the limit are retried automatically, but some may fail; upgrade the Brevo plan to send to everyone at once.
          </p>
        )}

        <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
        <input value={draft.subject} maxLength={150} onChange={e => update({ subject: e.target.value })}
          placeholder="e.g. New arrivals are here!"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#F2AA25] mb-3" />

        <div className="flex flex-wrap items-end justify-between gap-2 mb-1">
          <label className="text-xs font-semibold text-gray-500">Message</label>
          <div className="flex gap-1">
            {[["bold", <strong key="b">B</strong>, "Bold"], ["list", "• List", "Bullet list"], ["link", "🔗 Link", "Insert a link"]].map(([k, label, title]) => (
              <button key={k} type="button" title={title} onClick={() => format(k)}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-[#1e2d3d] hover:text-[#1e2d3d]">
                {label}
              </button>
            ))}
          </div>
        </div>
        <textarea ref={textRef} value={draft.message} maxLength={10000} rows={9} onChange={e => update({ message: e.target.value })}
          placeholder={"Write your message…\n\nTips: leave a blank line between paragraphs, start lines with \"- \" for a bullet list, and wrap words in **double stars** for bold."}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#F2AA25] resize-y font-[inherit]" />
        <p className="text-[11px] text-gray-400 mb-3">
          Customers see “Hi &#123;their name&#125;,” before your message, plus the Miss Betty Import logo, header and footer.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Button text (optional)</label>
            <input value={draft.buttonLabel} maxLength={60} onChange={e => update({ buttonLabel: e.target.value })}
              placeholder="Visit missbettyimport.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#F2AA25]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Button link (optional)</label>
            <input value={draft.buttonUrl} maxLength={500} onChange={e => update({ buttonUrl: e.target.value })}
              placeholder="https://www.missbettyimport.com"
              className={`w-full text-sm border rounded-xl px-3 py-2 outline-none focus:border-[#F2AA25] ${urlOk ? "border-gray-200" : "border-red-300"}`} />
            {!urlOk && <p className="text-[11px] text-red-500 mt-1">Use a full secure link starting with https://</p>}
          </div>
        </div>

        {notice && (
          <div className={`text-sm rounded-xl px-3 py-2 mt-3 border ${notice.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
            {notice.text}
          </div>
        )}

        {preview && (
          <div className="border border-gray-200 rounded-xl overflow-hidden mt-3">
            <p className="text-[11px] text-gray-400 bg-gray-50 px-3 py-1.5 border-b border-gray-200">Preview · Subject: <span className="text-[#1e2d3d] font-semibold">{draft.subject}</span></p>
            <iframe title="Email preview" srcDoc={preview} sandbox="" className="w-full h-[480px] bg-gray-100" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button onClick={showPreview} disabled={!valid || !!busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-600 hover:border-gray-400 disabled:opacity-40">
            {busy === "preview" ? "Loading…" : "Preview"}
          </button>
          <button onClick={sendTest} disabled={!valid || !!busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#1e2d3d] text-[#1e2d3d] hover:bg-gray-50 disabled:opacity-40">
            {busy === "test" ? "Sending…" : "Send test to me"}
          </button>
          <button onClick={() => setConfirming(true)} disabled={!valid || !!busy || !recipients}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F2AA25] text-white hover:opacity-90 disabled:opacity-40">
            {busy === "send" ? "Sending…" : `Send to ${recipients == null ? "…" : nf.format(recipients)} customers`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1e2d3d]">Sent emails</h2>
          <button onClick={refreshHistory} className="text-xs font-semibold text-gray-500 hover:text-[#1e2d3d]">Refresh</button>
        </div>
        {history.error && <p className="text-sm text-red-600 px-4 py-3">Could not load history: {history.error}</p>}
        {!history.loaded ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" /></div>
        ) : history.rows.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">No bulk emails sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Subject", "Sent", "Recipients", "Delivered", "Failed", "Sent by"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.rows.map(r => (
                  <tr key={r.id} onClick={() => setOpened(r)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-2.5 max-w-[260px]">
                      <p className="font-semibold text-[#1e2d3d] truncate">{r.subject}</p>
                      <p className="text-[11px] text-gray-400">{KIND_LABELS[r.kind]}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmt(r.created_at)}</td>
                    <td className="px-4 py-2.5 text-[#1e2d3d] font-semibold">{nf.format(r.recipient_count)}</td>
                    <td className="px-4 py-2.5 text-green-600 font-semibold">
                      {nf.format(r.sent)}{r.waiting > 0 && <span className="text-yellow-600 text-xs font-normal"> (+{nf.format(r.waiting)} sending)</span>}
                    </td>
                    <td className={`px-4 py-2.5 font-semibold ${r.failed ? "text-red-500" : "text-gray-300"}`}>{nf.format(r.failed)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.created_by_email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <div className="p-6">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-2">Send this email?</h3>
            <p className="text-sm text-gray-600 mb-1">
              You are about to send this email to <strong className="text-[#1e2d3d]">{nf.format(recipients)} customers</strong>. Are you sure you want to continue?
            </p>
            <p className="text-xs text-gray-400 mb-5 break-words">Subject: “{draft.subject}”</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-2xl text-sm hover:border-gray-400">
                Cancel
              </button>
              <button onClick={sendAll}
                className="flex-1 bg-[#F2AA25] text-white font-bold py-2.5 rounded-2xl text-sm hover:opacity-90">
                Yes, send it
              </button>
            </div>
          </div>
        </Modal>
      )}

      {opened && <HistoryDetail campaign={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
