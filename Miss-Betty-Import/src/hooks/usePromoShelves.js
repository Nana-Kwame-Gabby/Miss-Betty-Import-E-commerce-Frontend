import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { planShelves, shelvesNeeded, EVERY_DESKTOP, EVERY_PHONE } from "../lib/promotions";
import useMediaQuery from "./useMediaQuery";

const RANK_KEY = "mbimport_promo_rank_v2"; // { at, ids } — best sellers by sales value, cached for 10 minutes
const SEED_KEY = "mbimport_promo_seed";   // one random number per visit
const SEEN_KEY = "mbimport_promo_seen";   // product ids already shown on a shelf this visit
const RANK_TTL = 10 * 60 * 1000;

function read(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

function visitSeed() {
  const saved = read(SEED_KEY);
  if (Number.isInteger(saved)) return saved;
  const seed = Math.floor(Math.random() * 2 ** 31);
  write(SEED_KEY, seed);
  return seed;
}

// Called by a shelf once it has been on screen, so later shelves and pages show other products.
export function markShelfSeen(ids) {
  const seen = new Set(read(SEEN_KEY) ?? []);
  ids.forEach(id => seen.add(id));
  write(SEEN_KEY, [...seen].slice(-400));
}

function cachedRank() {
  const c = read(RANK_KEY);
  return c && Date.now() - c.at < RANK_TTL && Array.isArray(c.ids) ? c.ids : null;
}

// The shelves for a product listing page. `filters` are the page's search/category/status and
// `total` the length of its filtered list. Returns the shelves and their spacing (`every`):
// 6 products on phones and tablets, 8 on desktop (lg, 4 per row).
export default function usePromoShelves({ products, filters, total }) {
  const every = useMediaQuery("(min-width: 1024px)") ? EVERY_DESKTOP : EVERY_PHONE;
  // Plan for the phone spacing (the most shelves), so a resize never changes what a shelf holds.
  const count = shelvesNeeded(total, EVERY_PHONE);
  const [rankedIds, setRankedIds] = useState(cachedRank);
  // Read once per page visit so shelves never reshuffle while the shopper scrolls.
  const [seed] = useState(visitSeed);
  const [seen] = useState(() => new Set(read(SEEN_KEY) ?? []));

  useEffect(() => {
    if (rankedIds) return;
    let alive = true;
    supabase.rpc("top_ordered_products", { p_limit: 40 }).then(({ data, error }) => {
      if (!alive) return;
      const ids = error ? [] : (data ?? []).map(r => r.product_id);
      if (!error) write(RANK_KEY, { at: Date.now(), ids });
      setRankedIds(ids);
    });
    return () => { alive = false; };
  }, [rankedIds]);

  const { search, activeCategory, statusFilter } = filters;
  const shelves = useMemo(
    // Wait for the ranking so shelves don't switch kind after they first appear.
    () => products.length === 0 || rankedIds === null ? [] : planShelves({
      products,
      rankedIds,
      filters: { search, activeCategory, statusFilter },
      seed,
      seen,
      count,
    }),
    [products, rankedIds, search, activeCategory, statusFilter, seed, seen, count],
  );
  return { shelves, every };
}
