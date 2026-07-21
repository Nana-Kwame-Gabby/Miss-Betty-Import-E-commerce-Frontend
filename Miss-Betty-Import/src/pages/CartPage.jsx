import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { colourMap } from "../data/mockData";
import { getEffectivePrice, hasDiscount } from "../lib/priceUtils";

function VariantAdder({ product, addToCart }) {
  const [curSize,   setCurSize]   = useState(product.sizes?.[0]   ?? null);
  const [curColour, setCurColour] = useState(product.colours?.[0] ?? null);
  const [curQty,    setCurQty]    = useState(1);
  const [added,     setAdded]     = useState(false);

  const curEntry         = product.sizePricing && curSize
    ? (product.sizePricing.find(sp => sp.size === curSize) ?? null) : null;
  const curRegularPrice  = curEntry?.selling_price ?? curEntry?.price ?? product.unit_price ?? 0;
  const curDiscountPrice = curEntry?.discount_price ?? product.discount_price ?? null;
  const curHasDiscount   = curDiscountPrice != null && curDiscountPrice > 0 && curDiscountPrice < curRegularPrice;
  const curPrice         = curHasDiscount ? curDiscountPrice : curRegularPrice;
  const curCostPrice     = curEntry?.cost_price ?? product.cost_price ?? 0;
  const curProfit        = curEntry?.profit     ?? product.profit     ?? 0;

  const canAdd = (!product.sizes?.length || curSize) && (!product.colours?.length || curColour);

  function handleAdd() {
    if (!canAdd) return;
    addToCart(
      product, curQty, curSize, curColour,
      curPrice, curCostPrice, curProfit,
      curHasDiscount ? curRegularPrice : null
    );
    setAdded(true);
    setCurQty(1);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="bg-[#FFF9F0] rounded-xl border border-[#F2AA25]/30 p-3">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <p className="text-[11px] text-[#F2AA25] font-semibold">+ Add a variant</p>
      </div>

      {/* Size picker */}
      {product.sizes?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Size</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map(s => {
              const entry  = product.sizePricing?.find(sp => sp.size === s);
              const reg    = entry ? (entry.selling_price ?? entry.price ?? 0) : 0;
              const disc   = entry ? getEffectivePrice(entry) : 0;
              const hasDis = entry && hasDiscount(entry);
              const active = curSize === s;
              return (
                <button
                  key={s}
                  onClick={() => setCurSize(s)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors leading-none border ${
                    active
                      ? "bg-[#1e2d3d] text-white border-[#1e2d3d]"
                      : "border-gray-300 text-gray-600 hover:border-[#1e2d3d]"
                  }`}
                >
                  <span className="block">{s}</span>
                  {entry && (hasDis ? (
                    <>
                      <span className="block text-[10px] font-semibold text-[#DC2626]">GHS {disc.toLocaleString()}</span>
                      <span className={`block text-[9px] line-through ${active ? "text-white/50" : "text-gray-300"}`}>GHS {reg.toLocaleString()}</span>
                    </>
                  ) : (
                    <span className={`block text-[10px] ${active ? "text-white/70" : "text-gray-400"}`}>GHS {reg.toLocaleString()}</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Colour picker */}
      {product.colours?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Colour:{" "}
            <span className="normal-case font-normal text-gray-600">{curColour}</span>
          </p>
          <div className="flex flex-wrap gap-2.5">
            {product.colours.map(c => (
              <button
                key={c}
                onClick={() => setCurColour(c)}
                title={c}
                className={`w-7 h-7 rounded-full transition-all flex-shrink-0 ${
                  curColour === c
                    ? "ring-2 ring-offset-2 ring-[#1e2d3d] scale-110"
                    : "hover:scale-105"
                } ${c === "White" ? "border border-gray-200" : ""}`}
                style={{ backgroundColor: colourMap[c] || "#ccc" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Qty + Add Variant button */}
      <div className="flex items-center gap-3">
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCurQty(q => Math.max(1, q - 1))}
            className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-base leading-none"
          >−</button>
          <span className="px-3 py-2 text-sm font-semibold text-[#1e2d3d] min-w-[2rem] text-center">{curQty}</span>
          <button
            onClick={() => setCurQty(q => q + 1)}
            className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-base leading-none"
          >+</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
            added
              ? "bg-green-500 text-white"
              : canAdd
              ? "bg-[#F2AA25] text-white hover:opacity-90"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {added ? "✓ Added to cart!" : `Add Variant · GHS ${curPrice.toLocaleString()}`}
        </button>
      </div>
    </div>
  );
}

// One card per product — every size/colour variant of that product currently in the
// cart is listed as a compact row inside it, instead of each variant getting its own
// separate card.
function ProductGroupCard({ group, addToCart, updateQuantity, removeFromCart }) {
  const { product, variants } = group;
  const hasVariantOptions = (product.sizes?.length ?? 0) > 0 || (product.colours?.length ?? 0) > 0;
  const groupTotal = variants.reduce((s, v) => s + v.unit_price * v.quantity, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-2.5 sm:p-3">
      <div className="flex gap-2.5 sm:gap-3 items-center mb-2">
        <img
          src={product.product_image_url}
          alt={product.product_name}
          className="w-14 h-[72px] sm:w-20 sm:h-24 object-cover rounded-xl flex-shrink-0"
        />
        <h3 className="font-semibold text-[#1e2d3d] truncate flex-1 min-w-0">{product.product_name}</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {variants.map(v => (
          <div key={v.cartKey} className="py-2 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm text-gray-600 truncate">
                {[v.size, v.colour].filter(Boolean).join(" · ") || "Standard"}
              </span>
              <button
                onClick={() => removeFromCart(v.cartKey)}
                className="text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                aria-label="Remove item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 flex-shrink-0">GHS {v.unit_price.toLocaleString()} each</span>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2 py-1 flex-shrink-0">
                <button
                  onClick={() => updateQuantity(v.cartKey, v.quantity - 1)}
                  className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]"
                >−</button>
                <span className="w-6 text-center text-sm font-semibold">{v.quantity}</span>
                <button
                  onClick={() => updateQuantity(v.cartKey, v.quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]"
                >+</button>
              </div>
              <span className="font-semibold text-[#1e2d3d] flex-shrink-0">
                GHS {(v.unit_price * v.quantity).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hasVariantOptions && (
        <div className="mt-2">
          <VariantAdder product={product} addToCart={addToCart} />
        </div>
      )}

      <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100">
        <span className="text-sm font-semibold text-[#1e2d3d]">Total</span>
        <span className="font-bold text-[#1e2d3d]">GHS {groupTotal.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, addToCart, subtotal, totalSavings } = useCart();
  const { ordersClosed } = useAppSettings();
  const navigate = useNavigate();

  const isPreorder = s => typeof s === "string" && s.toLowerCase().includes("pre");
  const hasBlockedPreorders = ordersClosed && cartItems.some(i => isPreorder(i.product_status));

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

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <div className="text-4xl sm:text-5xl mb-3">🛒</div>
        <h2 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-2">Your cart is empty</h2>
        <p className="text-gray-400 text-sm mb-6">Looks like you haven't added anything yet.</p>
        <Link
          to="/shop"
          className="inline-block bg-[#F2AA25] text-white font-bold px-6 py-2.5 rounded-2xl hover:opacity-90 transition-opacity"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d] mb-3 sm:mb-5">
        My Cart <span className="text-gray-400 text-base font-normal">({cartItems.length} {cartItems.length === 1 ? "item" : "items"})</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
        {/* Items list */}
        <div className="lg:col-span-2 flex flex-col gap-2 sm:gap-3">

          {groupedCartItems.map(group => (
            <ProductGroupCard
              key={group.product.id}
              group={group}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
            />
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm p-3 sm:p-4 sticky top-12">
            <h2 className="font-bold text-[#1e2d3d] text-base mb-3">Order Summary</h2>
            <div className="flex flex-col gap-2 text-sm mb-3">
              {cartItems.map(item => (
                <div key={item.cartKey} className="flex justify-between text-gray-600">
                  <span className="truncate flex-1 mr-2">{item.product_name} × {item.quantity}</span>
                  <span className="font-medium flex-shrink-0">GHS {(item.unit_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 mb-3">
              <div className="flex justify-between font-bold text-[#1e2d3d] text-base">
                <span>Subtotal</span>
                <span className="text-[#DC2626]">GHS {subtotal.toLocaleString()}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between text-green-600 text-xs font-semibold mt-1">
                  <span>You save</span>
                  <span>− GHS {totalSavings.toLocaleString()}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Delivery fee calculated at checkout</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Please review your cart carefully before checking out — Miss Betty Import is not responsible for errors in size, colour, or style chosen by the customer.
            </p>
            <button
              onClick={() => !hasBlockedPreorders && navigate("/checkout")}
              disabled={hasBlockedPreorders}
              className={`w-full font-bold py-2.5 sm:py-3 rounded-2xl transition-opacity ${
                hasBlockedPreorders
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-[#F2AA25] text-white hover:opacity-90"
              }`}
            >
              {hasBlockedPreorders ? "Pre-orders Closed" : "Proceed to Checkout"}
            </button>
            {hasBlockedPreorders && (
              <p className="text-xs text-red-500 text-center mt-1.5">
                Your cart contains pre-order items which are currently unavailable. Remove them to proceed.
              </p>
            )}
            <Link
              to="/shop"
              className="block text-center text-sm text-[#1e2d3d] font-medium mt-3 hover:text-[#F2AA25] transition-colors"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
