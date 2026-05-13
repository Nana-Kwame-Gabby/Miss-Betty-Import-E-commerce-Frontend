import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { UserProvider } from "./context/UserContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import LoginPage from "./components/LoginPage";
import SignUp from "./components/SignUp";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";

import Layout from "./components/layout/Layout";

import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import MyOrdersPage from "./pages/MyOrdersPage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminInvoicesPage from "./pages/admin/AdminInvoicesPage";
import AdminLayout from "./pages/admin/AdminLayout";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedLayout() {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

function AdminGuard() {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/shop" replace />;
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* Public — auth pages */}
              <Route path="/" element={<LoginPage />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Admin — role-gated */}
              <Route element={<AdminGuard />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/products" element={<AdminProductsPage />} />
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/invoices" element={<AdminInvoicesPage />} />
                </Route>
              </Route>

              {/* Protected — all customer pages */}
              <Route element={<ProtectedLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/shop" element={<ShopPage />} />

                <Route element={<Layout />}>
                  <Route path="/shop/:id" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                  <Route path="/my-orders" element={<MyOrdersPage />} />
                </Route>
              </Route>
            </Routes>
          </Router>
        </CartProvider>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;
