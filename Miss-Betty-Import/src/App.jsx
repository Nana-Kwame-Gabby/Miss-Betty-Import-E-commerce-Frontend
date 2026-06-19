import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { UserProvider } from "./context/UserContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";

import LoginPage from "./components/LoginPage";
import SignUp from "./components/SignUp";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";

import Layout from "./components/layout/Layout";

import HomePage from "./pages/HomePage";
import ContactPage from "./pages/ContactPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsAndConditionsPage from "./pages/TermsAndConditionsPage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import MyOrdersPage from "./pages/MyOrdersPage";
import ShippingFeePage from "./pages/ShippingFeePage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminInvoicesPage from "./pages/admin/AdminInvoicesPage";
import AdminShippingFeesPage from "./pages/admin/AdminShippingFeesPage";
import AdminProductRequestsPage from "./pages/admin/AdminProductRequestsPage";
import AdminBulkSmsPage from "./pages/admin/AdminBulkSmsPage";
import AdminLayout from "./pages/admin/AdminLayout";
import ProductRequestPage from "./pages/ProductRequestPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PublicOnlyRoute() {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (session) return <Navigate to={isAdmin ? "/admin" : "/shop"} replace />;
  return <Outlet />;
}

function ProtectedLayout() {
  const { session, loading, isAdmin, emailVerified } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!emailVerified) return <Navigate to="/verify-email" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

function AdminGuard() {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/shop" replace />;
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <AppSettingsProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* Fully public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsAndConditionsPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              {/* Public-only — redirect to /shop if already logged in */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

              {/* Admin — role-gated */}
              <Route element={<AdminGuard />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/products" element={<AdminProductsPage />} />
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/invoices" element={<AdminInvoicesPage />} />
                  <Route path="/admin/shipping-fees" element={<AdminShippingFeesPage />} />
                  <Route path="/admin/product-requests" element={<AdminProductRequestsPage />} />
                  <Route path="/admin/bulk-sms" element={<AdminBulkSmsPage />} />
                </Route>
              </Route>

              {/* Protected — all customer pages */}
              <Route element={<ProtectedLayout />}>
                <Route path="/shop" element={<ShopPage />} />

                <Route element={<Layout />}>
                  <Route path="/shop/:id" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                  <Route path="/my-orders" element={<MyOrdersPage />} />
                  <Route path="/shipping-fees" element={<ShippingFeePage />} />
                  <Route path="/product-requests" element={<ProductRequestPage />} />
                </Route>
              </Route>
            </Routes>
          </Router>
        </CartProvider>
        </AppSettingsProvider>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;
