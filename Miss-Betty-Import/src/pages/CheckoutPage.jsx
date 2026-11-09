import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { supabase } from "../lib/supabase";
import usePersistedState from "../hooks/usePersistedState";
import { getVariantImage } from "../lib/variantImage";
import { getItemProfit } from "../lib/priceUtils";
import { imgFallback, thumbUrl } from "../lib/imageUrl";
import { money, primaryButtonClass } from "../lib/buyBoxStyles";

const ghanaRegions = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "North East", "Savannah",
];

// How long a persisted in-progress Hubtel payment is trusted before we treat it as
// stale/expired rather than attempting to reopen it.
const PAYMENT_RESUME_TTL_MS = 15 * 60 * 1000;

// Photo of the exact variant bought, falling back to the main product image.
function itemImage(item) {
  return getVariantImage(item.variant_images, item.size, item.colour) || item.product_image_url;
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
  <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-mbi-error">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><line x1="12" y1="16" x2="12" y2="16.01"/></svg>
    {children}
  </p>
  );
}

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
        rmb_price:      buyNowData.rmbPrice   ?? buyNowData.product.rmb_price  ?? 0,
        misc_amount:    buyNowData.miscAmount ?? buyNowData.product.misc_amount ?? 0,
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

  // Only region/town (the actually-editable fields) survive navigation, keyed per account
  // so a shared device doesn't leak one user's unsubmitted delivery edits into another's session.
  const [deliveryDraft, setDeliveryDraft] = usePersistedState(
    session?.user?.id ? `mbimport_form_checkout_delivery_${session.user.id}` : "mbimport_form_checkout_delivery_anon",
    { region: null, town: null }
  );
  const [form, setForm] = useState({
    fullName: user.fullName, email: user.email, phone: user.phone,
    region: deliveryDraft.region ?? user.deliveryRegion,
    town: deliveryDraft.town ?? user.deliveryTown,
  });
  const [errors, setErrors] = useState({});
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");
  // The in-progress Hubtel payment (orderId + hosted checkout URL) survives navigation,
  // so returning to /checkout reopens the same Hubtel session instead of starting over.
  // OTP/payment-method entry itself lives entirely inside Hubtel's cross-origin page and
  // can't be captured here — this only preserves what our own code actually controls.
  const [paymentInProgress, setPaymentInProgress] = usePersistedState(
    session?.user?.id ? `mbimport_form_checkout_payment_${session.user.id}` : "mbimport_form_checkout_payment_anon",
    null
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef(null);

  // Phones pin the pay button to the bottom; lift the chat launcher above it.
  useEffect(() => {
    document.documentElement.dataset.actionBar = "on";
    return () => { delete document.documentElement.dataset.actionBar; };
  }, []);

  // Discard a stale in-progress payment rather than reopening a likely-dead Hubtel URL.
  useEffect(() => {
    if (paymentInProgress && Date.now() - paymentInProgress.savedAt > PAYMENT_RESUME_TTL_MS) {
      setPaymentInProgress(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [applyCoupon, setApplyCoupon] = useState(false);

  useEffect(() => {
    async function loadCoupons() {
      if (!session?.user?.id) return;
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();
      if (!cust) return;
      const { data } = await supabase
        .from('coupons')
        .select('id')
        .eq('customer_id', cust.customer_id)
        .eq('status', 'available');
      setAvailableCoupons(data ?? []);
    }
    loadCoupons();
  }, [session]);

  const couponEligible = checkoutSubtotal > 3000 && availableCoupons.length > 0;
  const discountAmount = applyCoupon && couponEligible ? 100 : 0;
  const finalTotal      = checkoutSubtotal - discountAmount;

  function validate() {
    const e = {};
    if (!form.region) e.region = "Please select a region.";
    if (!form.town.trim()) e.town = "Town / city is required.";
    return e;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === "region" || name === "town") {
      setDeliveryDraft(prev => ({ ...prev, [name]: value }));
    }
    setErrors(prev => ({ ...prev, [e.target.name]: "" }));
  }

  function handleIframeLoad() {
    setIframeLoaded(true);
    try {
      const href = iframeRef.current?.contentWindow?.location?.href;
      if (!href) return;
      const url = new URL(href);
      if (url.pathname.includes("order-confirmation")) {
        setPaymentInProgress(null); // payment concluded (success or Hubtel-side cancellation) — nothing left to resume
        navigate(url.pathname + url.search);
      }
    } catch {
      // Cross-origin (Hubtel's page) — normal, ignore
    }
  }

  function handleIframeClose() {
    if (paymentInProgress?.couponId && paymentInProgress?.customerId) {
      supabase.rpc('release_coupon', {
        p_coupon_id:   paymentInProgress.couponId,
        p_customer_id: paymentInProgress.customerId,
      }).catch(() => {});
    }
    setPaymentInProgress(null); // explicit cancel
    setIframeLoaded(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setSubmitting(true);
    setSubmitError("");

    let couponId = null;
    let custId   = null;

    try {
      // 1. Get customer_id
      const { data: cust, error: custError } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (custError || !cust) throw new Error("Could not find your account. Please try again.");
      custId = cust.customer_id;

      // Products removed from the shop since they were added to the cart can't be bought.
      const { data: liveProducts, error: liveErr } = await supabase
        .from('products')
        .select('product_id')
        .in('product_id', [...new Set(checkoutItems.map(i => i.id))])
        .is('archived_at', null);
      if (liveErr) throw new Error("Could not check your cart. Please try again.");
      const liveIds = new Set((liveProducts ?? []).map(p => String(p.product_id)));
      const gone = checkoutItems.find(i => !liveIds.has(String(i.id)));
      if (gone) {
        throw new Error(`Sorry, "${gone.product_name}" is no longer available. Please remove it from your cart.`);
      }

      // Best-effort stock check: catch "sold out since it was added to cart" before spending
      // a Hubtel call. Advisory only — nothing is locked/reserved here, so it doesn't fully
      // close the race between two simultaneous buyers of the last unit.
      const availableItems = checkoutItems.filter(i => i.product_status === "Available");
      if (availableItems.length > 0) {
        const { data: stockRows } = await supabase
          .from('product_variant_stock')
          .select('product_id, size, colour, stock_quantity')
          .in('product_id', [...new Set(availableItems.map(i => i.id))]);
        for (const item of availableItems) {
          const row = (stockRows ?? []).find(r =>
            r.product_id === item.id && r.size === (item.size ?? "") && r.colour === (item.colour ?? "")
          );
          if (row && item.quantity > row.stock_quantity) {
            throw new Error(`Sorry, "${item.product_name}" no longer has enough stock (${row.stock_quantity} left). Please update your cart.`);
          }
        }
      }

      // 2. Generate order_id
      const uid     = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      const orderId = `ORD-${new Date().getFullYear()}-${uid}`;

      // 2b. Claim a coupon before payment (not just once it's confirmed) so it can't be
      //     double-spent by a second, near-simultaneous checkout.
      let discount = 0;
      if (applyCoupon && couponEligible) {
        const { data: claimed } = await supabase.rpc('claim_coupon', {
          p_customer_id: cust.customer_id,
          p_order_id:    orderId,
          p_order_total: checkoutSubtotal,
        });
        if (claimed) {
          couponId = claimed;
          discount = 100;
        }
      }
      const payAmount = checkoutSubtotal - discount;

      // 3. Call Hubtel via edge function
      const returnUrl       = `${window.location.origin}/order-confirmation?orderId=${orderId}&status=success`;
      const cancellationUrl = `${window.location.origin}/order-confirmation?orderId=${orderId}&status=cancelled`;

      const { data: fnData } = await supabase.functions.invoke('initiate-payment', {
        body: {
          orderId,
          amount: payAmount,
          description: `Miss Betty Import — ${orderId}`,
          returnUrl,
          cancellationUrl,
        },
      });

      if (fnData?.error || !fnData?.checkoutUrl) {
        throw new Error(fnData?.error || "Failed to start payment. Please try again.");
      }

      // 4. Persist pending order to DB so the callback can create the order server-side
      //    even if the customer closes the browser before reaching the confirmation page.
      const pendingItems = checkoutItems.map(item => ({
        id:                item.id,
        product_name:      item.product_name,
        product_image_url: itemImage(item) || "",
        unit_price:        item.unit_price,
        original_price:    item.original_price ?? null,
        cost_price:        item.cost_price  ?? 0,
        profit:            getItemProfit(item),
        rmb_price:         item.rmb_price   ?? 0,
        misc_amount:       item.misc_amount ?? 0,
        quantity:          item.quantity,
        size:              item.size   || null,
        colour:            item.colour || null,
        cartKey:           item.cartKey,
      }));

      const { error: pendingError } = await supabase.from('pending_orders').insert({
        order_id:        orderId,
        customer_id:     cust.customer_id,
        form_data:       form,
        items:           pendingItems,
        coupon_id:       couponId,
        discount_amount: discount,
      });
      if (pendingError) throw new Error("Could not save order. Please try again.");

      // Keep sessionStorage as a fallback for the confirmation page polling
      sessionStorage.setItem(`pending_order_${orderId}`, JSON.stringify({
        customerId: cust.customer_id,
        orderId,
        form,
        items: pendingItems,
        couponId,
      }));

      // 5. Open Hubtel checkout in iframe overlay
      setIframeLoaded(false);
      setPaymentInProgress({
        orderId,
        iframeUrl:  fnData.checkoutUrl,
        savedAt:    Date.now(),
        couponId,
        customerId: cust.customer_id,
      });
      setSubmitting(false);
    } catch (err) {
      if (couponId && custId) {
        await supabase.rpc('release_coupon', { p_coupon_id: couponId, p_customer_id: custId }).catch(() => {});
      }
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-full bg-mbi-surface-soft text-mbi-slate">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-mbi-navy">Your cart is empty</h1>
        <p className="mt-1 text-base text-mbi-slate">Add something to your cart to check out.</p>
        <Link to="/shop" className={`${primaryButtonClass()} mt-6 !w-auto`}>Go shopping</Link>
      </div>
    );
  }

  const label = "mb-1.5 block text-sm font-semibold text-mbi-navy";
  const inputClass = (field) =>
    `h-[52px] w-full rounded-lg border bg-white px-3 text-base text-mbi-navy outline-none transition-[border-color,box-shadow] duration-150 ${
      errors[field] ? "border-mbi-error focus:shadow-[0_0_0_2px_#fff,0_0_0_4px_#b42318]" : "border-mbi-hairline focus:border-mbi-navy focus:shadow-[0_0_0_2px_#fff,0_0_0_4px_#1e2d3d]"
    }`;
  const readOnlyClass =
    "h-[52px] w-full cursor-default rounded-lg border border-mbi-hairline-soft bg-mbi-surface-soft px-3 text-base text-mbi-navy-body outline-none";

  const payButton = (
    <button type="submit" form="checkout-form" disabled={submitting || hasBlockedPreorders} className={primaryButtonClass({ disabled: submitting || hasBlockedPreorders })}>
      {submitting ? (
        <>
          <svg className="size-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Opening payment…
        </>
      ) : hasBlockedPreorders ? "Pre-orders are closed" : `Pay ${money(finalTotal)}`}
    </button>
  );

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-12">
      {hasBlockedPreorders && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-mbi-card bg-mbi-error-tint px-4 py-3 text-sm font-medium text-mbi-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>
          Pre-orders are closed for now. Remove the pre-order items from your cart to continue.
        </div>
      )}
      <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy">Checkout</h1>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        <form id="checkout-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 lg:col-span-3">
          <section className="rounded-mbi-card border border-mbi-hairline bg-white p-5" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-xl font-bold text-mbi-navy">Delivery information</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="co-name" className={label}>Full name</label>
                <input id="co-name" readOnly value={form.fullName} className={readOnlyClass} />
              </div>
              <div>
                <label htmlFor="co-email" className={label}>Email address</label>
                <input id="co-email" readOnly value={form.email} className={readOnlyClass} />
              </div>
              <div>
                <label htmlFor="co-phone" className={label}>Phone number</label>
                <input id="co-phone" readOnly value={form.phone} className={readOnlyClass} />
              </div>
              <p className="sm:col-span-2 flex items-start gap-2 rounded-lg bg-mbi-surface-soft px-3 py-2.5 text-sm text-mbi-navy-body">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-mbi-slate"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8.01"/></svg>
                <span>Filled in from your account. To change these, open <strong className="font-semibold text-mbi-navy">Delivery details</strong> in the Account menu.</span>
              </p>
              <div>
                <label htmlFor="co-region" className={label}>Region</label>
                <select id="co-region" name="region" value={form.region ?? ""} onChange={handleChange} aria-invalid={!!errors.region} aria-describedby={errors.region ? "co-region-error" : undefined} className={inputClass("region")}>
                  <option value="">Select region</option>
                  {ghanaRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <FieldError id="co-region-error">{errors.region}</FieldError>
              </div>
              <div>
                <label htmlFor="co-town" className={label}>Town / city</label>
                <input id="co-town" name="town" value={form.town ?? ""} onChange={handleChange} placeholder="e.g. Kumasi" autoComplete="address-level2" aria-invalid={!!errors.town} aria-describedby={errors.town ? "co-town-error" : undefined} className={inputClass("town")} />
                <FieldError id="co-town-error">{errors.town}</FieldError>
              </div>
            </div>
          </section>

          {submitError && (
            <p role="alert" className="rounded-mbi-card bg-mbi-error-tint px-4 py-3 text-sm font-medium text-mbi-error">{submitError}</p>
          )}

          <div className="hidden lg:block">{payButton}</div>
          <p className="hidden lg:flex items-center justify-center gap-1.5 text-sm text-mbi-slate">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            Secure payment by Mobile Money or card through Hubtel
          </p>
        </form>

        <aside className="lg:col-span-2">
          <div className="rounded-mbi-card border border-mbi-hairline bg-white p-5 lg:sticky lg:top-24">
            <h2 className="text-xl font-bold text-mbi-navy">Order summary</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {checkoutItems.map(item => {
                const options = [item.size, item.colour].filter(Boolean).join(" · ");
                return (
                  <li key={item.cartKey} className="flex items-start gap-3">
                    {itemImage(item) ? (
                      <img src={thumbUrl(itemImage(item), 120)} onError={imgFallback(itemImage(item))} alt={item.product_name} className="size-14 shrink-0 rounded-lg bg-mbi-surface-soft object-cover" />
                    ) : (
                      <div className="size-14 shrink-0 rounded-lg bg-mbi-surface-soft" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-mbi-navy">{item.product_name}</p>
                      <p className="text-sm text-mbi-slate">{options ? `${options} · ` : ""}Qty {item.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-mbi-navy tabular">{money(item.unit_price * item.quantity)}</p>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-mbi-hairline pt-4 text-sm">
              <div className="flex justify-between text-mbi-navy-body tabular">
                <dt>Subtotal</dt>
                <dd>{money(checkoutSubtotal)}</dd>
              </div>
              {availableCoupons.length > 0 && (
                <div>
                  <label className={`flex min-h-11 items-center justify-between gap-2 ${couponEligible ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <span className="flex items-center gap-2.5 text-mbi-navy">
                      <input
                        type="checkbox"
                        checked={applyCoupon}
                        disabled={!couponEligible}
                        onChange={e => setApplyCoupon(e.target.checked)}
                        className="size-5 accent-mbi-navy"
                      />
                      Use 1 coupon ({availableCoupons.length} available)
                    </span>
                    <span className="font-semibold text-mbi-available tabular">− {money(100)}</span>
                  </label>
                  {!couponEligible && <p className="text-sm text-mbi-slate">Coupons work on orders above GHS 3,000.</p>}
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between font-semibold text-mbi-available tabular">
                  <dt>Coupon discount</dt>
                  <dd>− {money(discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-mbi-navy-body">
                <dt>Delivery</dt>
                <dd className="text-mbi-slate">Confirmed after your order</dd>
              </div>
              <div className="flex justify-between border-t border-mbi-hairline pt-3 text-lg font-bold text-mbi-navy tabular">
                <dt>Total</dt>
                <dd>{money(finalTotal)}</dd>
              </div>
              {checkoutSavings > 0 && (
                <p className="text-sm font-medium text-mbi-available tabular">Includes {money(checkoutSavings)} in product discounts.</p>
              )}
            </dl>
          </div>
        </aside>
      </div>

      {/* Phones: pay within thumb reach, above the bottom tab bar. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-mbi-hairline bg-white px-4 py-3 shadow-mbi-float lg:hidden">
        <div className="mx-auto max-w-xl">{payButton}</div>
      </div>
      <div className="h-24 lg:hidden" aria-hidden="true" />
    </div>

      {/* Hubtel Onsite Checkout iframe modal */}
      {paymentInProgress?.iframeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Secure payment">
          <div className="absolute inset-0 bg-mbi-navy/60" onClick={handleIframeClose} />
          <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white shadow-mbi-float sm:h-[640px] sm:w-[480px] sm:rounded-mbi-card">
            <div className="flex shrink-0 items-center justify-between bg-mbi-navy px-4 py-3">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2AA25" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
                <span className="text-sm font-semibold text-white">Secure payment</span>
              </div>
              <button
                type="button"
                onClick={handleIframeClose}
                className="mbi-press grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Cancel payment"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {!iframeLoaded && (
              <div className="absolute inset-0 top-16 z-10 flex flex-col items-center justify-center gap-3 bg-white">
                <div className="size-10 animate-spin rounded-full border-4 border-mbi-amber border-t-transparent" />
                <p className="text-sm font-medium text-mbi-slate">Loading payment…</p>
              </div>
            )}

            <iframe
              ref={iframeRef}
              src={paymentInProgress.iframeUrl}
              onLoad={handleIframeLoad}
              className="w-full flex-1 border-0"
              title="Hubtel Secure Payment"
              allow="payment"
            />
          </div>
        </div>
      )}
    </>
  );
}
