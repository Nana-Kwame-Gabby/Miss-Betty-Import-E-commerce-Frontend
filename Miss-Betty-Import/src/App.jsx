import "./App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useParams, useLocation } from "react-router-dom";
import { setPostAuthRedirect } from "./utils/postAuthRedirect";
import { CartProvider } from "./context/CartContext";
import { UserProvider } from "./context/UserContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { NotificationProvider } from "./context/NotificationContext";

const LoginPage = lazy(() => import("./components/LoginPage"));
const SignUp = lazy(() => import("./components/SignUp"));
const ForgotPasswordPage = lazy(() => import("./components/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage"));

import Layout from "./components/layout/Layout";

import HomePage from "./pages/HomePage";
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsAndConditionsPage = lazy(() => import("./pages/TermsAndConditionsPage"));
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmationPage"));
const MyOrdersPage = lazy(() => import("./pages/MyOrdersPage"));
const MyReferralsPage = lazy(() => import("./pages/MyReferralsPage"));
const ShippingFeePage = lazy(() => import("./pages/ShippingFeePage"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrderPeriodsPage = lazy(() => import("./pages/admin/AdminOrderPeriodsPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminInvoicesPage = lazy(() => import("./pages/admin/AdminInvoicesPage"));
const AdminShippingFeesPage = lazy(() => import("./pages/admin/AdminShippingFeesPage"));
const AdminOfflineBuyersPage = lazy(() => import("./pages/admin/AdminOfflineBuyersPage"));
const AdminProductRequestsPage = lazy(() => import("./pages/admin/AdminProductRequestsPage"));
const AdminSmsMessagingPage = lazy(() => import("./pages/admin/AdminSmsMessagingPage"));
const AdminAvailableOrdersPage = lazy(() => import("./pages/admin/AdminAvailableOrdersPage"));
const AdminAvailableDashboard = lazy(() => import("./pages/admin/AdminAvailableDashboard"));
const AdminPromoAlertPage = lazy(() => import("./pages/admin/AdminPromoAlertPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));
const AdminCountdownTimersPage = lazy(() => import("./pages/admin/AdminCountdownTimersPage"));
const AdminCouponsPage = lazy(() => import("./pages/admin/AdminCouponsPage"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
import ChatWidget from "./components/ChatWidget";
import AnalyticsTracker from "./components/AnalyticsTracker";
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminEmailsPage = lazy(() => import("./pages/admin/AdminEmailsPage"));
const AdminBulkEmailPage = lazy(() => import("./pages/admin/AdminBulkEmailPage"));
const ProductRequestPage = lazy(() => import("./pages/ProductRequestPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Take manual control of scroll position so the browser's own native scroll
// restoration (which can fire on back/forward) doesn't race with our per-page hooks.
if (typeof window !== "undefined" && window.history?.scrollRestoration) {
  window.history.scrollRestoration = "manual";
}

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
  const { session, loading, isAdmin, checkingCustomer } = useAuth();
  const location = useLocation();
  if (loading || checkingCustomer) return <LoadingSpinner />;
  if (!session) {
    setPostAuthRedirect(location.pathname + location.search);
    return <Navigate to={sessionStorage.getItem('oauth_denied') ? "/signup" : "/login"} replace />;
  }
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

// Old share links (/product/:id): product pages are public now, so everyone goes
// straight to the product page. (On the live site Vercel already 301-redirects these.)
function ProductShareGateway() {
  const { id } = useParams();
  return <Navigate to={`/shop/${id}`} replace />;
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
            <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Fully public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsAndConditionsPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/product/:id" element={<ProductShareGateway />} />
              {/* Public catalogue: anyone (and search engines) can browse; buying needs login */}
              <Route path="/shop" element={<ShopPage />} />
              <Route element={<Layout />}>
                <Route path="/shop/:id" element={<ProductDetailPage />} />
              </Route>
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
                  <Route path="/admin/order-periods" element={<AdminOrderPeriodsPage />} />
                  <Route path="/admin/products" element={<AdminProductsPage />} />
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/invoices" element={<AdminInvoicesPage />} />
                  <Route path="/admin/shipping-fees" element={<AdminShippingFeesPage />} />
                  <Route path="/admin/offline-buyers" element={<AdminOfflineBuyersPage />} />
                  <Route path="/admin/product-requests" element={<AdminProductRequestsPage />} />
                  <Route path="/admin/bulk-sms" element={<AdminSmsMessagingPage />} />
                  <Route path="/admin/available-orders" element={<AdminAvailableOrdersPage />} />
                  <Route path="/admin/available-dashboard" element={<AdminAvailableDashboard />} />
                  <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                  <Route path="/admin/emails" element={<AdminEmailsPage />} />
                  <Route path="/admin/bulk-email" element={<AdminBulkEmailPage />} />
                  <Route path="/admin/promo-alert" element={<AdminPromoAlertPage />} />
                  <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
                  <Route path="/admin/countdown-timers" element={<AdminCountdownTimersPage />} />
                  <Route path="/admin/coupons" element={<AdminCouponsPage />} />
                </Route>
              </Route>

              {/* Protected — customer account pages */}
              <Route element={<ProtectedLayout />}>
                <Route element={<Layout />}>
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                  <Route path="/my-orders" element={<MyOrdersPage />} />
                  <Route path="/my-referrals" element={<MyReferralsPage />} />
                  <Route path="/shipping-fees" element={<ShippingFeePage />} />
                  <Route path="/product-requests" element={<ProductRequestPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
            <ChatWidget />
            <AnalyticsTracker />
          </Router>
        </CartProvider>
        </NotificationProvider>
        </AppSettingsProvider>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;
