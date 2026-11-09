import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import AccountDropdown from "../AccountDropdown";
import NotificationBell from "../NotificationBell";
import CountdownDisplay from "../CountdownBanner";

const STATUS_FILTERS = ["All", "Available", "Pre-order"];

const chip = active =>
  `mbi-press inline-flex shrink-0 items-center gap-1.5 h-10 rounded-full px-4 text-sm font-semibold border ${
    active
      ? "bg-mbi-navy border-mbi-navy text-white"
      : "bg-white border-mbi-hairline text-mbi-navy-body hover:border-mbi-navy hover:text-mbi-navy"
  }`;

// Sticky shop header shared by Shop and Home (DESIGN.md "Top bar" + category chips):
// logo, search pill, cart, account; then category menu, status chips and the countdown.
export default function ShopHeader({
  logoTo = "/shop",
  showBell = true,
  search, onSearch,
  categories, activeCategory, onCategory,
  statusFilter, onStatus,
  countdownData,
}) {
  const { totalItems } = useCart();
  const { session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  function toggleMenu() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 6, left: Math.max(16, Math.min(r.left, window.innerWidth - 272)) });
    setMenuOpen(v => !v);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const inside = t => triggerRef.current?.contains(t) || listRef.current?.contains(t);
    const close = e => { if (!inside(e.target)) setMenuOpen(false); };
    const esc = e => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menuOpen]);

  const pickCategory = name => { onCategory(name); setMenuOpen(false); };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-mbi-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-2 sm:gap-4">
          <Link to={logoTo} className="shrink-0 rounded-lg" aria-label="Miss Betty Import home">
            <img src={logo} alt="Miss Betty Import" className="h-10 sm:h-11 w-auto" />
          </Link>

          <label className="relative flex-1 min-w-0 sm:max-w-xl sm:mx-auto">
            <span className="sr-only">Search products</span>
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mbi-slate" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="w-full h-11 sm:h-12 rounded-full border border-mbi-hairline bg-white pl-11 pr-4 text-base text-mbi-navy placeholder:text-mbi-slate outline-none transition-[border-color,box-shadow] duration-150 focus:border-mbi-navy focus:shadow-mbi-float"
            />
          </label>

          <Link
            to="/cart"
            aria-label={totalItems > 0 ? `Cart, ${totalItems} item${totalItems === 1 ? "" : "s"}` : "Cart"}
            className="mbi-press relative grid shrink-0 place-items-center size-11 rounded-full text-mbi-navy hover:bg-mbi-surface-soft"
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
            <div className="flex shrink-0 items-center gap-1">
              {showBell && <NotificationBell />}
              <AccountDropdown />
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link to="/login" className="mbi-press hidden sm:inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-mbi-navy hover:bg-mbi-surface-soft">
                Log in
              </Link>
              <Link to="/signup" className="mbi-press inline-flex h-11 items-center rounded-lg bg-mbi-amber px-3 sm:px-4 text-sm font-semibold text-mbi-navy hover:bg-mbi-amber-press whitespace-nowrap">
                Sign up
              </Link>
            </div>
          )}
        </div>

        <div className="flex h-14 items-center gap-2">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
            <div className="relative shrink-0">
              <button
                ref={triggerRef}
                type="button"
                onClick={toggleMenu}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                className={chip(activeCategory !== "All")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
                <span className="max-w-[11rem] truncate">{activeCategory === "All" ? "Categories" : activeCategory}</span>
                <svg className={`transition-transform duration-150 ease-mbi-out ${menuOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
            <span className="h-6 w-px shrink-0 bg-mbi-hairline" aria-hidden="true" />
            {STATUS_FILTERS.map(s => (
              <button key={s} type="button" onClick={() => onStatus(s)} aria-pressed={statusFilter === s} className={chip(statusFilter === s)}>
                {s === "All" ? "All products" : s}
              </button>
            ))}
          </div>
          {countdownData && (
            <div className="hidden lg:block shrink-0">
              <CountdownDisplay data={countdownData} />
            </div>
          )}
        </div>
      </div>

      {/* Category menu: fixed under its trigger, outside the scrolling chip row so it is never clipped. */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Categories"
        style={{ top: menuPos.top, left: menuPos.left }}
        className={`fixed z-50 w-64 max-h-80 overflow-y-auto rounded-mbi-card bg-white p-1.5 shadow-mbi-float origin-top-left transition-[opacity,transform] duration-150 ease-mbi-out ${
          menuOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[0.96]"
        }`}
      >
        {[{ category_id: "all", category_name: "All" }, ...categories].map(cat => {
          const active = activeCategory === cat.category_name;
          return (
            <button
              key={cat.category_id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => pickCategory(cat.category_name)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[15px] transition-colors duration-150 hover:bg-mbi-surface-soft ${
                active ? "font-semibold text-mbi-navy" : "text-mbi-navy-body"
              }`}
            >
              <span>{cat.category_name === "All" ? "All categories" : cat.category_name}</span>
              {active && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
