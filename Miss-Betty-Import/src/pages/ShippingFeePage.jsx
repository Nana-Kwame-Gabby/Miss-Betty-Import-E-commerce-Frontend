import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { colourMap } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function PayModal({ grandTotal, totalPaid, remaining, custId, onClose }) {
  const [amount, setAmount] = useState(String(remaining));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handlePay() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return setError("Enter a valid amount.");
    if (parsed > remaining) return setError(`Amount cannot exceed GHS ${remaining.toLocaleString()}.`);

    setSaving(true);

    const shpRef        = `SHP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const returnUrl     = `${window.location.origin}/shipping-fees?shpRef=${shpRef}&status=success`;
    const cancelUrl     = `${window.location.origin}/shipping-fees?shpRef=${shpRef}&status=cancelled`;

    const { data: fnData } = await supabase.functions.invoke("initiate-payment", {
      body: {
        orderId:     shpRef,
        amount:      parsed,
        description: "Miss Betty Import — Shipping Fee",
        returnUrl,
        cancellationUrl: cancelUrl,
      },
    });

    if (fnData?.error || !fnData?.checkoutUrl) {
      setSaving(false);
      return setError(fnData?.error || "Failed to start payment. Please try again.");
    }

    sessionStorage.setItem(`pending_shp_${shpRef}`, JSON.stringify({ customerId: custId, amount: parsed }));
    window.location.href = fnData.checkoutUrl;
  }

  const row = (label, value, highlight) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-[#F2AA25]" : "text-[#1e2d3d]"}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-[#1e2d3d] text-lg">Pay Shipping Fee</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4">
            {row("Total Shipping Fee", `GHS ${grandTotal.toLocaleString()}`)}
            {totalPaid > 0 && row("Already Paid", `GHS ${totalPaid.toLocaleString()}`)}
            {row("Remaining Balance", `GHS ${remaining.toLocaleString()}`, true)}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide">Amount to Pay (GHS)</label>
              <button
                onClick={() => { setAmount(String(remaining)); setError(""); }}
                className="text-xs text-[#F2AA25] font-semibold hover:underline"
              >
                Pay Full Amount
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={remaining}
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(""); }}
              className={`w-full border rounded-2xl px-4 py-2.5 text-sm outline-none transition-colors ${
                error ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[#F2AA25]"
              }`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-2xl text-sm hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePay}
              disabled={saving}
              className="flex-1 bg-[#F2AA25] text-white font-bold py-2.5 rounded-2xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Redirecting…
                </>
              ) : "Pay with Hubtel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShippingFeePage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [payments, setPayments] = useState([]);
  const [custId, setCustId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [shpMsg, setShpMsg] = useState(null); // { type: "success" | "cancelled", amount?: number }
  const redirectHandled = useRef(false);

  useEffect(() => {
    async function init() {
      // Handle Hubtel redirect before loading data
      const shpRef    = searchParams.get("shpRef");
      const shpStatus = searchParams.get("status");

      if (shpRef && !redirectHandled.current) {
        redirectHandled.current = true;
        const key   = `pending_shp_${shpRef}`;
        const saved = JSON.parse(sessionStorage.getItem(key) || "null");

        if (shpStatus === "success" && saved) {
          await supabase.from("shipping_fee_payments")
            .insert({ customer_id: saved.customerId, amount_paid: saved.amount });

          // Snapshot current fees into unlocked orders so future admin rate changes don't affect this customer
          const [{ data: custOrders }, { data: currentFees }] = await Promise.all([
            supabase.from('orders')
              .select('order_id, product_id, size')
              .eq('customer_id', saved.customerId)
              .is('shipping_fee', null),
            supabase.from('product_size_shipping_fees').select('product_id, size, shipping_fee'),
          ]);

          const snapMap = {};
          (currentFees ?? []).forEach(f => {
            snapMap[`${f.product_id}::${f.size}`] = Number(f.shipping_fee ?? 0);
          });

          await Promise.all(
            (custOrders ?? []).map(o => {
              const fee = snapMap[`${o.product_id}::${o.size ?? ''}`];
              if (fee == null) return Promise.resolve();
              return supabase.from('orders').update({ shipping_fee: fee }).eq('order_id', o.order_id);
            })
          );

          sessionStorage.removeItem(key);
          setShpMsg({ type: "success", amount: saved.amount });
        } else {
          sessionStorage.removeItem(key);
          if (shpStatus === "cancelled") setShpMsg({ type: "cancelled" });
        }
        setSearchParams({}, { replace: true });
      }

      // Load data
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }
      setCustId(cust.customer_id);

      const [{ data: orderData }, { data: feeData }, { data: paymentData }] = await Promise.all([
        supabase
          .from('orders')
          .select('*, products(product_name)')
          .eq('customer_id', cust.customer_id)
          .order('created_at', { ascending: false }),
        supabase.from('product_size_shipping_fees').select('*'),
        supabase.from('shipping_fee_payments').select('amount_paid').eq('customer_id', cust.customer_id),
      ]);

      const feeMap = {};
      (feeData ?? []).forEach(r => {
        feeMap[`${r.product_id}::${r.size ?? ''}`] = Number(r.shipping_fee ?? 0);
      });

      const enriched = (orderData ?? []).map(r => ({
        ...r,
        shipping_fee: r.shipping_fee != null
          ? Number(r.shipping_fee)
          : (feeMap[`${r.product_id}::${r.size ?? ''}`] ?? 0),
      }));

      setRows(enriched);
      setPayments(paymentData ?? []);
      setLoading(false);
    }

    init();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl sm:text-5xl mb-3">🚚</div>
        <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">No shipping info yet</h2>
        <p className="text-gray-400 text-sm mb-6">Shipping fees will appear here once your orders are processed.</p>
        <Link to="/shop" className="inline-block bg-[#F2AA25] text-white font-bold px-6 py-2.5 rounded-2xl hover:opacity-90">
          Shop Now
        </Link>
      </div>
    );
  }

  const grandTotal = rows.reduce((s, r) => s + Number(r.shipping_fee ?? 0) * Number(r.quantity ?? 1), 0);
  const totalPaid  = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const remaining  = Math.max(0, grandTotal - totalPaid);
  const fullyPaid  = grandTotal > 0 && remaining <= 0;

  if (fullyPaid) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">All Shipping Fees Paid!</h2>
        <p className="text-gray-400 text-sm mb-2">You have paid <span className="font-semibold text-green-600">GHS {totalPaid.toLocaleString()}</span> in shipping fees.</p>
        <p className="text-gray-400 text-sm mb-6">Thank you for your payment.</p>
        <Link to="/shop" className="inline-block bg-[#F2AA25] text-white font-bold px-6 py-2.5 rounded-2xl hover:opacity-90">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">

      {/* Hubtel redirect feedback banner */}
      {shpMsg && (
        <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 mb-3 text-sm font-medium ${
          shpMsg.type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-yellow-50 border border-yellow-200 text-yellow-800"
        }`}>
          <span>
            {shpMsg.type === "success"
              ? `✓ Shipping fee payment of GHS ${Number(shpMsg.amount).toLocaleString()} confirmed.`
              : "Payment was cancelled. No charge was made."}
          </span>
          <button onClick={() => setShpMsg(null)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d]">Shipping Fees</h1>
        {grandTotal > 0 && (
          <button
            onClick={() => setShowPayModal(true)}
            className="bg-[#F2AA25] text-white font-bold text-sm px-4 py-2 sm:py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Pay Now · GHS {remaining.toLocaleString()} remaining
          </button>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-3 sm:mb-5">Shipping fee breakdown for your orders</p>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Order ID", "Items", "Size", "Colour", "Qty", "Shipping Fee (GHS/item)", "Total Shipping (GHS)"].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const fee = Number(row.shipping_fee ?? 0);
              const qty = Number(row.quantity ?? 1);
              const hasFee = fee > 0;
              return (
                <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-3 font-semibold text-[#F2AA25] text-xs whitespace-nowrap">{row.order_id}</td>
                  <td className="px-3 py-3 text-[#1e2d3d]">{row.products?.product_name ?? `Product #${row.product_id}`}</td>
                  <td className="px-3 py-3 text-gray-500">{row.size ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: colourMap[row.colour] || "#ccc" }} />
                      <span className="text-gray-600">{row.colour ?? '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{qty}</td>
                  <td className="px-3 py-3 font-semibold text-[#1e2d3d]">{hasFee ? `GHS ${fee.toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-3 font-bold text-[#F2AA25]">{hasFee ? `GHS ${(fee * qty).toLocaleString()}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          {grandTotal > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#1e2d3d] bg-gray-50">
                <td colSpan={6} className="px-3 py-3 text-right font-bold text-[#1e2d3d] text-sm">Grand Total</td>
                <td className="px-3 py-3 font-bold text-[#F2AA25] text-sm">GHS {grandTotal.toLocaleString()}</td>
              </tr>
              {totalPaid > 0 && (
                <tr className="bg-gray-50">
                  <td colSpan={6} className="px-3 py-2 text-right text-sm text-gray-500">Already Paid</td>
                  <td className="px-3 py-2 text-sm text-green-600 font-semibold">− GHS {totalPaid.toLocaleString()}</td>
                </tr>
              )}
              {totalPaid > 0 && (
                <tr className="bg-gray-50">
                  <td colSpan={6} className="px-3 py-2 text-right font-bold text-[#1e2d3d] text-sm">Remaining</td>
                  <td className="px-3 py-2 font-bold text-[#1e2d3d] text-sm">GHS {remaining.toLocaleString()}</td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {rows.map(row => {
          const fee = Number(row.shipping_fee ?? 0);
          const qty = Number(row.quantity ?? 1);
          const hasFee = fee > 0;
          return (
            <div key={row.id} className="bg-white rounded-2xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#F2AA25] text-sm">{row.order_id}</span>
                {hasFee && (
                  <span className="text-xs font-bold text-white bg-[#F2AA25] px-2.5 py-1 rounded-full">
                    GHS {(fee * qty).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-[#1e2d3d] mb-3">
                {row.products?.product_name ?? `Product #${row.product_id}`}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                <span><span className="font-semibold text-[#1e2d3d]">Size:</span> {row.size ?? '—'}</span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-[#1e2d3d]">Colour:</span>
                  <span className="w-2.5 h-2.5 rounded-full border border-gray-200 inline-block mx-1" style={{ backgroundColor: colourMap[row.colour] || "#ccc" }} />
                  {row.colour ?? '—'}
                </span>
                <span><span className="font-semibold text-[#1e2d3d]">Qty:</span> {qty}</span>
                <span><span className="font-semibold text-[#1e2d3d]">Fee/item:</span> {hasFee ? `GHS ${fee.toLocaleString()}` : '—'}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-400">Total Shipping</span>
                <span className="font-bold text-[#1e2d3d] text-sm">{hasFee ? `GHS ${(fee * qty).toLocaleString()}` : '—'}</span>
              </div>
            </div>
          );
        })}

        {grandTotal > 0 && (
          <div className="bg-[#1e2d3d] rounded-2xl p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white font-semibold text-sm">Grand Total</span>
              <span className="text-[#F2AA25] font-bold text-lg">GHS {grandTotal.toLocaleString()}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-gray-400">Already Paid</span>
                  <span className="text-green-400 font-semibold">− GHS {totalPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-white/10 pt-1">
                  <span className="text-white font-semibold">Remaining</span>
                  <span className="text-white font-bold">GHS {remaining.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        )}

        {grandTotal > 0 && (
          <button
            onClick={() => setShowPayModal(true)}
            className="w-full bg-[#F2AA25] text-white font-bold text-sm py-2.5 rounded-2xl hover:opacity-90 transition-opacity"
          >
            Pay Now · GHS {remaining.toLocaleString()} remaining
          </button>
        )}
      </div>

      <div className="mt-5 text-center">
        <Link to="/shop" className="inline-block text-[#F2AA25] font-semibold hover:underline">
          ← Continue Shopping
        </Link>
      </div>

      {showPayModal && (
        <PayModal
          grandTotal={grandTotal}
          totalPaid={totalPaid}
          remaining={remaining}
          custId={custId}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  );
}
