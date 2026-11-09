import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from 'xlsx';
import { useSelectedOrderPeriod } from "../../hooks/useSelectedOrderPeriod";
import PeriodSwitcher from "../../components/PeriodSwitcher";

const PROCUREMENT_OPTIONS = ["Ordered", "Not Ordered"];
const PROCUREMENT_COLORS = {
  "Ordered":     "bg-mbi-available-tint text-mbi-available",
  "Not Ordered": "bg-mbi-surface-soft text-mbi-slate",
};

const FILTERS = ["All", "Pre-order"];

function groupByProduct(rows) {
  const productMap = {};
  const deliverySet = new Set();
  const deliveryRows = [];

  for (const row of rows) {
    const pid = row.product_id;
    const pKey = pid ?? `name:${row.product_name_snapshot ?? ''}`;

    if (!productMap[pKey]) {
      productMap[pKey] = {
        product_id: pid,
        product_name: row.products?.product_name ?? row.product_name_snapshot ?? 'Product no longer listed',
        product_status_name: row.products?.product_status?.status_name ?? null,
        procurement_status: row.products?.procurement_status ?? 'Not Ordered',
        sizeColourMap: {},
        total_quantity: 0,
        offline_quantity: 0,
      };
    }

    const entry = productMap[pKey];
    const sz = row.size   || "—";
    const cl = row.colour || "—";
    const qty = Number(row.quantity ?? 1);
    if (!entry.sizeColourMap[sz]) entry.sizeColourMap[sz] = {};
    const existingCell = entry.sizeColourMap[sz][cl];
    // rmb_price reflects the product's CURRENT procurement cost (not the order-time
    // snapshot), so admins always see the latest value for this exact size.
    const sp = row.products?.size_pricing;
    const liveRmb = Array.isArray(sp) && sp.length > 0
      ? (sp.find(s => s.size === row.size)?.rmb_price ?? null)
      : (row.products?.rmb_price ?? null);
    entry.sizeColourMap[sz][cl] = {
      qty: (existingCell?.qty ?? 0) + qty,
      rmb_price: liveRmb,
    };
    entry.total_quantity += qty;
    if (row.source === 'offline') entry.offline_quantity += qty;

    const dedupeKey = row.source === 'offline'
      ? `offline::${(row.customers?.customer_name ?? "").trim().toLowerCase()}`
      : `${row.customers?.customer_name ?? ""}::${row.delivery_town ?? ""}`;
    if (!deliverySet.has(dedupeKey)) {
      deliverySet.add(dedupeKey);
      deliveryRows.push({
        id: row.id,
        customer_name: row.customers?.customer_name ?? "—",
        telephone: row.customers?.telephone ?? "—",
        delivery_town: row.delivery_town ?? "—",
        delivery_region: row.delivery_region ?? "—",
        offline: row.source === 'offline',
      });
    }
  }

  return { productRows: Object.values(productMap), deliveryRows };
}

// An offline sale line (Admin › Offline Buyers) in the shape groupByProduct reads, so it
// merges into the same product / size / colour cells as online orders. Offline buyers have
// a name only: no phone or delivery address.
function offlineToRow(item) {
  return {
    id: `offline-${item.id}`,
    source: 'offline',
    sale_id: item.offline_sales.id,
    product_id: item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
    products: item.products,
    customers: { customer_name: item.offline_sales.buyer_name, telephone: null },
    delivery_town: null,
    delivery_region: null,
  };
}

