import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DeliveryDetailsModal from "./DeliveryDetailsModal";

export default function BottomNav() {
  const { session } = useAuth();
  const [showDelivery, setShowDelivery] = useState(false);

  if (!session) return null;

  const linkClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 flex-1 py-2 text-[10px] font-semibold transition-colors ${
      isActive ? "text-[#F2AA25]" : "text-gray-400 hover:text-[#1e2d3d]"
    }`;

  const btnClass =
    "flex flex-col items-center gap-0.5 flex-1 py-2 text-[10px] font-semibold text-gray-400 hover:text-[#1e2d3d] transition-colors";

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex items-center h-16">
        {/* Shop */}
        <NavLink to="/shop" className={linkClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          Shop
        </NavLink>

        {/* My Orders */}
        <NavLink to="/my-orders" className={linkClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          My Orders
        </NavLink>

        {/* Shipping Fee */}
        <NavLink to="/shipping-fees" className={linkClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          Shipping Fee
        </NavLink>

        {/* Delivery Details */}
        <button className={btnClass} onClick={() => setShowDelivery(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Delivery
        </button>
      </nav>

      {showDelivery && (
        <DeliveryDetailsModal onClose={() => setShowDelivery(false)} />
      )}
    </>
  );
}
