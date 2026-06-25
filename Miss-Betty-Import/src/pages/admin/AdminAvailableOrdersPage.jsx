import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from 'xlsx';

const PROCUREMENT_OPTIONS = ["Ordered", "Not Ordered"];
const PROCUREMENT_COLORS = {
  "Ordered":     "bg-green-100 text-green-700",
  "Not Ordered": "bg-gray-100 text-gray-500",
};

function groupByProduct(rows) {
  const productMap = {};
  const deliverySet = new Set();
  const deliveryRows = [];

  for (const row of rows) {
    const pid = row.product_id;

    if (!productMap[pid]) {
      productMap[pid] = {
        product_id: pid,
        product_name: row.products?.product_name ?? `Product #${pid}`,
        procurement_status: row.products?.procurement_status ?? 'Not Ordered',
        sizeColourMap: {},
        total_quantity: 0,
      };
    }

    const entry = productMap[pid];
    const sz = row.size   || "—";
    const cl = row.colour || "—";
    const qty = Number(row.quantity ?? 1);
    if (!entry.sizeColourMap[sz]) entry.sizeColourMap[sz] = {};
    entry.sizeColourMap[sz][cl] = (entry.sizeColourMap[sz][cl] ?? 0) + qty;
    entry.total_quantity += qty;

    const dedupeKey = `${row.customers?.customer_name ?? ""}::${row.delivery_town ?? ""}`;
    if (!deliverySet.has(dedupeKey)) {
      deliverySet.add(dedupeKey);
      deliveryRows.push({
        id: row.id,
        customer_name: row.customers?.customer_name ?? "—",
        telephone: row.customers?.telephone ?? "—",
        delivery_town: row.delivery_town ?? "—",
        delivery_region: row.delivery_region ?? "—",
      });
    }
  }

  return { productRows: Object.values(productMap), deliveryRows };
}

export default function AdminAvailableOrdersPage() {
  const [productRows, setProductRows] = useState([]);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, products(product_name, procurement_status, product_status(status_name)), customers(customer_name, telephone)')
      .eq('deleted_by_admin', false)
      .order('created_at', { ascending: false });

    const availableRows = (data ?? []).filter(
      r => r.products?.product_status?.status_name === 'Available'
    );
    const { productRows: pr, deliveryRows: dr } = groupByProduct(availableRows);
    setProductRows(pr);
    setDeliveryRows(dr);
    setLoading(false);
  }

  async function handleProcurementChange(productId, newStatus) {
    setUpdatingId(productId);
    await supabase.from('products').update({ procurement_status: newStatus }).eq('product_id', productId);
    setProductRows(prev => prev.map(r =>
      r.product_id === productId ? { ...r, procurement_status: newStatus } : r
    ));
    setUpdatingId(null);
  }

  async function handleDeleteAll() {
    setDeleting(true);
    const [{ error: ordErr }, { error: invErr }] = await Promise.all([
      supabase.from('orders').update({ deleted_by_admin: true }).eq('deleted_by_admin', false),
      supabase.from('invoices').update({ deleted_by_admin: true }).eq('deleted_by_admin', false),
    ]);
    const error = ordErr || invErr;
    if (!error) {
      setProductRows([]);
      setDeliveryRows([]);
      setConfirmDelete(false);
    } else {
      alert('Delete failed. Please try again.');
    }
    setDeleting(false);
  }

  function handleDownloadExcel() {
    const rows = productRows.flatMap(row =>
      Object.entries(row.sizeColourMap).flatMap(([size, colourMap]) =>
        Object.entries(colourMap).map(([colour, qty]) => ({
          'Product Name':  row.product_name,
          'Size / Colour': `${size} / ${colour}`,
          'Quantity':      qty,
        }))
      )
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Available Orders');
    XLSX.writeFile(wb, 'Miss-Betty-Available-Orders.xlsx');
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Available Goods Orders</h1>
      <p className="text-sm text-gray-400 mb-6">Manage and dispatch in-stock orders</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Section 1: Product Orders ───────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[#1e2d3d]">
                Product Orders ({productRows.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadExcel}
                  disabled={productRows.length === 0}
                  className="flex items-center gap-1.5 bg-[#1e2d3d] text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Excel
                </button>
                <span className="w-px h-5 bg-gray-200 mx-1" />
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={productRows.length === 0}
                  className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Delete All
                </button>
              </div>
            </div>

            {productRows.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No available goods orders.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Size / Colour</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Procurement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map(row => (
                      <tr key={row.product_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{row.product_name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-gray-500 leading-snug">
                            {Object.entries(row.sizeColourMap).map(([size, colourMap]) => (
                              <span key={size}>
                                <span className="font-semibold text-[#1e2d3d]">{size}:</span>{" "}
                                {Object.entries(colourMap).map(([colour, qty]) => `${colour} (${qty})`).join(", ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-[#1e2d3d]">{row.total_quantity}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${PROCUREMENT_COLORS[row.procurement_status] ?? PROCUREMENT_COLORS["Not Ordered"]}`}>
                              {row.procurement_status}
                            </span>
                            <select
                              value={row.procurement_status}
                              disabled={updatingId === row.product_id}
                              onChange={e => handleProcurementChange(row.product_id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#F2AA25] disabled:opacity-60 cursor-pointer"
                            >
                              {PROCUREMENT_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Section 2: Delivery Details ─────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">
                Delivery Details ({deliveryRows.length})
              </h2>
            </div>

            {deliveryRows.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No delivery info yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Town</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryRows.map(row => (
                      <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{row.customer_name}</td>
                        <td className="px-4 py-3 text-gray-500">{row.telephone}</td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{row.delivery_town}</td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{row.delivery_region}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-[#1e2d3d] mb-2">Delete All Orders?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will clear all orders from the admin view. Customer order histories are not affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
