import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { SMS_MAX_CHARS as MAX_CHARS, smsSegments } from "../../lib/smsUtils";
import usePersistedState from "../../hooks/usePersistedState";

export default function BulkSmsTab() {
  const [message,        setMessage]        = usePersistedState("mbimport_form_admin_bulk_sms_draft", "");
  const [customerCount,  setCustomerCount]  = useState(null);
  const [campaigns,      setCampaigns]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [banner,         setBanner]         = useState(null); // { type: "success"|"error", text }

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ count }, { data: camps }] = await Promise.all([
      supabase.from("customers").select("customer_id", { count: "exact", head: true }),
      supabase.from("bulk_sms_campaigns").select("*").order("sent_at", { ascending: false }),
    ]);
    setCustomerCount(count ?? 0);
    setCampaigns(camps ?? []);
    setLoading(false);
  }

  async function handleSend() {
    setShowConfirm(false);
    setSending(true);
    setBanner(null);

    try {
      // Fetch all phone numbers
      const { data: customers, error: fetchErr } = await supabase
        .from("customers")
        .select("telephone")
        .not("telephone", "is", null);

      if (fetchErr) throw new Error(fetchErr.message);

      const phones = (customers ?? [])
        .map(c => c.telephone)
        .filter(Boolean);

      if (phones.length === 0) {
        setBanner({ type: "error", text: "No customers with registered phone numbers found." });
        setSending(false);
        return;
      }

      // Call edge function
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("send-bulk-sms", {
        body: { message: message.trim(), phones },
      });

      if (fnErr || fnData?.error) {
        throw new Error(fnData?.error ?? fnErr?.message ?? "Unknown error");
      }

      const recipientCount = fnData?.recipientCount ?? phones.length;

      // Record campaign in history
      await supabase.from("bulk_sms_campaigns").insert({
        message: message.trim(),
        recipient_count: recipientCount,
        status: "sent",
      });

      setMessage("");
      setBanner({ type: "success", text: `SMS sent successfully to ${recipientCount} customer${recipientCount !== 1 ? "s" : ""}.` });
      loadAll();
    } catch (err) {
      // Still record as failed
      await supabase.from("bulk_sms_campaigns").insert({
        message: message.trim(),
        recipient_count: 0,
        status: "failed",
      });
      setBanner({ type: "error", text: err.message });
      loadAll();
    }

    setSending(false);
  }

  const charCount   = message.length;
  const segments    = smsSegments(charCount);
  const overLimit   = charCount > MAX_CHARS;
  const canSend     = message.trim().length > 0 && !overLimit && !sending;

  return (
    <div>
      {/* Compose */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-mbi-navy">Compose Message</h2>
          {customerCount !== null && (
            <span className="text-xs font-semibold text-mbi-amber-ink bg-mbi-amber/10 px-3 py-1 rounded-full">
              {customerCount} registered customer{customerCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your message to all customers…"
          rows={5}
          className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none transition-colors"
        />

        <div className="flex items-center justify-between mt-2 mb-4">
          <p className={`text-xs ${overLimit ? "text-mbi-error font-semibold" : "text-mbi-slate"}`}>
            {charCount} / {MAX_CHARS} chars · {segments} SMS segment{segments !== 1 ? "s" : ""}
          </p>
          {overLimit && (
            <p className="text-xs text-mbi-error font-semibold">Message too long</p>
          )}
        </div>

        {banner && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
            banner.type === "success"
              ? "bg-mbi-available-tint text-mbi-available border border-mbi-available/30"
              : "bg-mbi-error-tint text-mbi-error border border-mbi-error/30"
          }`}>
            {banner.text}
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canSend}
          className="mbi-press flex items-center gap-2 bg-mbi-navy text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {sending ? "Sending…" : `Send to All Customers`}
        </button>
      </div>

      {/* Campaign History */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-mbi-hairline-soft">
          <h2 className="text-sm font-bold text-mbi-navy">Campaign History</h2>
          <p className="text-xs text-mbi-slate mt-0.5">Previously sent bulk SMS campaigns</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-mbi-slate text-sm">No campaigns sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Recipients</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                    <td className="px-5 py-3 text-mbi-slate whitespace-nowrap">
                      {new Date(c.sent_at).toLocaleDateString("en-GH", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-mbi-navy max-w-xs">
                      <p className="truncate" title={c.message}>{c.message}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-mbi-navy">{c.recipient_count}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        c.status === "sent"
                          ? "bg-mbi-available-tint text-mbi-available"
                          : "bg-mbi-error-tint text-mbi-error"
                      }`}>
                        {c.status === "sent" ? "Sent" : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-mbi-card shadow-mbi-float w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-mbi-navy mb-1">Send Bulk SMS?</h3>
            <p className="text-sm text-mbi-slate mb-4">
              This will send your message to <strong>{customerCount} customer{customerCount !== 1 ? "s" : ""}</strong>. This action cannot be undone.
            </p>
            <div className="bg-mbi-surface-soft border border-mbi-hairline-soft rounded-lg px-3 py-2.5 mb-5 text-sm text-mbi-navy-body italic line-clamp-3">
              "{message}"
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-mbi-hairline text-mbi-navy-body font-semibold py-2 rounded-lg hover:bg-mbi-surface-soft transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="mbi-press flex-1 bg-mbi-navy text-white font-semibold py-2 rounded-lg hover:bg-mbi-navy-hover transition-colors text-sm"
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
