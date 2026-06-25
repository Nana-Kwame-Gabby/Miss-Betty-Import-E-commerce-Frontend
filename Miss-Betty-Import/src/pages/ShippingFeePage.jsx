import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function groupOrdersByProductSize(orders, feeMap) {
  const groups = {};
  for (const o of orders) {
    if (o.products?.product_status?.status_name === 'Available') continue;
    const key = `${o.product_id}::${o.size ?? ''}`;
    if (!groups[key]) {
      groups[key] = {
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
    const feePerItem = feeMap[`${g.productId}::${g.size ?? ''}`] ?? 0;
    return {
      ...g,
      feePerItem,
      totalFee: feePerItem * g.totalQty,
      orderIds: g.orders.map(o => o.order_id),
    };
  });
}

export default function ShippingFeePage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups]     = useState([]);
  const [custId, setCustId]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState(null);
  const [shpMsg, setShpMsg]     = useState(null);
  const redirectHandled         = useRef(false);

  useEffect(() => {
    async function init() {
      const shpRef    = searchParams.get("shpRef");
      const shpStatus = searchParams.get("status");

      if (shpRef && !redirectHandled.current) {
        redirectHandled.current = true;
        const key   = `pending_shp_${shpRef}`;
        const saved = JSON.parse(sessionStorage.getItem(key) || "null");

        if (shpStatus === "success" && saved) {
          // 1. Snapshot fees for only this product's orders in the group
          const [{ data: unsnapshot }, { data: currentFees }] = await Promise.all([
            supabase.from('orders')
              .select('order_id, product_id, size')
              .in('order_id', saved.orderIds)
              .is('shipping_fee', null)
              .eq('product_id', saved.productId),
            supabase.from('product_size_shipping_fees').select('*'),
          ]);

          const snapMap = {};
          (currentFees ?? []).forEach(f => {
            snapMap[`${f.product_id}::${f.size ?? ''}`] = Number(f.shipping_fee ?? 0);
          });

          await Promise.all(
            (unsnapshot ?? []).map(o => {
              const fee = snapMap[`${o.product_id}::${o.size ?? ''}`];
              if (!fee) return Promise.resolve();
              return supabase.from('orders')
                .update({ shipping_fee: fee })
                .eq('order_id', o.order_id)
                .eq('product_id', o.product_id);
            })
          );

          // 2. Insert payment linked to the specific product+size
          await supabase.from('shipping_fee_payments').insert({
            customer_id: saved.customerId,
            amount_paid: saved.amount,
            product_id:  saved.productId,
            size:        saved.size,
          });

          // 3. Mark only this product+size's orders as paid (not all orders in the batch)
          let markPaidQ = supabase
            .from('orders')
            .update({ shipping_fee_paid: true })
            .in('order_id', saved.orderIds)
            .eq('product_id', saved.productId);

          if (saved.size != null) {
            markPaidQ = markPaidQ.eq('size', saved.size);
          } else {
            markPaidQ = markPaidQ.is('size', null);
          }

          await markPaidQ;

          sessionStorage.removeItem(key);
          setShpMsg({ type: "success", amount: saved.amount });
        } else {
          sessionStorage.removeItem(key);
          if (shpStatus === "cancelled") setShpMsg({ type: "cancelled" });
        }
        setSearchParams({}, { replace: true });
      }

      // Load customer
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }
      setCustId(cust.customer_id);

      // Load unpaid orders + fee rates
      const [{ data: orderData }, { data: feeData }] = await Promise.all([
        supabase.from('orders')
          .select('*, products(product_name, product_status(status_name))')
          .eq('customer_id', cust.customer_id)
          .eq('shipping_fee_paid', false)
          .order('created_at', { ascending: false }),
        supabase.from('product_size_shipping_fees').select('*'),
      ]);

      const feeMap = {};
      (feeData ?? []).forEach(r => {
        feeMap[`${r.product_id}::${r.size ?? ''}`] = Number(r.shipping_fee ?? 0);
      });

      setGroups(groupOrdersByProductSize(orderData ?? [], feeMap));
      setLoading(false);
    }

    init();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePayGroup(group) {
    const groupKey = `${group.productId}::${group.size ?? ''}`;
    setPaying(groupKey);

    const shpRef = `SHP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const returnUrl  = `${window.location.origin}/shipping-fees?shpRef=${shpRef}&status=success`;
    const cancelUrl  = `${window.location.origin}/shipping-fees?shpRef=${shpRef}&status=cancelled`;

    sessionStorage.setItem(`pending_shp_${shpRef}`, JSON.stringify({
      customerId: custId,
      amount:     group.totalFee,
      productId:  group.productId,
      size:       group.size,
      orderIds:   group.orderIds,
    }));

    const { data: fnData } = await supabase.functions.invoke("initiate-payment", {
      body: {
        orderId:         shpRef,
        amount:          group.totalFee,
        description:     `Miss Betty Import — Shipping: ${group.productName} (${group.sizeDisplay})`,
        returnUrl,
        cancellationUrl: cancelUrl,
      },
    });

    if (!fnData?.checkoutUrl) {
      setPaying(null);
      alert(fnData?.error || "Payment failed. Please try again.");
      return;
    }

    window.location.href = fnData.checkoutUrl;
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
        {shpMsg?.type === "success" ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">All Shipping Fees Paid!</h2>
            <p className="text-gray-400 text-sm mb-6">All your shipping fees have been settled. Thank you!</p>
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

  const grandTotal = groups.reduce((s, g) => s + g.totalFee, 0);

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

      <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d] mb-1">Shipping Fees</h1>
      <p className="text-sm text-gray-400 mb-3 sm:mb-5">
        Shipping fees are assigned by our team. Once set, you can pay each product's fee here.
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
              const groupKey = `${group.productId}::${group.size ?? ''}`;
              const hasFee   = group.feePerItem > 0;
              const isPaying = paying === groupKey;
              return (
                <tr key={groupKey} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3 font-semibold text-[#1e2d3d]">{group.productName}</td>
                  <td className="px-4 py-3 text-gray-500">{group.sizeDisplay}</td>
                  <td className="px-4 py-3 text-gray-600">{group.totalQty}</td>
                  <td className="px-4 py-3 font-semibold text-[#1e2d3d]">
                    {hasFee ? `GHS ${group.feePerItem.toLocaleString()}` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#F2AA25]">
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
          {grandTotal > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#1e2d3d] bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-right font-bold text-[#1e2d3d] text-sm">Grand Total</td>
                <td className="px-4 py-3 font-bold text-[#F2AA25] text-sm">GHS {grandTotal.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {groups.map(group => {
          const groupKey = `${group.productId}::${group.size ?? ''}`;
          const hasFee   = group.feePerItem > 0;
          const isPaying = paying === groupKey;
          return (
            <div key={groupKey} className="bg-white rounded-2xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#1e2d3d] text-sm">{group.productName}</span>
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

        {grandTotal > 0 && (
          <div className="bg-[#1e2d3d] rounded-2xl p-3">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold text-sm">Grand Total</span>
              <span className="text-[#F2AA25] font-bold text-lg">GHS {grandTotal.toLocaleString()}</span>
            </div>
            <p className="text-gray-400 text-xs mt-1">Pay each product's fee separately above</p>
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
