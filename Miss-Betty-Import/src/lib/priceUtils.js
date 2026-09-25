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
