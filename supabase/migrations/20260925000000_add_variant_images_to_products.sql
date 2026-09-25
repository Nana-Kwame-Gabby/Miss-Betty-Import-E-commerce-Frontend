-- Optional per-variant product images, shaped as
--   { "colours": {"Red": url}, "sizes": {"S": url}, "combos": {"S|Red": url} }
-- NULL = no variant images; the storefront falls back to product_image_url.
alter table public.products add column if not exists variant_images jsonb;
