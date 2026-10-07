import { supabase } from "./supabase";
import { capturePoster, compressImage, deleteMedia, uploadMedia } from "./media";

// Product media state and storage helpers shared by the admin Add form and Edit modal.
// State shape (all optional):
//   { main, second, extras: [], videos: [] }
//   image slot: { url } (already stored) | { file, preview } (picked, not uploaded yet)
//   video slot: { url, poster_url } | { file, preview, posterFile, posterPreview }

export const emptyMedia = () => ({ main: null, second: null, extras: [], videos: [] });

export function mediaFromProduct(p) {
  return {
    main: p.product_image_url ? { url: p.product_image_url } : null,
    second: p.product_image_url_2 ? { url: p.product_image_url_2 } : null,
    extras: (p.extra_image_urls ?? []).filter(Boolean).map(url => ({ url })),
    videos: (p.product_videos ?? []).filter(v => v?.url).map(v => ({ url: v.url, poster_url: v.poster_url ?? null })),
  };
}

// Every media URL a product row references (mirrors productUrls in api/media.js).
export function productMediaUrls(p) {
  const urls = [p.product_image_url, p.product_image_url_2, ...(p.extra_image_urls ?? [])];
  for (const group of ["colours", "sizes", "combos"]) urls.push(...Object.values(p.variant_images?.[group] ?? {}));
  for (const v of p.product_videos ?? []) urls.push(v?.url, v?.poster_url);
  return urls.filter(u => typeof u === "string" && u);
}

// Deletes stored files: R2 files via the media endpoint, and any legacy Supabase Storage
// files (products not yet moved to R2) directly.
export async function removeStoredMedia(urls) {
  const list = [...new Set(urls.filter(Boolean))];
  if (!list.length) return;
  const legacy = { "product-images": [], "product-videos": [] };
  for (const url of list) {
    const m = url.match(/\/storage\/v1\/object\/public\/(product-images|product-videos)\/(.+)$/);
    if (m) legacy[m[1]].push(decodeURIComponent(m[2]));
  }
  await Promise.all([
    deleteMedia(list.filter(u => !/\/storage\/v1\/object\/public\//.test(u))),
    ...Object.entries(legacy).filter(([, paths]) => paths.length)
      .map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths).catch(() => {})),
  ]);
}

// Uploads everything that's new (images compressed to WebP first), then returns the product
// fields, the resolved variant-image map and the list of newly uploaded URLs (for rollback).
// True while a picked video is still being optimized (saving must wait).
export const mediaBusy = (media) => media.videos.some(v => v.compressing);

export async function uploadProductMedia(media, variantFlat, onProgress) {
  if (mediaBusy(media)) throw new Error("Please wait until the videos finish optimizing.");
  const items = [];
  const assign = [];
  const queue = async (slot, kind, set) => {
    if (!slot?.file) return;
    items.push({ file: kind === "image" ? await compressImage(slot.file) : slot.file, kind });
    assign.push(set);
  };

  const fields = { product_image_url: media.main?.url ?? null, product_image_url_2: media.second?.url ?? null };
  const extras = media.extras.map(s => s.url ?? null);
  const videos = media.videos.map(v => ({ url: v.url ?? null, poster_url: v.poster_url ?? null }));
  const variants = { ...variantFlat };

  await queue(media.main, "image", u => { fields.product_image_url = u; });
  await queue(media.second, "image", u => { fields.product_image_url_2 = u; });
  for (const [i, s] of media.extras.entries()) await queue(s, "image", u => { extras[i] = u; });
  for (const [i, v] of media.videos.entries()) {
    if (!v.file) continue;
    // QuickTime (.mov) phone videos are MP4-compatible; labelling them video/mp4 lets every
    // browser (not only Safari/Chrome) recognise and play them.
    const file = v.file.type === "video/quicktime"
      ? new File([v.file], v.file.name.replace(/\.mov$/i, "") + ".mp4", { type: "video/mp4" })
      : v.file;
    await queue({ file }, "video", u => { videos[i].url = u; });
    // Saved before the thumbnail was ready (or the browser skipped it): try once more.
    const poster = v.posterFile ?? await capturePoster(v.file);
    if (poster) await queue({ file: poster }, "poster", u => { videos[i].poster_url = u; });
  }
  for (const [key, v] of Object.entries(variantFlat)) {
    if (v && typeof v === "object") await queue(v, "image", u => { variants[key] = u; });
  }

  const urls = await uploadMedia(items, onProgress);
  urls.forEach((u, i) => assign[i](u));
  return {
    fields: {
      ...fields,
      extra_image_urls: extras.filter(Boolean),
      product_videos: videos.filter(v => v.url),
    },
    variantFlat: variants,
    uploaded: urls,
  };
}
