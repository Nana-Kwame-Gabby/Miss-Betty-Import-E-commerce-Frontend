import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MyAccountModal from "./MyAccountModal";
import DeliveryDetailsModal from "./DeliveryDetailsModal";

export default function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const { signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-[#1e2d3d] hover:border-[#F2AA25] hover:text-[#F2AA25] transition-colors whitespace-nowrap"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="hidden sm:inline">Account</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white shadow-lg rounded-2xl py-2 w-44 z-50 border border-gray-100">
          <button
            onClick={() => { setOpen(false); setShowAccount(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors text-left"
          >
            <span>👤</span> My account
          </button>
          <button
            onClick={() => { setOpen(false); setShowDelivery(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors text-left"
          >
            <span>📍</span> Delivery Details
          </button>
          <Link
            to="/my-orders"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
          >
            <span>📦</span> Orders
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
            >
              <span>⚙️</span> Admin Panel
            </Link>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={async () => { setOpen(false); await signOut(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <span>🚪</span> Sign out
          </button>
        </div>
      )}

      {showAccount  && <MyAccountModal      onClose={() => setShowAccount(false)}  />}
      {showDelivery && <DeliveryDetailsModal onClose={() => setShowDelivery(false)} />}
    </div>
  );
}
