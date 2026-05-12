import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";

const ghanaRegions = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "North East", "Savannah",
];

export default function CheckoutPage() {
  const { cartItems, subtotal, clearCart } = useCart();
  const { user } = useUser();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: user.fullName, email: user.email, phone: user.phone, region: "", town: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setSubmitting(true);
    setTimeout(() => {
      clearCart();
      navigate("/order-confirmation", { state: { form, items: cartItems, subtotal } });
    }, 1000);
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
    `w-full border rounded-2xl px-4 py-3 text-sm outline-none transition-colors ${
      errors[field] ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[#F2AA25]"
    }`;

  const readOnlyClass =
    "w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 cursor-default outline-none";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#1e2d3d] mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 flex flex-col gap-5">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-[#1e2d3d] text-lg mb-5">Delivery Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-[#1e2d3d] mb-1.5">Full Name</label>
                <input readOnly value={form.fullName} className={readOnlyClass} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1e2d3d] mb-1.5">Email Address</label>
                <input readOnly value={form.email} className={readOnlyClass} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1e2d3d] mb-1.5">Phone Number</label>
                <input readOnly value={form.phone} className={readOnlyClass} />
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  ℹ️ Pre-filled from your account. To update, use <strong>My Account</strong> in the Account menu.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1e2d3d] mb-1.5">Region</label>
                <select name="region" value={form.region} onChange={handleChange} className={inputClass("region")}>
                  <option value="">Select region</option>
                  {ghanaRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1e2d3d] mb-1.5">Town / City</label>
                <input name="town" value={form.town} onChange={handleChange} placeholder="Kumasi" className={inputClass("town")} />
                {errors.town && <p className="text-red-500 text-xs mt-1">{errors.town}</p>}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F2AA25] text-white font-bold py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
            <h2 className="font-bold text-[#1e2d3d] text-lg mb-5">Order Summary</h2>
            <div className="flex flex-col gap-3 mb-5">
              {cartItems.map(item => (
                <div key={item.cartKey} className="flex items-start gap-3">
                  <img src={item.product_image_url} alt={item.product_name} className="w-12 h-14 object-cover rounded-xl flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1e2d3d] truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.size} · {item.colour} · ×{item.quantity}</p>
                    <p className="text-sm font-bold text-[#F2AA25]">GHS {(item.unit_price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4">
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
