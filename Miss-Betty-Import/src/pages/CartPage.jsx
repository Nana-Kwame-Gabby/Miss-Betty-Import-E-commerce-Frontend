import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, subtotal } = useCart();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-3">🛒</div>
        <h2 className="text-xl font-bold text-[#1e2d3d] mb-2">Your cart is empty</h2>
        <p className="text-gray-400 mb-8">Looks like you haven't added anything yet.</p>
        <Link
          to="/shop"
          className="inline-block bg-[#F2AA25] text-white font-bold px-6 py-2.5 rounded-2xl hover:opacity-90 transition-opacity"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <h1 className="text-xl sm:text-2xl font-bold text-[#1e2d3d] mb-5">
        My Cart <span className="text-gray-400 text-xl font-normal">({cartItems.length} {cartItems.length === 1 ? "item" : "items"})</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Items list */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {cartItems.map(item => (
            <div key={item.cartKey} className="bg-white rounded-2xl shadow-sm p-3 flex gap-3 items-start">
              <img
                src={item.product_image_url}
                alt={item.product_name}
                className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-xl flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#1e2d3d] truncate">{item.product_name}</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {item.size !== "One Size" && <span>Size: <strong>{item.size}</strong> · </span>}
                  Colour: <strong>{item.colour}</strong>
                </p>
                <p className="text-[#F2AA25] font-bold mt-1">GHS {item.unit_price.toLocaleString()}</p>

                <div className="flex items-center justify-between mt-3">
                  {/* Quantity stepper */}
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2 py-1">
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]"
                    >−</button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center font-bold text-[#1e2d3d] hover:text-[#F2AA25]"
                    >+</button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-[#1e2d3d]">
                      GHS {(item.unit_price * item.quantity).toLocaleString()}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.cartKey)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                      aria-label="Remove item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm p-4 sticky top-24">
            <h2 className="font-bold text-[#1e2d3d] text-base mb-3">Order Summary</h2>
            <div className="flex flex-col gap-2 text-sm mb-3">
              {cartItems.map(item => (
                <div key={item.cartKey} className="flex justify-between text-gray-600">
                  <span className="truncate flex-1 mr-2">{item.product_name} × {item.quantity}</span>
                  <span className="font-medium flex-shrink-0">GHS {(item.unit_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 mb-3">
              <div className="flex justify-between font-bold text-[#1e2d3d] text-base">
                <span>Subtotal</span>
                <span className="text-[#F2AA25]">GHS {subtotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Delivery fee calculated at checkout</p>
            </div>
            <button
              onClick={() => navigate("/checkout")}
              className="w-full bg-[#F2AA25] text-white font-bold py-3 rounded-2xl hover:opacity-90 transition-opacity"
            >
              Proceed to Checkout
            </button>
            <Link
              to="/shop"
              className="block text-center text-sm text-[#1e2d3d] font-medium mt-3 hover:text-[#F2AA25] transition-colors"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
