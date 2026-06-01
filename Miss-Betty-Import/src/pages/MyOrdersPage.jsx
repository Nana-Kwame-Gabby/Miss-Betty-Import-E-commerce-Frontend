import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { colourMap } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import ReviewModal from "../components/ReviewModal";

const statusStyles = {
  Ordered:          "bg-teal-100 text-teal-700",
  Delivered:        "bg-green-100 text-green-700",
  Processing:       "bg-blue-100 text-blue-700",
  Pending:          "bg-amber-100 text-amber-700",
  Cancelled:        "bg-red-100 text-red-600",
  Received:         "bg-purple-100 text-purple-700",
  "Pending Payment":"bg-yellow-100 text-yellow-700",
  "Payment Failed": "bg-red-100 text-red-600",
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
      name:       r.product_name_snapshot ?? r.products?.product_name ?? `Product #${r.product_id}`,
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

  useEffect(() => {
    async function loadOrders() {
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }

      const [{ data }, { data: existingReviews }] = await Promise.all([
        supabase
          .from('orders')
          .select('*, products(product_name)')
          .eq('customer_id', cust.customer_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('product_id, order_id')
          .eq('customer_id', cust.customer_id),
      ]);

      setReviewedSet(new Set(
        (existingReviews ?? []).map(r => `${r.product_id}::${r.order_id}`)
      ));

      const grouped = groupByOrderId(data ?? []);

      // Auto-confirm orders delivered more than 72 hours ago
      const now = Date.now();
      const overdueIds = grouped
        .filter(o =>
          o.status === 'Delivered' &&
          o.delivered_at &&
          now - new Date(o.delivered_at).getTime() > 72 * 60 * 60 * 1000
        )
        .map(o => o.order_id);

      if (overdueIds.length > 0) {
        await supabase.from('orders').update({ status: 'Received' }).in('order_id', overdueIds);
        setOrders(grouped.map(o => overdueIds.includes(o.order_id) ? { ...o, status: 'Received' } : o));
      } else {
        setOrders(grouped);
      }
      setLoading(false);
    }
    loadOrders();
  }, [session]);

  async function handleConfirmReceipt(orderId) {
    await supabase.from('orders').update({ status: 'Received' }).eq('order_id', orderId);
    setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'Received' } : o));
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
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl sm:text-5xl mb-3">📦</div>
        <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">No orders yet</h2>
        <p className="text-gray-400 text-sm mb-6">You haven't placed any orders. Start shopping!</p>
        <Link to="/shop" className="inline-block bg-[#F2AA25] text-white font-bold px-6 py-2.5 rounded-2xl hover:opacity-90">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      <h1 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-3 sm:mb-5">My Orders</h1>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Order ID", "Date", "Items", "Size", "Colour", "Total", "Status", "", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 font-semibold text-[#1e2d3d] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => (
              <tr key={order.order_id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-3 py-3 font-semibold text-[#F2AA25] whitespace-nowrap">{order.order_id}</td>
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                  {order.date ? new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : '—'}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="block">{item.name} ×{item.qty}</span>
                  ))}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="block">{item.size ?? '—'}</span>
                  ))}
                </td>
                <td className="px-3 py-3">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                        style={{ backgroundColor: colourMap[item.colour] || "#ccc" }}
                      />
                      <span className="text-gray-600">{item.colour ?? '—'}</span>
                    </span>
                  ))}
                </td>
                <td className="px-3 py-3 font-bold text-[#1e2d3d] whitespace-nowrap">
                  GHS {order.total.toLocaleString()}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[order.status] || "bg-gray-100 text-gray-600"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {order.status === 'Delivered' && (
                    <button
                      onClick={() => handleConfirmReceipt(order.order_id)}
                      className="text-xs font-semibold text-green-600 border border-green-500 px-3 py-1.5 rounded-xl hover:bg-green-50 transition-colors whitespace-nowrap"
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
                          <span key={idx} className="text-xs text-gray-400 font-medium whitespace-nowrap">Reviewed ✓</span>
                        ) : (
                          <button
                            key={idx}
                            onClick={() => openReview(item, order.order_id)}
                            className="text-xs font-semibold text-[#F2AA25] border border-[#F2AA25] px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap"
                          >
                            Review
                          </button>
                        );
                      })}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {orders.map(order => (
          <div key={order.order_id} className="bg-white rounded-2xl shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-[#F2AA25] text-sm">{order.order_id}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[order.status] || "bg-gray-100 text-gray-600"}`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {order.date ? new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : '—'}
            </p>
            <div className="text-xs text-gray-600 mb-2.5 flex flex-col gap-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                    style={{ backgroundColor: colourMap[item.colour] || "#ccc" }}
                  />
                  <span>{item.name} — {item.size ?? '—'}, {item.colour ?? '—'} ×{item.qty}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="text-xs text-gray-500">Total</span>
              <span className="font-bold text-[#1e2d3d] text-sm">GHS {order.total.toLocaleString()}</span>
            </div>
            {order.status === 'Delivered' && (
              <button
                onClick={() => handleConfirmReceipt(order.order_id)}
                className="mt-2 w-full text-xs font-semibold text-green-600 border border-green-500 py-1.5 rounded-xl hover:bg-green-50 transition-colors"
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
                    <span key={idx} className="text-xs text-gray-400 font-medium text-center">Reviewed ✓</span>
                  ) : (
                    <button
                      key={idx}
                      onClick={() => openReview(item, order.order_id)}
                      className="text-xs font-semibold text-[#F2AA25] border border-[#F2AA25] py-1.5 rounded-xl hover:bg-amber-50 transition-colors"
                    >
                      Review — {item.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 text-center">
        <Link to="/shop" className="inline-block text-[#F2AA25] font-semibold hover:underline">
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
