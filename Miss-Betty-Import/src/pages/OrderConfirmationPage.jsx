import { useLocation, Link } from "react-router-dom";

export default function OrderConfirmationPage() {
  const { state } = useLocation();
  const orderId = state?.orderId ?? '—';

  if (!state) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">📋</p>
        <p className="text-gray-500 font-medium text-lg">No order details found.</p>
        <Link to="/shop" className="mt-4 inline-block text-[#F2AA25] font-semibold hover:underline">Go Shopping</Link>
      </div>
    );
  }

  const { form, items, subtotal } = state;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Success card */}
      <div className="bg-white rounded-2xl shadow-sm p-5 text-center mb-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1e2d3d] mb-1.5">Order Placed! 🎉</h1>
        <p className="text-gray-500 mb-3">
          Thank you, <strong>{form.fullName}</strong>! Your order has been received and is being processed.
        </p>
        <div className="inline-block bg-gray-50 border border-gray-100 rounded-xl px-4 py-2">
          <p className="text-xs text-gray-400 font-medium">Order ID</p>
          <p className="text-[#F2AA25] font-bold text-base">{orderId}</p>
        </div>
      </div>

      {/* Order details */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="font-bold text-[#1e2d3d] mb-3">Order Details</h2>
        <div className="flex flex-col gap-2.5 mb-3">
          {items.map(item => (
            <div key={item.cartKey} className="flex items-center gap-3">
              {item.product_image_url ? (
                <img src={item.product_image_url} alt={item.product_name} className="w-10 h-12 object-cover rounded-xl" />
              ) : (
                <div className="w-10 h-12 bg-gray-100 rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1e2d3d] truncate">{item.product_name}</p>
                <p className="text-xs text-gray-400">{item.size} · {item.colour} · ×{item.quantity}</p>
              </div>
              <p className="text-sm font-bold text-[#1e2d3d] flex-shrink-0">
                GHS {(item.unit_price * item.quantity).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-[#1e2d3d]">
          <span>Total</span>
          <span className="text-[#F2AA25]">GHS {subtotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Delivery info */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="font-bold text-[#1e2d3d] mb-2">Delivery To</h2>
        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p><strong>{form.fullName}</strong></p>
          <p>{form.email}</p>
          <p>{form.phone}</p>
          <p>{form.town}, {form.region}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/shop"
          className="flex-1 text-center bg-[#F2AA25] text-white font-bold py-3 rounded-2xl hover:opacity-90 transition-opacity"
        >
          Continue Shopping
        </Link>
        <Link
          to="/my-orders"
          className="flex-1 text-center border-2 border-[#1e2d3d] text-[#1e2d3d] font-bold py-3 rounded-2xl hover:bg-[#1e2d3d] hover:text-white transition-colors"
        >
          View My Orders
        </Link>
      </div>
    </div>
  );
}
