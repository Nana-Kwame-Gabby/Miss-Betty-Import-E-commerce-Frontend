import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import MediaCarousel from "../MediaCarousel";
import ReviewsSection from "../ReviewsSection";
import { getVariantImage } from "../../lib/variantImage";
import { setPostAuthRedirect } from "../../utils/postAuthRedirect";
import { productPath } from "../../lib/seo";
import {
  AddVariantRow, AddedLabel, ColourSwatches, PriceLine, QtyStepper, SelectionList, ShippingEstimate,
  SizeChips, StatusTag,
} from "./BuyBox";
import { primaryButtonClass, secondaryButtonClass } from "../../lib/buyBoxStyles";

const isPreorder = s => typeof s === "string" && s.toLowerCase().includes("pre");

// Product pop-up shared by the Shop and Home pages: a bottom sheet on phones, a dialog on
// desktop (DESIGN.md "Buy box"). Cart and checkout behaviour is unchanged from the pages'
// previous copies; `buyNow` opens it straight into the checkout path.
export default function ProductDetailModal({ product, onClose, buyNow = false }) {
  const { addToCart, addMultipleToCart } = useCart();
  const { session } = useAuth();
  const { ordersClosed } = useAppSettings();
  const navigate = useNavigate();
  const blockedByPreorder = ordersClosed && isPreorder(product.product_status);

  const hasVariants = product.sizes.length > 0 || product.colours.length > 0;

  const [curSize,         setCurSize]         = useState(null);
  const [curColour,       setCurColour]       = useState(null);
  const [curQty,          setCurQty]          = useState(1);
  const [pendingVariants, setPendingVariants] = useState([]);
  const [added,           setAdded]           = useState(false);

  const curEntry        = product?.sizePricing && curSize
    ? (product.sizePricing.find(sp => sp.size === curSize) ?? null)
    : null;
  const curRegularPrice = curEntry?.selling_price ?? curEntry?.price ?? product?.unit_price ?? 0;
  // A chosen size uses only its own discount; the product-level discount_price is the
  // lowest discount across sizes (for the "from" price) and must not leak into other sizes.
  const curDiscountPrice = curEntry ? (curEntry.discount_price ?? null) : (product?.discount_price ?? null);
  const curHasDiscount  = curDiscountPrice != null && curDiscountPrice > 0 && curDiscountPrice < curRegularPrice;
  const curPrice        = curHasDiscount ? curDiscountPrice : curRegularPrice;
  const curCostPrice    = curEntry?.cost_price ?? product?.cost_price ?? 0;
  const curProfit       = curEntry?.profit     ?? product?.profit    ?? 0;
  const curRmbPrice     = curEntry?.rmb_price  ?? product?.rmb_price ?? 0;
  const curMiscAmount   = curEntry?.misc_amount ?? product?.misc_amount ?? 0;
  // Photo for the current selection (exact size+colour → colour → size); null = main images only.
  const variantImg      = getVariantImage(product?.variant_images, curSize, curColour);

  const totalQty  = pendingVariants.reduce((s, v) => s + v.qty, 0);

  const canAddVariant =
    (!product.sizes.length   || curSize) &&
    (!product.colours.length || curColour);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.sheetOpen = "on"; // hides the chat launcher (App.css)
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      delete document.documentElement.dataset.sheetOpen;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
        rmbPrice: curRmbPrice, miscAmount: curMiscAmount,
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
        rmbPrice: v.rmbPrice, miscAmount: v.miscAmount,
        originalPrice: v.originalPrice ?? null,
      }))
    );
    andThen();
  }

  function handleAddAll() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if (pendingVariants.length === 0) return;
    commitToCart(() => { setAdded(true); setTimeout(() => { setAdded(false); onClose(); }, 1500); });
  }

  function handleCheckout() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if (blockedByPreorder || pendingVariants.length === 0) return;
    commitToCart(() => navigate("/checkout"));
  }

  function handleSimpleAdd() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    const simpleOriginal = curHasDiscount ? curRegularPrice : null;
    addToCart(product, curQty, null, null, curPrice, product.cost_price, product.profit, simpleOriginal, product.rmb_price, product.misc_amount);
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 1500);
  }

  function handleSimpleBuyNow() {
    if (!session) { setPostAuthRedirect(productPath(product)); navigate("/login"); return; }
    if (blockedByPreorder) return;
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

  const removeVariant = key => setPendingVariants(prev => prev.filter(x => x.variantKey !== key));
  const setVariantQty = (key, q) => setPendingVariants(prev => prev.map(x => x.variantKey === key ? { ...x, qty: q } : x));

  // The sheet's one main action, pinned to the bottom of the scroll area.
  let cta;
  if (hasVariants) {
    cta = buyNow ? (
      blockedByPreorder
        ? <button type="button" disabled className={secondaryButtonClass({ disabled: true })}>Pre-orders are closed</button>
        : <button type="button" onClick={handleCheckout} disabled={pendingVariants.length === 0} className={primaryButtonClass({ disabled: pendingVariants.length === 0 })}>
            {pendingVariants.length === 0 ? "Choose your options first" : "Proceed to checkout"}
          </button>
    ) : (
      <button type="button" onClick={handleAddAll} disabled={pendingVariants.length === 0 && !added} className={primaryButtonClass({ added, disabled: pendingVariants.length === 0 })}>
        {added ? <AddedLabel /> : totalQty > 0 ? `Add ${totalQty} item${totalQty !== 1 ? "s" : ""} to cart` : "Choose your options first"}
      </button>
    );
  } else {
    cta = (
      <div className="flex items-center gap-3">
        <QtyStepper value={curQty} onChange={setCurQty} />
        <div className="flex-1">
          {buyNow ? (
            blockedByPreorder
              ? <button type="button" disabled className={secondaryButtonClass({ disabled: true })}>Pre-orders are closed</button>
              : <button type="button" onClick={handleSimpleBuyNow} className={primaryButtonClass()}>Proceed to checkout</button>
          ) : (
            <button type="button" onClick={handleSimpleAdd} className={primaryButtonClass({ added })}>
              {added ? <AddedLabel /> : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-mbi-navy/50 transition-opacity duration-200 starting:opacity-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-sheet-title"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[20px] bg-white transition-transform duration-[280ms] ease-mbi-drawer starting:translate-y-8 sm:max-w-xl sm:rounded-mbi-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex h-14 shrink-0 items-center px-5">
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-mbi-hairline sm:hidden" aria-hidden="true" />
          <span className="truncate pr-12 text-sm font-medium text-mbi-slate">{product.category}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mbi-press absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-mbi-navy hover:bg-mbi-surface-soft"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative mx-4 overflow-hidden rounded-mbi-card">
            {/* With uploaded videos: video first, a thumbnail strip, and no auto-slide.
                Without videos: images first. */}
            <MediaCarousel
              heightClass="aspect-square max-h-[52vh]"
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

          <div className="space-y-5 px-5 pb-6 pt-4">
            <div>
              <StatusTag status={product.product_status} />
              <h2 id="product-sheet-title" className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.3px] text-mbi-navy">
                {product.product_name}
              </h2>
              <div className="mt-2">
                <PriceLine price={curPrice} regular={curRegularPrice} onSale={curHasDiscount} />
              </div>
            </div>

            {product.description && (
              <p className="whitespace-pre-line text-base leading-relaxed text-mbi-navy-body">{product.description}</p>
            )}

            <ShippingEstimate min={product.estimated_shipping_fee_min} max={product.estimated_shipping_fee_max} />

            {hasVariants && (
              <div className="space-y-4">
                <SizeChips sizes={product.sizes} sizePricing={product.sizePricing} value={curSize} onChange={setCurSize} />
                <ColourSwatches colours={product.colours} value={curColour} onChange={setCurColour} />
                <AddVariantRow qty={curQty} onQty={setCurQty} onAdd={addVariantToPending} disabled={!canAddVariant} />
                <SelectionList items={pendingVariants} onQty={setVariantQty} onRemove={removeVariant} />
              </div>
            )}

            <ReviewsSection productId={product.id} />
          </div>
        </div>

        <div className="border-t border-mbi-hairline bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {cta}
        </div>
      </div>
    </div>
  );
}
