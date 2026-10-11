import { useEffect } from "react";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/seo";

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Keeps <title>, meta description, canonical and social tags right as customers move
// around the app (the first page load already gets them from the server, api/seo.js).
// path: canonical path such as "/shop" or "/shop/686-rechargeable-fan".
export default function useSeo({ title, description = DEFAULT_DESCRIPTION, path, image = null, noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Quality Imported Products in Ghana`;
    document.title = fullTitle;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow");
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    if (image) setMeta("property", "og:image", image);
    if (path != null) {
      const url = SITE_URL + path;
      setCanonical(url);
      setMeta("property", "og:url", url);
    }
  }, [title, description, path, image, noindex]);
}
