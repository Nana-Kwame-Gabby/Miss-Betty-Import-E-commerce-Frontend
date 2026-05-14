import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const PROCUREMENT_OPTIONS = ["Ordered", "Not Ordered"];
const PROCUREMENT_COLORS = {
  "Ordered":     "bg-green-100 text-green-700",
  "Not Ordered": "bg-gray-100 text-gray-500",
};

const FILTERS = ["All", "Available", "Pre-order"];

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
        product_status_name: row.products?.product_status?.status_name ?? null,
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

    // Delivery dedup by customer_name + delivery_town
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

  const productRows = Object.values(productMap);

  return { productRows, deliveryRows };
}

export default function AdminOrdersPage() {
  const [productRows, setProductRows] = useState([]);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, products(product_name, procurement_status, product_status(status_name)), customers(customer_name, telephone)')
      .order('created_at', { ascending: false });

    const { productRows: pr, deliveryRows: dr } = groupByProduct(data ?? []);
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

  const filteredProducts = filter === "All"
    ? productRows
    : productRows.filter(r => r.product_status_name === filter);

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Orders</h1>
      <p className="text-sm text-gray-400 mb-6">Manage and track product orders</p>

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
                Product Orders ({filteredProducts.length})
              </h2>

              {/* Filter pills */}
              <div className="flex gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      filter === f
                        ? "bg-[#F2AA25] text-white border-[#F2AA25]"
                        : "border-gray-200 text-gray-500 hover:border-[#F2AA25] hover:text-[#F2AA25]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No orders{filter !== "All" ? ` for "${filter}" products` : ""}.
              </div>
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
                    {filteredProducts.map(row => (
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
    </div>
  );
}
