// Small versions of product photos for cards and thumbnails, resized on the fly by Cloudflare
// Image Transformations on media.missbettyimport.com (zone setting: Images → Transformations).
// If a transformed image fails (setting off, quota reached), <img onError={imgFallback(url)}>
// swaps in the original, so nothing can break.

const MEDIA = "https://media.missbettyimport.com/";

// Turned on once Cloudflare transformations are enabled for the zone and verified.
export const THUMBNAILS_ENABLED = true;

export function thumbUrl(url, width) {
  if (!THUMBNAILS_ENABLED || typeof url !== "string" || !url.startsWith(MEDIA)) return url;
  return `${MEDIA}cdn-cgi/image/width=${width},quality=75,format=auto,fit=scale-down/${url.slice(MEDIA.length)}`;
}

// onError handler: fall back to the original photo once.
export function imgFallback(original) {
  return (e) => {
    if (original && e.currentTarget.src !== original) e.currentTarget.src = original;
  };
}
