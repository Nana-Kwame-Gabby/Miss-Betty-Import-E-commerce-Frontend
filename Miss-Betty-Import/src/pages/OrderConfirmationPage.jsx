import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { imgFallback, thumbUrl } from "../lib/imageUrl";
import { money, primaryButtonClass, secondaryButtonClass } from "../lib/buyBoxStyles";

// One centred status card (processing / cancelled / failed / nothing found).
function StatusCard({ icon, tone, title, children, actions }) {
  return (
  <div className="flex flex-col items-center px-4 py-16">
    <div className="w-full max-w-sm rounded-mbi-card border border-mbi-hairline bg-white p-6 text-center sm:p-8">
      {icon && <div className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${tone}`}>{icon}</div>}
      <h1 className="text-xl font-bold text-mbi-navy">{title}</h1>
      <div className="mt-2 text-base text-mbi-navy-body">{children}</div>
      {actions && <div className="mt-6 flex flex-col gap-3">{actions}</div>}
    </div>
  </div>
  );
}

export default function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const { clearCart, removeCartKeys } = useCart();

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
  const releaseRanRef = useRef(false);

  // Coupon is only ever spent once the order actually exists — confirm here rather
  // than at checkout submission time. Idempotent server-side, safe to call more than
  // once (e.g. redundantly alongside the hubtel-callback webhook's own confirm call).
  async function confirmCouponIfPresent(couponId, orderId) {
    if (!couponId) return;
    await supabase.rpc('confirm_coupon_usage', { p_coupon_id: couponId, p_order_id: orderId }).catch(() => {});
  }

  // Hubtel's own cancel/fail redirect lands directly on these phases — nothing else
  // runs for them, so this is the only place a coupon reserved for a payment that
  // never completed inside Hubtel's UI (as opposed to our own Cancel button) gets
  // released back to available.
  useEffect(() => {
    if (phase !== "cancelled" && phase !== "failed") return;
    if (releaseRanRef.current) return;
    releaseRanRef.current = true;

    async function releaseIfReserved() {
      const { data: pendingRows } = await supabase
        .from("pending_orders")
        .select("coupon_id, customer_id")
        .eq("order_id", urlOrderId)
        .limit(1);
      const pending = pendingRows?.[0];
      if (pending?.coupon_id) {
        await supabase.rpc('release_coupon', {
          p_coupon_id:   pending.coupon_id,
          p_customer_id: pending.customer_id,
        }).catch(() => {});
      }
    }
    releaseIfReserved();
  }, [phase, urlOrderId]);

  useEffect(() => {
    if (phase !== "processing") return;
    if (ranRef.current) return;
    ranRef.current = true;

    async function fetchOrderFromDB(orderId) {
      const { data: orderRows } = await supabase
        .from("orders")
        .select("*, products(product_name, product_image_url)")
        .eq("order_id", orderId);
      if (!orderRows?.length) return null;

      const [{ data: custRows }, { data: pendingRows }] = await Promise.all([
        supabase
          .from("customers")
          .select("customer_name, email, telephone")
          .eq("customer_id", orderRows[0].customer_id)
          .single(),
        supabase
          .from("pending_orders")
          .select("discount_amount")
          .eq("order_id", orderId)
          .limit(1),
      ]);

      const items = orderRows.map(r => ({
        cartKey:           String(r.id),
        id:                r.product_id,
        product_name:      r.products?.product_name ?? r.product_name_snapshot ?? "Product no longer listed",
        product_image_url: r.products?.product_image_url ?? "",
        unit_price:        Number(r.unit_price),
        quantity:          r.quantity,
        size:              r.size,
        colour:            r.colour,
      }));

      return {
        form: {
          fullName: custRows?.customer_name ?? "",
          email:    custRows?.email         ?? "",
          phone:    custRows?.telephone      ?? "",
          region:   orderRows[0].delivery_region ?? "",
          town:     orderRows[0].delivery_town   ?? "",
        },
        items,
        subtotal: items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
        discount: Number(pendingRows?.[0]?.discount_amount ?? 0),
        orderId,
      };
    }

    async function processOrder() {
      // Primary path: poll DB for the order created by the hubtel-callback webhook.
      // The callback fires server-to-server and may complete slightly before or after
      // the browser redirect lands here — polling handles the timing gap.
      const MAX_POLLS = 8;
      const POLL_MS   = 2000;
      let dbOrder = null;

      for (let i = 0; i < MAX_POLLS; i++) {
        dbOrder = await fetchOrderFromDB(urlOrderId);
        if (dbOrder) break;
        if (i < MAX_POLLS - 1) await new Promise(r => setTimeout(r, POLL_MS));
      }

      if (dbOrder) {
        const { data: pendingRows } = await supabase
          .from("pending_orders").select("items, coupon_id").eq("order_id", urlOrderId).limit(1);
        const keys = (pendingRows?.[0]?.items || [])
          .map(i => i.cartKey).filter(k => k && !k.startsWith("buynow-"));
        keys.length ? removeCartKeys(keys) : clearCart();
        sessionStorage.removeItem(`pending_order_${urlOrderId}`);
        await confirmCouponIfPresent(pendingRows?.[0]?.coupon_id, urlOrderId);
        setOrderData(dbOrder);
        setPhase("ready");
        return;
      }

      // Fallback: callback didn't fire within the polling window.
      // Use sessionStorage data (saved by CheckoutPage) as a safety net.
      const key   = `pending_order_${urlOrderId}`;
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");

      if (saved) {
        const { data: activePeriodRows } = await supabase
          .from("order_periods").select("id").eq("is_active", true).limit(1);
        const activePeriodId = activePeriodRows?.[0]?.id ?? null;

        const orderRows = saved.items.map(item => ({
          order_id:          urlOrderId,
          customer_id:       saved.customerId,
          product_id:        item.id,
          quantity:          item.quantity,
          unit_price:        item.unit_price,
          cost_price:        item.cost_price ?? 0,
          profit:            item.profit     ?? 0,
          rmb_price:         item.rmb_price  ?? 0,
          misc_amount:       item.misc_amount ?? 0,
          size:              item.size,
          colour:            item.colour,
          status:            "Ordered",
          delivery_region:   saved.form.region,
          delivery_town:     saved.form.town,
          can_edit_delivery: true,
          order_period_id:   activePeriodId,
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
          order_period_id: activePeriodId,
        }));

        // Double-check idempotency before inserting
        const { data: alreadyExists } = await supabase
          .from("orders").select("order_id").eq("order_id", urlOrderId).limit(1);

        if (!alreadyExists?.length) {
          await supabase.from("orders").insert(orderRows);
          await supabase.from("invoices").insert(invoiceRows);
        }

        const keys = (saved.items || [])
          .map(i => i.cartKey).filter(k => k && !k.startsWith("buynow-"));
        keys.length ? removeCartKeys(keys) : clearCart();
        sessionStorage.removeItem(key);
        await confirmCouponIfPresent(saved.couponId, urlOrderId);

        const { data: pendingDiscountRows } = await supabase
          .from("pending_orders").select("discount_amount").eq("order_id", urlOrderId).limit(1);
        const discount = Number(pendingDiscountRows?.[0]?.discount_amount ?? 0);
        const subtotal = saved.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        setOrderData({ form: saved.form, items: saved.items, subtotal, discount, orderId: urlOrderId });
        setPhase("ready");
      } else {
        // No sessionStorage either — order may have been created by callback after
        // polling ended. Do one final DB check.
        const finalCheck = await fetchOrderFromDB(urlOrderId);
        if (finalCheck) {
          const { data: pendingRows } = await supabase
            .from("pending_orders").select("items, coupon_id").eq("order_id", urlOrderId).limit(1);
          const keys = (pendingRows?.[0]?.items || [])
            .map(i => i.cartKey).filter(k => k && !k.startsWith("buynow-"));
          keys.length ? removeCartKeys(keys) : clearCart();
          await confirmCouponIfPresent(pendingRows?.[0]?.coupon_id, urlOrderId);
          setOrderData(finalCheck);
          setPhase("ready");
        } else {
          setPhase("no-order");
        }
      }
    }

    processOrder();
  }, [phase, urlOrderId, clearCart, removeCartKeys]);

  const retryActions = (
    <>
      <Link to="/checkout" className={primaryButtonClass()}>Try again</Link>
      <Link to="/shop" className={secondaryButtonClass()}>Back to shop</Link>
    </>
  );

  if (phase === "processing") {
    return (
      <StatusCard
        title="Confirming your payment"
        icon={<div className="size-8 animate-spin rounded-full border-4 border-mbi-amber border-t-transparent" />}
        tone="bg-mbi-amber-tint"
      >
        <p role="status">Please don't close this page while we confirm your order.</p>
      </StatusCard>
    );
  }

  if (phase === "cancelled") {
    return (
      <StatusCard
        title="Payment cancelled"
        tone="bg-mbi-amber-tint text-mbi-amber-ink"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        actions={retryActions}
      >
        <p>You cancelled the payment, so your order was not placed. Your cart is still saved.</p>
      </StatusCard>
    );
  }

  if (phase === "failed") {
    return (
      <StatusCard
        title="Payment unsuccessful"
        tone="bg-mbi-error-tint text-mbi-error"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        actions={retryActions}
      >
        <p>Your payment could not be processed and you were not charged for this order. Please try again, or chat with us on WhatsApp.</p>
      </StatusCard>
    );
  }

  if (phase === "no-order" || !orderData) {
    return (
      <StatusCard
        title="No order details found"
        tone="bg-mbi-surface-soft text-mbi-slate"
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        actions={<><Link to="/my-orders" className={primaryButtonClass()}>View my orders</Link><Link to="/shop" className={secondaryButtonClass()}>Go shopping</Link></>}
      >
        <p>If you just paid, your order will appear in My orders shortly.</p>
      </StatusCard>
    );
  }

  const { form, items, subtotal, discount = 0, orderId } = orderData;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-12">
      <section className="rounded-mbi-card border border-mbi-hairline bg-white p-6 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-mbi-available-tint text-mbi-available">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy">Payment successful</h1>
        <p className="mt-2 text-base text-mbi-navy-body">
          Thank you, <strong className="font-semibold text-mbi-navy">{form.fullName}</strong>. Your order is placed and we're getting it ready.
        </p>
        <div className="mt-4 inline-block rounded-lg bg-mbi-surface-soft px-4 py-2.5">
          <p className="text-xs font-medium text-mbi-slate">Order number</p>
          <p className="text-base font-bold text-mbi-navy tabular">{orderId ?? "—"}</p>
        </div>
      </section>

      <section className="mt-4 rounded-mbi-card border border-mbi-hairline bg-white p-5" aria-labelledby="order-details-heading">
        <h2 id="order-details-heading" className="text-xl font-bold text-mbi-navy">Order details</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {items.map(item => {
            const options = [item.size, item.colour].filter(Boolean).join(" · ");
            return (
              <li key={item.cartKey} className="flex items-center gap-3">
                {item.product_image_url ? (
                  <img src={thumbUrl(item.product_image_url, 120)} onError={imgFallback(item.product_image_url)} alt={item.product_name} className="size-14 shrink-0 rounded-lg bg-mbi-surface-soft object-cover" />
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
          {discount > 0 && (
            <div className="flex justify-between font-semibold text-mbi-available tabular">
              <dt>Coupon discount</dt>
              <dd>− {money(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-mbi-navy tabular">
            <dt>Total paid</dt>
            <dd>{money(subtotal - discount)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 rounded-mbi-card border border-mbi-hairline bg-white p-5" aria-labelledby="delivery-to-heading">
        <h2 id="delivery-to-heading" className="text-xl font-bold text-mbi-navy">Delivery to</h2>
        <div className="mt-2 flex flex-col gap-1 text-base text-mbi-navy-body">
          <p className="font-semibold text-mbi-navy">{form.fullName}</p>
          <p>{form.email}</p>
          <p className="tabular">{form.phone}</p>
          <p>{[form.town, form.region].filter(Boolean).join(", ")}</p>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to="/my-orders" className={primaryButtonClass()}>View my orders</Link>
        <Link to="/shop" className={secondaryButtonClass()}>Continue shopping</Link>
      </div>
    </div>
  );
}
