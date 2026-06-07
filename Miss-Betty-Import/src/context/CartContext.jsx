import { createContext, useContext, useState, useEffect, useRef } from "react";
import { hasDiscount, getEffectivePrice } from "../lib/priceUtils";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useAuth();
  const storageKey = user ? `mbimport_cart_${user.id}` : null;
  const prevStorageKeyRef = useRef(null);
  const [cartItems, setCartItems] = useState([]);

  // Load cart from localStorage when the user changes (login / logout)
  useEffect(() => {
    if (!storageKey) { setCartItems([]); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      setCartItems(saved ? JSON.parse(saved) : []);
    } catch {
      setCartItems([]);
    }
  }, [storageKey]);

  // Persist cart to localStorage on every change.
  // Skip the first run after storageKey changes so we don't overwrite the
  // stored cart with the stale empty state before the load effect re-renders.
  useEffect(() => {
    if (!storageKey) return;
    if (prevStorageKeyRef.current !== storageKey) {
      prevStorageKeyRef.current = storageKey;
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(cartItems));
  }, [cartItems, storageKey]);

  function addToCart(product, quantity, size, colour, overridePrice, sizeCostPrice, sizeProfit, sizeOriginalPrice) {
    const key          = `${product.id}-${size}-${colour}`;
    const unitPrice    = overridePrice     ?? product.unit_price;
    const costPrice    = sizeCostPrice     ?? product.cost_price ?? 0;
    const profit       = sizeProfit        ?? product.profit     ?? 0;
    const originalPrice = sizeOriginalPrice ?? null;
    setCartItems(prev => {
      const existing = prev.find(item => item.cartKey === key);
      if (existing) {
        return prev.map(item =>
          item.cartKey === key ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, unit_price: unitPrice, cost_price: costPrice, profit, original_price: originalPrice, quantity, size, colour, cartKey: key }];
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
      variants.forEach(({ product, size, colour, qty, price, costPrice, profit, originalPrice }) => {
        const key = `${product.id}-${size}-${colour}`;
        const existing = items.find(i => i.cartKey === key);
        if (existing) {
          items = items.map(i =>
            i.cartKey === key ? { ...i, quantity: i.quantity + qty } : i
          );
        } else {
          items = [...items, {
            ...product, unit_price: price, cost_price: costPrice, profit,
            original_price: originalPrice ?? null,
            quantity: qty, size, colour, cartKey: key,
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
      const newProfit       = sizeEntry?.profit     ?? item.profit     ?? 0;

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
              cost_price: newCostPrice, profit: newProfit }
          : i
      );
    });
  }

  function clearCart() {
    setCartItems([]);
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const totalSavings = cartItems.reduce((sum, item) =>
    sum + (item.original_price != null && item.original_price > item.unit_price
      ? (item.original_price - item.unit_price) * item.quantity : 0), 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, addMultipleToCart, removeFromCart, updateQuantity, updateVariant, clearCart, totalItems, subtotal, totalSavings }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
