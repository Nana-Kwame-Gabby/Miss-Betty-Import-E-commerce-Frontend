import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ghanaRegions = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "North East", "Savannah",
];

export default function CheckoutPage() {
  const { cartItems, subtotal, clearCart } = useCart();
  const { user } = useUser();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: user.fullName, email: user.email, phone: user.phone, region: "", town: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function validate() {
    const e = {};
    if (!form.region) e.region = "Please select a region.";
    if (!form.town.trim()) e.town = "Town / city is required.";
    return e;
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setSubmitting(true);
    setSubmitError("");

    try {
      // 1. Get customer_id
      const { data: cust, error: custError } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (custError || !cust) throw new Error("Could not find your account. Please try again.");

      // 2. Generate order_id
      const orderId = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;

      // 3. Insert one orders row per cart item
      const orderRows = cartItems.map(item => ({
        order_id: orderId,
        customer_id: cust.customer_id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        size: item.size || null,
        colour: item.colour || null,
        status: 'Pending',
        delivery_region: form.region,
        delivery_town: form.town,
        can_edit_delivery: true,
      }));

      const { error: ordersError } = await supabase.from('orders').insert(orderRows);
      if (ordersError) throw new Error(ordersError.message);

      // 4. Insert invoice rows
      const invoiceRows = cartItems.map(item => ({
        invoice_id: orderId,
        customer_name: form.fullName,
        product_name: item.product_name,
        size: item.size || null,
        colour: item.colour || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.unit_price * item.quantity,
      }));

      const { error: invoicesError } = await supabase.from('invoices').insert(invoiceRows);
      if (invoicesError) throw new Error(invoicesError.message);

      // 5. Clear cart + navigate
      clearCart();
      navigate('/order-confirmation', { state: { form, items: cartItems, subtotal, orderId } });
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <p className="text-gray-500 font-medium text-lg">Your cart is empty.</p>
        <Link to="/shop" className="mt-4 inline-block text-[#F2AA25] font-semibold hover:underline">Go Shopping</Link>
      </div>
    );
  }

  const inputClass = (field) =>
    `w-full border rounded-2xl px-4 py-2.5 text-sm outline-none transition-colors ${
      errors[field] ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[#F2AA25]"
    }`;

  const readOnlyClass =
    "w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-500 cursor-default outline-none";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <h1 className="text-xl sm:text-2xl font-bold text-[#1e2d3d] mb-5">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 flex flex-col gap-5">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="font-bold text-[#1e2d3d] text-base mb-3">Delivery Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Full Name</label>
                <input readOnly value={form.fullName} className={readOnlyClass} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Email Address</label>
                <input readOnly value={form.email} className={readOnlyClass} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Phone Number</label>
                <input readOnly value={form.phone} className={readOnlyClass} />
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  ℹ️ Pre-filled from your account. To update, use <strong>My Account</strong> in the Account menu.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Region</label>
                <select name="region" value={form.region} onChange={handleChange} className={inputClass("region")}>
                  <option value="">Select region</option>
                  {ghanaRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1e2d3d] mb-1">Town / City</label>
                <input name="town" value={form.town} onChange={handleChange} placeholder="Kumasi" className={inputClass("town")} />
                {errors.town && <p className="text-red-500 text-xs mt-1">{errors.town}</p>}
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F2AA25] text-white font-bold py-3 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Placing Order...
              </>
            ) : "Place Order"}
          </button>
        </form>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm p-4 sticky top-16">
            <h2 className="font-bold text-[#1e2d3d] text-base mb-3">Order Summary</h2>
            <div className="flex flex-col gap-2.5 mb-3">
              {cartItems.map(item => (
                <div key={item.cartKey} className="flex items-start gap-3">
                  {item.product_image_url ? (
                    <img src={item.product_image_url} alt={item.product_name} className="w-10 h-12 object-cover rounded-xl flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-12 bg-gray-100 rounded-xl flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1e2d3d] truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.size} · {item.colour} · ×{item.quantity}</p>
                    <p className="text-sm font-bold text-[#F2AA25]">GHS {(item.unit_price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Subtotal</span>
                <span>GHS {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mb-4">
                <span>Delivery</span>
                <span className="text-green-600 font-medium">To be confirmed</span>
              </div>
              <div className="flex justify-between font-bold text-[#1e2d3d] text-base">
                <span>Total</span>
                <span className="text-[#F2AA25]">GHS {subtotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
