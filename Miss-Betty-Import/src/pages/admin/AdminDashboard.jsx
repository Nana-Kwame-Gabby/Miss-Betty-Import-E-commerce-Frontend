import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAppSettings } from "../../context/AppSettingsContext";
import * as XLSX from 'xlsx';
import { useSelectedOrderPeriod } from "../../hooks/useSelectedOrderPeriod";
import PeriodSwitcher from "../../components/PeriodSwitcher";
import SalesStatCards from "./SalesStatCards";
import { summariseSales } from "../../lib/salesSummary";

export default function AdminDashboard() {
  const { periods, activePeriod, selectedId, selectPeriod, loading: periodsLoading } = useSelectedOrderPeriod();
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
  const [stats, setStats] = useState({ products: 0, orders: 0, customers: 0, revenue: 0, cost: 0, profit: 0, misc: 0, shippingCollected: 0 });
  const [paymentRows, setPaymentRows] = useState([]);
  const [custTotals, setCustTotals] = useState({});
  const [productCustTotals, setProductCustTotals] = useState({});
  const [customerShippingData, setCustomerShippingData] = useState([]);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
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
    console.log("[check-payment-status] Checking transaction status for:", statusRef.trim());
    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { clientReference: statusRef.trim() },
      });
      console.log("[check-payment-status] Raw response — data:", data, "| error:", error);
      if (error) {
        console.error("[check-payment-status] Supabase function error:", error.message ?? error);
        setStatusError(error.message ?? "Failed to call payment service");
      } else if (data?.error) {
        console.warn("[check-payment-status] Payment service error:", data.error);
        setStatusError(data.error);
      } else {
        console.log("[check-payment-status] Transaction data:", data);
        setStatusResult(data);
      }
    } catch (err) {
      console.error("[check-payment-status] Unexpected error:", err);
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
    if (selectedId == null) return;

    async function loadStats() {
      const [
        { count: products },
        { data: paymentData },
        { data: allOrderData },
        { data: allFeeData },
      ] = await Promise.all([
        supabase.from('products').select('product_id, product_status!inner(status_name)', { count: 'exact', head: true }).eq('product_status.status_name', 'Pre-order').is('archived_at', null),
        supabase.from('shipping_fee_payments')
          .select('customer_id, amount_paid, paid_at, product_id, size, customers(customer_name), products(product_name)')
          .eq('order_period_id', selectedId)
          .order('paid_at', { ascending: false }),
        supabase.from('orders').select('customer_id, product_id, product_name_snapshot, size, quantity, unit_price, status, product_type, cost_price, profit, misc_amount, shipping_fee, shipping_fee_paid, customers(customer_name), products(product_name)').eq('deleted_by_admin', false).eq('order_period_id', selectedId),
        supabase.from('product_size_shipping_fees').select('product_id, size, shipping_fee').eq('order_period_id', selectedId),
      ]);

      // This dashboard covers Pre-order goods only; Available Goods sales have their own
      // dashboard. product_type is recorded on each order when it's placed.
      // Cancelled lines are excluded everywhere, including the Customer Shipping Fee Status table.
      const preOrderRows = (allOrderData ?? []).filter(o => o.product_type !== 'Available' && o.status !== 'Cancelled');
      const shippingCollected = (paymentData ?? []).reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);

      const feeMap = {};
      (allFeeData ?? []).forEach(f => {
        feeMap[`${f.product_id}::${f.size}`] = Number(f.shipping_fee ?? 0);
      });
      const totalByCustomer = {};
      const totalByProductCust = {};
      preOrderRows.forEach(o => {
        const qty = Number(o.quantity ?? 1);
        const fee = o.shipping_fee != null
          ? Number(o.shipping_fee)
          : (feeMap[`${o.product_id}::${o.size ?? ''}`] ?? 0);
        totalByCustomer[o.customer_id] = (totalByCustomer[o.customer_id] ?? 0) + fee * qty;
        const pKey = `${o.customer_id}::${o.product_id}::${o.size ?? ''}`;
        totalByProductCust[pKey] = (totalByProductCust[pKey] ?? 0) + fee * qty;
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

      // Build paid-product set from new-style payment records (those with product_id)
      const paidProductSet = new Set();
      (paymentData ?? []).forEach(p => {
        if (p.product_id != null) {
          paidProductSet.add(`${p.customer_id}::${p.product_id}::${p.size ?? ''}`);
        }
      });

      // Build customer-centric shipping data
      const custMap = {};
      preOrderRows.forEach(o => {
        if (!custMap[o.customer_id]) {
          custMap[o.customer_id] = {
            customerId: o.customer_id,
            customerName: o.customers?.customer_name ?? `Customer #${o.customer_id}`,
            productGroups: {},
          };
        }
        const pKey = `${o.product_id ?? `name:${o.product_name_snapshot ?? ''}`}::${o.size ?? ''}`;
        if (!custMap[o.customer_id].productGroups[pKey]) {
          const feePerItem = o.shipping_fee != null
            ? Number(o.shipping_fee)
            : (feeMap[`${o.product_id}::${o.size ?? ''}`] ?? 0);
          custMap[o.customer_id].productGroups[pKey] = {
            productId: o.product_id,
            productName: o.products?.product_name ?? o.product_name_snapshot ?? 'Product no longer listed',
            size: o.size ?? null,
            sizeDisplay: o.size ?? '—',
            totalQty: 0,
            feePerItem,
          };
        }
        const grp = custMap[o.customer_id].productGroups[pKey];
        grp.totalQty += Number(o.quantity ?? 1);
      });

      const builtCustomerShippingData = Object.values(custMap).map(cust => {
        const products = Object.values(cust.productGroups).map(grp => {
          const paidKey = `${cust.customerId}::${grp.productId}::${grp.size ?? ''}`;
          const isPaid  = paidProductSet.has(paidKey);
          return { ...grp, totalFee: grp.feePerItem * grp.totalQty, isPaid };
        });
        const totalFee  = products.reduce((s, p) => s + p.totalFee, 0);
        const totalPaid = products.filter(p => p.isPaid).reduce((s, p) => s + p.totalFee, 0);
        return {
          customerId:   cust.customerId,
          customerName: cust.customerName,
          products,
          totalFee,
          totalPaid,
          isFullyPaid:  totalFee > 0 && totalPaid >= totalFee,
        };
      });

      setStats({ products: products ?? 0, ...summariseSales(preOrderRows), shippingCollected });
      setPaymentRows(enriched);
      setCustTotals(totalByCustomer);
      setProductCustTotals(totalByProductCust);
      setCustomerShippingData(builtCustomerShippingData);
      setLoading(false);
    }
    loadStats();
  }, [selectedId]);

  async function handleDeleteAll() {
    if (selectedId == null) return;
    setDeleting(true);
    const { error } = await supabase.from('shipping_fee_payments').delete().eq('order_period_id', selectedId);
    if (!error) {
      setPaymentRows([]);
      setCustomerShippingData(prev => prev.map(c => ({
        ...c,
        products: c.products.map(p => ({ ...p, isPaid: false })),
        totalPaid: 0,
        isFullyPaid: false,
      })));
      setStats(prev => ({ ...prev, shippingCollected: 0 }));
      setConfirmDelete(false);
    } else {
      alert('Delete failed. Please try again.');
    }
    setDeleting(false);
  }

  const filteredCustomers = customerShippingData.filter(c =>
    c.customerName.toLowerCase().includes(query.toLowerCase())
  );

  function handleDownloadShippingPayments() {
    const rows = filteredCustomers.flatMap(cust =>
      cust.products.map(p => ({
        'Customer Name':     cust.customerName,
        'Product':           p.productName,
        'Size':              p.sizeDisplay,
        'Qty':               p.totalQty,
        'Fee / Item (GHS)':  p.feePerItem > 0 ? p.feePerItem : '',
        'Total Fee (GHS)':   p.totalFee > 0 ? p.totalFee : '',
        'Payment Status':    p.isPaid ? 'Paid' : 'Unpaid',
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipping Status');
    XLSX.writeFile(wb, 'Miss-Betty-Shipping-Status.xlsx');
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy">Pre-order Dashboard</h1>
        <PeriodSwitcher periods={periods} selectedId={selectedId} activeId={activePeriod?.id} onChange={selectPeriod} loading={periodsLoading} />
      </div>
      <p className="text-sm text-mbi-slate mb-4">Pre-order goods sales and shipping. Available Goods sales are on the Available Goods Dashboard.</p>

      {/* Pre-Order Control */}
      <div className={`rounded-mbi-card p-4 mb-5 border-2 ${ordersClosed ? "bg-mbi-error-tint border-mbi-error/30" : "bg-mbi-available-tint border-mbi-available/30"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ordersClosed ? "bg-mbi-error" : "bg-mbi-available"}`} />
              <h2 className="font-bold text-mbi-navy text-sm">
                {ordersClosed ? "Pre-Orders Closed" : "Pre-Orders Open"}
              </h2>
            </div>
            <p className="text-xs text-mbi-slate ml-4.5">
              {ordersClosed
                ? "Customers cannot purchase pre-order items. Available products are unaffected."
                : "Customers can purchase both available and pre-order products normally."}
            </p>
          </div>
          <button
            onClick={handleToggleOrders}
            disabled={toggling}
            className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
              ordersClosed ? "bg-mbi-error" : "bg-mbi-available"
            }`}
            title={ordersClosed ? "Click to re-open pre-orders" : "Click to close pre-orders"}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
              ordersClosed ? "translate-x-7" : "translate-x-1"
            }`} />
          </button>
        </div>
        {ordersClosed && (
          <p className="mt-3 text-xs font-semibold text-mbi-error bg-mbi-error-tint border border-mbi-error/30 rounded-lg px-3 py-2">
            ⚠️ Pre-orders are closed. Available products can still be purchased. Toggle off to re-enable pre-orders.
          </p>
        )}

        {/* Announcement message */}
        <div className="mt-3 border-t border-black/10 pt-3">
          <label className="text-xs font-semibold text-mbi-navy mb-1.5 block">
            Customer Announcement <span className="text-mbi-slate font-normal">(shown as banner when pre-orders are closed)</span>
          </label>
          <textarea
            value={localMessage}
            onChange={e => setLocalMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Pre-orders are paused for the holiday season. We'll reopen on 27 Dec."
            className="w-full border border-mbi-hairline rounded-lg px-3 py-2 text-xs outline-none focus:border-mbi-navy resize-none transition-colors"
          />
          <button
            onClick={handleSaveMessage}
            disabled={savingMessage}
            className="mbi-press mt-2 bg-mbi-navy text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-50"
          >
            {savingMessage ? "Saving…" : "Save Message"}
          </button>
        </div>
      </div>

      {/* Transaction Status Check */}
      <div className="bg-white rounded-mbi-card p-4 mb-5 border border-mbi-hairline-soft">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-mbi-preorder-tint flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e2d3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-mbi-navy text-sm">Transaction Status Check</h2>
            <p className="text-xs text-mbi-slate">Look up a Hubtel payment status by order ID</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={statusRef}
            onChange={e => { setStatusRef(e.target.value); setStatusResult(null); setStatusError(""); }}
            onKeyDown={e => e.key === "Enter" && handleCheckStatus()}
            placeholder="e.g. ORD-2026-1234"
            className="flex-1 border border-mbi-hairline rounded-lg px-3 py-2 text-xs outline-none focus:border-[#3b82f6] transition-colors"
          />
          <button
            onClick={handleCheckStatus}
            disabled={checkingStatus || !statusRef.trim()}
            className="mbi-press bg-mbi-navy text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
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
          <div className="mt-3 bg-mbi-error-tint border border-mbi-error/30 rounded-lg px-3 py-2.5 text-xs text-mbi-error font-medium">
            🚫 {statusError}
          </div>
        )}

        {statusResult && !statusError && (() => {
          const dataObj = statusResult.data;
          const d = (dataObj && typeof dataObj === "object" && (dataObj.status || dataObj.transactionId || dataObj.clientReference))
            ? dataObj
            : statusResult;
          const hasEnvelope = statusResult.responseCode || statusResult.message;
          const hasData     = d.status || d.clientReference || d.transactionId || d.amount != null;
          if (!hasEnvelope && !hasData) {
            return (
              <div className="mt-3 bg-mbi-amber-tint border border-mbi-amber/40 rounded-lg px-3 py-2.5 text-xs text-mbi-amber-ink font-medium">
                ⚠️ No transaction data found for this Order ID. Verify the ID is correct and that payment was initiated via Hubtel.
              </div>
            );
          }
          const statusColor =
            d.status === "Paid"     ? "bg-mbi-available-tint text-mbi-available" :
            d.status === "Unpaid"   ? "bg-mbi-amber-tint text-mbi-amber-ink" :
            d.status === "Refunded" ? "bg-mbi-preorder-tint text-mbi-navy"   :
            "bg-mbi-surface-soft text-mbi-slate";
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
            <div className="mt-3 bg-mbi-preorder-tint border border-mbi-navy/15 rounded-lg px-3 py-3 text-xs space-y-1.5">
              {/* Top-level envelope fields */}
              {statusResult.responseCode && (
                <div className="flex justify-between gap-4">
                  <span className="text-mbi-slate font-medium">Response Code</span>
                  <span className="text-mbi-navy font-semibold text-right">{statusResult.responseCode}</span>
                </div>
              )}
              {statusResult.message && (
                <div className="flex justify-between gap-4">
                  <span className="text-mbi-slate font-medium">Message</span>
                  <span className="text-mbi-navy font-semibold text-right">{statusResult.message}</span>
                </div>
              )}
              {/* Status badge */}
              {d.status && (
                <div className="flex justify-between items-center gap-4">
                  <span className="text-mbi-slate font-medium">Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-semibold ${statusColor}`}>{d.status}</span>
                </div>
              )}
              {/* Remaining data fields */}
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-mbi-slate font-medium">{label}</span>
                  <span className="text-mbi-navy font-semibold text-right break-all">{String(value)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <SalesStatCards stats={stats} loading={loading} shippingCollected={stats.shippingCollected} />

      <div className="bg-white rounded-mbi-card p-5 border border-mbi-hairline mb-8">
        <h2 className="text-sm font-bold text-mbi-navy mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Upload a Product", to: "/admin/products" },
            { label: "View Orders", to: "/admin/orders" },
            { label: "View Invoices", to: "/admin/invoices" },
          ].map(link => (
            <a
              key={link.to}
              href={link.to}
              className="mbi-press block text-center text-sm font-semibold px-4 py-3 rounded-lg bg-white text-mbi-navy border border-mbi-navy/25 hover:border-mbi-navy transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Customer Shipping Fee Status ───────────────────────────────── */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-mbi-hairline-soft flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-mbi-navy">Customer Shipping Fee Status</h2>
            <p className="text-xs text-mbi-slate mt-0.5">Click a customer to see per-product shipping fee details</p>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-mbi-slate" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by customer name…"
              className="border border-mbi-hairline rounded-lg pl-8 pr-4 py-2 text-xs outline-none focus:border-mbi-navy transition-colors w-52"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-mbi-slate hover:text-mbi-navy-body">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <button
            onClick={handleDownloadShippingPayments}
            disabled={filteredCustomers.length === 0}
            className="mbi-press flex items-center gap-1.5 bg-mbi-navy text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Excel
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            disabled={paymentRows.length === 0}
            className="flex items-center gap-1.5 bg-mbi-error text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-mbi-error/90 transition-colors disabled:opacity-40"
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
            <div className="w-7 h-7 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-mbi-slate text-sm">
            {query ? `No customers match "${query}".` : "No orders placed yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Customer</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Products</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Total Fee</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(cust => (
                  <>
                    <tr
                      key={cust.customerId}
                      onClick={() => setExpandedCustomer(expandedCustomer === cust.customerId ? null : cust.customerId)}
                      className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-bold">
                        <span className={cust.totalFee === 0 ? "text-mbi-slate" : cust.isFullyPaid ? "text-mbi-available" : "text-mbi-error"}>
                          {cust.customerName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-mbi-slate hidden sm:table-cell">
                        {cust.products.length}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-mbi-navy hidden sm:table-cell">
                        {cust.totalFee > 0 ? `GHS ${cust.totalFee.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-mbi-available hidden sm:table-cell">
                        {cust.totalPaid > 0 ? `GHS ${cust.totalPaid.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {cust.totalFee === 0
                          ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-mbi-surface-soft text-mbi-slate">No Fee Set</span>
                          : cust.isFullyPaid
                            ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-mbi-available-tint text-mbi-available">Fully Paid</span>
                            : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-mbi-error-tint text-mbi-error">
                                Owes GHS {(cust.totalFee - cust.totalPaid).toLocaleString()}
                              </span>
                        }
                      </td>
                      <td className="px-4 py-3 text-mbi-slate text-right">
                        <svg
                          className={`inline-block transition-transform duration-200 ${expandedCustomer === cust.customerId ? "rotate-180" : ""}`}
                          xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </td>
                    </tr>

                    {expandedCustomer === cust.customerId && (
                      <tr key={`${cust.customerId}-detail`}>
                        <td colSpan={6} className="p-0 bg-mbi-surface-soft">
                          <div className="px-6 py-3 border-b border-mbi-hairline-soft">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-mbi-slate uppercase tracking-wide">
                                  <th className="text-left pb-2 font-semibold">Product</th>
                                  <th className="text-left pb-2 font-semibold hidden sm:table-cell">Size</th>
                                  <th className="text-center pb-2 font-semibold hidden sm:table-cell">Qty</th>
                                  <th className="text-right pb-2 font-semibold hidden sm:table-cell">Fee / Item</th>
                                  <th className="text-right pb-2 font-semibold">Total Fee</th>
                                  <th className="text-right pb-2 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cust.products.map((p, idx) => (
                                  <tr key={idx} className="border-t border-mbi-hairline">
                                    <td className="py-2 pr-3 font-semibold text-mbi-navy">{p.productName}</td>
                                    <td className="py-2 pr-3 text-mbi-slate hidden sm:table-cell">{p.sizeDisplay}</td>
                                    <td className="py-2 pr-3 text-center text-mbi-slate hidden sm:table-cell">{p.totalQty}</td>
                                    <td className="py-2 pr-3 text-right text-mbi-slate hidden sm:table-cell">
                                      {p.feePerItem > 0 ? `GHS ${p.feePerItem.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="py-2 pr-3 text-right font-semibold text-mbi-navy">
                                      {p.totalFee > 0 ? `GHS ${p.totalFee.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="py-2 text-right">
                                      {p.isPaid
                                        ? <span className="px-2 py-0.5 rounded-full bg-mbi-available-tint text-mbi-available font-semibold">Paid</span>
                                        : <span className="px-2 py-0.5 rounded-full bg-mbi-error-tint text-mbi-error font-semibold">Unpaid</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-mbi-card shadow-mbi-float p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-mbi-navy mb-2">Delete All Payments?</h3>
            <p className="text-sm text-mbi-slate mb-5">
              This will permanently delete all shipping fee payment records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-semibold px-4 py-2 rounded-lg border border-mbi-hairline hover:bg-mbi-surface-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-mbi-error text-white hover:bg-mbi-error/90 disabled:opacity-60"
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
