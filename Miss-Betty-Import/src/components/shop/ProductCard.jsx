import { useState } from "react";
import { useCart } from "../../context/CartContext";
import ShareProductButton from "../ShareProductButton";
import { getEffectivePrice, hasDiscount } from "../../lib/priceUtils";
import { productPath } from "../../lib/seo";
import { imgFallback, thumbUrl } from "../../lib/imageUrl";
import { downloadImage } from "../../lib/downloadImage";
import { photoButtonClass, photoIconClass } from "../../lib/photoButton";

const NBSP = String.fromCharCode(160); // keeps "GHS" and the amount on one line
const money = n => `GHS${NBSP}${Number(n ?? 0).toLocaleString()}`;

// Photo-first product card shared by the Shop and Home pages (DESIGN.md "Product card").
// The whole card opens the product; Add to cart and Buy now stay on the card. Amber stays the
// single "next step" voltage, so the card's Add to cart is the soft amber-tint button.
export default function ProductCard({ product, onSelect, onViewImage, onBuyNow, ordersClosed, priority = false }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const isPreorder = typeof product?.product_status === "string" && product.product_status.toLowerCase().includes("pre");
  const blockedByOrders = ordersClosed && isPreorder;

  // Stock is opt-in per product (no product_variant_stock rows = untracked = unlimited,
  // matching every product's behavior before this feature existed) and only gates
  // "Available" status products — Pre-order items have no stock limitations.
  const isTracked = (product.variantStock?.length ?? 0) > 0;
  const hasAnyStock = !isTracked || product.variantStock.some(r => r.stock_quantity > 0);
  const outOfStock = product.product_status === "Available" && isTracked && !hasAnyStock;
  const totalStock = isTracked ? product.variantStock.reduce((s, r) => s + r.stock_quantity, 0) : null;
  const onSale = hasDiscount(product);
  const from = product.sizePricing ? "From " : "";

  function firstInStockVariant() {
    const sizes = product.sizes.length > 0 ? product.sizes : [null];
    const colours = product.colours.length > 0 ? product.colours : [null];
    for (const size of sizes) {
      for (const colour of colours) {
        const row = product.variantStock.find(r => r.size === (size ?? "") && r.colour === (colour ?? ""));
        if (!row || row.stock_quantity > 0) return { size, colour };
      }
    }
    return { size: product.sizes[0] ?? null, colour: product.colours[0] ?? null };
  }

  function handleAdd(e) {
    e.stopPropagation();
    if (outOfStock) return;
    if (product.sizes.length > 0 || product.colours.length > 0) {
      onSelect(product); // require the customer to choose a variant in the picker
      return;
    }
    const { size: firstSize, colour: firstColour } = firstInStockVariant();
    const sizeEntry = product.sizePricing?.find(sp => sp.size === firstSize) ?? null;
    const price     = sizeEntry ? getEffectivePrice(sizeEntry) : getEffectivePrice(product);
    const costP     = sizeEntry?.cost_price ?? product.cost_price ?? 0;
    const prof      = sizeEntry?.profit     ?? product.profit     ?? 0;
    const rmbP      = sizeEntry?.rmb_price  ?? product.rmb_price  ?? 0;
    const miscP     = sizeEntry?.misc_amount ?? product.misc_amount ?? 0;
    const origPrice = sizeEntry
      ? (hasDiscount(sizeEntry) ? (sizeEntry.selling_price ?? product.unit_price) : null)
      : (hasDiscount(product)   ? product.unit_price : null);
    addToCart(product, 1, firstSize, firstColour, price, costP, prof, origPrice, rmbP, miscP);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow(e) {
    e.stopPropagation();
    if (blockedByOrders || outOfStock) return;
    onBuyNow(product);
  }

  const status = outOfStock
    ? { label: "Out of stock", dot: "bg-mbi-error" }
    : product.product_status === "Available"
      ? { label: "Available", dot: "bg-mbi-available" }
      : { label: product.product_status, dot: "bg-mbi-navy" };

  return (
    <article className="group flex flex-col cursor-pointer" onClick={() => onSelect(product)}>
      <div className="relative overflow-hidden rounded-mbi-card bg-mbi-surface-soft aspect-[4/5] transition-shadow duration-150 group-hover:shadow-mbi-float">
        {product.product_image_url ? (
          <img
            src={thumbUrl(product.product_image_url, 480)}
            onError={imgFallback(product.product_image_url)}
            alt={product.product_name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="size-full object-cover object-center"
          />
        ) : (
          <div className="size-full grid place-items-center text-mbi-slate">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        )}

        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-mbi-navy">
          <span className={`size-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>

        <ShareProductButton
          productId={product.id}
          productName={product.product_name}
          productPrice={getEffectivePrice(product)}
          originalPrice={onSale ? product.unit_price : null}
          isFromPrice={!!product.sizePricing}
        />

        {product.product_image_url && (
          <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 flex gap-2.5">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onViewImage(product.product_image_url, product.product_name); }}
              className={photoButtonClass}
              aria-label={`View ${product.product_name} full screen`}
              title="View full image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={photoIconClass}>
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={e => downloadImage(e, product.product_image_url, product.product_name)}
              className={photoButtonClass}
              aria-label={`Download photo of ${product.product_name}`}
              title="Download image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={photoIconClass}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-2.5">
        <p className="truncate text-xs font-medium text-mbi-slate">{product.category}</p>
        <h2 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-mbi-navy">
          <a
            href={productPath(product)}
            onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey) e.stopPropagation(); else e.preventDefault(); }}
            className="hover:underline focus-visible:underline"
          >
            {product.product_name}
          </a>
        </h2>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 tabular">
          <span className="text-base font-bold text-mbi-navy">{from}{money(getEffectivePrice(product))}</span>
          {onSale && <s className="text-sm text-mbi-slate">{money(product.unit_price)}</s>}
        </p>
        {product.product_status === "Available" && isTracked && totalStock > 0 && (
          <p className="mt-0.5 text-xs font-medium text-mbi-slate">{totalStock} in stock</p>
        )}

        <div className="mt-auto flex gap-1.5 pt-2.5">
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className={`mbi-press flex-1 h-11 rounded-lg px-2 text-[13px] sm:text-sm font-semibold ${
              outOfStock
                ? "bg-mbi-surface-soft text-mbi-slate cursor-not-allowed"
                : added
                  ? "bg-mbi-available-tint text-mbi-available"
                  : "bg-mbi-amber-tint text-mbi-navy hover:bg-mbi-amber"
            }`}
          >
            {outOfStock ? "Sold out" : added ? (
              <span className="inline-flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                Added
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="sm:hidden">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <span className="sm:hidden" aria-hidden="true">Add</span>
                <span className="sr-only sm:not-sr-only">Add to cart</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={blockedByOrders || outOfStock}
            title={blockedByOrders ? "Pre-orders are closed for now" : undefined}
            className={`mbi-press flex-1 h-11 rounded-lg border px-2 text-[13px] sm:text-sm font-semibold ${
              blockedByOrders || outOfStock
                ? "border-mbi-hairline bg-mbi-surface-soft text-mbi-slate cursor-not-allowed"
                : "border-mbi-navy/25 bg-white text-mbi-navy hover:border-mbi-navy hover:bg-mbi-navy hover:text-white"
            }`}
          >
            {outOfStock ? "Sold out" : blockedByOrders ? "Closed" : "Buy now"}
          </button>
        </div>
      </div>
    </article>
  );
}
