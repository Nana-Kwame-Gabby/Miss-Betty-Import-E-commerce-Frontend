import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MyAccountModal from "./MyAccountModal";
import DeliveryDetailsModal from "./DeliveryDetailsModal";

// One stroke icon set (DESIGN.md: no emoji as icons).
const ICONS = {
  account:  <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  delivery: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  orders:   <><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></>,
  shipping: <><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
  referral: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M12 8c-2.5 0-4-1.2-4-2.6S9.2 3 10.5 4.2 12 8 12 8Zm0 0c2.5 0 4-1.2 4-2.6S14.8 3 13.5 4.2 12 8 12 8Z"/></>,
  request:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6"/><path d="M8 11h6"/></>,
  contact:  <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  admin:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  signout:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
};
const Icon = ({ name }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-mbi-slate group-hover:text-mbi-navy">
    {ICONS[name]}
  </svg>
);

const item = "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] text-mbi-navy transition-colors duration-150 hover:bg-mbi-surface-soft";

// Account menu used by every customer header (shop header and site navbar).
export default function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const { signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", handleOutside); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => setOpen(false);
  const links = [
    ["/my-orders", "orders", "Orders"],
    ["/shipping-fees", "shipping", "Shipping fees"],
    ["/my-referrals", "referral", "Referrals & coupons"],
    ["/product-requests", "request", "Request a product"],
    ["/contact", "contact", "Contact us"],
  ];

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="mbi-press inline-flex h-11 items-center gap-1.5 rounded-full border border-mbi-hairline bg-white pl-3 pr-2.5 text-sm font-semibold text-mbi-navy hover:border-mbi-navy whitespace-nowrap"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span className="hidden sm:inline">Account</span>
        <svg className={`transition-transform duration-150 ease-mbi-out ${open ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-mbi-card bg-white p-1.5 shadow-mbi-float transition-[opacity,transform] duration-150 ease-mbi-out starting:scale-[0.96] starting:opacity-0">
          <button type="button" role="menuitem" onClick={() => { close(); setShowAccount(true); }} className={item}>
            <Icon name="account" /> My account
          </button>
          <button type="button" role="menuitem" onClick={() => { close(); setShowDelivery(true); }} className={item}>
            <Icon name="delivery" /> Delivery details
          </button>
          {links.map(([to, icon, label]) => (
            <Link key={to} to={to} role="menuitem" onClick={close} className={item}>
              <Icon name={icon} /> {label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" role="menuitem" onClick={close} className={item}>
              <Icon name="admin" /> Admin panel
            </Link>
          )}
          <div className="my-1.5 border-t border-mbi-hairline-soft" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => { close(); await signOut(); navigate("/"); }}
            className={`${item} text-mbi-error hover:bg-mbi-error-tint`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">{ICONS.signout}</svg>
            Sign out
          </button>
        </div>
      )}

      {showAccount  && <MyAccountModal      onClose={() => setShowAccount(false)}  />}
      {showDelivery && <DeliveryDetailsModal onClose={() => setShowDelivery(false)} />}
    </div>
  );
}
