import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// Compose, preview, test and send the "order period closed" / "new order period open"
// announcement emails. Each customer gets their own email (no shared recipient list).

const KINDS = {
  period_closed: {
    label: "Order period closed",
    subject: (closed) => `Order period closed${closed ? ` – ${closed}` : ""}`,
    message: "Thank you for all your orders! We're now placing them with our suppliers and will keep you updated on shipping.",
  },
  period_opened: {
    label: "New order period open",
    subject: (_closed, active) => `New order period now open${active ? ` – ${active}` : ""}`,
    message: "Pre-orders are open again! Visit missbettyimport.com to browse the latest products and place your order.",
  },
};

async function fetchRecipientCount() {
  const { data } = await supabase.rpc("email_campaign_recipient_count");
  return data ?? 0;
}

export default function EmailAnnouncementModal({ initialKind = "period_opened", closedName, activeName, onClose, justSwitched = false }) {
  const [kind, setKind] = useState(initialKind);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(
    Object.entries(KINDS).map(([k, v]) => [k, { subject: v.subject(closedName, activeName), message: v.message }])
  ));
  const [recipients, setRecipients] = useState(null);
  const [preview, setPreview] = useState(null); // { kind, html }
  const [busy, setBusy] = useState("");          // "preview" | "test" | "send"
  const [result, setResult] = useState(null);    // { type, text }
  const [sent, setSent] = useState({});

  useEffect(() => {
    document.body.style.overflow = "hidden";
    fetchRecipientCount().then(setRecipients);
    return () => { document.body.style.overflow = ""; };
  }, []);

  const draft = drafts[kind];
  const setDraft = (patch) => {
    setDrafts(d => ({ ...d, [kind]: { ...d[kind], ...patch } }));
    setPreview(null);
  };
  const valid = draft.subject.trim().length >= 3;

  async function showPreview() {
    setBusy("preview");
    setResult(null);
    const { data, error } = await supabase.functions.invoke("send-emails", {
      body: { action: "preview", kind, subject: draft.subject, message: draft.message },
    });
    setBusy("");
    if (error || data?.error) setResult({ type: "error", text: `Preview failed: ${data?.error ?? error.message}` });
    else setPreview({ kind, html: data.html });
  }

  async function send(test) {
    if (!test && !window.confirm(`Send "${draft.subject}" to all ${recipients ?? ""} customers now? This can't be undone.`)) return;
    setBusy(test ? "test" : "send");
    setResult(null);
    const { data, error } = await supabase.rpc("queue_email_campaign", {
      p_kind: kind, p_subject: draft.subject, p_message: draft.message, p_test: test,
    });
    setBusy("");
    if (error) {
      setResult({ type: "error", text: error.message });
      return;
    }
    if (test) {
      setResult({ type: "success", text: `Test email sent to ${data.recipient}. Check your inbox (and spam folder) in a minute.` });
    } else {
      setSent(s => ({ ...s, [kind]: data.recipients }));
      setResult({ type: "success", text: `Sending to ${data.recipients} customers. Delivery progress is on the Emails page.` });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-mbi-card w-full max-w-2xl shadow-mbi-float max-h-[94vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-mbi-hairline-soft">
          <div>
            <h2 className="text-base font-bold text-mbi-navy">Email customers</h2>
            <p className="text-xs text-mbi-slate">
              {justSwitched ? "The period was switched. Optionally let customers know." : "Send an order period announcement."}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-mbi-surface-soft text-mbi-slate text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="inline-flex bg-mbi-surface-soft rounded-lg p-1 mb-4">
            {Object.entries(KINDS).map(([k, v]) => (
              <button key={k} onClick={() => { setKind(k); setPreview(null); setResult(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${kind === k ? "bg-white text-mbi-navy border border-mbi-hairline" : "text-mbi-slate"}`}>
                {v.label}{sent[k] ? " ✓" : ""}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold text-mbi-slate mb-1">Subject</label>
          <input value={draft.subject} maxLength={150} onChange={e => setDraft({ subject: e.target.value })}
            className="w-full text-sm border border-mbi-hairline rounded-lg px-3 py-2 outline-none focus:border-mbi-navy mb-3" />

          <label className="block text-xs font-semibold text-mbi-slate mb-1">Your message</label>
          <textarea value={draft.message} maxLength={5000} rows={5} onChange={e => setDraft({ message: e.target.value })}
            placeholder="Add details customers should know…"
            className="w-full text-sm border border-mbi-hairline rounded-lg px-3 py-2 outline-none focus:border-mbi-navy resize-y" />
          <p className="text-xs text-mbi-slate mb-3">
            Shown in a highlighted box in the email, under a standard {kind === "period_opened" ? "\"new order period is open\"" : "\"order period has closed\""} introduction.
            {kind === "period_opened" ? " Includes a \"Shop now on missbettyimport.com\" button." : ""}
          </p>

          {result && (
            <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${result.type === "error" ? "bg-mbi-error-tint text-mbi-error border border-mbi-error/30" : "bg-mbi-available-tint text-mbi-available border border-mbi-available/30"}`}>
              {result.text}{" "}
              {result.type === "success" && <Link to="/admin/emails" className="font-semibold underline" onClick={onClose}>Open Emails</Link>}
            </div>
          )}

          {preview?.kind === kind && (
            <div className="border border-mbi-hairline rounded-lg overflow-hidden mb-3">
              <p className="text-xs text-mbi-slate bg-mbi-surface-soft px-3 py-1.5 border-b border-mbi-hairline">Preview · Subject: <span className="text-mbi-navy font-semibold">{draft.subject}</span></p>
              <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="w-full h-[420px] bg-mbi-surface-soft" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-end px-5 py-4 border-t border-mbi-hairline-soft">
          <button onClick={showPreview} disabled={!valid || !!busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-mbi-hairline text-mbi-navy-body hover:border-mbi-navy disabled:opacity-40">
            {busy === "preview" ? "Loading…" : "Preview"}
          </button>
          <button onClick={() => send(true)} disabled={!valid || !!busy}
            className="mbi-press px-4 py-2 rounded-lg text-sm font-semibold border border-mbi-navy text-mbi-navy hover:bg-mbi-surface-soft disabled:opacity-40">
            {busy === "test" ? "Sending…" : "Send test to me"}
          </button>
          <button onClick={() => send(false)} disabled={!valid || !!busy || !!sent[kind] || !recipients}
            className="mbi-press px-4 py-2 rounded-lg text-sm font-bold bg-mbi-amber text-mbi-navy hover:bg-mbi-amber-press disabled:opacity-40">
            {busy === "send" ? "Sending…" : sent[kind] ? `Sent to ${sent[kind]}` : `Send to ${recipients ?? "…"} customers`}
          </button>
        </div>
      </div>
    </div>
  );
}
