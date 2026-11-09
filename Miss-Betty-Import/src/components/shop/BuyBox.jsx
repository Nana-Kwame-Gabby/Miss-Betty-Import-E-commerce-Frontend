import { colourMap } from "../../data/mockData";
import { money, moneyRange } from "../../lib/buyBoxStyles";

// Shared buy-box pieces for the product pop-up and the product page (DESIGN.md "Buy box",
// "Variant chips"). Presentation only: each surface keeps its own cart / stock logic.
// Button styles and price formatting live in lib/buyBoxStyles.js.

const Check = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
);

export const AddedLabel = ({ children = "Added to cart" }) => <><Check />{children}</>;

export function StatusTag({ status, outOfStock = false }) {
  const style = outOfStock ? "bg-mbi-error-tint text-mbi-error"
    : status === "Available" ? "bg-mbi-available-tint text-mbi-available"
    : "bg-mbi-preorder-tint text-mbi-navy";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{outOfStock ? "Out of stock" : status}</span>;
}

export function PriceLine({ price, regular, onSale, large = true }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular">
      <span className={`${large ? "text-2xl" : "text-xl"} font-bold text-mbi-navy`}>{money(price)}</span>
      {onSale && (
        <>
          <s className="text-base text-mbi-slate">{money(regular)}</s>
          <span className="rounded-full bg-mbi-amber-tint px-2.5 py-1 text-xs font-bold text-mbi-amber-ink">
            Save {money(regular - price)}
          </span>
        </>
      )}
    </p>
  );
}

export function ShippingEstimate({ min, max }) {
  if (!(min > 0 || max > 0)) return null;
  const range = min > 0 && max > 0 && min !== max ? moneyRange(min, max) : money(max || min);
  return (
    <p className="flex items-center gap-2 text-sm text-mbi-navy-body">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-mbi-slate">
        <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
      <span>Estimated shipping fee <span className="font-bold text-mbi-navy tabular">{range}</span></span>
    </p>
  );
}

const sectionLabel = "text-sm font-semibold text-mbi-navy";

// Size choices; with per-size pricing each chip shows its own price (and sale price).
export function SizeChips({ sizes, sizePricing, value, onChange, isUnavailable = () => false }) {
  if (!sizes.length) return null;
  return (
    <fieldset>
      <legend className={`${sectionLabel} mb-2`}>
        Size{value && <span className="ml-1.5 font-normal text-mbi-slate">{value}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {sizes.map(s => {
          const entry = sizePricing?.find(sp => sp.size === s);
          const regular = entry ? (entry.selling_price ?? entry.price ?? 0) : 0;
          const disc = entry?.discount_price ?? null;
          const onSale = disc != null && disc > 0 && disc < regular;
          const selected = value === s;
          const unavailable = isUnavailable(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={selected}
              disabled={unavailable}
              className={`mbi-press min-h-11 rounded-lg border px-3.5 py-2 text-left text-sm font-semibold ${
                selected ? "border-mbi-navy bg-mbi-navy text-white"
                  : unavailable ? "border-mbi-hairline bg-mbi-surface-soft text-mbi-slate line-through cursor-not-allowed"
                  : "border-mbi-hairline bg-white text-mbi-navy hover:border-mbi-navy"
              }`}
            >
              <span className="block">{s}</span>
              {entry && (
                <span className={`block text-xs font-medium tabular ${selected ? "text-white/80" : onSale ? "text-mbi-amber-ink" : "text-mbi-slate"}`}>
                  {money(onSale ? disc : regular)}
                  {onSale && <s className={`ml-1 font-normal ${selected ? "text-white/60" : "text-mbi-slate"}`}>{money(regular)}</s>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Colour swatches (36px circles, 44px tap areas) with the chosen colour named.
export function ColourSwatches({ colours, value, onChange }) {
  if (!colours.length) return null;
  return (
    <fieldset>
      <legend className={`${sectionLabel} mb-2`}>
        Colour{value && <span className="ml-1.5 font-normal text-mbi-slate">{value}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {colours.map(c => {
          const selected = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={selected}
              aria-label={c}
              title={c}
              className={`mbi-press grid size-11 place-items-center rounded-full ${selected ? "ring-2 ring-mbi-navy" : "hover:ring-1 hover:ring-mbi-hairline"}`}
            >
              <span className="size-8 rounded-full border border-mbi-navy/15" style={{ backgroundColor: colourMap[c] || "#c9d1da" }} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QtyStepper({ value, onChange, min = 1, compact = false, label = "Quantity" }) {
  const box = compact ? "size-9" : "size-11";
  return (
    <div className="inline-flex items-center rounded-lg border border-mbi-hairline bg-white" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease quantity"
        className={`mbi-press grid ${box} place-items-center rounded-l-lg text-mbi-navy hover:bg-mbi-surface-soft disabled:text-mbi-slate disabled:opacity-50`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <span className={`${compact ? "min-w-8 text-sm" : "min-w-10 text-base"} text-center font-semibold text-mbi-navy tabular`} aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Increase quantity"
        className={`mbi-press grid ${box} place-items-center rounded-r-lg text-mbi-navy hover:bg-mbi-surface-soft`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  );
}

// Quantity + "Add this variant" row used before the variants go to the cart together.
export function AddVariantRow({ qty, onQty, onAdd, disabled, label = "Add to selection" }) {
  return (
    <div className="flex items-center gap-2">
      <QtyStepper value={qty} onChange={onQty} />
      <button type="button" onClick={onAdd} disabled={disabled}
        className="mbi-press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-mbi-navy/25 bg-white px-4 text-sm font-semibold text-mbi-navy hover:border-mbi-navy disabled:cursor-not-allowed disabled:opacity-40">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        {label}
      </button>
    </div>
  );
}

// The variants chosen so far, each with its own quantity, and the running total.
export function SelectionList({ items, onQty, onRemove }) {
  if (!items.length) return null;
  const totalQty = items.reduce((s, v) => s + v.qty, 0);
  const totalCost = items.reduce((s, v) => s + v.price * v.qty, 0);
  return (
    <div className="rounded-mbi-card border border-mbi-hairline">
      <p className="border-b border-mbi-hairline-soft px-4 py-2.5 text-sm font-semibold text-mbi-navy">Your selection</p>
      <ul>
        {items.map(v => (
          <li key={v.variantKey} className="flex items-center gap-3 border-b border-mbi-hairline-soft px-4 py-2.5 last:border-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {v.colour && <span className="size-4 shrink-0 rounded-full border border-mbi-navy/15" style={{ backgroundColor: colourMap[v.colour] || "#c9d1da" }} aria-hidden="true" />}
              <span className="truncate text-sm text-mbi-navy">{[v.size, v.colour].filter(Boolean).join(" · ")}</span>
              <span className="ml-auto shrink-0 pl-2 text-sm font-semibold text-mbi-navy tabular">{money(v.price)}</span>
            </div>
            <QtyStepper compact value={v.qty} onChange={q => onQty(v.variantKey, q)} label={`Quantity of ${[v.size, v.colour].filter(Boolean).join(" ")}`} />
            <button type="button" onClick={() => onRemove(v.variantKey)} aria-label={`Remove ${[v.size, v.colour].filter(Boolean).join(" ")}`}
              className="mbi-press grid size-9 shrink-0 place-items-center rounded-full text-mbi-slate hover:bg-mbi-error-tint hover:text-mbi-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between rounded-b-mbi-card bg-mbi-surface-soft px-4 py-2.5 text-sm font-semibold text-mbi-navy tabular">
        <span>{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
        <span>Total {money(totalCost)}</span>
      </div>
    </div>
  );
}
