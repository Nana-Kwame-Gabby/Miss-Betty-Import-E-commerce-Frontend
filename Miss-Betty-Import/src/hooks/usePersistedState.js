import { useEffect, useState } from "react";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Drop-in replacement for useState that mirrors its value to sessionStorage under `key`.
// Survives SPA navigation-away-and-back and same-tab reloads; clears when the tab closes.
// One call site per key — no cross-instance sync between simultaneously-mounted components.
// Note: runs under StrictMode's double-invoke in dev; both the read and write are idempotent, so this is harmless.
export default function usePersistedState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored == null) return initialValue;
      const parsed = JSON.parse(stored);
      // Merge onto defaults (object-shaped state only) so a field added in a future
      // deploy isn't left `undefined` by an older stale sessionStorage blob.
      if (isPlainObject(initialValue) && isPlainObject(parsed)) {
        return { ...initialValue, ...parsed };
      }
      return parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (state === undefined) {
        sessionStorage.removeItem(key);
        return;
      }
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage can throw in private-browsing/locked-down contexts — safe to ignore
    }
  }, [key, state]);

  return [state, setState];
}
