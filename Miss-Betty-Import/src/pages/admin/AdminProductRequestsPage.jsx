import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const STATUS_STYLES = {
  Pending:   "bg-yellow-100 text-yellow-700",
  Reviewing: "bg-blue-100 text-blue-700",
  Sourced:   "bg-green-100 text-green-700",
  Declined:  "bg-red-100 text-red-700",
};
const STATUSES = ["Pending", "Reviewing", "Sourced", "Declined"];

function LightboxModal({ src, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <img src={src} alt="Product request" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors text-xl">×</button>
    </div>
  );
}

function ImageThumb({ url }) {
  const [lightbox, setLightbox] = useState(false);
  if (!url) {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }
  return (
    <>
      <img
        src={url}
        alt="request"
        onClick={() => setLightbox(true)}
        className="w-16 h-16 object-cover rounded-xl border border-gray-200 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
      />
      {lightbox && <LightboxModal src={url} onClose={() => setLightbox(false)} />}
    </>
  );
}

function ConfirmDeleteModal({ request, onConfirm, onCancel, deleting }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </div>
        <h3 className="text-base font-bold text-[#1e2d3d] text-center mb-1">Delete Request?</h3>
        <p className="text-sm text-gray-500 text-center mb-5">
          "<span className="font-semibold text-[#1e2d3d]">{request.product_name}</span>" will be permanently deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-2xl text-sm hover:border-gray-400 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-2xl text-sm hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Deleting…
              </>
            ) : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProductRequestsPage() {
  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null); // request to delete
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("product_requests")
        .select("*, customers(customer_name)")
        .order("created_at", { ascending: false });
      setRequests(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleStatusChange(id, status) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    await supabase.from("product_requests").update({ status }).eq("id", id);
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);

    // Delete image from storage if present
    if (confirmTarget.image_url) {
      const marker = "/object/public/product-requests/";
      const idx    = confirmTarget.image_url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = confirmTarget.image_url.slice(idx + marker.length);
        await supabase.storage.from("product-requests").remove([storagePath]);
      }
    }

    const { error } = await supabase
      .from("product_requests")
      .delete()
      .eq("id", confirmTarget.id);

    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== confirmTarget.id));
      setConfirmTarget(null);
    }
    setDeleting(false);
  }

  const filtered = requests.filter(r =>
    r.product_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#1e2d3d]">Product Requests</h1>
          <p className="text-sm text-gray-400 mt-0.5">{requests.length} request{requests.length !== 1 ? "s" : ""} submitted</p>
        </div>
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by product name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#F2AA25] w-64"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-gray-400 font-medium">{search ? "No requests match your search." : "No product requests yet."}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Image", "Product Name", "Details", "Requested By", "Date", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req, i) => (
                  <tr key={req.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-4 py-3">
                      <ImageThumb url={req.image_url} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#1e2d3d] max-w-[160px]">
                      <p className="truncate">{req.product_name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                      {req.details ? (
                        <p className="line-clamp-2 text-xs">{req.details}</p>
                      ) : (
                        <span className="text-gray-300 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {req.customers?.customer_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      <br />
                      <span className="text-gray-300">{new Date(req.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={req.status}
                        onChange={e => handleStatusChange(req.id, e.target.value)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border-0 outline-none cursor-pointer ${STATUS_STYLES[req.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfirmTarget(req)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {filtered.map(req => (
              <div key={req.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex gap-3 mb-3">
                  <ImageThumb url={req.image_url} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1e2d3d] text-sm truncate">{req.product_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{req.customers?.customer_name ?? "—"}</p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {req.details && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-3">{req.details}</p>
                )}
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <select
                    value={req.status}
                    onChange={e => handleStatusChange(req.id, e.target.value)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border-0 outline-none cursor-pointer ${STATUS_STYLES[req.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setConfirmTarget(req)}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmTarget && (
        <ConfirmDeleteModal
          request={confirmTarget}
          onConfirm={handleDelete}
          onCancel={() => setConfirmTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
