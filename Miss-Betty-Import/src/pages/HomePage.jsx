import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { colourMap } from "../data/mockData";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { supabase } from "../lib/supabase";
import MediaCarousel from "../components/MediaCarousel";
import ReviewsSection from "../components/ReviewsSection";
import AccountDropdown from "../components/AccountDropdown";
import { getEffectivePrice, hasDiscount } from "../lib/priceUtils";
import BottomNav from "../components/BottomNav";

const CATEGORY_ICONS = {
  'Mother care items':               '👶',
  'Beddings':                        '🛏️',
  'Furniture':                       '🪑',
  'Industrial Equipment/Heavy Duty': '🏗️',
  'Kitchenware':                     '🍳',
  'Home Appliances':                 '🏠',
  'Home Designs/Decor':              '🖼️',
  "Men's Fashion":                   '👔',
  'Ladies Fashion':                  '👜',
  'Sneakers':                        '👟',
  'Others':                          '📦',
};

function mapProduct(p) {
  const rawSizePricing = Array.isArray(p.size_pricing) && p.size_pricing.length > 0
    ? p.size_pricing : null;
  const sizePricing = rawSizePricing
    ? rawSizePricing.map(r => ({
        ...r,
        discount_price: r.discount_price != null ? Number(r.discount_price) : null,
      }))
    : null;
  const discountedSizes   = (sizePricing ?? []).filter(r => r.discount_price != null);
  const minDiscountPrice  = discountedSizes.length ? Math.min(...discountedSizes.map(r => r.discount_price)) : null;
  const productDiscountPrice = p.discount_price != null ? Number(p.discount_price) : null;
  const discount_price = sizePricing ? minDiscountPrice : productDiscountPrice;
  return {
    id: p.product_id,
    category: p.category?.category_name ?? 'Others',
    product_name: p.product_name,
    product_image_url:   p.product_image_url   ?? '',
    product_image_url_2: p.product_image_url_2 ?? '',
    product_video_url:   p.product_video_url   ?? '',
    unit_price: Number(p.unit_price),
    cost_price: Number(p.cost_price ?? 0),
    profit:     Number(p.profit ?? 0),
    discount_price,
    description: p.description ?? '',
    sizePricing,
    sizes: sizePricing
      ? sizePricing.map(sp => sp.size)
      : (p.size ? p.size.split(',').map(s => s.trim()).filter(Boolean) : []),
    colours: p.colour ? p.colour.split(',').map(c => c.trim()).filter(Boolean) : [],
    product_status: p.product_status?.status_name ?? 'Available',
    estimated_shipping_fee: p.estimated_shipping_fee ?? null,
  };
}

async function downloadImage(e, url, name) {
  e.stopPropagation();
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const tmp  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = tmp;
    a.download = name || 'product-image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(tmp);
  } catch {
    window.open(url, '_blank');
  }
}

