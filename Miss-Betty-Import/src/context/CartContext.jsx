import { createContext, useContext, useState, useEffect, useRef } from "react";
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

  function addToCart(product, quantity, size, colour) {
    const key = `${product.id}-${size}-${colour}`;
    setCartItems(prev => {
      const existing = prev.find(item => item.cartKey === key);
      if (existing) {
        return prev.map(item =>
          item.cartKey === key ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity, size, colour, cartKey: key }];
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

  function clearCart() {
    setCartItems([]);
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
