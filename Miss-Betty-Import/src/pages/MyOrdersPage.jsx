import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { colourMap } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import ReviewModal from "../components/ReviewModal";

const statusStyles = {
  Ordered:          "bg-mbi-surface-strong text-mbi-navy",
  Delivered:        "bg-mbi-available-tint text-mbi-available",
  Processing:       "bg-mbi-preorder-tint text-mbi-navy",
  Pending:          "bg-mbi-amber-tint text-mbi-amber-ink",
  Cancelled:        "bg-mbi-error-tint text-mbi-error",
  Received:         "bg-mbi-available-tint text-mbi-available",
  "Pending Payment":"bg-mbi-amber-tint text-mbi-amber-ink",
  "Payment Failed": "bg-mbi-error-tint text-mbi-error",
};

function groupByOrderId(rows) {
  const map = {};
  for (const row of rows) {
    if (!map[row.order_id]) map[row.order_id] = [];
    map[row.order_id].push(row);
  }
  return Object.entries(map).map(([order_id, rows]) => ({
    order_id,
    date: rows[0].created_at,
    status: rows[0].status ?? 'Pending',
    delivery: { region: rows[0].delivery_region, town: rows[0].delivery_town },
    delivered_at: rows[0].delivered_at ?? null,
    items: rows.map(r => ({
      id:         r.id,
      product_id: r.product_id,
      name:       r.products?.product_name ?? r.product_name_snapshot ?? 'Product no longer listed',
      size:       r.size,
      colour:     r.colour,
      qty:        r.quantity,
      unit_price: Number(r.unit_price),
    })),
    total: rows.reduce((s, r) => s + Number(r.unit_price ?? 0) * Number(r.quantity ?? 1), 0),
  }));
}

