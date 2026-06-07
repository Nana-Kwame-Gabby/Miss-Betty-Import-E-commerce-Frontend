import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAppSettings } from "../../context/AppSettingsContext";

function StatCard({ title, value, icon, color, loading }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-[#1e2d3d]">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { ordersClosed, announcementMessage, toggleOrdersClosed, updateAnnouncementMessage } = useAppSettings();
  const [toggling, setToggling]         = useState(false);
  const [localMessage, setLocalMessage] = useState(announcementMessage);
  const [savingMessage, setSavingMessage] = useState(false);

  // Sync localMessage when context loads
  useEffect(() => { setLocalMessage(announcementMessage); }, [announcementMessage]);

  async function handleSaveMessage() {
    setSavingMessage(true);
    await updateAnnouncementMessage(localMessage);
    setSavingMessage(false);
  }
  const [stats, setStats] = useState({ products: 0, orders: 0, customers: 0, revenue: 0, shippingCollected: 0, totalCostPrice: 0, totalProfit: 0 });
  const [paymentRows, setPaymentRows] = useState([]);
  const [custTotals, setCustTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [statusRef,       setStatusRef]       = useState("");
  const [statusResult,    setStatusResult]    = useState(null);
  const [statusError,     setStatusError]     = useState("");
  const [checkingStatus,  setCheckingStatus]  = useState(false);

  async function handleCheckStatus() {
    if (!statusRef.trim()) return;
    setCheckingStatus(true);
    setStatusResult(null);
    setStatusError("");
    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { clientReference: statusRef.trim() },
      });
      if (error) setStatusError(error.message ?? "Failed to call payment service");
      else if (data?.error) setStatusError(data.error);
      else setStatusResult(data);
    } catch (err) {
      setStatusError(err.message ?? "Unexpected error");
    }
    setCheckingStatus(false);
  }

  async function handleToggleOrders() {
    setToggling(true);
    await toggleOrdersClosed(!ordersClosed);
    setToggling(false);
  }

  useEffect(() => {
    async function loadStats() {
      const [
        { count: products },
        { count: orders },
        { count: customers },
        { data: invoiceData },
        { data: paymentData },
        { data: allOrderData },
        { data: allFeeData },
      ] = await Promise.all([
        supabase.from('products').select('product_id', { count: 'exact', head: true }),
        supabase.from('orders').select('order_id', { count: 'exact', head: true }),
        supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
        supabase.from('invoices').select('total'),
        supabase.from('shipping_fee_payments')
          .select('customer_id, amount_paid, paid_at, customers(customer_name)')
          .order('paid_at', { ascending: false }),
        supabase.from('orders').select('customer_id, product_id, size, quantity, cost_price, profit, shipping_fee'),
        supabase.from('product_size_shipping_fees').select('product_id, size, shipping_fee'),
      ]);

      const revenue = (invoiceData ?? []).reduce((sum, r) => sum + Number(r.total ?? 0), 0);
      const shippingCollected = (paymentData ?? []).reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);

      const feeMap = {};
      (allFeeData ?? []).forEach(f => {
        feeMap[`${f.product_id}::${f.size}`] = Number(f.shipping_fee ?? 0);
      });
      const totalByCustomer = {};
      let totalCostPrice = 0;
      let totalProfit    = 0;
      (allOrderData ?? []).forEach(o => {
        const qty  = Number(o.quantity ?? 1);
        const fee  = o.shipping_fee != null
          ? Number(o.shipping_fee)
          : (feeMap[`${o.product_id}::${o.size ?? ''}`] ?? 0);
        totalByCustomer[o.customer_id] = (totalByCustomer[o.customer_id] ?? 0) + fee * qty;
        totalCostPrice += Number(o.cost_price ?? 0) * qty;
        totalProfit    += Number(o.profit     ?? 0) * qty;
      });

      // Compute running balance per customer (sorted chronologically, then re-sorted newest-first)
      const custPayments = {};
      (paymentData ?? []).forEach(r => {
        if (!custPayments[r.customer_id]) custPayments[r.customer_id] = [];
        custPayments[r.customer_id].push({ ...r });
      });
      const enriched = [];
      Object.values(custPayments).forEach(payments => {
        payments.sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at));
        let cumulative = 0;
        payments.forEach(p => {
          cumulative += Number(p.amount_paid);
          p.balance = Math.max(0, (totalByCustomer[p.customer_id] ?? 0) - cumulative);
          enriched.push(p);
        });
      });
      enriched.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));

      setStats({ products: products ?? 0, orders: orders ?? 0, customers: customers ?? 0, revenue, shippingCollected, totalCostPrice, totalProfit });
      setPaymentRows(enriched);
      setCustTotals(totalByCustomer);
      setLoading(false);
    }
    loadStats();
  }, []);

  async function handleDeleteAll() {
    setDeleting(true);
    const { error } = await supabase.from('shipping_fee_payments').delete().gte('id', 1);
    if (!error) {
      setPaymentRows([]);
      setStats(prev => ({ ...prev, shippingCollected: 0 }));
      setConfirmDelete(false);
    } else {
      alert('Delete failed. Please try again.');
    }
    setDeleting(false);
  }

  const filteredPayments = paymentRows.filter(r =>
    (r.customers?.customer_name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Dashboard</h1>
      <p className="text-sm text-gray-400 mb-4">Overview of your store</p>

      {/* Pre-Order Control */}
      <div className={`rounded-2xl shadow-sm p-4 mb-5 border-2 ${ordersClosed ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ordersClosed ? "bg-red-500" : "bg-green-500"}`} />
              <h2 className="font-bold text-[#1e2d3d] text-sm">
                {ordersClosed ? "Pre-Orders Closed" : "Pre-Orders Open"}
              </h2>
            </div>
            <p className="text-xs text-gray-500 ml-4.5">
              {ordersClosed
                ? "Customers cannot purchase pre-order items. Available products are unaffected."
                : "Customers can purchase both available and pre-order products normally."}
            </p>
          </div>
          <button
            onClick={handleToggleOrders}
            disabled={toggling}
            className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
              ordersClosed ? "bg-red-500" : "bg-green-500"
            }`}
            title={ordersClosed ? "Click to re-open pre-orders" : "Click to close pre-orders"}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
              ordersClosed ? "translate-x-7" : "translate-x-1"
            }`} />
          </button>
        </div>
        {ordersClosed && (
          <p className="mt-3 text-xs font-semibold text-red-600 bg-red-100 border border-red-200 rounded-xl px-3 py-2">
            ⚠️ Pre-orders are closed. Available products can still be purchased. Toggle off to re-enable pre-orders.
          </p>
        )}

        {/* Announcement message */}
        <div className="mt-3 border-t border-black/10 pt-3">
          <label className="text-xs font-semibold text-[#1e2d3d] mb-1.5 block">
            Customer Announcement <span className="text-gray-400 font-normal">(shown as banner when pre-orders are closed)</span>
          </label>
          <textarea
            value={localMessage}
            onChange={e => setLocalMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Pre-orders are paused for the holiday season. We'll reopen on 27 Dec."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#F2AA25] resize-none transition-colors"
          />
          <button
            onClick={handleSaveMessage}
            disabled={savingMessage}
            className="mt-2 bg-[#1e2d3d] text-white text-xs font-semibold px-4 py-1.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {savingMessage ? "Saving…" : "Save Message"}
          </button>
        </div>
      </div>

      {/* Transaction Status Check */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-5 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-[#1e2d3d] text-sm">Transaction Status Check</h2>
            <p className="text-xs text-gray-400">Look up a Hubtel payment status by order ID</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={statusRef}
            onChange={e => { setStatusRef(e.target.value); setStatusResult(null); setStatusError(""); }}
            onKeyDown={e => e.key === "Enter" && handleCheckStatus()}
            placeholder="e.g. ORD-2026-1234"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#3b82f6] transition-colors"
          />
          <button
            onClick={handleCheckStatus}
            disabled={checkingStatus || !statusRef.trim()}
            className="bg-[#1e2d3d] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
          >
            {checkingStatus ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Checking…
              </>
            ) : "Check Status"}
          </button>
        </div>

        {statusError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 font-medium">
            🚫 {statusError}
          </div>
        )}

        {statusResult && !statusError && (() => {
          const d = statusResult.data ?? {};
          const statusColor =
            d.status === "Paid"     ? "bg-green-100 text-green-700" :
            d.status === "Unpaid"   ? "bg-amber-100 text-amber-700" :
            d.status === "Refunded" ? "bg-blue-100 text-blue-700"   :
            "bg-gray-100 text-gray-500";
          const rows = [
            ["Date",                d.date],
            ["Client Reference",    d.clientReference],
            ["Transaction ID",      d.transactionId],
            ["External Txn ID",     d.externalTransactionId],
            ["Payment Method",      d.paymentMethod],
            ["Currency",            d.currencycode],
            ["Amount",              d.amount          != null ? `GHS ${Number(d.amount).toLocaleString()}` : null],
            ["Charges",             d.charges         != null ? `GHS ${Number(d.charges).toLocaleString()}` : null],
            ["Amount After Charges",d.amountAfterCharges != null ? `GHS ${Number(d.amountAfterCharges).toLocaleString()}` : null],
            ["Fulfilled",           d.isFulfilled     != null ? (d.isFulfilled ? "Yes" : "No") : null],
          ].filter(([, v]) => v != null && v !== "");
          return (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-3 text-xs space-y-1.5">
              {/* Top-level envelope fields */}
              {statusResult.responseCode && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 font-medium">Response Code</span>
                  <span className="text-[#1e2d3d] font-semibold text-right">{statusResult.responseCode}</span>
                </div>
              )}
              {statusResult.message && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 font-medium">Message</span>
                  <span className="text-[#1e2d3d] font-semibold text-right">{statusResult.message}</span>
                </div>
              )}
              {/* Status badge */}
              {d.status && (
                <div className="flex justify-between items-center gap-4">
                  <span className="text-gray-500 font-medium">Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-semibold ${statusColor}`}>{d.status}</span>
                </div>
              )}
              {/* Remaining data fields */}
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 font-medium">{label}</span>
                  <span className="text-[#1e2d3d] font-semibold text-right break-all">{String(value)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Products"
          value={stats.products}
          loading={loading}
          color="bg-blue-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          }
        />
        <StatCard
          title="Total Orders"
          value={stats.orders}
          loading={loading}
          color="bg-amber-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          }
        />
        <StatCard
          title="Total Customers"
          value={stats.customers}
          loading={loading}
          color="bg-purple-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          }
        />
        <StatCard
          title="Total Revenue"
          value={`GHS ${stats.revenue.toLocaleString()}`}
          loading={loading}
          color="bg-green-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          }
        />
        <StatCard
          title="Shipping Collected"
          value={`GHS ${stats.shippingCollected.toLocaleString()}`}
          loading={loading}
          color="bg-cyan-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          }
        />
        <StatCard
          title="Total Cost Price"
          value={`GHS ${stats.totalCostPrice.toLocaleString()}`}
          loading={loading}
          color="bg-orange-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          }
        />
        <StatCard
          title="Total Profit"
          value={`GHS ${stats.totalProfit.toLocaleString()}`}
          loading={loading}
          color="bg-emerald-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          }
        />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Upload a Product", to: "/admin/products", color: "bg-blue-500" },
            { label: "View Orders", to: "/admin/orders", color: "bg-amber-500" },
            { label: "View Invoices", to: "/admin/invoices", color: "bg-green-500" },
          ].map(link => (
            <a
              key={link.to}
              href={link.to}
              className={`${link.color} text-white text-sm font-semibold px-4 py-3 rounded-xl hover:opacity-90 transition-opacity text-center block`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Shipping Fee Payments ───────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1e2d3d]">Shipping Fee Payments</h2>
            <p className="text-xs text-gray-400 mt-0.5">All shipping fee payments made by customers</p>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by customer name…"
              className="border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:border-[#F2AA25] transition-colors w-52"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <button
            onClick={() => setConfirmDelete(true)}
            disabled={paymentRows.length === 0}
            className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete All
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {query ? `No payments match "${query}".` : "No shipping fee payments yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer Name</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Total Shipping Fee</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((r, i) => {
                  const d = new Date(r.paid_at);
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{r.customers?.customer_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1e2d3d] hidden sm:table-cell">
                        {custTotals[r.customer_id] > 0 ? `GHS ${custTotals[r.customer_id].toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#F2AA25]">GHS {Number(r.amount_paid).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {r.balance === 0
                          ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Paid in Full</span>
                          : <span className="text-[#1e2d3d]">GHS {r.balance.toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-2">Delete All Payments?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete all shipping fee payment records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
