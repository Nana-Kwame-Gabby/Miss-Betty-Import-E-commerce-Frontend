import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function groupOrdersByProductSize(orders, feeMap, periodNameMap) {
  const groups = {};
  for (const o of orders) {
    // Available goods carry no shipping fee (same rule as create_shipping_payment).
    if (o.product_type === 'Available') continue;
    const key = `${o.order_period_id}::${o.product_id}::${o.size ?? ''}`;
    if (!groups[key]) {
      groups[key] = {
        orderPeriodId: o.order_period_id,
        periodName: periodNameMap[o.order_period_id] ?? null,
        productId: o.product_id,
        productName: o.products?.product_name ?? `Product #${o.product_id}`,
        size: o.size ?? null,
        sizeDisplay: o.size ?? '—',
        orders: [],
        totalQty: 0,
      };
    }
    groups[key].orders.push(o);
    groups[key].totalQty += Number(o.quantity ?? 1);
  }
  return Object.values(groups).map(g => {
    const feePerItem = feeMap[`${g.orderPeriodId}::${g.productId}::${g.size ?? ''}`] ?? 0;
    return {
      ...g,
      feePerItem,
      totalFee: feePerItem * g.totalQty,
      lineIds: g.orders.map(o => o.id),
    };
  });
}

const money = n => Math.round(Number(n) * 100) / 100;

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

function PayAllButton({ amount, paying, onClick, block = false }) {
  return (
    <button
      onClick={onClick}
      disabled={!!paying}
      className={`${block ? "w-full py-2.5 text-sm" : "px-4 py-2 text-xs"} inline-flex items-center justify-center gap-2 bg-[#F2AA25] text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap`}
    >
      {paying === 'all' ? <><Spinner /> Redirecting…</> : `Pay All Shipping Fees — GHS ${amount.toLocaleString()}`}
    </button>
  );
}

