import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { imgFallback, thumbUrl } from "../lib/imageUrl";
import { productPath } from "../lib/seo";
import { AddVariantRow, ColourSwatches, QtyStepper, SizeChips } from "../components/shop/BuyBox";
import { money, primaryButtonClass, secondaryButtonClass } from "../lib/buyBoxStyles";

function VariantAdder({ product, addToCart }) {
  const [curSize,   setCurSize]   = useState(null);
  const [curColour, setCurColour] = useState(null);
  const [curQty,    setCurQty]    = useState(1);
  const [added,     setAdded]     = useState(false);

  const curEntry         = product.sizePricing && curSize
    ? (product.sizePricing.find(sp => sp.size === curSize) ?? null) : null;
  const curRegularPrice  = curEntry?.selling_price ?? curEntry?.price ?? product.unit_price ?? 0;
  // A chosen size uses only its own discount; the product-level discount_price is the
  // lowest discount across sizes (for the "from" price) and must not leak into other sizes.
  const curDiscountPrice = curEntry ? (curEntry.discount_price ?? null) : (product.discount_price ?? null);
  const curHasDiscount   = curDiscountPrice != null && curDiscountPrice > 0 && curDiscountPrice < curRegularPrice;
  const curPrice         = curHasDiscount ? curDiscountPrice : curRegularPrice;
  const curCostPrice     = curEntry?.cost_price ?? product.cost_price ?? 0;
  const curProfit        = curEntry?.profit     ?? product.profit     ?? 0;
  const curRmbPrice      = curEntry?.rmb_price  ?? product.rmb_price  ?? 0;
  // Misc travels with the line like on every other add-to-cart path, so the order's
  // profit (price − cost − misc) is right.
  const curMiscAmount    = curEntry?.misc_amount ?? product.misc_amount ?? 0;

  const canAdd = (!product.sizes?.length || curSize) && (!product.colours?.length || curColour);

  function handleAdd() {
    if (!canAdd) return;
    addToCart(
      product, curQty, curSize, curColour,
      curPrice, curCostPrice, curProfit,
      curHasDiscount ? curRegularPrice : null,
      curRmbPrice, curMiscAmount
    );
    setAdded(true);
    setCurQty(1);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <details className="group rounded-lg bg-mbi-surface-soft">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold text-mbi-navy [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add another size or colour
        </span>
        <svg className="transition-transform duration-150 ease-mbi-out group-open:rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </summary>
      <div className="space-y-4 px-3 pb-3 pt-1">
        <SizeChips sizes={product.sizes ?? []} sizePricing={product.sizePricing} value={curSize} onChange={setCurSize} />
        <ColourSwatches colours={product.colours ?? []} value={curColour} onChange={setCurColour} />
        <AddVariantRow
          qty={curQty}
          onQty={setCurQty}
          onAdd={handleAdd}
          disabled={!canAdd}
          label={added ? "Added to cart" : canAdd ? `Add · ${money(curPrice)}` : "Choose options"}
        />
      </div>
    </details>
  );
}

// One card per product — every size/colour variant of that product currently in the
// cart is listed as a row inside it, instead of each variant getting its own card.
function ProductGroupCard({ group, addToCart, updateQuantity, removeFromCart }) {
  const { product, variants } = group;
  const hasVariantOptions = (product.sizes?.length ?? 0) > 0 || (product.colours?.length ?? 0) > 0;
  const groupTotal = variants.reduce((s, v) => s + v.unit_price * v.quantity, 0);

  return (
    <article className="rounded-mbi-card border border-mbi-hairline bg-white p-4">
      <div className="flex items-center gap-3">
        <Link to={productPath({ id: product.id, product_name: product.product_name })} className="shrink-0">
          <img
            src={thumbUrl(product.product_image_url, 160)}
            onError={imgFallback(product.product_image_url)}
            alt={product.product_name}
            className="size-16 rounded-lg bg-mbi-surface-soft object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-mbi-navy">
            <Link to={productPath({ id: product.id, product_name: product.product_name })} className="hover:underline">{product.product_name}</Link>
          </h2>
          {product.product_status && <p className="mt-0.5 text-sm text-mbi-slate">{product.product_status}</p>}
        </div>
      </div>

      <ul className="mt-3 divide-y divide-mbi-hairline-soft border-t border-mbi-hairline-soft">
        {variants.map(v => {
          const label = [v.size, v.colour].filter(Boolean).join(" · ") || "Standard";
          return (
            <li key={v.cartKey} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 sm:flex-1">
                <p className="truncate text-sm font-medium text-mbi-navy">{label}</p>
                <p className="text-sm text-mbi-slate tabular">
                  {money(v.unit_price)} each
                  {v.original_price != null && v.original_price > v.unit_price && <s className="ml-1.5">{money(v.original_price)}</s>}
                </p>
              </div>
              <div className="flex items-center gap-3">
              <QtyStepper compact value={v.quantity} onChange={q => updateQuantity(v.cartKey, q)} label={`Quantity of ${label}`} />
              <span className="ml-auto min-w-24 text-right text-base font-bold text-mbi-navy tabular sm:ml-0">{money(v.unit_price * v.quantity)}</span>
              <button
                type="button"
                onClick={() => removeFromCart(v.cartKey)}
                className="mbi-press grid size-9 shrink-0 place-items-center rounded-full text-mbi-slate hover:bg-mbi-error-tint hover:text-mbi-error"
                aria-label={`Remove ${product.product_name} ${label}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
              </div>
            </li>
          );
        })}
      </ul>

      {hasVariantOptions && (
        <div className="mt-1">
          <VariantAdder product={product} addToCart={addToCart} />
        </div>
      )}

      {variants.length > 1 && (
        <div className="mt-3 flex items-center justify-between border-t border-mbi-hairline-soft pt-3 text-sm">
          <span className="font-semibold text-mbi-navy">Product total</span>
          <span className="font-bold text-mbi-navy tabular">{money(groupTotal)}</span>
        </div>
      )}
    </article>
  );
}

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, addToCart, subtotal, totalSavings } = useCart();
  const { ordersClosed } = useAppSettings();
  const navigate = useNavigate();

  const isPreorder = s => typeof s === "string" && s.toLowerCase().includes("pre");
  const hasBlockedPreorders = ordersClosed && cartItems.some(i => isPreorder(i.product_status));
  const itemCount = cartItems.reduce((s, i) => s + Number(i.quantity ?? 0), 0);

  // One group per product — every cart line (a distinct size/colour combination) for
  // that product id is collected together so it can render as rows inside one card.
  const groupedCartItems = useMemo(() => {
    const map = new Map();
    cartItems.forEach(item => {
      if (!map.has(item.id)) map.set(item.id, { product: item, variants: [] });
      map.get(item.id).variants.push(item);
    });
    return Array.from(map.values());
  }, [cartItems]);

  // Phones get a pinned checkout bar; lift the chat launcher above it.
  const hasItems = cartItems.length > 0;
  useEffect(() => {
    if (!hasItems) return;
    document.documentElement.dataset.actionBar = "on";
    return () => { delete document.documentElement.dataset.actionBar; };
  }, [hasItems]);

  const goToCheckout = () => { if (!hasBlockedPreorders) navigate("/checkout"); };

  if (!hasItems) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="grid size-16 place-items-center rounded-full bg-mbi-surface-soft text-mbi-slate">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-mbi-navy">Your cart is empty</h1>
        <p className="mt-1 text-base text-mbi-slate">Looks like you haven't added anything yet.</p>
        <Link to="/shop" className={`${primaryButtonClass()} mt-6 !w-auto`}>Start shopping</Link>
      </div>
    );
  }

  const checkoutLabel = hasBlockedPreorders ? "Pre-orders are closed" : "Proceed to checkout";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-40 lg:pb-12">
      <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy">
        Your cart <span className="text-base font-medium tracking-normal text-mbi-slate">({itemCount} {itemCount === 1 ? "item" : "items"})</span>
      </h1>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {groupedCartItems.map(group => (
            <ProductGroupCard
              key={group.product.id}
              group={group}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
            />
          ))}
          <Link to="/shop" className="mbi-press mt-1 inline-flex h-11 w-fit items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-mbi-navy hover:underline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            Continue shopping
          </Link>
        </div>

        <aside className="lg:col-span-1">
          <div className="rounded-mbi-card border border-mbi-hairline bg-white p-5 lg:sticky lg:top-24">
            <h2 className="text-xl font-bold text-mbi-navy">Order summary</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {cartItems.map(item => (
                <li key={item.cartKey} className="flex justify-between gap-3 text-mbi-navy-body">
                  <span className="min-w-0 flex-1 truncate">{item.product_name} × {item.quantity}</span>
                  <span className="shrink-0 font-medium tabular">{money(item.unit_price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-mbi-hairline pt-4">
              <div className="flex justify-between text-base font-bold text-mbi-navy tabular">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between text-sm font-semibold text-mbi-available tabular">
                  <span>You save</span>
                  <span>− {money(totalSavings)}</span>
                </div>
              )}
              <p className="text-sm text-mbi-slate">Delivery fee is calculated at checkout.</p>
            </div>
            <p className="mt-4 rounded-lg bg-mbi-surface-soft px-3 py-2.5 text-sm leading-relaxed text-mbi-navy-body">
              Please check sizes, colours and styles before checking out. Miss Betty Import is not responsible for errors in the options you choose.
            </p>
            <button
              type="button"
              onClick={goToCheckout}
              disabled={hasBlockedPreorders}
              className={`mt-4 hidden lg:inline-flex ${hasBlockedPreorders ? secondaryButtonClass({ disabled: true }) : primaryButtonClass()}`}
            >
              {checkoutLabel}
            </button>
            {hasBlockedPreorders && (
              <p role="alert" className="mt-3 text-sm font-medium text-mbi-error">
                Your cart has pre-order items, and pre-orders are closed right now. Remove them to check out.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Phones: subtotal and checkout within thumb reach, above the bottom tab bar. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-mbi-hairline bg-white px-4 py-3 shadow-mbi-float lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-mbi-slate">Subtotal</p>
            <p className="text-lg font-bold text-mbi-navy tabular">{money(subtotal)}</p>
          </div>
          <button
            type="button"
            onClick={goToCheckout}
            disabled={hasBlockedPreorders}
            className={`flex-1 ${hasBlockedPreorders ? secondaryButtonClass({ disabled: true }) : primaryButtonClass()}`}
          >
            {hasBlockedPreorders ? "Orders closed" : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
