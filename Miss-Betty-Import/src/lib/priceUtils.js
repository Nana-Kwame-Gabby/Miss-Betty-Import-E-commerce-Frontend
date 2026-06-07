export function getEffectivePrice({ selling_price, unit_price, discount_price }) {
  const base = selling_price ?? unit_price ?? 0;
  return (discount_price != null && discount_price > 0 && discount_price < base)
    ? discount_price : base;
}

export function hasDiscount({ selling_price, unit_price, discount_price }) {
  const base = selling_price ?? unit_price ?? 0;
  return discount_price != null && discount_price > 0 && discount_price < base;
}
