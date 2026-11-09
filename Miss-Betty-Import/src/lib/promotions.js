// Picks the products for the promoted shelves on Home and Shop (DESIGN.md "Promoted shelf").
// Two kinds: "ready" (in-stock Available products) and "popular" (most ordered, ranked by the
// top_ordered_products database function by sales value). Pure functions; no React, no network.

export const SHELF_SIZE = 8;       // cards per shelf
export const SHELF_MIN = 4;        // a kind with fewer candidates is left out
export const EVERY_PHONE = 6;      // a shelf after every 6 products on phones and tablets (2 or 3 per row)
export const EVERY_DESKTOP = 8;    // and after every 8 on desktop (4 per row), so it always follows a full row
export const MIN_LIST = 12;        // a shorter list gets no shelves (they could only repeat it)

// Same stock rule as the product card: no stock rows = untracked = unlimited.
export function hasStock(p) {
  const rows = p.variantStock ?? [];
  return rows.length === 0 || rows.some(r => r.stock_quantity > 0);
}

const isPreorder = p => typeof p.product_status === "string" && p.product_status.toLowerCase().includes("pre");

export function isReadyToShip(p) {
  return p.product_status === "Available" && !!p.product_image_url && hasStock(p);
}

// The pages' own filter rule, so shelves only hold products that match what the shopper asked for.
export function matchesFilters(p, { search = "", activeCategory = "All", statusFilter = "All" } = {}) {
  return p.product_name.toLowerCase().includes(search.toLowerCase())
    && (activeCategory === "All" || p.category === activeCategory)
    && (statusFilter === "All" || p.product_status === statusFilter);
}

export function readyToShipPool(products) {
  return products.filter(isReadyToShip);
}

export function mostOrderedPool(products, rankedIds, { ordersClosed = false } = {}) {
  const byId = new Map(products.map(p => [p.id, p]));
  const out = [];
  for (const id of rankedIds ?? []) {
    const p = byId.get(id);
    if (!p || !p.product_image_url) continue;
    if (p.product_status === "Available" && !hasStock(p)) continue; // never promote a sold-out item
    if (ordersClosed && isPreorder(p)) continue;                     // its card would only say "Closed"
    out.push(p);
  }
  return out;
}

// Small seeded random generator (mulberry32), so a visit's shelves stay put while scrolling.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Keeps the ranking but mixes each block of SHELF_SIZE, so the best sellers still lead
// while the exact line-up changes from visit to visit.
function shuffleWithinBlocks(list, rand) {
  const out = [];
  for (let i = 0; i < list.length; i += SHELF_SIZE) out.push(...shuffle(list.slice(i, i + SHELF_SIZE), rand));
  return out;
}

// Products not yet shown this visit come first; already-seen ones keep their order at the back.
function unseenFirst(list, seen) {
  if (!seen?.size) return list;
  return [...list.filter(p => !seen.has(p.id)), ...list.filter(p => seen.has(p.id))];
}

// Returns `count` shelves: [{ kind: "ready" | "popular", items: [product…] }].
// Kinds alternate (ready first); when one has too few products the other continues. Each kind
// walks through its pool in order, so no product repeats until every product of that kind has
// been shown; then it starts over from the top (unseen-this-visit products first).
export function planShelves({ products, rankedIds, filters, ordersClosed = false, seed = 1, seen = new Set(), count = 0 }) {
  const rand = rng(seed);
  const match = p => matchesFilters(p, filters);
  // Browsing "Available" already lists only ready-to-deliver goods, so that shelf would just repeat it.
  const browsingAvailable = filters?.statusFilter === "Available";
  const pools = {
    ready: browsingAvailable ? [] : unseenFirst(shuffle(readyToShipPool(products).filter(match), rand), seen),
    popular: unseenFirst(shuffleWithinBlocks(mostOrderedPool(products, rankedIds, { ordersClosed }).filter(match), rand), seen),
  };
  const usable = kind => pools[kind].length >= SHELF_MIN;
  const cursor = { ready: 0, popular: 0 };
  const take = kind => {
    const pool = pools[kind];
    const n = Math.min(SHELF_SIZE, pool.length);
    const items = Array.from({ length: n }, (_, j) => pool[(cursor[kind] + j) % pool.length]);
    cursor[kind] = (cursor[kind] + n) % pool.length;
    return items;
  };

  const shelves = [];
  if (!usable("ready") && !usable("popular")) return shelves;
  for (let k = 0; k < count; k++) {
    const preferred = k % 2 === 0 ? "ready" : "popular";
    const kind = usable(preferred) ? preferred : (preferred === "ready" ? "popular" : "ready");
    shelves.push({ kind, items: take(kind) });
  }
  return shelves;
}

// How many shelves a list of `total` products needs at this spacing.
export const shelvesNeeded = (total, every) => (total < MIN_LIST ? 0 : Math.floor(total / every));

// The shelf to render right after product `i` (0-based) of a list of `total`, or null.
// One shelf after every `every` products (6 on phones and tablets, 8 on desktop), each following
// a full row. Shelf products never count towards the list positions.
export function shelfAfter(i, total, shelves, every) {
  if (!shelves.length || total < MIN_LIST || (i + 1) % every !== 0) return null;
  return shelves[(i + 1) / every - 1] ?? null;
}
