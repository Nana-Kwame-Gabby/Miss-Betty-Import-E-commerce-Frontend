import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import MyAccountModal from "../MyAccountModal";
import DeliveryDetailsModal from "../DeliveryDetailsModal";

function AccountDropdown() {
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-[#1e2d3d] hover:border-[#F2AA25] hover:text-[#F2AA25] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        Account
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white shadow-lg rounded-2xl py-2 w-44 z-50 border border-gray-100">
          <button
            onClick={() => { setOpen(false); setShowAccount(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors text-left"
          >
            <span>👤</span> My account
          </button>
          <button
            onClick={() => { setOpen(false); setShowDelivery(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors text-left"
          >
            <span>📍</span> Delivery Details
          </button>
          <Link
            to="/my-orders"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
          >
            <span>📦</span> Orders
          </Link>
          <Link
            to="/shipping-fees"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
          >
            <span>🚚</span> Shipping Fee
          </Link>
          <Link
            to="/product-requests"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
          >
            <span>🛍️</span> Request a Product
          </Link>
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
          >
            <span>📞</span> Contact Us
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
            >
              <span>⚙️</span> Admin Panel
            </Link>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={async () => { setOpen(false); await signOut(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
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

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems } = useCart();

  const navClass = ({ isActive }) =>
    isActive
      ? "text-[#F2AA25] font-semibold border-b-2 border-[#F2AA25] pb-0.5"
      : "text-[#1e2d3d] font-medium hover:text-[#F2AA25] transition-colors";

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">

          {/* Logo */}
          <Link to="/shop" className="flex items-center gap-2 flex-shrink-0">
            <img src={logo} alt="Miss Betty Import" className="h-8 w-auto" />
            <span className="font-bold text-[#1e2d3d] hidden sm:block text-sm leading-tight">
              Miss Betty<br /><span className="text-[#F2AA25] text-xs font-semibold">Import</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5">
            <NavLink to="/shop" className={navClass}>Shop</NavLink>
            <NavLink to="/my-orders" className={navClass}>My Orders</NavLink>
            <NavLink to="/shipping-fees" className={navClass}>Shipping Fee</NavLink>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-[#1e2d3d] hover:text-[#F2AA25] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#F2AA25] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>

            {/* Account dropdown */}
            <div className="hidden sm:block">
              <AccountDropdown />
            </div>

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-[#1e2d3d]"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 flex flex-col gap-3 px-2">
            <NavLink to="/shop" className={navClass} onClick={() => setMenuOpen(false)}>Shop</NavLink>
            <NavLink to="/my-orders" className={navClass} onClick={() => setMenuOpen(false)}>My Orders</NavLink>
            <NavLink to="/shipping-fees" className={navClass} onClick={() => setMenuOpen(false)}>Shipping Fee</NavLink>
            <NavLink to="/product-requests" className={navClass} onClick={() => setMenuOpen(false)}>Request a Product</NavLink>
            <NavLink to="/contact" className={navClass} onClick={() => setMenuOpen(false)}>Contact Us</NavLink>
            <Link to="/my-orders" className="flex items-center gap-2 text-[#1e2d3d] font-medium" onClick={() => setMenuOpen(false)}>📦 Orders</Link>
            <button onClick={async () => { setMenuOpen(false); await signOut(); navigate("/"); }} className="flex items-center gap-2 text-red-500 font-medium text-left">🚪 Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
