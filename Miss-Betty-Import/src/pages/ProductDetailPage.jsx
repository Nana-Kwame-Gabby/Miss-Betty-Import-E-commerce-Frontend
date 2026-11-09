import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { supabase } from "../lib/supabase";
import MediaCarousel from "../components/MediaCarousel";
import { getVariantImage } from "../lib/variantImage";
import ReviewsSection from "../components/ReviewsSection";
import usePersistedState from "../hooks/usePersistedState";
import useScrollRestoration from "../hooks/useScrollRestoration";
import useSeo from "../hooks/useSeo";
import { useAuth } from "../context/AuthContext";
import { setPostAuthRedirect } from "../utils/postAuthRedirect";
import { metaDescription, productPath } from "../lib/seo";
import {
  AddVariantRow, AddedLabel, ColourSwatches, PriceLine, QtyStepper, SelectionList, ShippingEstimate,
  SizeChips, StatusTag,
} from "../components/shop/BuyBox";
import { primaryButtonClass, secondaryButtonClass } from "../lib/buyBoxStyles";

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
    extra_image_urls: Array.isArray(p.extra_image_urls) ? p.extra_image_urls.filter(Boolean) : [],
    videos: Array.isArray(p.product_videos) ? p.product_videos.filter(v => v?.url) : [],
    unit_price: Number(p.unit_price),
    cost_price: Number(p.cost_price ?? 0),
    profit:     Number(p.profit ?? 0),
    rmb_price:  Number(p.rmb_price ?? 0), // admin-only procurement cost; never rendered on this customer-facing page
    misc_amount: Number(p.misc_amount ?? 0), // admin-only; never rendered on this customer-facing page
    discount_price,
    description: p.description ?? '',
    sizePricing,
    sizes: sizePricing
      ? sizePricing.map(sp => sp.size)
      : (p.size ? p.size.split(',').map(s => s.trim()).filter(Boolean) : []),
    colours: p.colour ? p.colour.split(',').map(c => c.trim()).filter(Boolean) : [],
    product_status: p.product_status?.status_name ?? 'Available',
    estimated_shipping_fee_min: p.estimated_shipping_fee_min ?? null,
    estimated_shipping_fee_max: p.estimated_shipping_fee_max ?? null,
    variantStock: p.product_variant_stock ?? [],
    variant_images: p.variant_images ?? null,
  };
}

