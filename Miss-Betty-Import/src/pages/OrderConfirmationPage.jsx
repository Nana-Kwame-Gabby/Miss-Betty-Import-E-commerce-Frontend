import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";

export default function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const { clearCart } = useCart();

  const urlOrderId    = searchParams.get("orderId");
  const hubtelStatus  = searchParams.get("status"); // "success" | "cancelled" | "failed"

  // Determine initial phase:
  // - Hubtel redirect with orderId+status → process it
  // - Navigation state (legacy fallback) → show directly
  // - Neither → no-order
  const initialPhase = urlOrderId && hubtelStatus
    ? hubtelStatus === "success" ? "processing" : hubtelStatus === "cancelled" ? "cancelled" : "failed"
    : state ? "ready" : "no-order";

  const [phase, setPhase]         = useState(initialPhase);
  const [orderData, setOrderData] = useState(state || null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (phase !== "processing") return;
    if (ranRef.current) return;
    ranRef.current = true;

    async function createOrder() {
      const key    = `pending_order_${urlOrderId}`;
      const saved  = JSON.parse(sessionStorage.getItem(key) || "null");

      if (saved) {
        // First-time success: create order + invoice from saved data
        const orderRows = saved.items.map(item => ({
          order_id:        urlOrderId,
          customer_id:     saved.customerId,
          product_id:      item.id,
          quantity:        item.quantity,
          unit_price:      item.unit_price,
          size:            item.size,
          colour:          item.colour,
          status:          "Ordered",
          delivery_region: saved.form.region,
          delivery_town:   saved.form.town,
          can_edit_delivery: true,
        }));

        const invoiceRows = saved.items.map(item => ({
          invoice_id:    urlOrderId,
          customer_name: saved.form.fullName,
          product_name:  item.product_name,
          size:          item.size,
          colour:        item.colour,
          quantity:      item.quantity,
          unit_price:    item.unit_price,
          total:         item.unit_price * item.quantity,
        }));

        await supabase.from("orders").insert(orderRows);
        await supabase.from("invoices").insert(invoiceRows);
        sessionStorage.removeItem(key);
        clearCart();

        const subtotal = saved.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        setOrderData({ form: saved.form, items: saved.items, subtotal, orderId: urlOrderId });
        setPhase("ready");
      } else {
        // Page refreshed after order already created — fetch from DB
        const { data: orderRows } = await supabase
          .from("orders")
          .select("*, products(product_name, product_image_url)")
          .eq("order_id", urlOrderId);

        if (!orderRows?.length) { setPhase("no-order"); return; }

        const { data: custRows } = await supabase
          .from("customers")
          .select("customer_name, email, telephone")
          .eq("customer_id", orderRows[0].customer_id)
          .single();

        const items = orderRows.map(r => ({
          cartKey:           String(r.id),
          id:                r.product_id,
          product_name:      r.products?.product_name ?? `Product #${r.product_id}`,
          product_image_url: r.products?.product_image_url ?? "",
          unit_price:        Number(r.unit_price),
          quantity:          r.quantity,
          size:              r.size,
          colour:            r.colour,
        }));

        const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

        setOrderData({
          form: {
            fullName: custRows?.customer_name ?? "",
            email:    custRows?.email         ?? "",
            phone:    custRows?.telephone      ?? "",
            region:   orderRows[0].delivery_region ?? "",
            town:     orderRows[0].delivery_town   ?? "",
          },
          items,
          subtotal,
          orderId: urlOrderId,
        });
        setPhase("ready");
      }
    }

    createOrder();
  }, [phase, urlOrderId, clearCart]);

  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#1e2d3d] mb-1">Placing Your Order</h2>
          <p className="text-sm text-gray-400">Just a moment…</p>
        </div>
      </div>
    );
  }

  if (phase === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#1e2d3d] mb-2">Payment Cancelled</h2>
          <p className="text-sm text-gray-500 mb-6">You cancelled the payment. Your order was not placed.</p>
          <div className="flex flex-col gap-3">
            <Link to="/checkout" className="w-full bg-[#F2AA25] text-white font-bold py-2.5 sm:py-3 rounded-2xl hover:opacity-90 transition-opacity text-sm">
              Try Again
            </Link>
            <Link to="/shop" className="w-full border-2 border-[#1e2d3d] text-[#1e2d3d] font-bold py-2.5 sm:py-3 rounded-2xl hover:bg-[#1e2d3d] hover:text-white transition-colors text-sm">
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#1e2d3d] mb-2">Payment Unsuccessful</h2>
          <p className="text-sm text-gray-500 mb-6">Your payment could not be processed. Please try again.</p>
          <div className="flex flex-col gap-3">
            <Link to="/checkout" className="w-full bg-[#F2AA25] text-white font-bold py-2.5 sm:py-3 rounded-2xl hover:opacity-90 transition-opacity text-sm">
              Try Again
            </Link>
            <Link to="/shop" className="w-full border-2 border-[#1e2d3d] text-[#1e2d3d] font-bold py-2.5 sm:py-3 rounded-2xl hover:bg-[#1e2d3d] hover:text-white transition-colors text-sm">
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "no-order" || !orderData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-4xl sm:text-5xl mb-3">📋</p>
        <p className="text-gray-500 font-medium text-lg">No order details found.</p>
        <Link to="/shop" className="mt-4 inline-block text-[#F2AA25] font-semibold hover:underline">Go Shopping</Link>
      </div>
    );
  }

  const { form, items, subtotal, orderId } = orderData;

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 text-center mb-3 sm:mb-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d] mb-1">Payment Successful 🎉</h1>
        <p className="text-gray-500 mb-3">
          Thank you, <strong>{form.fullName}</strong>! Your order has been placed and is being processed.
        </p>
        <div className="inline-block bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
          <p className="text-xs text-gray-400 font-medium">Order ID</p>
          <p className="text-[#F2AA25] font-bold text-base">{orderId ?? '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 mb-3 sm:mb-4">
        <h2 className="font-bold text-[#1e2d3d] mb-3">Order Details</h2>
        <div className="flex flex-col gap-2.5 mb-3">
          {items.map(item => (
            <div key={item.cartKey} className="flex items-center gap-3">
              {item.product_image_url ? (
                <img src={item.product_image_url} alt={item.product_name} className="w-10 h-12 object-cover rounded-xl" />
              ) : (
                <div className="w-10 h-12 bg-gray-100 rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1e2d3d] truncate">{item.product_name}</p>
                <p className="text-xs text-gray-400">{item.size} · {item.colour} · ×{item.quantity}</p>
              </div>
              <p className="text-sm font-bold text-[#1e2d3d] flex-shrink-0">
                GHS {(item.unit_price * item.quantity).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-[#1e2d3d]">
          <span>Total</span>
          <span className="text-[#F2AA25]">GHS {subtotal.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 mb-3 sm:mb-4">
        <h2 className="font-bold text-[#1e2d3d] mb-2">Delivery To</h2>
        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p><strong>{form.fullName}</strong></p>
          <p>{form.email}</p>
          <p>{form.phone}</p>
          <p>{form.town}, {form.region}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/shop"
          className="flex-1 text-center bg-[#F2AA25] text-white font-bold py-2.5 sm:py-3 rounded-2xl hover:opacity-90 transition-opacity text-sm"
        >
          Continue Shopping
        </Link>
        <Link
          to="/my-orders"
          className="flex-1 text-center border-2 border-[#1e2d3d] text-[#1e2d3d] font-bold py-2.5 sm:py-3 rounded-2xl hover:bg-[#1e2d3d] hover:text-white transition-colors text-sm"
        >
          View My Orders
        </Link>
      </div>
    </div>
  );
}
