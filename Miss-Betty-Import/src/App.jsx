import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { UserProvider } from "./context/UserContext";

import LoginPage from "./components/LoginPage";
import SignUp from "./components/SignUp";

import Layout from "./components/layout/Layout";

import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import MyOrdersPage from "./pages/MyOrdersPage";

function App() {
  return (
    <UserProvider>
    <CartProvider>
      <Router>
        <Routes>
          {/* Auth — no layout */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Standalone pages — own header & footer */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />

          {/* Customer pages — Navbar + Footer via Layout */}
          <Route element={<Layout />}>
            <Route path="/shop/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            <Route path="/my-orders" element={<MyOrdersPage />} />
          </Route>
        </Routes>
      </Router>
    </CartProvider>
    </UserProvider>
  );
}

export default App;