export default function ProductDetailPage() {
  const { id: idParam } = useParams();
  const id = String(parseInt(idParam, 10));
  const navigate = useNavigate();
  const { addToCart, addMultipleToCart } = useCart();
  const { ordersClosed } = useAppSettings();
  const { session } = useAuth();

  const [product, setProduct] = useState(null);
  const isPreorder = product ? product.product_status.toLowerCase().includes("pre") : false;
  const [loading, setLoading] = useState(true);
  // Selection state persists per product id, so navigating away and back restores it,
  // and switching to a different product starts fresh instead of leaking state across products.
  const [curSize,         setCurSize]         = usePersistedState(`mbimport_state_product_detail_${id}_size`, null);
  const [curColour,       setCurColour]       = usePersistedState(`mbimport_state_product_detail_${id}_colour`, null);
  const [curQty,          setCurQty]          = usePersistedState(`mbimport_state_product_detail_${id}_qty`, 1);
  const [pendingVariants, setPendingVariants] = usePersistedState(`mbimport_state_product_detail_${id}_pending`, []);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useScrollRestoration(`mbimport_scroll_product_${id}`, !loading);

  // This page pins its actions to the bottom on phones; lift the chat launcher above them.
  useEffect(() => {
    document.documentElement.dataset.actionBar = "on";
    return () => { delete document.documentElement.dataset.actionBar; };
  }, []);
  useSeo(product
    ? {
        title: product.product_name,
        description: metaDescription(product.description, `Buy ${product.product_name} from Miss Betty Import${product.category ? ` (${product.category})` : ""}. ${product.product_status === "Available" ? "In stock in Ghana" : "Pre-order from China"}, with delivery across Ghana.`),
        path: productPath(product),
        image: product.product_image_url || null,
      }
    : { title: "Product", path: `/shop/${id}` });

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*, category(category_name), product_status(status_name), product_variant_stock(*)')
        .eq('product_id', Number(id))
        .is('archived_at', null)
        .maybeSingle();
      if (data) {
        const mapped = mapProduct(data);
        setProduct(mapped);
        // Keep a restored selection if it's still valid for this product; otherwise
        // leave unselected — never auto-pick a variant on the customer's behalf.
        setCurSize(prev => (prev && mapped.sizes.includes(prev)) ? prev : null);
        setCurColour(prev => (prev && mapped.colours.includes(prev)) ? prev : null);
      }
      setLoading(false);
    }
    loadProduct();
  }, [id]);

  // Live stock updates: a purchase decrements product_variant_stock server-side via a
  // Postgres trigger (a plain UPDATE), so subscribing here keeps the displayed count
  // current for every customer viewing this product, without a page refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`product_variant_stock_detail_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'product_variant_stock', filter: `product_id=eq.${id}` },
        (payload) => {
          setProduct(prev => prev ? {
            ...prev,
            variantStock: prev.variantStock.map(r => r.id === payload.new.id ? payload.new : r),
          } : prev);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id]);

  const hasVariants = (product?.sizes?.length ?? 0) > 0 || (product?.colours?.length ?? 0) > 0;

  const curEntry        = product?.sizePricing && curSize
    ? (product.sizePricing.find(sp => sp.size === curSize) ?? null)
    : null;
  const curRegularPrice  = curEntry?.selling_price ?? curEntry?.price ?? product?.unit_price ?? 0;
  // A chosen size uses only its own discount; the product-level discount_price is the
  // lowest discount across sizes (for the "from" price) and must not leak into other sizes.
  const curDiscountPrice = curEntry ? (curEntry.discount_price ?? null) : (product?.discount_price ?? null);
  const curHasDiscount   = curDiscountPrice != null && curDiscountPrice > 0 && curDiscountPrice < curRegularPrice;
  const curPrice         = curHasDiscount ? curDiscountPrice : curRegularPrice;
  const curCostPrice     = curEntry?.cost_price ?? product?.cost_price ?? 0;
  const curProfit        = curEntry?.profit     ?? product?.profit    ?? 0;
  const curRmbPrice      = curEntry?.rmb_price  ?? product?.rmb_price ?? 0;
  const curMiscAmount    = curEntry?.misc_amount ?? product?.misc_amount ?? 0;
  // Photo for the current selection (exact size+colour → colour → size); null = main images only.
  const variantImg      = getVariantImage(product?.variant_images, curSize, curColour);

  const totalQty  = pendingVariants.reduce((s, v) => s + v.qty, 0);

  const canAddVariant = product
    ? ((!product.sizes.length   || curSize) &&
       (!product.colours.length || curColour))
    : false;

  // Stock is per (size, colour) combination and only tracked/gated for "Available" status
  // products with at least one product_variant_stock row (opt-in — untracked = unlimited,
  // matching every product's behavior before this feature existed).
  const isTracked = (product?.variantStock?.length ?? 0) > 0;
  const curStockRow = isTracked
    ? product.variantStock.find(r => r.size === (curSize ?? "") && r.colour === (curColour ?? ""))
    : null;
  const curStock = curStockRow ? curStockRow.stock_quantity : null;
  const curOutOfStock = product?.product_status === "Available" && isTracked && curStock != null && curStock <= 0;
  const productOutOfStock = product?.product_status === "Available" && isTracked
    && product.variantStock.every(r => r.stock_quantity <= 0);

  if (loading) {
    // Same footprint as the loaded page so nothing jumps when it arrives.
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-h-[85vh]" aria-busy="true" aria-label="Loading product">
        <div className="h-4 w-48 rounded-full bg-mbi-surface-soft" />
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
          <div className="aspect-square rounded-mbi-card bg-mbi-surface-soft animate-pulse" />
          <div className="space-y-3">
            <div className="h-6 w-24 rounded-full bg-mbi-surface-soft" />
            <div className="h-7 w-4/5 rounded-full bg-mbi-surface-soft" />
            <div className="h-8 w-1/3 rounded-full bg-mbi-surface-soft" />
            <div className="h-24 rounded-mbi-card bg-mbi-surface-soft" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center text-center">
        <div className="grid size-14 place-items-center rounded-full bg-mbi-surface-soft text-mbi-slate">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </div>
        <p className="mt-4 text-xl font-bold text-mbi-navy">This product is no longer available</p>
        <p className="mt-1 text-base text-mbi-slate">It may have sold out or been removed from the shop.</p>
        <Link to="/shop" className={`${primaryButtonClass()} mt-6 !w-auto`}>Browse the shop</Link>
      </div>
    );
  }

  function addVariantToPending() {
    if (!canAddVariant || curOutOfStock) return;
    const vKey = `${curSize ?? 'none'}-${curColour ?? 'none'}`;
    setPendingVariants(prev => {
      const existing = prev.find(v => v.variantKey === vKey);
      if (existing) {
        return prev.map(v => v.variantKey === vKey ? { ...v, qty: v.qty + curQty } : v);
      }
      return [...prev, {
        variantKey: vKey, size: curSize, colour: curColour,
        qty: curQty, price: curPrice, costPrice: curCostPrice, profit: curProfit,
        rmbPrice: curRmbPrice, miscAmount: curMiscAmount,
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
        rmbPrice: v.rmbPrice, miscAmount: v.miscAmount,
        originalPrice: v.originalPrice ?? null,
      }))
    );
    andThen();
  }

  function handleAddToCart() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if (pendingVariants.length === 0) return setError("Please add at least one variant.");
    setError("");
    commitToCart(() => {
      setPendingVariants([]);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    });
  }

  function handleBuyNow() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if (ordersClosed && isPreorder) return;
    if (pendingVariants.length === 0) return setError("Please add at least one variant.");
    setError("");
    commitToCart(() => navigate("/checkout"));
  }

  function handleSimpleAdd() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if (curOutOfStock) return;
    const simpleOriginal = curHasDiscount ? curRegularPrice : null;
    addToCart(product, curQty, null, null, curPrice, product.cost_price, product.profit, simpleOriginal, product.rmb_price, product.misc_amount);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleSimpleBuyNow() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if ((ordersClosed && isPreorder) || curOutOfStock) return;
    navigate("/checkout", {
      state: {
        buyNow: {
          product, quantity: curQty, size: null, colour: null,
          unitPrice: curPrice, costPrice: product.cost_price, sizeProfit: product.profit,
          rmbPrice: product.rmb_price, miscAmount: product.misc_amount,
          originalPrice: curHasDiscount ? curRegularPrice : null,
        },
      },
    });
  }

  const closedForPreorder = ordersClosed && isPreorder;
  const removeVariant = key => setPendingVariants(prev => prev.filter(x => x.variantKey !== key));
  const setVariantQty = (key, q) => setPendingVariants(prev => prev.map(x => x.variantKey === key ? { ...x, qty: q } : x));
  const stockNote = product.product_status === "Available" && isTracked && curStock != null
    ? (curStock > 0 ? `${curStock} item${curStock !== 1 ? "s" : ""} left in stock` : "Out of stock for this selection")
    : null;

  // The two actions; rendered in the buy box (desktop) and, with short labels, in the sticky
  // bottom bar (phones), where two buttons share the width.
  const renderActions = (short = false) => hasVariants ? (
    <>
      <button type="button" onClick={handleAddToCart} disabled={pendingVariants.length === 0 && !added} className={primaryButtonClass({ added, disabled: pendingVariants.length === 0 })}>
        {added ? <AddedLabel>{short ? "Added" : "Added to cart"}</AddedLabel>
          : totalQty > 0 ? (short ? `Add ${totalQty} to cart` : `Add ${totalQty} item${totalQty !== 1 ? "s" : ""} to cart`)
          : "Add to cart"}
      </button>
      <button type="button" onClick={handleBuyNow} disabled={closedForPreorder || pendingVariants.length === 0} className={secondaryButtonClass({ disabled: closedForPreorder || pendingVariants.length === 0 })}>
        {closedForPreorder ? (short ? "Orders closed" : "Pre-orders are closed") : (short ? "Checkout" : "Proceed to checkout")}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={handleSimpleAdd} disabled={curOutOfStock} className={curOutOfStock ? secondaryButtonClass({ disabled: true }) : primaryButtonClass({ added })}>
        {curOutOfStock ? "Out of stock" : added ? <AddedLabel>{short ? "Added" : "Added to cart"}</AddedLabel> : "Add to cart"}
      </button>
      <button type="button" onClick={handleSimpleBuyNow} disabled={closedForPreorder || curOutOfStock} className={secondaryButtonClass({ disabled: closedForPreorder || curOutOfStock })}>
        {curOutOfStock ? "Out of stock" : closedForPreorder ? (short ? "Orders closed" : "Pre-orders are closed") : "Buy now"}
      </button>
    </>
  );

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pb-16 ${session ? "pb-52" : "pb-36"}`}>
      <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-1.5 text-sm text-mbi-slate">
        <Link to="/" className="shrink-0 hover:text-mbi-navy hover:underline">Home</Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0"><polyline points="9 6 15 12 9 18"/></svg>
        <Link to="/shop" className="shrink-0 hover:text-mbi-navy hover:underline">Shop</Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0"><polyline points="9 6 15 12 9 18"/></svg>
        <span className="truncate font-medium text-mbi-navy" aria-current="page">{product.product_name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
        <div className="overflow-hidden rounded-mbi-card lg:self-start">
          {/* With uploaded videos: video first, a thumbnail strip, and no auto-slide.
              Without videos: images first. */}
          <MediaCarousel
            heightClass="aspect-square"
            name={product.product_name}
            thumbnails={product.videos.length > 0}
            autoSlide={product.videos.length === 0}
            autoplayVideo
            focusUrl={variantImg}
            media={[
              ...product.videos.map(v => ({ type: "video", url: v.url, poster: v.poster_url })),
              { type: "image", url: variantImg },
              { type: "image", url: product.product_image_url   === variantImg ? null : product.product_image_url },
              { type: "image", url: product.product_image_url_2 === variantImg ? null : product.product_image_url_2 },
              ...product.extra_image_urls.map(url => ({ type: "image", url: url === variantImg ? null : url })),
              { type: "tiktok", url: product.product_video_url },
            ]}
          />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag status={product.product_status} outOfStock={productOutOfStock} />
                <span className="text-sm text-mbi-slate">{product.category}</span>
              </div>
              <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.3px] text-mbi-navy sm:text-[28px] sm:font-bold">
                {product.product_name}
              </h1>
              <div className="mt-3">
                <PriceLine price={curPrice} regular={curRegularPrice} onSale={curHasDiscount} />
              </div>
              {stockNote && (
                <p className={`mt-2 text-sm font-semibold ${curStock > 0 ? "text-mbi-slate" : "text-mbi-error"}`}>{stockNote}</p>
              )}
            </div>

            <ShippingEstimate min={product.estimated_shipping_fee_min} max={product.estimated_shipping_fee_max} />

            {hasVariants ? (
              <div className="space-y-4">
                <SizeChips sizes={product.sizes} sizePricing={product.sizePricing} value={curSize} onChange={setCurSize} />
                <ColourSwatches colours={product.colours} value={curColour} onChange={setCurColour} />
                <AddVariantRow
                  qty={curQty}
                  onQty={setCurQty}
                  onAdd={addVariantToPending}
                  disabled={!canAddVariant || curOutOfStock}
                  label={curOutOfStock ? "Out of stock" : "Add to selection"}
                />
                <SelectionList items={pendingVariants} onQty={setVariantQty} onRemove={removeVariant} />
              </div>
            ) : (
              <div>
                <p className="mb-2 text-sm font-semibold text-mbi-navy">Quantity</p>
                <QtyStepper value={curQty} onChange={setCurQty} />
              </div>
            )}

            {error && <p role="alert" className="text-sm font-medium text-mbi-error">{error}</p>}

            <div className="hidden gap-3 lg:grid">{renderActions()}</div>

            {product.description && (
              <div className="border-t border-mbi-hairline pt-5">
                <h2 className="text-xl font-bold text-mbi-navy">Description</h2>
                <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-mbi-navy-body">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-mbi-hairline pt-6">
        <ReviewsSection productId={Number(id)} />
      </div>

      {/* Phones: the actions stay within thumb reach (DESIGN.md "The Thumb Rule"). */}
      {/* Logged-in shoppers have the bottom tab bar (64px), so the actions sit just above it. */}
      <div className={`fixed inset-x-0 z-30 border-t border-mbi-hairline bg-white px-4 pt-3 shadow-mbi-float lg:hidden ${
        session ? "bottom-16 pb-3" : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      }`}>
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 [&>button]:h-12 [&>button]:px-3 [&>button]:text-[15px]">{renderActions(true)}</div>
      </div>
    </div>
  );
}
