import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { colourMap } from "../data/mockData";
import { useCart } from "../context/CartContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { supabase } from "../lib/supabase";
import { getEffectivePrice, hasDiscount } from "../lib/priceUtils";
import MediaCarousel from "../components/MediaCarousel";
import ReviewsSection from "../components/ReviewsSection";

function mapProduct(p) {
  const rawSizePricing = Array.isArray(p.size_pricing) && p.size_pricing.length > 0
    ? p.size_pricing : null;
  const sizePricing = rawSizePricing
    ? rawSizePricing.map(r => ({
        ...r,
        discount_price: r.discount_price != null ? Number(r.discount_price) : null,
      }))
    : null;
  const discountedSizes = (sizePricing ?? []).filter(r => r.discount_price != null);
  const minDiscountPrice = discountedSizes.length
    ? Math.min(...discountedSizes.map(r => r.discount_price))
    : null;
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

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, addMultipleToCart } = useCart();
  const { ordersClosed } = useAppSettings();

  const [product, setProduct] = useState(null);
  const isPreorder = product ? product.product_status.toLowerCase().includes("pre") : false;
  const [loading, setLoading] = useState(true);
  const [curSize,         setCurSize]         = useState(null);
  const [curColour,       setCurColour]       = useState(null);
  const [curQty,          setCurQty]          = useState(1);
  const [pendingVariants, setPendingVariants] = useState([]);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*, category(category_name), product_status(status_name)')
        .eq('product_id', Number(id))
        .single();
      if (data) {
        const mapped = mapProduct(data);
        setProduct(mapped);
        setCurSize(mapped.sizes[0] ?? null);
        setCurColour(mapped.colours[0] ?? null);
      }
      setLoading(false);
    }
    loadProduct();
  }, [id]);

  const hasVariants = (product?.sizes?.length ?? 0) > 0 || (product?.colours?.length ?? 0) > 0;

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

  const canAddVariant = product
    ? ((!product.sizes.length   || curSize) &&
       (!product.colours.length || curColour))
    : false;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-gray-500 text-lg font-medium">Product not found</p>
        <Link to="/shop" className="mt-4 inline-block text-[#F2AA25] font-semibold hover:underline">← Back to Shop</Link>
      </div>
    );
  }

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
    setError("");
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

  function handleAddToCart() {
    if (pendingVariants.length === 0) return setError("Please add at least one variant.");
    setError("");
    commitToCart(() => {
      setPendingVariants([]);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    });
  }

  function handleBuyNow() {
    if (ordersClosed && isPreorder) return;
    if (pendingVariants.length === 0) return setError("Please add at least one variant.");
    setError("");
    commitToCart(() => navigate("/checkout"));
  }

  function handleSimpleAdd() {
    const simpleOriginal = curHasDiscount ? curRegularPrice : null;
    addToCart(product, curQty, null, null, curPrice, product.cost_price, product.profit, simpleOriginal);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleSimpleBuyNow() {
    if (ordersClosed && isPreorder) return;
    navigate("/checkout", {
      state: {
        buyNow: {
          product, quantity: curQty, size: null, colour: null,
          unitPrice: curPrice, costPrice: product.cost_price, sizeProfit: product.profit,
          originalPrice: curHasDiscount ? curRegularPrice : null,
        },
      },
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-3 sm:mb-5">
        <Link to="/home" className="hover:text-[#F2AA25]">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-[#F2AA25]">Shop</Link>
        <span>/</span>
        <span className="text-[#1e2d3d] font-medium">{product.product_name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        {/* Media carousel */}
        <div className="rounded-2xl overflow-hidden shadow-sm">
          <MediaCarousel
            heightClass="h-48 sm:h-72"
            name={product.product_name}
            media={[
              { type: "image", url: product.product_image_url },
              { type: "image", url: product.product_image_url_2 },
              { type: "tiktok", url: product.product_video_url },
            ]}
          />
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <span className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-1">{product.category}</span>
          <h1 className="text-lg sm:text-2xl font-bold text-[#1e2d3d] mb-1.5">{product.product_name}</h1>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="text-[#DC2626] font-bold text-2xl">GHS {curPrice.toLocaleString()}</span>
            {curHasDiscount && (
              <>
                <span className="text-gray-400 text-base line-through">GHS {curRegularPrice.toLocaleString()}</span>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>
              </>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              product.product_status === "Available"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {product.product_status}
            </span>
          </div>

          {product.description && (
            <p className="text-gray-500 text-sm leading-relaxed mb-3">{product.description}</p>
          )}

          {product.estimated_shipping_fee != null && product.estimated_shipping_fee > 0 && (
            <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
              <span>🚚</span>
              Est. shipping: <span className="font-semibold text-[#1e2d3d] ml-0.5">GHS {Number(product.estimated_shipping_fee).toLocaleString()}</span>
            </p>
          )}

          {hasVariants ? (
            <>
              {/* Size selector */}
              {product.sizes.length > 0 && (
                <div className="mb-4">
                  <p className="font-semibold text-[#1e2d3d] mb-2 text-sm">
                    Size <span className="text-gray-400 font-normal ml-1">{curSize && `— ${curSize}`}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(size => {
                      const priceEntry = product.sizePricing?.find(sp => sp.size === size);
                      const sizeRegular = priceEntry ? (priceEntry.selling_price ?? priceEntry.price ?? 0) : 0;
                      const sizeHasDiscount = priceEntry && hasDiscount(priceEntry);
                      const sizeEffective = priceEntry ? getEffectivePrice(priceEntry) : 0;
                      return (
                        <button
                          key={size}
                          onClick={() => setCurSize(size)}
                          className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                            curSize === size
                              ? "border-[#F2AA25] bg-[#F2AA25] text-white"
                              : "border-gray-200 text-[#1e2d3d] hover:border-[#F2AA25]"
                          }`}
                        >
                          <span className="block">{size}</span>
                          {priceEntry && (
                            sizeHasDiscount ? (
                              <>
                                <span className="block text-xs font-semibold">GHS {sizeEffective.toLocaleString()}</span>
                                <span className={`block text-[10px] font-normal line-through ${curSize === size ? "text-white/60" : "text-gray-300"}`}>GHS {sizeRegular.toLocaleString()}</span>
                              </>
                            ) : (
                              <span className={`block text-xs font-normal ${curSize === size ? "text-white/80" : "text-gray-400"}`}>
                                GHS {sizeRegular.toLocaleString()}
                              </span>
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colour selector */}
              {product.colours.length > 0 && (
                <div className="mb-4">
                  <p className="font-semibold text-[#1e2d3d] mb-2 text-sm">
                    Colour <span className="text-gray-400 font-normal ml-1">{curColour && `— ${curColour}`}</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {product.colours.map(colour => (
                      <button
                        key={colour}
                        onClick={() => setCurColour(colour)}
                        title={colour}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-all ${
                          curColour === colour ? "border-[#F2AA25] scale-110" : "border-gray-200 hover:border-gray-400"
                        }`}
                        style={{ background: colourMap[colour] || "#ccc" }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Qty + Add Variant */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-[#1e2d3d] hover:border-[#F2AA25] transition-colors">−</button>
                  <span className="w-10 text-center font-semibold text-[#1e2d3d]">{curQty}</span>
                  <button onClick={() => setCurQty(q => q + 1)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-[#1e2d3d] hover:border-[#F2AA25] transition-colors">+</button>
                </div>
                <button
                  onClick={addVariantToPending}
                  disabled={!canAddVariant}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-[#1e2d3d] font-semibold text-sm py-2 rounded-xl transition-colors"
                >
                  + Add Variant
                </button>
              </div>

              {/* Pending variants list */}
              {pendingVariants.length > 0 && (
                <div className="mb-4 border border-gray-100 rounded-xl overflow-hidden">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 bg-gray-50 border-b border-gray-100">
                    Selected Variants
                  </p>
                  {pendingVariants.map(v => (
                    <div key={v.variantKey} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {v.size && <span className="text-xs font-bold bg-[#1e2d3d] text-white px-2 py-0.5 rounded-lg flex-shrink-0">{v.size}</span>}
                        {v.colour && (
                          <>
                            <span className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: colourMap[v.colour] || "#ccc" }} />
                            <span className="text-sm text-gray-500 truncate">{v.colour}</span>
                          </>
                        )}
                        <span className="text-sm text-[#DC2626] font-semibold ml-auto flex-shrink-0 pl-2">GHS {v.price.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                        <button onClick={() => setPendingVariants(prev => prev.map(x => x.variantKey === v.variantKey ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 font-bold">−</button>
                        <span className="px-2.5 py-1.5 text-sm font-semibold text-[#1e2d3d] min-w-[2rem] text-center">{v.qty}</span>
                        <button onClick={() => setPendingVariants(prev => prev.map(x => x.variantKey === v.variantKey ? { ...x, qty: x.qty + 1 } : x))} className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 font-bold">+</button>
                      </div>
                      <button onClick={() => setPendingVariants(prev => prev.filter(x => x.variantKey !== v.variantKey))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2 bg-gray-50 font-semibold text-sm text-[#1e2d3d]">
                    <span>{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
                    <span className="text-[#DC2626]">Total: GHS {totalCost.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={pendingVariants.length === 0}
                  className={`flex-1 font-semibold py-2 sm:py-2.5 text-sm rounded-2xl text-white transition-all ${
                    added
                      ? "bg-green-500"
                      : pendingVariants.length === 0
                      ? "bg-[#F2AA25]/40 cursor-not-allowed"
                      : "bg-[#F2AA25] hover:opacity-90"
                  }`}
                >
                  {added
                    ? "✓ Added to Cart!"
                    : totalQty > 0
                    ? `Add ${totalQty} item${totalQty !== 1 ? "s" : ""} to Cart`
                    : "Add to Cart"}
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={(ordersClosed && isPreorder) || pendingVariants.length === 0}
                  className={`flex-1 font-semibold py-2 sm:py-2.5 text-sm rounded-2xl border-2 transition-colors ${
                    (ordersClosed && isPreorder) || pendingVariants.length === 0
                      ? "border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border-[#1e2d3d] text-[#1e2d3d] hover:bg-[#1e2d3d] hover:text-white"
                  }`}
                >
                  {ordersClosed && isPreorder ? "Pre-orders Closed" : "Proceed to Checkout"}
                </button>
              </div>
            </>
          ) : (
            /* Simple mode — no sizes or colours */
            <>
              <div className="mb-4">
                <p className="font-semibold text-[#1e2d3d] mb-2 text-sm">Quantity</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCurQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-[#1e2d3d] hover:border-[#F2AA25] transition-colors">−</button>
                  <span className="w-10 text-center font-semibold text-[#1e2d3d]">{curQty}</span>
                  <button onClick={() => setCurQty(q => q + 1)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-[#1e2d3d] hover:border-[#F2AA25] transition-colors">+</button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSimpleAdd}
                  className={`flex-1 font-semibold py-2 sm:py-2.5 text-sm rounded-2xl text-white transition-all ${added ? "bg-green-500" : "bg-[#F2AA25] hover:opacity-90"}`}
                >
                  {added ? "✓ Added to Cart!" : "Add to Cart"}
                </button>
                <button
                  onClick={handleSimpleBuyNow}
                  disabled={ordersClosed && isPreorder}
                  className={`flex-1 font-semibold py-2 sm:py-2.5 text-sm rounded-2xl border-2 transition-colors ${
                    ordersClosed && isPreorder
                      ? "border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border-[#1e2d3d] text-[#1e2d3d] hover:bg-[#1e2d3d] hover:text-white"
                  }`}
                >
                  {ordersClosed && isPreorder ? "Pre-orders Closed" : "Buy Now"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection productId={Number(id)} />
    </div>
  );
}
