// How Home and Shop read products from the database and shape them for the product cards,
// shelves and pop-up. One copy, shared by both pages and their live updates.

export const PRODUCT_SELECT = "*, category(category_name), product_status(status_name), product_variant_stock(*)";

export function mapProduct(p) {
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
    rmb_price:  Number(p.rmb_price ?? 0), // admin-only procurement cost; never rendered on customer pages
    misc_amount: Number(p.misc_amount ?? 0), // admin-only; never rendered on customer pages
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

// Applies freshly read rows to the list: changed products are replaced, products that no longer
// come back (deleted or archived) are removed, new ones are added. Newest first, as loaded.
export function mergeProducts(list, ids, freshRows) {
  const fresh = new Map(freshRows.map(r => [r.product_id, mapProduct(r)]));
  const next = list
    .filter(p => !ids.has(p.id) || fresh.has(p.id))
    .map(p => fresh.get(p.id) ?? p);
  const known = new Set(next.map(p => p.id));
  for (const [id, p] of fresh) if (!known.has(id)) next.push(p);
  return next.sort((a, b) => b.id - a.id);
}
