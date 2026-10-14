export function getEffectivePrice({ selling_price, unit_price, discount_price }) {
  const base = selling_price ?? unit_price ?? 0;
  return (discount_price != null && discount_price > 0 && discount_price < base)
    ? discount_price : base;
}

export function hasDiscount({ selling_price, unit_price, discount_price }) {
  const base = selling_price ?? unit_price ?? 0;
  return discount_price != null && discount_price > 0 && discount_price < base;
}

// Actual per-unit profit: what the customer paid minus cost and misc. A discount
// (already in unit_price) comes off profit exactly once; misc is never profit.
export function getItemProfit({ unit_price, cost_price, misc_amount }) {
  return Math.round((Number(unit_price ?? 0) - Number(cost_price ?? 0) - Number(misc_amount ?? 0)) * 100) / 100;
}

// Per-unit pricing for one size of a raw `products` row — the shop's rule
// (ProductDetailPage): a size entry overrides the product, the discount is used only when
// it is below the regular price, and profit is what is left after cost and misc.
// The database's offline_sale_price() applies the same rule when a sale is saved.
export function getVariantPricing(product, size) {
  const entries = Array.isArray(product?.size_pricing) ? product.size_pricing : [];
  const entry = size ? entries.find(e => e.size === size) ?? null : null;
  const num = v => (v == null || v === '' ? null : Number(v));
  const original = num(entry?.selling_price) ?? num(entry?.price) ?? num(product?.unit_price) ?? 0;
  const disc = num(entry?.discount_price) ?? num(product?.discount_price);
  const unit = disc != null && disc > 0 && disc < original ? disc : original;
  const cost = num(entry?.cost_price) ?? num(product?.cost_price) ?? 0;
  const misc = num(entry?.misc_amount) ?? num(product?.misc_amount) ?? 0;
  return {
    original_price: original,
    discount_amount: Math.round((original - unit) * 100) / 100,
    unit_price: unit,
    cost_price: cost,
    misc_amount: misc,
    profit: getItemProfit({ unit_price: unit, cost_price: cost, misc_amount: misc }),
  };
}
