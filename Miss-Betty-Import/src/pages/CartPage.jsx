import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { colourMap } from "../data/mockData";
import { getEffectivePrice, hasDiscount } from "../lib/priceUtils";

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, updateVariant, addToCart, subtotal, totalSavings } = useCart();
  const { ordersClosed } = useAppSettings();
  const navigate = useNavigate();

  const [variantPanels, setVariantPanels] = useState({});

  function openPanel(item) {
    setVariantPanels(prev => ({
      ...prev,
      [item.cartKey]: { open: true, size: item.size, colour: item.colour, qty: 1 },
    }));
  }

  function closePanel(cartKey) {
    setVariantPanels(prev => ({ ...prev, [cartKey]: { ...prev[cartKey], open: false } }));
  }

  function updatePanel(cartKey, patch) {
    setVariantPanels(prev => ({ ...prev, [cartKey]: { ...prev[cartKey], ...patch } }));
  }

  function handleAddVariant(item) {
    const panel = variantPanels[item.cartKey];
    if (!panel) return;
    const sizeEntry    = item.sizePricing?.find(sp => sp.size === panel.size) ?? null;
    const price        = sizeEntry ? getEffectivePrice(sizeEntry) : item.unit_price;
    const originalPrice = sizeEntry && hasDiscount(sizeEntry) ? (sizeEntry.selling_price ?? sizeEntry.price) : null;
    const costPrice    = sizeEntry?.cost_price ?? item.cost_price ?? 0;
    const profit       = sizeEntry?.profit     ?? item.profit     ?? 0;
    addToCart(item, panel.qty, panel.size, panel.colour, price, costPrice, profit, originalPrice);
    closePanel(item.cartKey);
  }

  const isPreorder = s => typeof s === "string" && s.toLowerCase().includes("pre");
  const hasBlockedPreorders = ordersClosed && cartItems.some(i => isPreorder(i.product_status));

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
          {cartItems.map(item => {
            const panel = variantPanels[item.cartKey];
            const hasVariants = item.sizes?.length > 0 || item.colours?.length > 0;
            const cloneEntry = panel && item.sizePricing?.find(sp => sp.size === panel.size);
            const clonePrice = cloneEntry ? getEffectivePrice(cloneEntry) : item.unit_price;
            const cloneRegularPrice = cloneEntry ? (cloneEntry.selling_price ?? cloneEntry.price ?? item.unit_price) : item.unit_price;
            const cloneHasDiscount = cloneEntry && hasDiscount(cloneEntry);

            return (
              <Fragment key={item.cartKey}>
                {/* Original cart item card */}
                <div className="bg-white rounded-2xl shadow-sm p-2.5 sm:p-3 flex gap-2.5 sm:gap-3 items-start">
                  <img
                    src={item.product_image_url}
                    alt={item.product_name}
                    className="w-14 h-[72px] sm:w-20 sm:h-24 object-cover rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1e2d3d] truncate">{item.product_name}</h3>
                    {item.sizes?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.sizes.map(s => {
                          const priceEntry = item.sizePricing?.find(sp => sp.size === s);
                          const sizeRegular = priceEntry ? (priceEntry.selling_price ?? priceEntry.price ?? 0) : 0;
                          const sizeHasDiscount = priceEntry && hasDiscount(priceEntry);
                          const sizeEffective = priceEntry ? getEffectivePrice(priceEntry) : 0;
                          return (
                            <button
                              key={s}
                              onClick={() => updateVariant(item.cartKey, s, item.colour)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors leading-none ${
                                item.size === s
                                  ? "bg-[#1e2d3d] text-white"
                                  : "border border-gray-300 text-gray-500 hover:border-[#1e2d3d]"
                              }`}
                            >
                              <span className="block">{s}</span>
                              {priceEntry && (
                                sizeHasDiscount ? (
                                  <>
                                    <span className="block text-[10px] font-semibold text-[#F2AA25]">GHS {sizeEffective.toLocaleString()}</span>
                                    <span className={`block text-[9px] font-normal line-through ${item.size === s ? "text-white/50" : "text-gray-300"}`}>GHS {sizeRegular.toLocaleString()}</span>
                                  </>
                                ) : (
                                  <span className={`block text-[10px] font-normal ${item.size === s ? "text-white/70" : "text-gray-400"}`}>
                                    GHS {sizeRegular.toLocaleString()}
                                  </span>
                                )
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {item.colours?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[11px] text-gray-400 font-medium">Colour:</span>
                        {item.colours.map(c => (
                          <button
                            key={c}
                            onClick={() => updateVariant(item.cartKey, item.size, c)}
                            title={c}
                            className={`w-5 h-5 rounded-full transition-all flex-shrink-0 ${
                              item.colour === c
                                ? "ring-2 ring-offset-1 ring-[#1e2d3d] scale-110"
                                : "hover:scale-105"
                            } ${c === "White" ? "border border-gray-200" : ""}`}
                            style={{ backgroundColor: colourMap[c] || "#ccc" }}
                          />
                        ))}
                        <span className="text-[11px] text-gray-500">{item.colour}</span>
                      </div>
                    )}
                    {hasVariants && (
                      <button
                        onClick={() => panel?.open ? closePanel(item.cartKey) : openPanel(item)}
                        className="mt-1.5 text-[11px] font-semibold text-[#1e2d3d] hover:text-[#F2AA25] transition-colors"
                      >
                        {panel?.open ? "− Cancel" : "+ Add Variant"}
                      </button>
                    )}
                    <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                      <p className="text-[#F2AA25] font-bold">GHS {item.unit_price.toLocaleString()}</p>
                      {item.original_price != null && item.original_price > item.unit_price && (
                        <span className="text-gray-400 text-xs line-through">GHS {item.original_price.toLocaleString()}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2 py-1">
                        <button
                          onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]"
                        >−</button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]"
                        >+</button>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-bold text-[#1e2d3d]">
                          GHS {(item.unit_price * item.quantity).toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.cartKey)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clone card — shown when "+ Add Variant" is open */}
                {panel?.open && (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-[#F2AA25]/60 p-2.5 sm:p-3 flex gap-2.5 sm:gap-3 items-start">
                    <img
                      src={item.product_image_url}
                      alt={item.product_name}
                      className="w-14 h-[72px] sm:w-20 sm:h-24 object-cover rounded-xl flex-shrink-0 opacity-80"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-[#1e2d3d] truncate text-sm">{item.product_name}</h3>
                        <span className="text-[10px] font-semibold text-[#F2AA25] bg-[#F2AA25]/10 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                          New Variant
                        </span>
                      </div>

                      {item.sizes?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.sizes.map(s => {
                            const priceEntry = item.sizePricing?.find(sp => sp.size === s);
                            const sizeRegular = priceEntry ? (priceEntry.selling_price ?? priceEntry.price ?? 0) : 0;
                            const sizeHasDiscount = priceEntry && hasDiscount(priceEntry);
                            const sizeEffective = priceEntry ? getEffectivePrice(priceEntry) : 0;
                            return (
                              <button
                                key={s}
                                onClick={() => updatePanel(item.cartKey, { size: s })}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors leading-none ${
                                  panel.size === s
                                    ? "bg-[#1e2d3d] text-white"
                                    : "border border-gray-300 text-gray-500 hover:border-[#1e2d3d]"
                                }`}
                              >
                                <span className="block">{s}</span>
                                {priceEntry && (
                                  sizeHasDiscount ? (
                                    <>
                                      <span className="block text-[10px] font-semibold text-[#F2AA25]">GHS {sizeEffective.toLocaleString()}</span>
                                      <span className={`block text-[9px] font-normal line-through ${panel.size === s ? "text-white/50" : "text-gray-300"}`}>GHS {sizeRegular.toLocaleString()}</span>
                                    </>
                                  ) : (
                                    <span className={`block text-[10px] font-normal ${panel.size === s ? "text-white/70" : "text-gray-400"}`}>
                                      GHS {sizeRegular.toLocaleString()}
                                    </span>
                                  )
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {item.colours?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] text-gray-400 font-medium">Colour:</span>
                          {item.colours.map(c => (
                            <button
                              key={c}
                              onClick={() => updatePanel(item.cartKey, { colour: c })}
                              title={c}
                              className={`w-5 h-5 rounded-full transition-all flex-shrink-0 ${
                                panel.colour === c ? "ring-2 ring-offset-1 ring-[#1e2d3d] scale-110" : "hover:scale-105"
                              } ${c === "White" ? "border border-gray-200" : ""}`}
                              style={{ backgroundColor: colourMap[c] || "#ccc" }}
                            />
                          ))}
                          <span className="text-[11px] text-gray-500">{panel.colour}</span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                        <p className="text-[#F2AA25] font-bold">GHS {clonePrice.toLocaleString()}</p>
                        {cloneHasDiscount && (
                          <span className="text-gray-400 text-xs line-through">GHS {cloneRegularPrice.toLocaleString()}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2 py-1">
                          <button onClick={() => updatePanel(item.cartKey, { qty: Math.max(1, panel.qty - 1) })} className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]">−</button>
                          <span className="w-8 text-center text-sm font-semibold">{panel.qty}</span>
                          <button onClick={() => updatePanel(item.cartKey, { qty: panel.qty + 1 })} className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]">+</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1e2d3d]">
                            GHS {(clonePrice * panel.qty).toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleAddVariant(item)}
                            className="bg-[#F2AA25] text-white font-semibold text-xs px-3 py-1.5 rounded-xl hover:opacity-90 transition-opacity"
                          >
                            Add to Cart
                          </button>
                          <button
                            onClick={() => closePanel(item.cartKey)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            aria-label="Cancel"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
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
                <span className="text-[#F2AA25]">GHS {subtotal.toLocaleString()}</span>
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
