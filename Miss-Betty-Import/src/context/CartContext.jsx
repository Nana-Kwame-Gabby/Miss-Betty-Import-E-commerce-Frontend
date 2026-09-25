import { createContext, useContext, useState, useEffect, useRef } from "react";
import { hasDiscount, getEffectivePrice, getItemProfit } from "../lib/priceUtils";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";

const CartContext = createContext();

const CACHE_PREFIX    = "mbimport_cart_";          // per-device copy for instant display on load
const MIGRATED_PREFIX = "mbimport_cart_migrated_"; // set once this device's old local cart is merged
const SAVE_DELAY_MS   = 400;

function readLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// Key-order-independent JSON: Postgres jsonb reorders object keys, so plain
// JSON.stringify can't tell our own saved cart apart from a real remote change.
function stableJson(value) {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  );
}

// Merge a device's pre-sync local cart into the account cart. Same variant on both:
// keep the larger quantity rather than adding them, so nothing is doubled.
function mergeCarts(accountItems, localItems) {
  const byKey = new Map(accountItems.map(i => [i.cartKey, i]));
  for (const item of localItems) {
    const existing = byKey.get(item.cartKey);
    byKey.set(item.cartKey, existing
      ? { ...existing, quantity: Math.max(existing.quantity, item.quantity) }
      : item);
  }
  return [...byKey.values()];
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [cartItems, setCartItems] = useState([]);
  // userId whose cart has been loaded from the database; saving waits for this so an
  // empty/cached cart never overwrites the account cart before it has been read.
  const [loadedFor, setLoadedFor] = useState(null);
  const lastSyncedRef = useRef(null); // stableJson of the cart as last read from / written to the DB

  // Load the account cart from the database on login (cached copy shows meanwhile).
  useEffect(() => {
    lastSyncedRef.current = null;
    setLoadedFor(null);
    if (!userId) { setCartItems([]); return; }

    const cached = readLocal(CACHE_PREFIX + userId, []);
    setCartItems(cached);

    let cancelled = false;
    supabase.from("carts").select("items").eq("user_id", userId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[cart] could not load account cart:", error.message);
          return;
        }
        const accountItems = Array.isArray(data?.items) ? data.items : [];
        let items = accountItems;
        // One-time per device: fold in the cart this browser kept before carts synced.
        if (!readLocal(MIGRATED_PREFIX + userId, false)) {
          items = mergeCarts(accountItems, cached);
          writeLocal(MIGRATED_PREFIX + userId, true);
        }
        lastSyncedRef.current = stableJson(accountItems);
        setCartItems(items);
        setLoadedFor(userId);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Save every change to the account (debounced) and to the device cache.
  useEffect(() => {
    if (!userId || loadedFor !== userId) return;
    writeLocal(CACHE_PREFIX + userId, cartItems);
    const json = stableJson(cartItems);
    if (json === lastSyncedRef.current) return;
    const timer = setTimeout(async () => {
      lastSyncedRef.current = json;
      const { error } = await supabase.from("carts").upsert({
        user_id: userId, items: cartItems, updated_at: new Date().toISOString(),
      });
      if (error) {
        console.warn("[cart] could not save account cart:", error.message);
        lastSyncedRef.current = null; // retry on the next change
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cartItems, userId, loadedFor]);

  // Live updates from the customer's other devices.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`cart_${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "carts", filter: `user_id=eq.${userId}` },
        payload => {
          const items = payload.new?.items;
          if (!Array.isArray(items)) return;
          const json = stableJson(items);
          if (json === lastSyncedRef.current) return; // our own save echoing back
          lastSyncedRef.current = json;
          setCartItems(items);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function addToCart(product, quantity, size, colour, overridePrice, sizeCostPrice, sizeProfit, sizeOriginalPrice, sizeRmbPrice, sizeMiscAmount) {
    const key          = `${product.id}-${size}-${colour}`;
    const unitPrice    = overridePrice     ?? product.unit_price;
    const costPrice    = sizeCostPrice     ?? product.cost_price ?? 0;
    const originalPrice = sizeOriginalPrice ?? null;
    const rmbPrice     = sizeRmbPrice      ?? product.rmb_price ?? 0;
    const miscAmount   = sizeMiscAmount    ?? product.misc_amount ?? 0;
    const profit       = getItemProfit({ unit_price: unitPrice, cost_price: costPrice, misc_amount: miscAmount });
    setCartItems(prev => {
      const existing = prev.find(item => item.cartKey === key);
      if (existing) {
        return prev.map(item =>
          item.cartKey === key ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, unit_price: unitPrice, cost_price: costPrice, profit, original_price: originalPrice, rmb_price: rmbPrice, misc_amount: miscAmount, quantity, size, colour, cartKey: key, added_at: new Date().toISOString() }];
    });
  }

  function removeFromCart(cartKey) {
    setCartItems(prev => prev.filter(item => item.cartKey !== cartKey));
  }

  function updateQuantity(cartKey, qty) {
    setCartItems(prev =>
      prev.map(item => item.cartKey === cartKey ? { ...item, quantity: Math.max(1, qty) } : item)
    );
  }

  function addMultipleToCart(variants) {
    setCartItems(prev => {
      let items = [...prev];
      variants.forEach(({ product, size, colour, qty, price, costPrice, profit, originalPrice, rmbPrice, miscAmount }) => {
        const key = `${product.id}-${size}-${colour}`;
        const existing = items.find(i => i.cartKey === key);
        if (existing) {
          items = items.map(i =>
            i.cartKey === key ? { ...i, quantity: i.quantity + qty } : i
          );
        } else {
          items = [...items, {
            ...product, unit_price: price, cost_price: costPrice, profit: getItemProfit({ unit_price: price, cost_price: costPrice, misc_amount: miscAmount ?? 0 }),
            original_price: originalPrice ?? null,
            rmb_price: rmbPrice ?? 0,
            misc_amount: miscAmount ?? 0,
            quantity: qty, size, colour, cartKey: key, added_at: new Date().toISOString(),
          }];
        }
      });
      return items;
    });
  }

  function updateVariant(cartKey, newSize, newColour) {
    setCartItems(prev => {
      const item = prev.find(i => i.cartKey === cartKey);
      if (!item) return prev;

      const newKey = `${item.id}-${newSize}-${newColour}`;
      if (newKey === cartKey) return prev;

      const sizeEntry       = item.sizePricing?.find(sp => sp.size === newSize) ?? null;
      const newUnitPrice    = sizeEntry ? getEffectivePrice(sizeEntry) : item.unit_price;
      const newOriginalPrice = sizeEntry && hasDiscount(sizeEntry) ? (sizeEntry.selling_price ?? sizeEntry.price) : null;
      const newCostPrice    = sizeEntry?.cost_price ?? item.cost_price ?? 0;
      const newRmbPrice     = sizeEntry?.rmb_price ?? item.rmb_price ?? 0;
      const newMiscAmount   = sizeEntry?.misc_amount ?? item.misc_amount ?? 0;
      const newProfit       = getItemProfit({ unit_price: newUnitPrice, cost_price: newCostPrice, misc_amount: newMiscAmount });

      const existingAtNewKey = prev.find(i => i.cartKey === newKey);
      if (existingAtNewKey) {
        return prev
          .filter(i => i.cartKey !== cartKey)
          .map(i => i.cartKey === newKey
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
          );
      }

      return prev.map(i =>
        i.cartKey === cartKey
          ? { ...i, size: newSize, colour: newColour, cartKey: newKey,
              unit_price: newUnitPrice, original_price: newOriginalPrice,
              cost_price: newCostPrice, profit: newProfit, rmb_price: newRmbPrice,
              misc_amount: newMiscAmount }
          : i
      );
    });
  }

  function clearCart() {
    setCartItems([]);
  }

  function removeCartKeys(keys) {
    const keySet = new Set(keys);
    setCartItems(prev => prev.filter(item => !keySet.has(item.cartKey)));
  }

  // On login, clean up any cart items that were successfully purchased (server-side callback
  // may have created the order before the customer reached the confirmation page).
  // Runs once the account cart has loaded. An item is only removed if it was added before
  // that order was placed, so a variant re-added after buying it stays in the cart.
  useEffect(() => {
    if (!userId || loadedFor !== userId) return;

    const cleanedKey = `mbimport_cleaned_orders_${userId}`;
    const alreadyCleaned = readLocal(cleanedKey, []);

    supabase
      .from('pending_orders')
      .select('order_id, items, created_at')
      .not('processed_at', 'is', null)
      .then(({ data }) => {
        if (!data?.length) return;
        const fresh = data.filter(p => !alreadyCleaned.includes(p.order_id));
        if (!fresh.length) return;

        const purchasedAt = {}; // cartKey -> latest time an order containing it was placed
        fresh.forEach(p =>
          (p.items || []).forEach(item => {
            if (!item.cartKey || item.cartKey.startsWith('buynow-')) return;
            if (!purchasedAt[item.cartKey] || p.created_at > purchasedAt[item.cartKey])
              purchasedAt[item.cartKey] = p.created_at;
          })
        );

        setCartItems(prev => prev.filter(item => {
          const orderedAt = purchasedAt[item.cartKey];
          if (!orderedAt) return true;
          // Items saved before carts had timestamps are treated as already purchased.
          return item.added_at != null && new Date(item.added_at) > new Date(orderedAt);
        }));

        writeLocal(cleanedKey, [...alreadyCleaned, ...fresh.map(p => p.order_id)]);
      });
  }, [userId, loadedFor]);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const totalSavings = cartItems.reduce((sum, item) =>
    sum + (item.original_price != null && item.original_price > item.unit_price
      ? (item.original_price - item.unit_price) * item.quantity : 0), 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, addMultipleToCart, removeFromCart, updateQuantity, updateVariant, clearCart, removeCartKeys, totalItems, subtotal, totalSavings }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
