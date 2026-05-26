import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);

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
