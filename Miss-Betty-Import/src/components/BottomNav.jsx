import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DeliveryDetailsModal from "./DeliveryDetailsModal";

// Bottom tab bar for logged-in shoppers. Active tab: navy label with an amber marker
// (amber text on white fails contrast, so amber is only the marker).
export default function BottomNav() {
  const { session } = useAuth();
  const [showDelivery, setShowDelivery] = useState(false);

  if (!session) return null;

  const tab = "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors duration-150";
  const linkClass = ({ isActive }) =>
    `${tab} ${isActive
      ? "text-mbi-navy before:absolute before:top-0 before:h-[3px] before:w-10 before:rounded-b-full before:bg-mbi-amber"
      : "text-mbi-slate hover:text-mbi-navy"}`;

  return (
    <>
      <nav aria-label="Account shortcuts" className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t border-mbi-hairline bg-white pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/shop" className={linkClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          Shop
        </NavLink>

        <NavLink to="/my-orders" className={linkClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          My orders
        </NavLink>

        <NavLink to="/shipping-fees" className={linkClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="3" width="15" height="13"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          Shipping fees
        </NavLink>

        <button type="button" className={`${tab} text-mbi-slate hover:text-mbi-navy`} onClick={() => setShowDelivery(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
