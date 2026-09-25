// Most specific image for a selection: exact size+colour, then colour, then size.
// Returns null when nothing matches so callers fall back to the main product image.
export function getVariantImage(variantImages, size, colour) {
  if (!variantImages) return null;
  return (size && colour && variantImages.combos?.[`${size}|${colour}`])
    || (colour && variantImages.colours?.[colour])
    || (size && variantImages.sizes?.[size])
    || null;
}
