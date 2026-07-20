import { useEffect, useRef } from "react";

// Saves window scroll position under `key` while the page is mounted, and restores it
// once `ready` becomes true (e.g. once the list it scrolls has finished loading).
export default function useScrollRestoration(key, ready) {
  const restored = useRef(false);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = sessionStorage.getItem(key);
    if (saved != null) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }
  }, [key, ready]);

  useEffect(() => {
    function save() {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        // ignore storage errors
      }
    }
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
    };
  }, [key]);
}