function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={e => downloadImage(e, src, alt)}
        className="absolute top-4 left-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        title="Download image"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function ProductDetailModal({ product, onClose, buyNow = false }) {
  const { addToCart, addMultipleToCart } = useCart();
  const { session } = useAuth();
  const { ordersClosed } = useAppSettings();
  const navigate = useNavigate();
  const isPreorder = typeof product?.product_status === "string" && product.product_status.toLowerCase().includes("pre");
  const blockedByPreorder = ordersClosed && isPreorder;

  const hasVariants = product.sizes.length > 0 || product.colours.length > 0;

  const [curSize,         setCurSize]         = useState(product.sizes[0]   ?? null);
  const [curColour,       setCurColour]       = useState(product.colours[0] ?? null);
  const [curQty,          setCurQty]          = useState(1);
  const [pendingVariants, setPendingVariants] = useState([]);
  const [added,           setAdded]           = useState(false);

  const curEntry        = product?.sizePricing && curSize
    ? (product.sizePricing.find(sp => sp.size === curSize) ?? null)
    : null;
  const curRegularPrice  = curEntry?.selling_price ?? curEntry?.price ?? product?.unit_price ?? 0;
  const curDiscountPrice = curEntry?.discount_price ?? product?.discount_price ?? null;
  const curHasDiscount   = curDiscountPrice != null && curDiscountPrice > 0 && curDiscountPrice < curRegularPrice;
  const curPrice         = curHasDiscount ? curDiscountPrice : curRegularPrice;
  const curCostPrice     = curEntry?.cost_price ?? product?.cost_price ?? 0;
  const curProfit        = curEntry?.profit     ?? product?.profit    ?? 0;

  const totalQty  = pendingVariants.reduce((s, v) => s + v.qty, 0);
  const totalCost = pendingVariants.reduce((s, v) => s + v.price * v.qty, 0);

  const canAddVariant =
    (!product.sizes.length   || curSize) &&
    (!product.colours.length || curColour);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function addVariantToPending() {
    if (!canAddVariant) return;
    const vKey = `${curSize ?? 'none'}-${curColour ?? 'none'}`;
    setPendingVariants(prev => {
      const existing = prev.find(v => v.variantKey === vKey);
      if (existing) {
        return prev.map(v => v.variantKey === vKey ? { ...v, qty: v.qty + curQty } : v);
      }
      return [...prev, {
        variantKey: vKey, size: curSize, colour: curColour,
        qty: curQty, price: curPrice, costPrice: curCostPrice, profit: curProfit,
        originalPrice: curHasDiscount ? curRegularPrice : null,
      }];
    });
    setCurQty(1);
  }

  function commitToCart(andThen) {
    addMultipleToCart(
      pendingVariants.map(v => ({
        product, size: v.size, colour: v.colour,
        qty: v.qty, price: v.price, costPrice: v.costPrice, profit: v.profit,
        originalPrice: v.originalPrice ?? null,
      }))
    );
    andThen();
  }

  function handleAddAll() {
    if (pendingVariants.length === 0) return;
    commitToCart(() => { setAdded(true); setTimeout(() => { setAdded(false); onClose(); }, 1500); });
  }

  function handleCheckout() {
    if (!session) { navigate("/login"); return; }
    if (blockedByPreorder || pendingVariants.length === 0) return;
    commitToCart(() => navigate("/checkout"));
  }

  function handleSimpleAdd() {
    addToCart(product, curQty, null, null, curPrice, product.cost_price, product.profit,
      curHasDiscount ? curRegularPrice : null);
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 1500);
  }

  function handleSimpleBuyNow() {
    if (!session) { navigate("/login"); return; }
    if (blockedByPreorder) return;
    navigate("/checkout", {
      state: {
        buyNow: {
          product, quantity: curQty, size: null, colour: null,
          unitPrice: product.unit_price, costPrice: product.cost_price, sizeProfit: product.profit,
        },
      },
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            {product.category}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Media carousel */}
        <div className="relative">
          <MediaCarousel
            heightClass="h-48 sm:h-64"
            name={product.product_name}
            media={[
              { type: "image", url: product.product_image_url },
              { type: "image", url: product.product_image_url_2 },
              { type: "tiktok", url: product.product_video_url },
            ]}
          />
          <span
            className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full z-10 ${
              product.product_status === "Available"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {product.product_status}
          </span>
        </div>

        {/* Details */}
        <div className="px-4 py-3">
          <h2 className="font-bold text-[#1e2d3d] text-lg mb-1 leading-snug">
            {product.product_name}
          </h2>
          <div className="flex items-baseline gap-2 flex-wrap mb-2">
            <p className="text-[#F2AA25] font-bold text-xl">GHS {curPrice.toLocaleString()}</p>
            {curHasDiscount && (
              <>
                <span className="text-gray-400 text-sm line-through">GHS {curRegularPrice.toLocaleString()}</span>
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">SALE</span>
              </>
            )}
          </div>

          {product.description && (
            <p className="text-gray-500 text-sm leading-relaxed mb-3">
              {product.description}
            </p>
          )}

          {product.estimated_shipping_fee != null && product.estimated_shipping_fee > 0 && (
            <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
              <span>🚚</span>
              Est. shipping: <span className="font-semibold text-[#1e2d3d] ml-0.5">GHS {Number(product.estimated_shipping_fee).toLocaleString()}</span>
            </p>
          )}

          {hasVariants ? (
            <>
              {/* Size */}
              {product.sizes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(s => {
                      const priceEntry = product.sizePricing?.find(sp => sp.size === s);
                      return (
                        <button
                          key={s}
                          onClick={() => setCurSize(s)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            curSize === s
                              ? "bg-[#1e2d3d] text-white"
                              : "border border-gray-300 text-gray-600 hover:border-[#1e2d3d]"
                          }`}
                        >
                          <span className="block">{s}</span>
                          {priceEntry && (
                            <span className={`block text-[10px] font-normal ${curSize === s ? "text-white/70" : "text-gray-400"}`}>
                              GHS {(priceEntry.selling_price ?? priceEntry.price ?? 0).toLocaleString()}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colour */}
              {product.colours.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Colour: <span className="font-normal normal-case text-gray-500">{curColour}</span>
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {product.colours.map(c => (
                      <button
                        key={c}
                        onClick={() => setCurColour(c)}
                        title={c}
                        className={`w-7 h-7 rounded-full transition-all ${
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

              {/* Qty + Add Variant */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setCurQty(q => Math.max(1, q - 1))} className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none">−</button>
                  <span className="px-3 py-2 text-sm font-semibold text-[#1e2d3d] min-w-[2rem] text-center">{curQty}</span>
                  <button onClick={() => setCurQty(q => q + 1)} className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none">+</button>
                </div>
                <button
                  onClick={addVariantToPending}
                  disabled={!canAddVariant}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-[#1e2d3d] font-semibold text-xs py-2 rounded-xl transition-colors"
                >
                  + Add Variant
                </button>
              </div>

              {/* Pending variants list */}
              {pendingVariants.length > 0 && (
                <div className="mb-3 border border-gray-100 rounded-xl overflow-hidden">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    Selected Variants
                  </p>
                  {pendingVariants.map(v => (
                    <div key={v.variantKey} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {v.size && <span className="text-[10px] font-bold bg-[#1e2d3d] text-white px-1.5 py-0.5 rounded flex-shrink-0">{v.size}</span>}
                        {v.colour && (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: colourMap[v.colour] || "#ccc" }} />
                            <span className="text-xs text-gray-500 truncate">{v.colour}</span>
                          </>
                        )}
                        <span className="text-xs text-[#F2AA25] font-semibold ml-auto flex-shrink-0 pl-1">GHS {v.price.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        <button onClick={() => setPendingVariants(prev => prev.map(x => x.variantKey === v.variantKey ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="px-2 py-1 text-gray-500 hover:bg-gray-50 font-bold text-sm">−</button>
                        <span className="px-2 py-1 text-xs font-semibold text-[#1e2d3d] min-w-[1.5rem] text-center">{v.qty}</span>
                        <button onClick={() => setPendingVariants(prev => prev.map(x => x.variantKey === v.variantKey ? { ...x, qty: x.qty + 1 } : x))} className="px-2 py-1 text-gray-500 hover:bg-gray-50 font-bold text-sm">+</button>
                      </div>
                      <button onClick={() => setPendingVariants(prev => prev.filter(x => x.variantKey !== v.variantKey))} className="text-red-400 hover:text-red-600 ml-0.5 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-1.5 bg-gray-50 text-xs font-semibold text-[#1e2d3d]">
                    <span>{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
                    <span className="text-[#F2AA25]">Total: GHS {totalCost.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="pb-2">
                {buyNow ? (
                  <button
                    onClick={handleCheckout}
                    disabled={blockedByPreorder || pendingVariants.length === 0}
                    className={`w-full font-semibold py-2 rounded-xl text-sm transition-opacity ${
                      blockedByPreorder
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : pendingVariants.length === 0
                        ? "bg-[#F2AA25]/40 text-white cursor-not-allowed"
                        : "bg-[#F2AA25] text-white hover:opacity-90"
                    }`}
                  >
                    {blockedByPreorder ? "Pre-orders Closed" : "Proceed to Checkout"}
                  </button>
                ) : (
                  <button
                    onClick={handleAddAll}
                    disabled={pendingVariants.length === 0}
                    className={`w-full font-semibold py-2 rounded-xl text-sm transition-colors ${
                      added
                        ? "bg-green-500 text-white"
                        : pendingVariants.length === 0
                        ? "bg-[#F2AA25]/40 text-white cursor-not-allowed"
                        : "bg-[#F2AA25] text-white hover:opacity-90"
                    }`}
                  >
                    {added
                      ? "✓ Added to cart!"
                      : totalQty > 0
                      ? `Add ${totalQty} item${totalQty !== 1 ? "s" : ""} to Cart`
                      : "Add to Cart"}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Simple mode — no sizes or colours */
            <div className="flex items-center gap-3 pb-2">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setCurQty(q => Math.max(1, q - 1))} className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none">−</button>
                <span className="px-3 py-2 text-sm font-semibold text-[#1e2d3d] min-w-[2rem] text-center">{curQty}</span>
                <button onClick={() => setCurQty(q => q + 1)} className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none">+</button>
              </div>
              {buyNow ? (
                <button onClick={handleSimpleBuyNow} disabled={blockedByPreorder} className={`flex-1 font-semibold py-2 rounded-xl text-sm transition-opacity ${blockedByPreorder ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-[#F2AA25] text-white hover:opacity-90"}`}>
                  {blockedByPreorder ? "Pre-orders Closed" : "Proceed to Checkout"}
                </button>
              ) : (
                <button onClick={handleSimpleAdd} className={`flex-1 font-semibold py-2 rounded-xl text-sm transition-colors ${added ? "bg-green-500 text-white" : "bg-[#F2AA25] text-white hover:opacity-90"}`}>
                  {added ? "✓ Added to cart!" : "Add to Cart"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="px-4 pb-4">
          <ReviewsSection productId={product.id} />
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, onSelect, onViewImage, onBuyNow, ordersClosed }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const isPreorder = typeof product?.product_status === "string" && product.product_status.toLowerCase().includes("pre");
  const blockedByOrders = ordersClosed && isPreorder;

  function handleAdd(e) {
    e.stopPropagation();
    const firstSize = product.sizes[0] ?? null;
    const sizeEntry = product.sizePricing?.find(sp => sp.size === firstSize) ?? null;
    const price     = sizeEntry ? getEffectivePrice(sizeEntry) : getEffectivePrice(product);
    const costP     = sizeEntry?.cost_price ?? product.cost_price ?? 0;
    const prof      = sizeEntry?.profit     ?? product.profit     ?? 0;
    const origPrice = sizeEntry
      ? (hasDiscount(sizeEntry) ? (sizeEntry.selling_price ?? product.unit_price) : null)
      : (hasDiscount(product)   ? product.unit_price : null);
    addToCart(product, 1, firstSize, product.colours[0] ?? null, price, costP, prof, origPrice);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow(e) {
    e.stopPropagation();
    if (blockedByOrders) return;
    onBuyNow(product);
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col cursor-pointer"
      onClick={() => onSelect(product)}
    >
      <div className="relative overflow-hidden">
        {product.product_image_url ? (
          <img
            src={product.product_image_url}
            alt={product.product_name}
            className="w-full h-28 sm:h-40 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-28 sm:h-40 bg-gray-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
            product.product_status === "Available"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {product.product_status}
        </span>
        {product.product_image_url && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onViewImage(product.product_image_url, product.product_name); }}
              className="absolute bottom-2 left-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 transition-colors"
              title="View full image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            <button
              onClick={e => downloadImage(e, product.product_image_url, product.product_name)}
              className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 transition-colors"
              title="Download image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </>
        )}
      </div>
      <div className="p-2 sm:p-3 flex flex-col flex-1">
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full w-fit mb-1 truncate max-w-full">
          {product.category}
        </span>
        <h3 className="font-semibold text-[#1e2d3d] text-xs sm:text-sm mb-0.5 line-clamp-2 flex-1">
          {product.product_name}
        </h3>
        <div className="mb-2 flex items-baseline gap-1.5 flex-wrap">
          {hasDiscount(product) ? (
            <>
              <span className="text-[#F2AA25] font-bold text-sm sm:text-base">
                {product.sizePricing ? "From " : ""}GHS {getEffectivePrice(product).toLocaleString()}
              </span>
              <span className="text-gray-400 text-xs line-through">GHS {product.unit_price.toLocaleString()}</span>
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">SALE</span>
            </>
          ) : (
            <span className="text-[#F2AA25] font-bold text-sm sm:text-base">
              {product.sizePricing ? "From " : ""}GHS {product.unit_price.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleAdd}
            className={`flex-1 font-medium py-1 rounded-xl text-[11px] transition-colors ${
              added ? "bg-green-500 text-white" : "bg-[#F2AA25] text-white hover:opacity-90"
            }`}
          >
            {added ? "✓ Added!" : "Add to Cart"}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={blockedByOrders}
            className={`flex-1 font-medium py-1 rounded-xl text-[11px] border-2 transition-colors ${
              blockedByOrders
                ? "border-gray-200 text-gray-400 cursor-not-allowed"
                : "border-[#1e2d3d] text-[#1e2d3d] hover:bg-[#1e2d3d] hover:text-white"
            }`}
          >
            {blockedByOrders ? "Pre-orders Closed" : "Buy Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { totalItems } = useCart();
  const { session } = useAuth();
  const { ordersClosed, announcementMessage, promoActive, promoMessage } = useAppSettings();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryRef = useRef(null);
  const filterBarRef = useRef(null);
  const [filterBarHeight, setFilterBarHeight] = useState(0);

  useLayoutEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    setFilterBarHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setFilterBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setCategoryMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadData() {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('products')
          .select('*, category(category_name), product_status(status_name)')
          .order('product_id', { ascending: false }),
        supabase.from('category').select('*').order('category_name'),
      ]);
      setProducts((prods ?? []).map(mapProduct));
      setDbCategories(cats ?? []);
      setLoadingProducts(false);
    }
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.product_name.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchStatus = statusFilter === "All" || p.product_status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [products, search, activeCategory, statusFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .spin-vertical {
          animation: spinY 5s linear infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
        @keyframes spinY {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 22s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes promoSlide {
          0%    { transform: translateX(60px);  opacity: 0; }
          12%   { transform: translateX(0);     opacity: 1; }
          72%   { transform: translateX(0);     opacity: 1; }
          84%   { transform: translateX(-60px); opacity: 0; }
          100%  { transform: translateX(-60px); opacity: 0; }
        }
        .promo-slide {
          animation: promoSlide 3.5s ease-in-out infinite;
          will-change: transform, opacity;
        }
      `}</style>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/" className="flex-shrink-0">
              <img src={logo} alt="Miss Betty Import" className="h-12 sm:h-14 w-auto spin-vertical" />
            </Link>

            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors"
              />
            </div>

            <Link to="/cart" className="relative flex-shrink-0 p-1.5 text-[#1e2d3d] hover:text-[#F2AA25] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#F2AA25] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>

            {session ? (
              <AccountDropdown />
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-[#1e2d3d] border border-gray-300 px-3 py-2 rounded-xl hover:border-[#F2AA25] hover:text-[#F2AA25] transition-colors hidden xs:block sm:block"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-bold text-white px-3 py-2 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
                  style={{ backgroundColor: "#F2AA25" }}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Fixed sub-header: announcement banner + filters */}
      <div ref={filterBarRef} className="fixed top-16 sm:top-[72px] left-0 right-0 z-30">
        {/* Promo alert banner */}
        {promoActive && promoMessage && (
          <div className="flex justify-center items-center py-2.5 bg-[#1e2d3d] overflow-hidden">
            <p
              className="promo-slide text-xl font-extrabold tracking-wide text-center whitespace-nowrap select-none"
              style={{ color: "#F2AA25", textShadow: "0 0 14px rgba(242,170,37,0.55), 0 1px 3px rgba(0,0,0,0.35)" }}
            >
              {promoMessage}
            </p>
          </div>
        )}

        {/* Announcement banner */}
        <div className="bg-[#F2AA25] py-1.5 overflow-hidden">
          <div className="marquee-track">
            {[1, 2].map(i => (
              <span key={i} className="text-white font-semibold text-sm whitespace-nowrap px-8">
                {announcementMessage || "Browse our latest imported products — quality items delivered to your door"}
                &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;
                {announcementMessage || "Browse our latest imported products — quality items delivered to your door"}
                &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;
              </span>
            ))}
          </div>
        </div>

        {/* Filter row */}
        <div className="bg-gray-50 border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">

              {/* Categories dropdown */}
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => setCategoryMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1e2d3d] text-white hover:bg-[#2a3f54] transition-colors"
                >
                  <span>
                    {activeCategory === "All"
                      ? "🏷️ Categories"
                      : `${CATEGORY_ICONS[activeCategory] ?? '🏷️'} ${activeCategory}`}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${categoryMenuOpen ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                <div className={`absolute left-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 z-50 w-56 overflow-y-auto max-h-80 transition-all duration-200 origin-top ${
                  categoryMenuOpen
                    ? 'opacity-100 scale-100 pointer-events-auto'
                    : 'opacity-0 scale-95 pointer-events-none'
                }`}>
                  <button
                    onClick={() => { setActiveCategory("All"); setCategoryMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50 ${
                      activeCategory === "All" ? "font-semibold text-[#F2AA25]" : "text-gray-700"
                    }`}
                  >
                    <span>🏷️</span> All Categories
                  </button>
                  <div className="border-t border-gray-100" />
                  {dbCategories.map(cat => (
                    <button
                      key={cat.category_id}
                      onClick={() => { setActiveCategory(cat.category_name); setCategoryMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50 ${
                        activeCategory === cat.category_name
                          ? "font-semibold text-[#F2AA25]"
                          : "text-gray-700"
                      }`}
                    >
                      <span>{CATEGORY_ICONS[cat.category_name] ?? '🏷️'}</span>
                      <span>{cat.category_name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-gray-400 text-sm">
                {loadingProducts ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? "product" : "products"} found`}
              </p>
            </div>

            <div className="flex gap-2">
              {["All", "Available", "Pre-order"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? "bg-[#F2AA25] text-white"
                      : "border border-gray-300 text-gray-600 hover:border-[#F2AA25]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products section */}
      <main style={{ paddingTop: filterBarHeight }} className="max-w-7xl mx-auto px-3 sm:px-6 pb-20">

        {loadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
                <div className="w-full h-28 sm:h-40 bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                  <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                  <div className="h-4 bg-gray-100 rounded-full w-1/3" />
                  <div className="h-8 bg-gray-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onSelect={setSelectedProduct}
                onViewImage={(src, alt) => setLightboxImage({ src, alt })}
                onBuyNow={setBuyNowProduct}
                ordersClosed={ordersClosed}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-semibold text-[#1e2d3d] text-lg">No products found</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search term or filter.</p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("All"); setStatusFilter("All"); }}
              className="mt-4 text-[#F2AA25] font-semibold hover:underline text-sm"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
      {buyNowProduct && (
        <ProductDetailModal product={buyNowProduct} onClose={() => setBuyNowProduct(null)} buyNow />
      )}

      {lightboxImage && (
        <ImageLightbox src={lightboxImage.src} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />
      )}

      <BottomNav />

      {/* Footer */}
      <footer className="bg-[#1e2d3d] text-white px-4 py-7">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Miss Betty Import is a duly registered business with the Office of the
            Registrar of Companies, Republic of Ghana, under the Registration of
            Business Names Act, 1962 (Act 151).
          </p>
          <div className="flex justify-center items-center gap-4 sm:gap-8 flex-wrap mb-4 text-sm">
            <a
              href="https://wa.me/233202697541"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#F2AA25] font-semibold hover:underline"
            >
              <span>💬</span> Chat with us
            </a>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <a href="/terms" className="text-gray-300 hover:text-[#F2AA25] transition-colors">
              Terms and conditions
            </a>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <a href="/privacy-policy" className="text-gray-300 hover:text-[#F2AA25] transition-colors">
              Privacy Policy
            </a>
          </div>
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} Miss Betty Import. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
