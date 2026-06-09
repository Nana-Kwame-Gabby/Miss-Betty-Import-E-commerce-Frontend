import { useState, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { supabase } from "../lib/supabase";

const ghanaRegions = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "North East", "Savannah",
];

export default function CheckoutPage() {
  const { cartItems, subtotal, totalSavings } = useCart();
  const { user } = useUser();
  const { session } = useAuth();
  const { ordersClosed } = useAppSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const buyNowData = location.state?.buyNow ?? null;

  const checkoutItems = buyNowData
    ? [{
        ...buyNowData.product,
        unit_price:     buyNowData.unitPrice  ?? buyNowData.product.unit_price,
        original_price: buyNowData.originalPrice ?? null,
        cost_price:     buyNowData.costPrice  ?? buyNowData.product.cost_price ?? 0,
        profit:         buyNowData.sizeProfit ?? buyNowData.product.profit     ?? 0,
        quantity:       buyNowData.quantity,
        size:           buyNowData.size,
        colour:         buyNowData.colour,
        cartKey:        `buynow-${buyNowData.product.id}`,
      }]
    : cartItems;

  const checkoutSubtotal = buyNowData
    ? (buyNowData.unitPrice ?? buyNowData.product.unit_price) * buyNowData.quantity
    : subtotal;

  const checkoutSavings = buyNowData
    ? (buyNowData.originalPrice && buyNowData.originalPrice > (buyNowData.unitPrice ?? buyNowData.product.unit_price)
        ? (buyNowData.originalPrice - (buyNowData.unitPrice ?? buyNowData.product.unit_price)) * buyNowData.quantity
        : 0)
    : totalSavings;

  const isPreorder = s => typeof s === "string" && s.toLowerCase().includes("pre");
  const hasBlockedPreorders = ordersClosed && checkoutItems.some(i => isPreorder(i.product_status));

  const [form, setForm] = useState({
    fullName: user.fullName, email: user.email, phone: user.phone,
    region: user.deliveryRegion, town: user.deliveryTown,
  });
  const [errors, setErrors] = useState({});
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");
  const [iframeUrl,    setIframeUrl]    = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef(null);

  function validate() {
    const e = {};
    if (!form.region) e.region = "Please select a region.";
    if (!form.town.trim()) e.town = "Town / city is required.";
    return e;
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: "" }));
  }

  function handleIframeLoad() {
    setIframeLoaded(true);
    try {
      const href = iframeRef.current?.contentWindow?.location?.href;
      if (!href) return;
      const url = new URL(href);
      if (url.pathname.includes("order-confirmation")) {
        navigate(url.pathname + url.search);
      }
    } catch {
      // Cross-origin (Hubtel's page) — normal, ignore
    }
  }

  function handleIframeClose() {
    setIframeUrl(null);
    setIframeLoaded(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setSubmitting(true);
    setSubmitError("");

    try {
      // 1. Get customer_id
      const { data: cust, error: custError } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (custError || !cust) throw new Error("Could not find your account. Please try again.");

      // 2. Generate order_id
      const uid     = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      const orderId = `ORD-${new Date().getFullYear()}-${uid}`;

      // 3. Call Hubtel via edge function
      const returnUrl       = `${window.location.origin}/order-confirmation?orderId=${orderId}&status=success`;
      const cancellationUrl = `${window.location.origin}/order-confirmation?orderId=${orderId}&status=cancelled`;

      const { data: fnData } = await supabase.functions.invoke('initiate-payment', {
        body: {
          orderId,
          amount: checkoutSubtotal,
          description: `Miss Betty Import — ${orderId}`,
          returnUrl,
          cancellationUrl,
        },
      });

      if (fnData?.error || !fnData?.checkoutUrl) {
        throw new Error(fnData?.error || "Failed to start payment. Please try again.");
      }

      // 4. Save pending order data for the confirmation page to use after redirect
      sessionStorage.setItem(`pending_order_${orderId}`, JSON.stringify({
        customerId: cust.customer_id,
        orderId,
        form,
        items: checkoutItems.map(item => ({
          id:                item.id,
          product_name:      item.product_name,
          product_image_url: item.product_image_url || "",
          unit_price:        item.unit_price,
          original_price:    item.original_price ?? null,
          cost_price:        item.cost_price  ?? 0,
          profit:            item.profit      ?? 0,
          quantity:          item.quantity,
          size:              item.size   || null,
          colour:            item.colour || null,
          cartKey:           item.cartKey,
        })),
      }));

      // 5. Open Hubtel checkout in iframe overlay
      setIframeLoaded(false);
      setIframeUrl(fnData.checkoutUrl);
      setSubmitting(false);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <p className="text-gray-500 font-medium text-lg">Your cart is empty.</p>
        <Link to="/shop" className="mt-4 inline-block text-[#F2AA25] font-semibold hover:underline">Go Shopping</Link>
      </div>
    );
  }

  const inputClass = (field) =>
    `w-full border rounded-2xl px-3 py-2 sm:py-2.5 text-sm outline-none transition-colors ${
      errors[field] ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[#F2AA25]"
    }`;

  const readOnlyClass =
    "w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 sm:py-2.5 text-sm text-gray-500 cursor-default outline-none";

  return (
    <>
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      {hasBlockedPreorders && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-3 py-2.5 mb-3 text-sm text-red-700 font-medium flex items-center gap-2">
          <span>🚫</span> Pre-orders are temporarily closed. Remove pre-order items to continue.
        </div>
      )}
      <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d] mb-3 sm:mb-5">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 flex flex-col gap-3 sm:gap-5">
          <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4">
            <h2 className="font-bold text-[#1e2d3d] text-base mb-3">Delivery Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Full Name</label>
                <input readOnly value={form.fullName} className={readOnlyClass} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Email Address</label>
                <input readOnly value={form.email} className={readOnlyClass} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Phone Number</label>
                <input readOnly value={form.phone} className={readOnlyClass} />
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  ℹ️ Pre-filled from your account. To update, use <strong>Delivery Details</strong> in the Account menu.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Region</label>
                <select name="region" value={form.region} onChange={handleChange} className={inputClass("region")}>
                  <option value="">Select region</option>
                  {ghanaRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Town / City</label>
                <input name="town" value={form.town} onChange={handleChange} placeholder="Kumasi" className={inputClass("town")} />
                {errors.town && <p className="text-red-500 text-xs mt-1">{errors.town}</p>}
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || hasBlockedPreorders}
            className="w-full bg-[#F2AA25] text-white font-bold py-2.5 sm:py-3 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Opening Payment…
              </>
            ) : "Pay with Hubtel"}
          </button>
        </form>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm p-3 sticky top-12">
            <h2 className="font-bold text-[#1e2d3d] text-base mb-3">Order Summary</h2>
            <div className="flex flex-col gap-2 mb-2.5">
              {checkoutItems.map(item => (
                <div key={item.cartKey} className="flex items-start gap-3">
                  {item.product_image_url ? (
                    <img src={item.product_image_url} alt={item.product_name} className="w-10 h-12 object-cover rounded-xl flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-12 bg-gray-100 rounded-xl flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1e2d3d] truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.size} · {item.colour} · ×{item.quantity}</p>
                    <p className="text-sm font-bold text-[#F2AA25]">GHS {(item.unit_price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Subtotal</span>
                <span>GHS {checkoutSubtotal.toLocaleString()}</span>
              </div>
              {checkoutSavings > 0 && (
                <div className="flex justify-between text-green-600 text-sm font-semibold mb-2">
                  <span>Discount savings</span>
                  <span>− GHS {checkoutSavings.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500 mb-4">
                <span>Delivery</span>
                <span className="text-green-600 font-medium">To be confirmed</span>
              </div>
              <div className="flex justify-between font-bold text-[#1e2d3d] text-base">
                <span>Total</span>
                <span className="text-[#F2AA25]">GHS {checkoutSubtotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Hubtel Onsite Checkout iframe modal */}

      {iframeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={handleIframeClose} />
          <div className="relative z-10 flex flex-col w-full h-full sm:w-[480px] sm:h-[640px] sm:rounded-2xl overflow-hidden shadow-2xl bg-white">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1e2d3d] flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2AA25" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="text-white text-sm font-semibold">Secure Payment</span>
              </div>
              <button
                onClick={handleIframeClose}
                className="text-gray-300 hover:text-white transition-colors p-1"
                aria-label="Cancel payment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Loading spinner */}
            {!iframeLoaded && (
              <div className="absolute inset-0 top-12 flex flex-col items-center justify-center bg-white z-10 gap-3">
                <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 font-medium">Loading payment…</p>
              </div>
            )}

            <iframe
              ref={iframeRef}
              src={iframeUrl}
              onLoad={handleIframeLoad}
              className="flex-1 w-full border-0"
              title="Hubtel Secure Payment"
              allow="payment"
            />
          </div>
        </div>
      )}
    </>
  );
}
