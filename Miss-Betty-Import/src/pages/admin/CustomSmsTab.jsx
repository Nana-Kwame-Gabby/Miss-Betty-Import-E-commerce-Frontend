import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { SMS_MAX_CHARS as MAX_CHARS, smsSegments } from "../../lib/smsUtils";
import { validateGhanaPhone, normalizeGhanaPhone, splitManualPhoneInput } from "../../lib/phoneUtils";

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
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [manualInput,       setManualInput]       = useState("");
  const [manualNumbers,     setManualNumbers]     = useState([]); // [{ raw, normalized }]
  const [manualError,       setManualError]       = useState(null);
  const [message,           setMessage]           = useState("");
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
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#1e2d3d]">Recipients</h2>
          <span className="text-xs font-semibold text-[#F2AA25] bg-[#F2AA25]/10 px-3 py-1 rounded-full">
            {totalRecipients} recipient{totalRecipients !== 1 ? "s" : ""} selected
          </span>
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2">Registered customers</p>
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={customerQuery}
            onChange={e => setCustomerQuery(e.target.value)}
            placeholder="Search by customer name or phone…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors"
          />
          {customerQuery && (
            <button
              onClick={() => setCustomerQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 mb-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No customers found.</div>
          ) : (
            filteredCustomers.map(c => {
              const isSelected = selectedCustomers.some(x => x.customer_id === c.customer_id);
              return (
                <button
                  key={c.customer_id}
                  onClick={() => toggleCustomer(c)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3 ${isSelected ? "bg-[#F2AA25]/10" : ""}`}
                >
                  <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? "bg-[#F2AA25] border-[#F2AA25]" : "border-gray-300"
                  }`}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-[#1e2d3d] font-medium flex-1">{c.customer_name}</span>
                  <span className="text-xs text-gray-400">{c.telephone || "No phone on file"}</span>
                </button>
              );
            })
          )}
        </div>

        {selectedCustomers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedCustomers.map(c => (
              <span key={c.customer_id} className="bg-gray-100 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
                {c.customer_name}
                <button onClick={() => removeCustomer(c.customer_id)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-500 mb-2">Manual phone numbers</p>
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
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] resize-none transition-colors mb-2"
        />
        <button
          onClick={addManualNumbers}
          disabled={!manualInput.trim()}
          className="border-2 border-gray-200 text-gray-600 font-semibold text-xs px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 mb-2"
        >
          Add Number(s)
        </button>

        {manualError && (
          <p className="text-xs text-red-500 font-medium mb-2">{manualError}</p>
        )}

        {manualNumbers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {manualNumbers.map(m => (
              <span key={m.normalized} className="bg-gray-100 rounded-full pl-1 pr-3 py-1 text-xs flex items-center gap-1.5">
                <span className="bg-gray-200 text-gray-500 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded">Manual</span>
                {m.raw}
                <button onClick={() => removeManualNumber(m.normalized)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Compose Message</h2>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your message to selected recipients…"
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] resize-none transition-colors"
        />

        <div className="flex items-center justify-between mt-2 mb-4">
          <p className={`text-xs ${overLimit ? "text-red-500 font-semibold" : "text-gray-400"}`}>
            {charCount} / {MAX_CHARS} chars · {segments} SMS segment{segments !== 1 ? "s" : ""}
          </p>
          {overLimit && (
            <p className="text-xs text-red-500 font-semibold">Message too long</p>
          )}
        </div>

        {banner && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-600 border border-red-100"
          }`}>
            {banner.text}
          </div>
        )}

        {sendResults && (
          <div className="mb-4 border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
            {sendResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold text-[#1e2d3d]">{r.customer_name}</span>
                  <span className="text-gray-400 ml-2">{r.phone}</span>
                  {r.status === "failed" && r.error && (
                    <p className="text-red-500 mt-0.5">{r.error}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 font-semibold px-2.5 py-1 rounded-full ${
                  r.status === "sent"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
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
          className="flex items-center gap-2 bg-[#1e2d3d] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {sending ? "Sending…" : "Send Message"}
        </button>
      </div>

      {/* Recent Custom Sends */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1e2d3d]">Recent Custom Sends</h2>
          <p className="text-xs text-gray-400 mt-0.5">Previously sent custom SMS messages</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No custom messages sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Recipient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(l.sent_at).toLocaleDateString("en-GH", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-[#1e2d3d] max-w-xs">
                      <p className="truncate" title={l.message}>{l.message}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <p className="font-semibold text-[#1e2d3d]">{l.customer_name}</p>
                      <p className="text-xs">{l.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        l.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
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
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-1">Send SMS?</h3>
            <p className="text-sm text-gray-500 mb-2">
              This will send your message to <strong>{totalRecipients} total recipient{totalRecipients !== 1 ? "s" : ""}</strong>:
              {" "}{selectedCustomers.length} registered customer{selectedCustomers.length !== 1 ? "s" : ""} and{" "}
              {manualNumbers.length} manually-entered number{manualNumbers.length !== 1 ? "s" : ""}. This action cannot be undone.
            </p>
            <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 mb-4">
              {mergedRecipients.map((r, i) => (
                <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                  <span className="font-medium text-[#1e2d3d]">{r.customer_name}</span>
                  <span className="text-gray-400">{r.phone}</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-5 text-sm text-gray-600 italic line-clamp-3">
              "{message}"
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex-1 bg-[#1e2d3d] text-white font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity text-sm"
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
