import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { categories, products, colourMap } from "../data/mockData";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import MyAccountModal from "../components/MyAccountModal";

function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const { signOut } = useAuth();
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
          <Link
            to="/my-orders"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1e2d3d] hover:bg-gray-50 transition-colors"
          >
            <span>📦</span> Orders
          </Link>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={async () => { setOpen(false); await signOut(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <span>🚪</span> Sign out
          </button>
        </div>
      )}

      {showAccount && <MyAccountModal onClose={() => setShowAccount(false)} />}
    </div>
  );
}

function ProductDetailModal({ product, onClose }) {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [selectedColour, setSelectedColour] = useState(product.colours[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleAdd() {
    addToCart(product, qty, selectedSize, selectedColour);
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 1500);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            {product.category}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Image */}
        <div className="relative">
          <img
            src={product.product_image_url}
            alt={product.product_name}
            className="w-full h-48 sm:h-64 object-cover"
          />
          <span
            className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${
              product.product_status === "Available"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {product.product_status}
          </span>
        </div>

        {/* Details */}
        <div className="px-4 py-3">
          <h2 className="font-bold text-[#1e2d3d] text-lg mb-1 leading-snug">
            {product.product_name}
          </h2>
          <p className="text-[#F2AA25] font-bold text-xl mb-3">
            GHS {product.unit_price.toLocaleString()}
          </p>
          <p className="text-gray-500 text-sm leading-relaxed mb-3">
            {product.description}
          </p>

          {/* Size */}
          {product.sizes.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Size</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      selectedSize === s
                        ? "bg-[#1e2d3d] text-white"
                        : "border border-gray-300 text-gray-600 hover:border-[#1e2d3d]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colour */}
          {product.colours.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Colour: <span className="font-normal normal-case text-gray-500">{selectedColour}</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {product.colours.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColour(c)}
                    title={c}
                    className={`w-7 h-7 rounded-full transition-all ${
                      selectedColour === c
                        ? "ring-2 ring-offset-2 ring-[#1e2d3d] scale-110"
                        : "hover:scale-105"
                    } ${c === "White" ? "border border-gray-200" : ""}`}
                    style={{ backgroundColor: colourMap[c] || "#ccc" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3 pb-2">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none"
              >
                −
              </button>
              <span className="px-3 py-2 text-sm font-semibold text-[#1e2d3d] min-w-[2rem] text-center">
                {qty}
              </span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              className={`flex-1 font-semibold py-2 rounded-xl text-sm transition-colors ${
                added ? "bg-green-500 text-white" : "bg-[#F2AA25] text-white hover:opacity-90"
              }`}
            >
              {added ? "✓ Added to cart!" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, onSelect }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd(e) {
    e.stopPropagation();
    addToCart(product, 1, product.sizes[0], product.colours[0]);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col cursor-pointer"
      onClick={() => onSelect(product)}
    >
      <div className="relative overflow-hidden">
        <img
          src={product.product_image_url}
          alt={product.product_name}
          className="w-full h-36 sm:h-44 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span
          className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
            product.product_status === "Available"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {product.product_status}
        </span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col flex-1">
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full w-fit mb-1 truncate max-w-full">
          {product.category}
        </span>
        <h3 className="font-semibold text-[#1e2d3d] text-xs sm:text-sm mb-0.5 line-clamp-2 flex-1">
          {product.product_name}
        </h3>
        <p className="text-[#F2AA25] font-bold text-sm sm:text-base mb-2">
          GHS {product.unit_price.toLocaleString()}
        </p>
        <button
          onClick={handleAdd}
          className={`w-full font-semibold py-1.5 rounded-xl text-sm transition-colors ${
            added ? "bg-green-500 text-white" : "bg-[#F2AA25] text-white hover:opacity-90"
          }`}
        >
          {added ? "✓ Added!" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { totalItems } = useCart();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.product_name.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchStatus = statusFilter === "All" || p.product_status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [search, activeCategory, statusFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .spin-vertical {
          animation: spinY 5s linear infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
        @keyframes spinY {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 22s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Marquee banner */}
      <div className="bg-[#F2AA25] py-1.5 overflow-hidden">
        <div className="marquee-track">
          {[1, 2].map(i => (
            <span key={i} className="text-white font-semibold text-sm whitespace-nowrap px-8">
              Browse our latest imported products — quality items delivered to your door
              &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;
              Browse our latest imported products — quality items delivered to your door
              &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Logo */}
            <Link to="/shop" className="flex-shrink-0">
              <img src={logo} alt="Miss Betty Import" className="h-8 sm:h-9 w-auto spin-vertical" />
            </Link>

            {/* Search */}
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors"
              />
            </div>

            {/* Cart */}
            <Link to="/cart" className="relative flex-shrink-0 p-1.5 text-[#1e2d3d] hover:text-[#F2AA25] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#F2AA25] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>

            {/* Account */}
            <AccountDropdown />
          </div>
        </div>
      </header>

      {/* Category pills */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory("All")}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === "All"
                  ? "bg-[#1e2d3d] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat.name
                    ? "bg-[#1e2d3d] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products section */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* Status filter + count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <p className="text-gray-400 text-sm">
            {filtered.length} {filtered.length === 1 ? "product" : "products"} found
          </p>
          <div className="flex gap-2">
            {["All", "Available", "Pre-order"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-[#F2AA25] text-white"
                    : "border border-gray-300 text-gray-600 hover:border-[#F2AA25]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {filtered.map(p => <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />)}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-semibold text-[#1e2d3d] text-lg">No products found</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search term or filter.</p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("All"); setStatusFilter("All"); }}
              className="mt-4 text-[#F2AA25] font-semibold hover:underline text-sm"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      {/* Footer */}
      <footer className="bg-[#1e2d3d] text-white px-4 py-7">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            Miss Betty Import is a duly registered business with the Office of the
            Registrar of Companies, Republic of Ghana, under the Registration of
            Business Names Act, 1962 (Act 151).
          </p>
          <div className="flex justify-center items-center gap-4 sm:gap-8 flex-wrap mb-4 text-sm">
            <a
              href="https://wa.me/233200000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#F2AA25] font-semibold hover:underline"
            >
              <span>💬</span> Chat with us
            </a>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <a href="/terms" className="text-gray-300 hover:text-[#F2AA25] transition-colors">
              Terms and conditions
            </a>
          </div>
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} Miss Betty Import. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
