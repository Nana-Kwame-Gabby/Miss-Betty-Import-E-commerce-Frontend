import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../NotificationBell";
import AccountDropdown from "../AccountDropdown";

// Site header for every page inside the customer layout (product page, cart, checkout,
// orders, …). Same chrome as the shop header (DESIGN.md "Top bar").
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems } = useCart();
  const { signOut, session } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }) =>
    `relative inline-flex h-16 items-center text-[15px] font-semibold transition-colors duration-150 ${
      isActive
        ? "text-mbi-navy after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-mbi-navy"
        : "text-mbi-navy-body hover:text-mbi-navy"
    }`;
  const mobileLink = ({ isActive }) =>
    `flex h-12 items-center rounded-lg px-3 text-base font-semibold ${isActive ? "bg-mbi-surface-soft text-mbi-navy" : "text-mbi-navy-body hover:bg-mbi-surface-soft"}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-mbi-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/shop" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Miss Betty Import shop">
            <img src={logo} alt="Miss Betty Import" className="h-10 sm:h-11 w-auto" />
            <span className="hidden sm:block text-base font-bold leading-tight text-mbi-navy">Miss Betty Import</span>
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-7">
            <NavLink to="/shop" className={navClass}>Shop</NavLink>
            {session ? (
              <>
                <NavLink to="/my-orders" className={navClass}>My orders</NavLink>
                <NavLink to="/shipping-fees" className={navClass}>Shipping fees</NavLink>
              </>
            ) : (
              <NavLink to="/contact" className={navClass}>Contact us</NavLink>
            )}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/cart"
              aria-label={totalItems > 0 ? `Cart, ${totalItems} item${totalItems === 1 ? "" : "s"}` : "Cart"}
              className="mbi-press relative grid size-11 place-items-center rounded-full text-mbi-navy hover:bg-mbi-surface-soft"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {totalItems > 0 && (
                <span className="absolute top-0.5 right-0.5 grid min-w-5 h-5 place-items-center rounded-full bg-mbi-amber px-1 text-xs font-bold leading-none text-mbi-navy tabular">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>

            {session ? (
              <>
                <NotificationBell />
                <div className="hidden sm:block">
                  <AccountDropdown />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link to="/login" className="mbi-press hidden sm:inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-mbi-navy hover:bg-mbi-surface-soft">
                  Log in
                </Link>
                <Link to="/signup" className="mbi-press inline-flex h-11 items-center rounded-lg bg-mbi-amber px-3 sm:px-4 text-sm font-semibold text-mbi-navy hover:bg-mbi-amber-press whitespace-nowrap">
                  Sign up
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="mbi-press md:hidden grid size-11 place-items-center rounded-full text-mbi-navy hover:bg-mbi-surface-soft"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav aria-label="Menu" className="md:hidden flex flex-col gap-1 border-t border-mbi-hairline-soft py-3">
            <NavLink to="/shop" className={mobileLink} onClick={closeMenu}>Shop</NavLink>
            {session && <NavLink to="/my-orders" className={mobileLink} onClick={closeMenu}>My orders</NavLink>}
            {session && <NavLink to="/shipping-fees" className={mobileLink} onClick={closeMenu}>Shipping fees</NavLink>}
            {session && <NavLink to="/my-referrals" className={mobileLink} onClick={closeMenu}>Referrals & coupons</NavLink>}
            {session && <NavLink to="/product-requests" className={mobileLink} onClick={closeMenu}>Request a product</NavLink>}
            <NavLink to="/contact" className={mobileLink} onClick={closeMenu}>Contact us</NavLink>
            <div className="my-1 border-t border-mbi-hairline-soft" />
            {session ? (
              <button
                type="button"
                onClick={async () => { closeMenu(); await signOut(); navigate("/"); }}
                className="flex h-12 items-center rounded-lg px-3 text-left text-base font-semibold text-mbi-error hover:bg-mbi-error-tint"
              >
                Sign out
              </button>
            ) : (
              <Link to="/login" onClick={closeMenu} className="flex h-12 items-center rounded-lg px-3 text-base font-semibold text-mbi-navy hover:bg-mbi-surface-soft">
                Log in
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
