import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { SMS_MAX_CHARS as MAX_CHARS, smsSegments } from "../../lib/smsUtils";

export default function IndividualSmsTab() {
  const [customers,        setCustomers]        = useState([]);
  const [customerQuery,    setCustomerQuery]    = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [message,          setMessage]          = useState("");
  const [logs,              setLogs]            = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [sending,          setSending]          = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [banner,           setBanner]           = useState(null); // { type: "success"|"error", text }

  useEffect(() => { loadAll(); }, []);

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

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.customer_name ?? "").toLowerCase().includes(q) ||
      (c.telephone ?? "").includes(q)
    );
  }, [customers, customerQuery]);

  function selectCustomer(c) {
    setSelectedCustomer(c);
    setCustomerQuery("");
    setBanner(null);
  }

  function changeCustomer() {
    setSelectedCustomer(null);
    setBanner(null);
  }

  async function handleSend() {
    setShowConfirm(false);
    setSending(true);
    setBanner(null);

    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("send-bulk-sms", {
        body: { message: message.trim(), phones: [selectedCustomer.telephone] },
      });

      if (fnErr || fnData?.error) {
        throw new Error(fnData?.error ?? fnErr?.message ?? "Unknown error");
      }

      await supabase.from("individual_sms_logs").insert({
        customer_id: selectedCustomer.customer_id,
        customer_name: selectedCustomer.customer_name,
        phone: selectedCustomer.telephone,
        message: message.trim(),
        status: "sent",
      });

      setMessage("");
      setBanner({ type: "success", text: `SMS sent successfully to ${selectedCustomer.customer_name}.` });
      loadAll();
    } catch (err) {
      await supabase.from("individual_sms_logs").insert({
        customer_id: selectedCustomer.customer_id,
        customer_name: selectedCustomer.customer_name,
        phone: selectedCustomer.telephone,
        message: message.trim(),
        status: "failed",
      });
      setBanner({ type: "error", text: err.message });
      loadAll();
    }

    setSending(false);
  }

  const charCount = message.length;
  const segments  = smsSegments(charCount);
  const overLimit = charCount > MAX_CHARS;
  const canSend   = !!selectedCustomer && !!selectedCustomer.telephone && message.trim().length > 0 && !overLimit && !sending;

  return (
    <div>
      {/* Compose */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Recipient</h2>

        {!selectedCustomer ? (
          <>
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

            <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No customers found.</div>
              ) : (
                filteredCustomers.map(c => (
                  <button
                    key={c.customer_id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-[#1e2d3d] font-medium">{c.customer_name}</span>
                    <span className="text-xs text-gray-400">{c.telephone || "No phone on file"}</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 mb-1">
            <div>
              <p className="text-sm font-semibold text-[#1e2d3d]">{selectedCustomer.customer_name}</p>
              <p className={`text-xs ${selectedCustomer.telephone ? "text-gray-400" : "text-red-500 font-semibold"}`}>
                {selectedCustomer.telephone || "No phone number on file"}
              </p>
            </div>
            <button
              onClick={changeCustomer}
              className="text-xs font-semibold text-[#F2AA25] hover:underline flex-shrink-0"
            >
              Change
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Compose Message</h2>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your message to this customer…"
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

      {/* Recent Individual Sends */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1e2d3d]">Recent Individual Sends</h2>
          <p className="text-xs text-gray-400 mt-0.5">Previously sent individual SMS messages</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No individual messages sent yet.</div>
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
            <p className="text-sm text-gray-500 mb-4">
              This will send your message to <strong>{selectedCustomer?.customer_name}</strong> ({selectedCustomer?.telephone}). This action cannot be undone.
            </p>
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
