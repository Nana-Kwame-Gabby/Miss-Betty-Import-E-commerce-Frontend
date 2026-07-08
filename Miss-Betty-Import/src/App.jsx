import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { UserProvider } from "./context/UserContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { NotificationProvider } from "./context/NotificationContext";

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
import AdminSmsMessagingPage from "./pages/admin/AdminSmsMessagingPage";
import AdminAvailableOrdersPage from "./pages/admin/AdminAvailableOrdersPage";
import AdminPromoAlertPage from "./pages/admin/AdminPromoAlertPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminLayout from "./pages/admin/AdminLayout";
import ProductRequestPage from "./pages/ProductRequestPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

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
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace />;
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
        <NotificationProvider>
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
              {/* Public-only — redirect to /shop if already logged in */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
                  <Route path="/admin/bulk-sms" element={<AdminSmsMessagingPage />} />
                  <Route path="/admin/available-orders" element={<AdminAvailableOrdersPage />} />
                  <Route path="/admin/promo-alert" element={<AdminPromoAlertPage />} />
                  <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
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
        </NotificationProvider>
        </AppSettingsProvider>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;
