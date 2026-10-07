-- Product media on Cloudflare R2: more images and optional uploaded videos.
-- Files live in R2 (served from https://media.missbettyimport.com); the database keeps URLs.
--   extra_image_urls: images after Image 1 / Image 2, e.g. ["https://media…/a.webp", …]
--   product_videos:   uploaded videos, e.g. [{"url": "https://media…/v.mp4", "poster_url": "https://media…/p.jpg"}]
-- product_video_url stays the optional TikTok link.

alter table public.products
  add column if not exists extra_image_urls jsonb not null default '[]'::jsonb,
  add column if not exists product_videos   jsonb not null default '[]'::jsonb;

alter table public.products drop constraint if exists products_extra_image_urls_check;
alter table public.products add constraint products_extra_image_urls_check
  check (jsonb_typeof(extra_image_urls) = 'array' and jsonb_array_length(extra_image_urls) <= 8);

alter table public.products drop constraint if exists products_product_videos_check;
alter table public.products add constraint products_product_videos_check
  check (jsonb_typeof(product_videos) = 'array' and jsonb_array_length(product_videos) <= 3);