// Result of returning from Hubtel. "confirming" waits for the server, which marks fees
// paid only after Hubtel itself confirms the payment.
function PaymentBanner({ shpMsg, onClose }) {
  if (!shpMsg) return null;
  const styles = {
    confirming: "bg-blue-50 border-blue-200 text-blue-800",
    success:    "bg-green-50 border-green-200 text-green-800",
    cancelled:  "bg-yellow-50 border-yellow-200 text-yellow-800",
    pending:    "bg-yellow-50 border-yellow-200 text-yellow-800",
    error:      "bg-red-50 border-red-200 text-red-700",
  };
  const text = {
    confirming: "Confirming your payment with Hubtel…",
    success:    `✓ Shipping fee payment of GHS ${Number(shpMsg.amount ?? 0).toLocaleString()} confirmed.`,
    cancelled:  "Payment was cancelled. No charge was made — your shipping fees are still outstanding.",
    pending:    "We haven't received confirmation from Hubtel yet. If you were charged, your fees will update here automatically once it arrives.",
    error:      shpMsg.msg,
  };
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 mb-3 text-sm font-medium border ${styles[shpMsg.type]}`}>
      <span className="flex items-center gap-2">{shpMsg.type === "confirming" && <Spinner />}{text[shpMsg.type]}</span>
      {shpMsg.type !== "confirming" && (
        <button onClick={onClose} aria-label="Dismiss" className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

export default function ShippingFeePage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups]     = useState([]);
  const [custId, setCustId]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(null);
  // { type: 'confirming' | 'success' | 'cancelled' | 'pending' | 'error', amount?, msg? }
  const [shpMsg, setShpMsg]     = useState(null);
  const redirectHandled         = useRef(false);
  const customerIdRef           = useRef(null);

  // Sum of fees that are set and unpaid right now — the Pay All amount.
  const payableTotal = money(groups.filter(g => g.feePerItem > 0).reduce((s, g) => s + g.totalFee, 0));

  async function refreshGroups(customerId) {
    const [{ data: orderData }, { data: feeData }, { data: periodData }] = await Promise.all([
      supabase.from('orders')
        .select('*, products(product_name, product_status(status_name))')
        .eq('customer_id', customerId)
        .eq('shipping_fee_paid', false)
        .neq('status', 'Cancelled') // no shipping fee for cancelled products
        .order('created_at', { ascending: false }),
      supabase.from('product_size_shipping_fees').select('*'),
      supabase.from('order_periods').select('id, name'),
    ]);

    const feeMap = {};
    (feeData ?? []).forEach(r => {
      feeMap[`${r.order_period_id}::${r.product_id}::${r.size ?? ''}`] = Number(r.shipping_fee ?? 0);
    });
    const periodNameMap = {};
    (periodData ?? []).forEach(p => { periodNameMap[p.id] = p.name; });

    setGroups(groupOrdersByProductSize(orderData ?? [], feeMap, periodNameMap));
  }

  // Wait for the server to confirm a payment we were redirected back from. Polls the
  // payment request; if Hubtel's callback hasn't arrived yet, asks the server to check
  // with Hubtel directly once (check-payment-status applies it only if Hubtel says paid).
  async function confirmPayment(ref) {
    setShpMsg({ type: "confirming" });
    let askedHubtel = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data: req } = await supabase
        .from('shipping_payment_requests')
        .select('status, amount')
        .eq('shp_ref', ref)
        .maybeSingle();
      if (req?.status === 'paid') {
        setShpMsg({ type: "success", amount: req.amount });
        if (customerIdRef.current) refreshGroups(customerIdRef.current);
        return;
      }
      if (req?.status === 'amount_mismatch') {
        setShpMsg({ type: "error", msg: "We couldn't match this payment to your shipping fees. Please contact us on WhatsApp (+233 20 269 7541) and we'll sort it out." });
        return;
      }
      if (!askedHubtel && attempt >= 2) {
        askedHubtel = true;
        await supabase.functions.invoke("check-payment-status", { body: { clientReference: ref } }).catch(() => {});
        continue;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    setShpMsg({ type: "pending" });
  }

  useEffect(() => {
    async function init() {
      const shpRef    = searchParams.get("shpRef");
      const shpStatus = searchParams.get("status");

      // Back from Hubtel. The redirect proves nothing: fees are marked paid only by the
      // server once Hubtel confirms the payment (hubtel-callback / check-payment-status).
      if (shpRef && !redirectHandled.current) {
        redirectHandled.current = true;
        setSearchParams({}, { replace: true });
        if (shpStatus === "success") confirmPayment(shpRef);
        else setShpMsg({ type: "cancelled" });
      }

      // Load customer
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }
      setCustId(cust.customer_id);
      customerIdRef.current = cust.customer_id;

      // Load unpaid orders + fee rates
      await refreshGroups(cust.customer_id);
      setLoading(false);
    }

    init();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-reflect admin edits: a status/fee change on this customer's orders, or any
  // shipping-fee-rate change (including on a period closed months ago), refetches
  // and regroups without the customer needing to reload the page.
  useEffect(() => {
    if (!custId) return;
    const ordersChannel = supabase
      .channel(`shipping_fees_orders_${custId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${custId}` },
        () => refreshGroups(custId))
      .subscribe();
    const ratesChannel = supabase
      .channel('shipping_fees_rates_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_size_shipping_fees' },
        () => refreshGroups(custId))
      .subscribe();
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(ratesChannel);
    };
  }, [custId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start a payment for one product's fees (lineIds) or all outstanding fees (null).
  // The amount is calculated by the server from what is unpaid right now.
  async function startPayment(payKey, lineIds, description, shownAmount) {
    setPaying(payKey);
    setShpMsg(null);
    const { data, error } = await supabase.rpc('create_shipping_payment', { p_line_ids: lineIds });
    const req = Array.isArray(data) ? data[0] : data;
    if (error || !req?.shp_ref) {
      setPaying(null);
      setShpMsg({ type: "error", msg: error?.message || "Couldn't start the payment. Please try again." });
      if (customerIdRef.current) refreshGroups(customerIdRef.current);
      return;
    }
    // If a fee changed since the page loaded, show the new amounts before charging anything.
    if (Math.abs(money(req.amount) - money(shownAmount)) > 0.009) {
      setPaying(null);
      setShpMsg({ type: "error", msg: `Your shipping fees have just been updated — the amount due is now GHS ${money(req.amount).toLocaleString()}. Please review and pay again.` });
      if (customerIdRef.current) refreshGroups(customerIdRef.current);
      return;
    }

    const returnUrl = `${window.location.origin}/shipping-fees?shpRef=${req.shp_ref}&status=success`;
    const cancelUrl = `${window.location.origin}/shipping-fees?shpRef=${req.shp_ref}&status=cancelled`;
    const { data: fnData } = await supabase.functions.invoke("initiate-payment", {
      body: {
        orderId:         req.shp_ref,
        amount:          money(req.amount),
        description:     `Miss Betty Import — ${description}`,
        returnUrl,
        cancellationUrl: cancelUrl,
      },
    });

    if (!fnData?.checkoutUrl) {
      setPaying(null);
      setShpMsg({ type: "error", msg: fnData?.error || "Payment failed to start. Nothing was charged — please try again." });
      return;
    }
    window.location.href = fnData.checkoutUrl;
  }

  function handlePayGroup(group) {
    startPayment(
      `${group.orderPeriodId}::${group.productId}::${group.size ?? ''}`,
      group.lineIds,
      `Shipping: ${group.productName} (${group.sizeDisplay})`,
      group.totalFee,
    );
  }

  function handlePayAll() {
    startPayment('all', null, 'Shipping: all outstanding fees', payableTotal);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        {shpMsg && shpMsg.type !== "success" && (
          <div className="max-w-xl mx-auto mb-6 text-left"><PaymentBanner shpMsg={shpMsg} onClose={() => setShpMsg(null)} /></div>
        )}
        {shpMsg?.type === "success" ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">All shipping fees have been paid.</h2>
            <p className="text-gray-400 text-sm mb-6">Thank you! Your payment has been confirmed.</p>
          </>
        ) : (
          <>
            <div className="text-4xl sm:text-5xl mb-3">🚚</div>
            <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">No shipping fees pending</h2>
            <p className="text-gray-400 text-sm mb-6">Shipping fees will appear here once your orders are processed.</p>
          </>
        )}
        <Link to="/shop" className="inline-block bg-[#F2AA25] text-white font-bold px-6 py-2.5 rounded-2xl hover:opacity-90">
          {shpMsg?.type === "success" ? "Continue Shopping" : "Shop Now"}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">

      <PaymentBanner shpMsg={shpMsg} onClose={() => setShpMsg(null)} />

      <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d] mb-1">Shipping Fees</h1>
      <p className="text-sm text-gray-400 mb-3 sm:mb-5">
        Shipping fees are assigned by our team. Pay for one product at a time, or pay everything at once.
      </p>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Product", "Size", "Qty", "Fee / Item (GHS)", "Total Shipping (GHS)", ""].map((h, i) => (
                <th key={i} className={`text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap ${i === 5 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, i) => {
              const groupKey = `${group.orderPeriodId}::${group.productId}::${group.size ?? ''}`;
              const hasFee   = group.feePerItem > 0;
              const isPaying = paying === groupKey;
              return (
                <tr key={groupKey} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3 font-semibold text-[#1e2d3d]">
                    {group.productName}
                    {group.periodName && <span className="block text-xs font-normal text-gray-400">{group.periodName}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{group.sizeDisplay}</td>
                  <td className="px-4 py-3 text-gray-600">{group.totalQty}</td>
                  <td className="px-4 py-3 font-semibold text-[#1e2d3d]">
                    {hasFee ? `GHS ${group.feePerItem.toLocaleString()}` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#DC2626]">
                    {hasFee ? `GHS ${group.totalFee.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {hasFee ? (
                      <button
                        onClick={() => handlePayGroup(group)}
                        disabled={!!paying}
                        className="inline-flex items-center gap-2 bg-[#F2AA25] text-white font-bold text-xs px-3 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap"
                      >
                        {isPaying ? (
                          <>
                            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Redirecting…
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                            </svg>
                            Pay GHS {group.totalFee.toLocaleString()}
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                        Awaiting Shipping Fee
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {payableTotal > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#1e2d3d] bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-right font-bold text-[#1e2d3d] text-sm">Total Outstanding</td>
                <td className="px-4 py-3 font-bold text-[#DC2626] text-sm">GHS {payableTotal.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <PayAllButton amount={payableTotal} paying={paying} onClick={handlePayAll} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {groups.map(group => {
          const groupKey = `${group.orderPeriodId}::${group.productId}::${group.size ?? ''}`;
          const hasFee   = group.feePerItem > 0;
          const isPaying = paying === groupKey;
          return (
            <div key={groupKey} className="bg-white rounded-2xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#1e2d3d] text-sm">
                  {group.productName}
                  {group.periodName && <span className="block text-xs font-normal text-gray-400">{group.periodName}</span>}
                </span>
                {hasFee ? (
                  <span className="text-xs font-bold text-white bg-[#F2AA25] px-2.5 py-1 rounded-full">
                    GHS {group.totalFee.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                    Awaiting Fee
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                <span><span className="font-semibold text-[#1e2d3d]">Size:</span> {group.sizeDisplay}</span>
                <span><span className="font-semibold text-[#1e2d3d]">Qty:</span> {group.totalQty}</span>
                <span>
                  <span className="font-semibold text-[#1e2d3d]">Fee/item:</span>{" "}
                  {hasFee ? `GHS ${group.feePerItem.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">Total Shipping</span>
                <span className="font-bold text-[#1e2d3d] text-sm">
                  {hasFee ? `GHS ${group.totalFee.toLocaleString()}` : '—'}
                </span>
              </div>
              {hasFee ? (
                <button
                  onClick={() => handlePayGroup(group)}
                  disabled={!!paying}
                  className="w-full bg-[#F2AA25] text-white font-bold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isPaying ? (
                    <>
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Redirecting…
                    </>
                  ) : `Pay GHS ${group.totalFee.toLocaleString()} · Hubtel`}
                </button>
              ) : (
                <div className="border-t border-gray-100 pt-2 text-center">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700">
                    Awaiting Shipping Fee
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {payableTotal > 0 && (
          <div className="bg-[#1e2d3d] rounded-2xl p-3">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-white font-semibold text-sm">Total Outstanding</span>
              <span className="text-[#F2AA25] font-bold text-lg">GHS {payableTotal.toLocaleString()}</span>
            </div>
            <PayAllButton amount={payableTotal} paying={paying} onClick={handlePayAll} block />
            <p className="text-gray-400 text-xs mt-2 text-center">Or pay each product's fee separately above</p>
          </div>
        )}
      </div>

      <div className="mt-5 text-center">
        <Link to="/shop" className="inline-block text-[#F2AA25] font-semibold hover:underline">
          ← Continue Shopping
        </Link>
      </div>
    </div>
  );
}
