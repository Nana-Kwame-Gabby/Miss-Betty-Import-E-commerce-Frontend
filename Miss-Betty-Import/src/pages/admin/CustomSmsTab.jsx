import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { SMS_MAX_CHARS as MAX_CHARS, smsSegments } from "../../lib/smsUtils";
import { validateGhanaPhone, normalizeGhanaPhone, splitManualPhoneInput } from "../../lib/phoneUtils";
import usePersistedState from "../../hooks/usePersistedState";

const SEND_CONCURRENCY = 5;

function chunkArray(items, size) {
  if (items.length === 0) return [];
  return [items.slice(0, size), ...chunkArray(items.slice(size), size)];
}

// Runs async `fn` over `items` in batches of at most `size` concurrent calls.
// Returns results in the same order as `items`, each { status, value|reason }
// matching the shape of Promise.allSettled.
async function settleInBatches(items, size, fn) {
  const batches = chunkArray(items, size);
  const nested = await batches.reduce(async (accPromise, batch) => {
    const acc = await accPromise;
    const batchResults = await Promise.allSettled(batch.map(fn));
    return [...acc, ...batchResults];
  }, Promise.resolve([]));
  return nested;
}

export default function CustomSmsTab() {
  const [customers,         setCustomers]         = useState([]);
  const [customerQuery,     setCustomerQuery]     = useState("");
  // Recipient list + draft message persist across navigation (admin-only, tab-scoped —
  // accepted that customer names/phone numbers sit in sessionStorage while composing).
  const [selectedCustomers, setSelectedCustomers] = usePersistedState("mbimport_form_admin_custom_sms_draft_selected", []);
  const [manualInput,       setManualInput]       = usePersistedState("mbimport_form_admin_custom_sms_draft_manual_input", "");
  const [manualNumbers,     setManualNumbers]     = usePersistedState("mbimport_form_admin_custom_sms_draft_manual_numbers", []); // [{ raw, normalized }]
  const [manualError,       setManualError]       = useState(null);
  const [message,           setMessage]           = usePersistedState("mbimport_form_admin_custom_sms_draft_message", "");
  const [logs,               setLogs]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [sending,           setSending]           = useState(false);
  const [showConfirm,       setShowConfirm]       = useState(false);
  const [banner,            setBanner]            = useState(null); // { type: "success"|"error", text }
  const [sendResults,       setSendResults]       = useState(null); // per-recipient outcomes

  async function loadAll() {
    setLoading(true);
    const [{ data: custs }, { data: logRows }] = await Promise.all([
      supabase.from("customers").select("customer_id, customer_name, telephone").order("customer_name"),
      supabase.from("individual_sms_logs").select("*").order("sent_at", { ascending: false }),
    ]);
    setCustomers(custs ?? []);
    setLogs(logRows ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.customer_name ?? "").toLowerCase().includes(q) ||
      (c.telephone ?? "").includes(q)
    );
  }, [customers, customerQuery]);

  function toggleCustomer(c) {
    setSelectedCustomers(prev =>
      prev.some(x => x.customer_id === c.customer_id)
        ? prev.filter(x => x.customer_id !== c.customer_id)
        : [...prev, c]
    );
    setBanner(null);
    setSendResults(null);
  }

  function removeCustomer(id) {
    setSelectedCustomers(prev => prev.filter(x => x.customer_id !== id));
  }

  function addManualNumbers() {
    const candidates = splitManualPhoneInput(manualInput);
    if (candidates.length === 0) {
      setManualError(null);
      return;
    }

    const errors = [];
    const additions = [];
    for (const raw of candidates) {
      const result = validateGhanaPhone(raw);
      if (!result.valid) {
        errors.push(result.error);
        continue;
      }
      const alreadyAdded = manualNumbers.some(m => m.normalized === result.normalized) ||
        additions.some(m => m.normalized === result.normalized);
      if (alreadyAdded) continue;
      additions.push({ raw, normalized: result.normalized });
    }

    if (additions.length > 0) {
      setManualNumbers(prev => [...prev, ...additions]);
    }
    setManualError(errors.length > 0 ? errors.join(" ") : null);
    setManualInput("");
    setBanner(null);
    setSendResults(null);
  }

  function removeManualNumber(normalized) {
    setManualNumbers(prev => prev.filter(m => m.normalized !== normalized));
  }

  const mergedRecipients = useMemo(() => {
    const byPhone = new Map();
    for (const c of selectedCustomers) {
      if (!c.telephone) continue;
      const norm = normalizeGhanaPhone(c.telephone.replace(/[\s-]/g, ""));
      byPhone.set(norm, {
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        phone: c.telephone,
      });
    }
    for (const m of manualNumbers) {
      if (byPhone.has(m.normalized)) continue; // registered customer wins
      byPhone.set(m.normalized, {
        customer_id: null,
        customer_name: "Manual entry",
        phone: m.raw,
      });
    }
    return Array.from(byPhone.values());
  }, [selectedCustomers, manualNumbers]);

  async function handleSend() {
    setShowConfirm(false);
    setSending(true);
    setBanner(null);
    setSendResults(null);

    const recipients = mergedRecipients;
    const trimmedMessage = message.trim();

    const outcomes = await settleInBatches(recipients, SEND_CONCURRENCY, async (r) => {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("send-bulk-sms", {
        body: { message: trimmedMessage, phones: [r.phone] },
      });
      if (fnErr || fnData?.error) {
        throw new Error(fnData?.error ?? fnErr?.message ?? "Unknown error");
      }
      return r;
    });

    const results = outcomes.map((outcome, i) => {
      const r = recipients[i];
      const ok = outcome.status === "fulfilled";
      return { ...r, status: ok ? "sent" : "failed", error: ok ? null : (outcome.reason?.message ?? "Unknown error") };
    });

    await supabase.from("individual_sms_logs").insert(
      results.map(r => ({
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        phone: r.phone,
        message: trimmedMessage,
        status: r.status,
      }))
    );

    const sentCount = results.filter(r => r.status === "sent").length;
    const failedCount = results.length - sentCount;

    setSendResults(results);
    if (failedCount === 0) {
      setBanner({ type: "success", text: `SMS sent successfully to all ${sentCount} recipient${sentCount !== 1 ? "s" : ""}.` });
      setMessage("");
      setSelectedCustomers([]);
      setManualNumbers([]);
    } else if (sentCount === 0) {
      setBanner({ type: "error", text: `Failed to send to all ${failedCount} recipient${failedCount !== 1 ? "s" : ""}. See details below.` });
    } else {
      setBanner({ type: "error", text: `Sent to ${sentCount} of ${results.length} recipients — ${failedCount} failed. See details below.` });
    }

    loadAll();
    setSending(false);
  }

  const charCount        = message.length;
  const segments          = smsSegments(charCount);
  const overLimit         = charCount > MAX_CHARS;
  const totalRecipients   = mergedRecipients.length;
  const canSend           = totalRecipients > 0 && message.trim().length > 0 && !overLimit && !sending;

  return (
    <div>
      {/* Recipients */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-mbi-navy">Recipients</h2>
          <span className="text-xs font-semibold text-mbi-amber-ink bg-mbi-amber/10 px-3 py-1 rounded-full">
            {totalRecipients} recipient{totalRecipients !== 1 ? "s" : ""} selected
          </span>
        </div>

        <p className="text-xs font-semibold text-mbi-slate mb-2">Registered customers</p>
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-mbi-slate" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={customerQuery}
            onChange={e => setCustomerQuery(e.target.value)}
            placeholder="Search by customer name or phone…"
            className="w-full border border-mbi-hairline rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-mbi-navy transition-colors"
          />
          {customerQuery && (
            <button
              onClick={() => setCustomerQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mbi-slate hover:text-mbi-navy-body"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto border border-mbi-hairline-soft rounded-lg divide-y divide-mbi-hairline-soft mb-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-mbi-slate text-sm">No customers found.</div>
          ) : (
            filteredCustomers.map(c => {
              const isSelected = selectedCustomers.some(x => x.customer_id === c.customer_id);
              return (
                <button
                  key={c.customer_id}
                  onClick={() => toggleCustomer(c)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-mbi-surface-soft transition-colors flex items-center gap-3 ${isSelected ? "bg-mbi-amber/10" : ""}`}
                >
                  <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? "bg-mbi-amber border-mbi-navy" : "border-mbi-hairline"
                  }`}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-mbi-navy font-medium flex-1">{c.customer_name}</span>
                  <span className="text-xs text-mbi-slate">{c.telephone || "No phone on file"}</span>
                </button>
              );
            })
          )}
        </div>

        {selectedCustomers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedCustomers.map(c => (
              <span key={c.customer_id} className="bg-mbi-surface-soft rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                {c.customer_name}
                <button onClick={() => removeCustomer(c.customer_id)} className="text-mbi-slate hover:text-mbi-navy-body">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-xs font-semibold text-mbi-slate mb-2">Manual phone numbers</p>
        <textarea
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addManualNumbers();
            }
          }}
          placeholder="Enter phone number(s) — one per line, or separated by commas"
          rows={2}
          className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none transition-colors mb-2"
        />
        <button
          onClick={addManualNumbers}
          disabled={!manualInput.trim()}
          className="border-2 border-mbi-hairline text-mbi-navy-body font-semibold text-xs px-4 py-2 rounded-lg hover:bg-mbi-surface-soft transition-colors disabled:opacity-40 mb-2"
        >
          Add Number(s)
        </button>

        {manualError && (
          <p className="text-xs text-mbi-error font-medium mb-2">{manualError}</p>
        )}

        {manualNumbers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {manualNumbers.map(m => (
              <span key={m.normalized} className="bg-mbi-surface-soft rounded-full pl-1 pr-3 py-1 text-xs flex items-center gap-1.5">
                <span className="bg-mbi-surface-strong text-mbi-slate text-xs uppercase font-semibold px-1.5 py-0.5 rounded">Manual</span>
                {m.raw}
                <button onClick={() => removeManualNumber(m.normalized)} className="text-mbi-slate hover:text-mbi-navy-body">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-6">
        <h2 className="text-sm font-bold text-mbi-navy mb-3">Compose Message</h2>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your message to selected recipients…"
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

        {sendResults && (
          <div className="mb-4 border border-mbi-hairline-soft rounded-lg divide-y divide-mbi-hairline-soft overflow-hidden">
            {sendResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold text-mbi-navy">{r.customer_name}</span>
                  <span className="text-mbi-slate ml-2">{r.phone}</span>
                  {r.status === "failed" && r.error && (
                    <p className="text-mbi-error mt-0.5">{r.error}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 font-semibold px-2.5 py-1 rounded-full ${
                  r.status === "sent"
                    ? "bg-mbi-available-tint text-mbi-available"
                    : "bg-mbi-error-tint text-mbi-error"
                }`}>
                  {r.status === "sent" ? "Sent" : "Failed"}
                </span>
              </div>
            ))}
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
          {sending ? "Sending…" : "Send Message"}
        </button>
      </div>

      {/* Recent Custom Sends */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-mbi-hairline-soft">
          <h2 className="text-sm font-bold text-mbi-navy">Recent Custom Sends</h2>
          <p className="text-xs text-mbi-slate mt-0.5">Previously sent custom SMS messages</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-mbi-slate text-sm">No custom messages sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                    <td className="px-5 py-3 text-mbi-slate whitespace-nowrap">
                      {new Date(l.sent_at).toLocaleDateString("en-GH", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-mbi-navy max-w-xs">
                      <p className="truncate" title={l.message}>{l.message}</p>
                    </td>
                    <td className="px-4 py-3 text-mbi-slate">
                      <p className="font-semibold text-mbi-navy">{l.customer_name}</p>
                      <p className="text-xs">{l.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        l.status === "sent"
                          ? "bg-mbi-available-tint text-mbi-available"
                          : "bg-mbi-error-tint text-mbi-error"
                      }`}>
                        {l.status === "sent" ? "Sent" : "Failed"}
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
            <h3 className="text-base font-bold text-mbi-navy mb-1">Send SMS?</h3>
            <p className="text-sm text-mbi-slate mb-2">
              This will send your message to <strong>{totalRecipients} total recipient{totalRecipients !== 1 ? "s" : ""}</strong>:
              {" "}{selectedCustomers.length} registered customer{selectedCustomers.length !== 1 ? "s" : ""} and{" "}
              {manualNumbers.length} manually-entered number{manualNumbers.length !== 1 ? "s" : ""}. This action cannot be undone.
            </p>
            <div className="max-h-40 overflow-y-auto border border-mbi-hairline-soft rounded-lg divide-y divide-mbi-hairline-soft mb-4">
              {mergedRecipients.map((r, i) => (
                <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                  <span className="font-medium text-mbi-navy">{r.customer_name}</span>
                  <span className="text-mbi-slate">{r.phone}</span>
                </div>
              ))}
            </div>
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