export default function MyOrdersPage() {
  const { session } = useAuth();
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewedSet,  setReviewedSet]  = useState(new Set());
  const [customerId,   setCustomerId]   = useState(null);

  async function refreshOrders(customerId) {
    const [{ data }, { data: existingReviews }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, products(product_name)')
        .eq('customer_id', customerId)
        .eq('deleted_by_customer', false)
        .neq('status', 'Cancelled') // products cancelled by the admin are no longer shown
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('product_id, order_id')
        .eq('customer_id', customerId),
    ]);

    setReviewedSet(new Set(
      (existingReviews ?? []).map(r => `${r.product_id}::${r.order_id}`)
    ));

    const grouped = groupByOrderId(data ?? []);

    // A coupon discount is tracked on pending_orders (one row per checkout session), not
    // on individual order rows — fold it in here so the displayed total always matches
    // what was actually paid.
    const orderIds = grouped.map(o => o.order_id);
    const { data: discountRows } = orderIds.length
      ? await supabase.from('pending_orders').select('order_id, discount_amount').in('order_id', orderIds)
      : { data: [] };
    const discountMap = Object.fromEntries((discountRows ?? []).map(r => [r.order_id, Number(r.discount_amount ?? 0)]));
    const groupedWithDiscount = grouped.map(o => ({
      ...o,
      discount: discountMap[o.order_id] ?? 0,
      total: o.total - (discountMap[o.order_id] ?? 0),
    }));

    // Auto-confirm orders delivered more than 72 hours ago
    const now = Date.now();
    const overdueIds = groupedWithDiscount
      .filter(o =>
        o.status === 'Delivered' &&
        o.delivered_at &&
        now - new Date(o.delivered_at).getTime() > 72 * 60 * 60 * 1000
      )
      .map(o => o.order_id);

    if (overdueIds.length > 0) {
      await supabase.from('orders').update({ status: 'Received' }).in('order_id', overdueIds).neq('status', 'Cancelled');
      setOrders(groupedWithDiscount.map(o => overdueIds.includes(o.order_id) ? { ...o, status: 'Received' } : o));
    } else {
      setOrders(groupedWithDiscount);
    }
  }

  useEffect(() => {
    async function init() {
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }
      setCustomerId(cust.customer_id);
      await refreshOrders(cust.customer_id);
      setLoading(false);
    }
    init();
  }, [session]);

  // Reflect admin edits (status change, shipping fee, etc.) live, regardless of
  // how old the order's order period is.
  useEffect(() => {
    if (!customerId) return;
    const channel = supabase
      .channel(`my_orders_realtime_${customerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` },
        () => refreshOrders(customerId))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirmReceipt(orderId) {
    await supabase.from('orders').update({ status: 'Received' }).eq('order_id', orderId).neq('status', 'Cancelled');
    setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'Received' } : o));
  }

  async function handleDeleteOrder(orderId) {
    if (!window.confirm('Remove this order from your history? This cannot be undone.')) return;
    const { error } = await supabase
      .from('orders')
      .update({ deleted_by_customer: true })
      .eq('order_id', orderId)
      .eq('customer_id', customerId);
    if (error) { alert('Could not remove order. Please try again.'); return; }
    setOrders(prev => prev.filter(o => o.order_id !== orderId));
  }

  function openReview(item, orderId) {
    setReviewTarget({
      product_id:   item.product_id,
      product_name: item.name,
      order_id:     orderId,
    });
  }

  function handleReviewSubmitted() {
    setReviewedSet(prev => new Set([
      ...prev,
      `${reviewTarget.product_id}::${reviewTarget.order_id}`,
    ]));
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-mbi-surface-soft text-mbi-slate">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-mbi-navy mb-2">No orders yet</h2>
        <p className="text-mbi-slate text-sm mb-6">You haven't placed any orders. Start shopping!</p>
        <Link to="/shop" className="mbi-press inline-block bg-mbi-amber text-mbi-navy font-bold px-6 py-2.5 rounded-mbi-card hover:bg-mbi-amber-press">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy mb-4 sm:mb-6">My orders</h1>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mbi-surface-soft border-b border-mbi-hairline-soft">
            <tr>
              {["Order ID", "Date", "Items", "Size", "Colour", "Total", "Status", "", "", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 font-semibold text-mbi-navy whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => (
              <tr key={order.order_id} className={i % 2 === 0 ? "bg-white" : "bg-mbi-surface-soft/60"}>
                <td className="px-3 py-3 font-semibold text-mbi-amber-ink whitespace-nowrap">{order.order_id}</td>
                <td className="px-3 py-3 text-mbi-slate whitespace-nowrap">
                  {order.date ? new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : '—'}
                </td>
                <td className="px-3 py-3 text-mbi-navy-body">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="block">{item.name} ×{item.qty}</span>
                  ))}
                </td>
                <td className="px-3 py-3 text-mbi-navy-body">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="block">{item.size ?? '—'}</span>
                  ))}
                </td>
                <td className="px-3 py-3">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-mbi-hairline"
                        style={{ backgroundColor: colourMap[item.colour] || "#ccc" }}
                      />
                      <span className="text-mbi-navy-body">{item.colour ?? '—'}</span>
                    </span>
                  ))}
                </td>
                <td className="px-3 py-3 font-bold text-mbi-navy whitespace-nowrap">
                  GHS {order.total.toLocaleString()}
                  {order.discount > 0 && (
                    <span className="block text-xs font-semibold text-mbi-available">Coupon applied</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[order.status] || "bg-mbi-surface-soft text-mbi-navy-body"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {order.status === 'Delivered' && (
                    <button
                      onClick={() => handleConfirmReceipt(order.order_id)}
                      className="text-xs font-semibold text-mbi-available border border-green-500 px-3 py-1.5 rounded-lg hover:bg-mbi-available-tint transition-colors whitespace-nowrap"
                    >
                      Confirm Receipt
                    </button>
                  )}
                </td>
                {/* Write a Review — one button per item in Received orders */}
                <td className="px-3 py-3">
                  {order.status === 'Received' && (
                    <div className="flex flex-col gap-1">
                      {order.items.map((item, idx) => {
                        const key = `${item.product_id}::${order.order_id}`;
                        if (!item.product_id) return null;
                        return reviewedSet.has(key) ? (
                          <span key={idx} className="text-xs text-mbi-slate font-medium whitespace-nowrap">Reviewed ✓</span>
                        ) : (
                          <button
                            key={idx}
                            onClick={() => openReview(item, order.order_id)}
                            className="mbi-press text-xs font-semibold text-mbi-navy border border-mbi-navy/25 px-3 py-1.5 rounded-lg hover:border-mbi-navy hover:bg-mbi-navy hover:text-white transition-colors whitespace-nowrap"
                          >
                            Review
                          </button>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => handleDeleteOrder(order.order_id)}
                    title="Remove from history"
                    className="text-mbi-slate hover:text-mbi-error transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {orders.map(order => (
          <div key={order.order_id} className="bg-white rounded-mbi-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-mbi-amber-ink text-sm">{order.order_id}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[order.status] || "bg-mbi-surface-soft text-mbi-navy-body"}`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-mbi-slate mb-2">
              {order.date ? new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : '—'}
            </p>
            <div className="text-xs text-mbi-navy-body mb-2.5 flex flex-col gap-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-mbi-hairline"
                    style={{ backgroundColor: colourMap[item.colour] || "#ccc" }}
                  />
                  <span>{item.name}{[item.size, item.colour].filter(Boolean).length ? ` · ${[item.size, item.colour].filter(Boolean).join(", ")}` : ""} × {item.qty}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-mbi-hairline-soft pt-2 flex justify-between items-center">
              <span className="text-xs text-mbi-slate">Total</span>
              <span className="font-bold text-mbi-navy text-sm">
                GHS {order.total.toLocaleString()}
                {order.discount > 0 && (
                  <span className="block text-xs font-semibold text-mbi-available text-right">Coupon applied</span>
                )}
              </span>
            </div>
            {order.status === 'Delivered' && (
              <button
                onClick={() => handleConfirmReceipt(order.order_id)}
                className="mt-2 w-full text-xs font-semibold text-mbi-available border border-green-500 py-1.5 rounded-lg hover:bg-mbi-available-tint transition-colors"
              >
                Confirm Receipt
              </button>
            )}
            {order.status === 'Received' && (
              <div className="mt-2 flex flex-col gap-1.5">
                {order.items.map((item, idx) => {
                  const key = `${item.product_id}::${order.order_id}`;
                  if (!item.product_id) return null;
                  return reviewedSet.has(key) ? (
                    <span key={idx} className="text-xs text-mbi-slate font-medium text-center">Reviewed ✓</span>
                  ) : (
                    <button
                      key={idx}
                      onClick={() => openReview(item, order.order_id)}
                      className="mbi-press text-xs font-semibold text-mbi-navy border border-mbi-navy/25 py-1.5 rounded-lg hover:border-mbi-navy hover:bg-mbi-navy hover:text-white transition-colors"
                    >
                      Review — {item.name}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => handleDeleteOrder(order.order_id)}
              className="mt-2 w-full text-xs font-semibold text-mbi-error border border-mbi-error/30 py-1.5 rounded-lg hover:bg-mbi-error-tint transition-colors"
            >
              Remove order
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 text-center">
        <Link to="/shop" className="inline-block text-mbi-amber-ink font-semibold hover:underline">
          ← Continue Shopping
        </Link>
      </div>

      <ReviewModal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        product={reviewTarget}
        onSubmitted={handleReviewSubmitted}
      />
    </div>
  );
}