export default function AdminOrdersPage() {
  const { periods, activePeriod, selectedId, selectPeriod, loading: periodsLoading } = useSelectedOrderPeriod();
  const [productRows, setProductRows] = useState([]);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [orderIds, setOrderIds] = useState([]);
  const [offlineSaleIds, setOfflineSaleIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (selectedId != null) loadOrders(); }, [selectedId]);

  async function loadOrders() {
    setLoading(true);
    const [{ data }, { data: offlineData }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, products(product_name, procurement_status, product_status(status_name), rmb_price, size_pricing), customers(customer_name, telephone)')
        .eq('deleted_by_admin', false)
        .eq('order_period_id', selectedId)
        .neq('status', 'Cancelled') // cancelled lines no longer count toward quantities
        .order('created_at', { ascending: false }),
      // Offline sales in the same period (not cancelled, not cleared by Delete All).
      supabase
        .from('offline_sale_items')
        .select('id, product_id, product_name_snapshot, size, colour, quantity, offline_sales!inner(id, buyer_name, status, order_period_id, preorders_hidden_at), products(product_name, procurement_status, product_status(status_name), rmb_price, size_pricing)')
        .eq('offline_sales.order_period_id', selectedId)
        .eq('offline_sales.status', 'Active')
        .is('offline_sales.preorders_hidden_at', null)
        .order('id', { ascending: false }),
    ]);

    // Same rule for both sources: the product is currently a Pre-order product.
    const isPreOrder = r => r.products?.product_status?.status_name === 'Pre-order';
    const preOrderRows = (data ?? []).filter(isPreOrder);
    const offlineRows = (offlineData ?? []).filter(isPreOrder).map(offlineToRow);
    const { productRows: pr, deliveryRows: dr } = groupByProduct([...preOrderRows, ...offlineRows]);
    setProductRows(pr);
    setDeliveryRows(dr);
    setOrderIds(preOrderRows.map(r => r.order_id));
    setOfflineSaleIds([...new Set(offlineRows.map(r => r.sale_id))]);
    setLoading(false);
  }

  useEffect(() => {
    const channel = supabase
      .channel('products_rmb_price_preorders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProductRows(prev => prev.map(r => {
          if (r.product_id !== payload.new.product_id) return r;
          const sp = payload.new.size_pricing;
          const flatRmb = payload.new.rmb_price;
          const newMap = {};
          for (const [size, colourMap] of Object.entries(r.sizeColourMap)) {
            const rmb = Array.isArray(sp) && sp.length > 0
              ? (sp.find(s => s.size === size)?.rmb_price ?? null)
              : (flatRmb ?? null);
            newMap[size] = Object.fromEntries(
              Object.entries(colourMap).map(([colour, cell]) => [colour, { ...cell, rmb_price: rmb }])
            );
          }
          return { ...r, sizeColourMap: newMap };
        }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

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

  async function handleDeleteAll() {
    if (orderIds.length === 0 && offlineSaleIds.length === 0) return;
    setDeleting(true);
    const ok = { error: null };
    const [{ error: ordErr }, { error: invErr }, { error: offErr }] = await Promise.all([
      orderIds.length ? supabase.from('orders').update({ deleted_by_admin: true }).in('order_id', orderIds) : ok,
      orderIds.length ? supabase.from('invoices').update({ deleted_by_admin: true }).in('invoice_id', orderIds) : ok,
      // Offline sales are only hidden from this page; the sales and invoices are kept.
      offlineSaleIds.length ? supabase.rpc('offline_sales_hide_preorders', { p_sale_ids: offlineSaleIds }) : ok,
    ]);
    const error = ordErr || invErr || offErr;
    if (!error) {
      setProductRows([]);
      setDeliveryRows([]);
      setOrderIds([]);
      setOfflineSaleIds([]);
      setConfirmDelete(false);
    } else {
      alert('Delete failed. Please try again.');
    }
    setDeleting(false);
  }

  function handleDownloadExcel() {
    const rows = filteredProducts.flatMap(row =>
      Object.entries(row.sizeColourMap).flatMap(([size, colourMap]) =>
        Object.entries(colourMap).map(([colour, cell]) => ({
          'Product Name':  row.product_name,
          'Size / Colour': `${size} / ${colour}`,
          'Quantity':      cell.qty,
          'RMB Price':     cell.rmb_price ?? '',
        }))
      )
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Orders');
    XLSX.writeFile(wb, 'Miss-Betty-Product-Orders.xlsx');
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy">Pre-Order Goods</h1>
        <PeriodSwitcher periods={periods} selectedId={selectedId} activeId={activePeriod?.id} onChange={selectPeriod} loading={periodsLoading} />
      </div>
      <p className="text-sm text-mbi-slate mb-6">Manage pre-order product orders</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Section 1: Product Orders ───────────────────────────────── */}
          <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-mbi-hairline-soft flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-mbi-navy">
                Product Orders ({filteredProducts.length})
              </h2>
              <div className="flex items-center gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`mbi-press inline-flex h-9 items-center text-sm font-medium px-3.5 rounded-full border transition-colors ${
                      filter === f
                        ? "bg-mbi-navy text-white border-mbi-navy"
                        : "bg-white border-mbi-navy/20 text-mbi-navy hover:border-mbi-navy"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <span className="w-px h-5 bg-mbi-surface-strong mx-1" />
                <button
                  onClick={handleDownloadExcel}
                  disabled={filteredProducts.length === 0}
                  className="mbi-press flex items-center gap-1.5 bg-mbi-navy text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Excel
                </button>
                <span className="w-px h-5 bg-mbi-surface-strong mx-1" />
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={productRows.length === 0}
                  className="flex items-center gap-1.5 bg-mbi-error text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-mbi-error/90 transition-colors disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  Delete All
                </button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-mbi-slate text-sm">
                No orders{filter !== "All" ? ` for "${filter}" products` : ""}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Product Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Size / Colour</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Qty</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Procurement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(row => (
                      <tr key={row.product_id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                        <td className="px-5 py-3 font-semibold text-mbi-navy">{row.product_name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-mbi-slate leading-snug">
                            {Object.entries(row.sizeColourMap).map(([size, colourMap]) => (
                              <span key={size}>
                                <span className="font-semibold text-mbi-navy">{size}:</span>{" "}
                                {Object.entries(colourMap).map(([colour, cell]) =>
                                  `${colour} (${cell.qty})${cell.rmb_price != null ? ` · ¥${Number(cell.rmb_price).toLocaleString()}` : ""}`
                                ).join(", ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-mbi-navy">
                          {row.total_quantity}
                          {row.offline_quantity > 0 && (
                            <span className="block text-xs font-semibold text-mbi-slate whitespace-nowrap">incl. {row.offline_quantity} offline</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${PROCUREMENT_COLORS[row.procurement_status] ?? PROCUREMENT_COLORS["Not Ordered"]}`}>
                              {row.procurement_status}
                            </span>
                            <select
                              value={row.procurement_status}
                              disabled={updatingId === row.product_id}
                              onChange={e => handleProcurementChange(row.product_id, e.target.value)}
                              className="text-xs border border-mbi-hairline rounded-lg px-2 py-1 outline-none focus:border-mbi-navy disabled:opacity-60 cursor-pointer"
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
          <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
            <div className="px-5 py-4 border-b border-mbi-hairline-soft">
              <h2 className="text-sm font-bold text-mbi-navy">
                Delivery Details ({deliveryRows.length})
              </h2>
            </div>

            {deliveryRows.length === 0 ? (
              <div className="text-center py-12 text-mbi-slate text-sm">No delivery info yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Customer Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Town</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryRows.map(row => (
                      <tr key={row.id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                        <td className="px-5 py-3 font-semibold text-mbi-navy">
                          {row.customer_name}
                          {row.offline && (
                            <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-mbi-surface-soft text-mbi-slate align-middle">Offline</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-mbi-slate">{row.telephone}</td>
                        <td className="px-4 py-3 text-mbi-slate hidden sm:table-cell">{row.delivery_town}</td>
                        <td className="px-4 py-3 text-mbi-slate hidden sm:table-cell">{row.delivery_region}</td>
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
          <div className="bg-white rounded-mbi-card shadow-mbi-float p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-mbi-navy mb-2">Delete All Orders?</h3>
            <p className="text-sm text-mbi-slate mb-5">
              This will clear all orders, online and offline, from this page. Customer order histories are not affected, and offline sales and their invoices stay on the Offline Buyers page.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-semibold px-4 py-2 rounded-lg border border-mbi-hairline hover:bg-mbi-surface-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-mbi-error text-white hover:bg-mbi-error/90 disabled:opacity-60"
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
