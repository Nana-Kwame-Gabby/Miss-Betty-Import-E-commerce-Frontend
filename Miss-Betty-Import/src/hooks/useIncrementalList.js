import { useEffect, useRef } from "react";
import usePersistedState from "./usePersistedState";

// Renders a long product list in batches: `step` items at first, then the next batch as the
// customer scrolls near the end (rendering ~640 cards at once froze phones for seconds).
// The count is remembered for the tab so returning to the page restores the scroll position,
// and it resets whenever `resetKey` (search/filters) changes.
export default function useIncrementalList(items, storageKey, resetKey, step = 24) {
  const [state, setState] = usePersistedState(storageKey, { n: step, k: resetKey });
  const count = state?.k === resetKey ? Math.max(step, state.n) : step;
  const hasMore = count < items.length;
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setState({ n: count + step, k: resetKey });
    }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [count, hasMore, resetKey, step, setState]);

  return { visible: items.slice(0, count), sentinelRef, hasMore, showAll: () => setState({ n: items.length, k: resetKey }) };
}
