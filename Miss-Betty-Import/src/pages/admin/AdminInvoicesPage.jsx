import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import * as XLSX from 'xlsx';
import { useSelectedOrderPeriod } from "../../hooks/useSelectedOrderPeriod";
import PeriodSwitcher from "../../components/PeriodSwitcher";

const STATUS_OPTIONS = ["Ordered", "Processing", "Delivered", "Cancelled"];
const STATUS_COLORS = {
  Ordered:    "bg-teal-100 text-teal-700",
  Pending:    "bg-mbi-amber-tint text-mbi-amber-ink",
  Processing: "bg-mbi-preorder-tint text-mbi-navy",
  Delivered:  "bg-mbi-available-tint text-mbi-available",
  Cancelled:  "bg-mbi-error-tint text-mbi-error",
  // Offline invoices show their payment status
  Paid:             "bg-mbi-available-tint text-mbi-available",
  'Partially paid': "bg-mbi-amber-tint text-mbi-amber-ink",
  Unpaid:           "bg-mbi-surface-soft text-mbi-slate",
};

const PRODUCT_TYPE_COLORS = {
  'Available': 'bg-mbi-available-tint text-mbi-available',
  'Pre-order': 'bg-teal-100 text-teal-700',
};
function ProductTypeBadge({ status }) {
  if (!status) return <span className="text-mbi-slate text-xs">—</span>;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${PRODUCT_TYPE_COLORS[status] ?? 'bg-mbi-surface-soft text-mbi-slate'}`}>
      {status}
    </span>
  );
}

// Each invoice line is linked to its order line (invoices.order_line_id), so every product
// carries its own status. Cancelled lines stay visible here (struck through) but are left
// out of totals and counts.
function groupByInvoiceId(rows, customerNameMap = {}, productTypeMap = {}, lineStatusMap = {}, orderStatusMap = {}) {
  const map = {};
  for (const row of rows) {
    if (!map[row.invoice_id]) map[row.invoice_id] = [];
    const lineStatus = lineStatusMap[row.order_line_id] ?? orderStatusMap[row.invoice_id] ?? 'Pending';
    map[row.invoice_id].push({
      ...row,
      product_status_name: productTypeMap[row.product_name] ?? null,
      line_status: lineStatus,
      cancelled: lineStatus === 'Cancelled',
    });
  }
  return Object.entries(map).map(([invoice_id, items]) => {
    const active = items.filter(i => !i.cancelled);
    return {
      invoice_id,
      customer_name: customerNameMap[invoice_id] ?? '',
      date: items[0].date,
      items,
      active_count: active.length,
      cancelled_count: items.length - active.length,
      total: active.reduce((s, r) => s + Number(r.total ?? 0), 0),
      // Status of the products still active; "Cancelled" only when every product is.
      order_status: active.length ? active[0].line_status : 'Cancelled',
    };
  });
}

const CANCEL_LINE_MESSAGE =
  "Are you sure you want to cancel this product order? This action will update the customer's order, shipping fee, dashboard calculations, and product quantities.";

function InvoiceModal({ invoice, onClose, onCancelLine, cancellingLineId, notice }) {
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:bg-white print:inset-auto print:fixed print:top-0 print:left-0">
      <div id="invoice-print-area" className="bg-white rounded-mbi-card shadow-mbi-float w-full max-w-2xl max-h-[90vh] overflow-y-auto print:rounded-none print:shadow-none print:max-h-none print:overflow-visible">
        <div className="flex justify-end px-6 pt-5 print:hidden">
          <button onClick={onClose} className="text-mbi-slate hover:text-mbi-navy-body">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Invoice Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-mbi-navy">INVOICE</h2>
              <p className="text-sm text-mbi-slate mt-0.5">#{invoice.invoice_id}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-mbi-navy">Miss Betty Import</p>
              <p className="text-xs text-mbi-slate">Ghana</p>
              {invoice.date && (
                <p className="text-xs text-mbi-slate mt-1">
                  {new Date(invoice.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="bg-mbi-surface-soft rounded-lg px-4 py-3 mb-6">
            <p className="text-xs font-semibold text-mbi-slate uppercase tracking-wide mb-1">Bill To</p>
            <p className="font-bold text-mbi-navy">{invoice.customer_name}</p>
          </div>

          {notice && (
            <div className={`mb-4 rounded-lg px-3 py-2.5 text-xs font-medium border print:hidden ${
              notice.type === 'error' ? 'bg-mbi-error-tint border-mbi-error/30 text-mbi-error' : 'bg-mbi-available-tint border-mbi-available/30 text-mbi-available'
            }`}>
              {notice.msg}
            </div>
          )}

          {/* Items Table */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-mbi-navy">
                <th className="text-left py-2 text-xs font-semibold text-mbi-navy uppercase">Product</th>
                <th className="text-center py-2 text-xs font-semibold text-mbi-navy uppercase hidden sm:table-cell">Size</th>
                <th className="text-center py-2 text-xs font-semibold text-mbi-navy uppercase hidden sm:table-cell">Colour</th>
                <th className="text-center py-2 text-xs font-semibold text-mbi-navy uppercase hidden sm:table-cell">Type</th>
                <th className="text-center py-2 text-xs font-semibold text-mbi-navy uppercase">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-mbi-navy uppercase">Unit Price</th>
                <th className="text-right py-2 text-xs font-semibold text-mbi-navy uppercase">Total</th>
                <th className="py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className={`border-b border-mbi-hairline-soft ${item.cancelled ? 'text-mbi-slate print:hidden' : ''}`}>
                  <td className="py-2.5">
                    <span className={item.cancelled ? 'line-through' : 'text-mbi-navy'}>{item.product_name}</span>
                    {item.cancelled && (
                      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-mbi-error-tint text-mbi-error no-underline">Cancelled</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center text-mbi-slate hidden sm:table-cell">{item.size ?? '—'}</td>
                  <td className="py-2.5 text-center text-mbi-slate hidden sm:table-cell">{item.colour ?? '—'}</td>
                  <td className="py-2.5 text-center hidden sm:table-cell">
                    <ProductTypeBadge status={item.product_status_name} />
                  </td>
                  <td className={`py-2.5 text-center text-mbi-slate ${item.cancelled ? 'line-through' : ''}`}>{item.quantity}</td>
                  <td className={`py-2.5 text-right text-mbi-slate ${item.cancelled ? 'line-through' : ''}`}>GHS {Number(item.unit_price).toLocaleString()}</td>
                  <td className={`py-2.5 text-right font-semibold ${item.cancelled ? 'line-through' : 'text-mbi-navy'}`}>GHS {Number(item.total).toLocaleString()}</td>
                  <td className="py-2.5 pl-3 text-right print:hidden">
                    {!item.cancelled && item.order_line_id && (
                      <button
                        onClick={() => onCancelLine(item)}
                        disabled={cancellingLineId != null}
                        className="text-xs font-semibold text-mbi-error hover:text-mbi-error border border-mbi-error/30 hover:border-mbi-error rounded-lg px-2 py-1 whitespace-nowrap transition-colors disabled:opacity-50"
                      >
                        {cancellingLineId === item.order_line_id ? 'Cancelling…' : 'Cancel product'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-mbi-navy">
                <td colSpan={4} className="py-3 hidden sm:table-cell" />
                <td colSpan={2} className="py-3 text-right font-bold text-mbi-navy text-base">Grand Total</td>
                <td className="py-3 text-right font-bold text-mbi-amber-ink text-base">GHS {invoice.total.toLocaleString()}</td>
                <td className="print:hidden" />
              </tr>
              {invoice.cancelled_count > 0 && (
                <tr className="print:hidden">
                  <td colSpan={8} className="pt-1 text-right text-xs text-mbi-slate">
                    Excludes {invoice.cancelled_count} cancelled product{invoice.cancelled_count !== 1 ? 's' : ''}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          {/* Print button */}
          <div className="flex justify-end print:hidden">
            <button
              onClick={() => window.print()}
              className="mbi-press bg-mbi-navy text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-mbi-navy-hover transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print Invoice
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#invoice-print-area) { display: none !important; }
          #invoice-print-area { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

// Fetch a period's invoices with each line's own status (via invoices.order_line_id).
async function fetchInvoices(periodId) {
  const [{ data: rawData }, { data: orderRows }, { data: productData }, { data: offlineSales }] = await Promise.all([
    supabase.from('invoices').select('*')
      .eq('deleted_by_admin', false)
      .eq('order_period_id', periodId)
      .order('date', { ascending: false }),
    supabase.from('orders').select('id, order_id, status, customer_id, customers(customer_name)').order('order_id'),
    supabase.from('products').select('product_name, product_status(status_name)'),
    supabase.from('offline_sales')
      .select('id, invoice_number, buyer_name, status, payment_status, created_at, offline_sale_items(id, product_name_snapshot, product_type, size, colour, quantity, unit_price)')
      .eq('order_period_id', periodId)
      .is('invoices_hidden_at', null)
      .order('created_at', { ascending: false }),
  ]);

  // Per-line status (by order line id), plus an order-level fallback and customer names
  const lineStatusMap = {};
  const orderStatusMap = {};
  const customerNameMap = {};
  (orderRows ?? []).forEach(r => {
    lineStatusMap[r.id] = r.status;
    if (r.status !== 'Cancelled' && !orderStatusMap[r.order_id]) orderStatusMap[r.order_id] = r.status;
    if (r.order_id && !customerNameMap[r.order_id]) {
      customerNameMap[r.order_id] = r.customers?.customer_name ?? null;
    }
  });

  // Build product name → status map
  const productTypeMap = {};
  (productData ?? []).forEach(p => {
    if (p.product_name) {
      productTypeMap[p.product_name] = p.product_status?.status_name ?? null;
    }
  });

  const online = groupByInvoiceId(rawData ?? [], customerNameMap, productTypeMap, lineStatusMap, orderStatusMap)
    .map(inv => ({ ...inv, source: 'online' }));
  const offline = (offlineSales ?? []).map(sale => offlineToInvoice(sale, productTypeMap));
  return [...online, ...offline].sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));
}

// An offline sale (Admin › Offline Buyers) shown as an invoice in the same shape as online
// ones. It is read straight from offline_sales, never copied into the invoices table, so it
// can't be counted twice. Cancellation is per sale, so a cancelled sale's lines are all
// cancelled; its status column shows the payment status instead of an order status.
function offlineToInvoice(sale, productTypeMap = {}) {
  const cancelled = sale.status === 'Cancelled';
  const items = [...(sale.offline_sale_items ?? [])]
    .sort((a, b) => a.id - b.id)
    .map(i => ({
      id: `offline-${i.id}`,
      product_name: i.product_name_snapshot,
      size: i.size,
      colour: i.colour,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      total: Math.round(Number(i.unit_price) * Number(i.quantity) * 100) / 100,
      product_status_name: productTypeMap[i.product_name_snapshot] ?? i.product_type ?? null,
      line_status: cancelled ? 'Cancelled' : sale.payment_status,
      cancelled,
      order_line_id: null, // no "Cancel product" here; offline sales are managed on Offline Buyers
    }));
  const active = items.filter(i => !i.cancelled);
  return {
    invoice_id: sale.invoice_number,
    sale_id: sale.id,
    source: 'offline',
    customer_name: sale.buyer_name,
    date: sale.created_at,
    items,
    active_count: active.length,
    cancelled_count: items.length - active.length,
    total: Math.round(active.reduce((s, r) => s + r.total, 0) * 100) / 100,
    order_status: cancelled ? 'Cancelled' : (sale.payment_status ?? 'Paid'),
  };
}

// Excel rows for the given invoices: active products only (no Status column, so cancelled
// products are left out and the file matches the totals shown).
function invoiceExportRows(invoices) {
  return invoices.flatMap(inv =>
    inv.items.filter(item => !item.cancelled).map(item => ({
      Customer:            inv.customer_name ?? '—',
      'Product Type':      item.product_status_name ?? '—',
      Product:             item.product_name ?? '—',
      Size:                item.size ?? '—',
      Colour:              item.colour ?? '—',
      Quantity:            Number(item.quantity ?? 0),
      'Unit Price (GHS)':  Number(item.unit_price),
      'Total Price (GHS)': Number(item.total),
    }))
  );
}

const SOURCE_FILTERS = [
  { key: 'all',     label: 'All Invoices' },
  { key: 'online',  label: 'Online Buyers' },
  { key: 'offline', label: 'Offline Buyers' },
];

export default function AdminInvoicesPage() {
  const { periods, activePeriod, selectedId, selectPeriod, loading: periodsLoading } = useSelectedOrderPeriod();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingLineId, setCancellingLineId] = useState(null);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', msg }
  const [source, setSource] = useState('all'); // all | online | offline

  // Apply freshly fetched invoices, keeping an open invoice in step with the new data.
  function applyInvoices(grouped) {
    setInvoices(grouped);
    setSelected(prev => (prev ? grouped.find(inv => inv.invoice_id === prev.invoice_id) ?? null : prev));
    setLoading(false);
  }

  const loadInvoices = periodId => fetchInvoices(periodId).then(applyInvoices);

  useEffect(() => {
    if (selectedId == null) return;
    fetchInvoices(selectedId).then(applyInvoices);
  }, [selectedId]);

  // Cancel a single product: one database transaction (admin_cancel_order_line) marks the
  // line Cancelled and returns Available stock. Every other screen excludes cancelled lines.
  async function handleCancelLine(item) {
    if (!window.confirm(`${CANCEL_LINE_MESSAGE}\n\nProduct: ${item.product_name}${item.size ? ` (${item.size})` : ''} × ${item.quantity}`)) return;
    setNotice(null);
    setCancellingLineId(item.order_line_id);
    const { error } = await supabase.rpc('admin_cancel_order_line', { p_line_id: item.order_line_id });
    setCancellingLineId(null);
    if (error) {
      setNotice({ type: 'error', msg: `Couldn't cancel this product: ${error.message}. Nothing was changed.` });
      return;
    }
    setNotice({ type: 'success', msg: `${item.product_name} was cancelled. Totals, shipping fees, quantities and the customer's portal are updated.` });
    await loadInvoices(selectedId);
  }

  async function handleStatusChange(invoiceId, newStatus) {
    setNotice(null);
    if (newStatus === 'Cancelled') {
      if (!window.confirm(`Cancel every product in order ${invoiceId}?\n\n${CANCEL_LINE_MESSAGE}`)) return;
      setUpdatingId(invoiceId);
      const { error } = await supabase.rpc('admin_cancel_order', { p_order_id: invoiceId });
      setUpdatingId(null);
      if (error) {
        setNotice({ type: 'error', msg: `Couldn't cancel order ${invoiceId}: ${error.message}. Nothing was changed.` });
        return;
      }
      setNotice({ type: 'success', msg: `Order ${invoiceId} was cancelled.` });
      await loadInvoices(selectedId);
      return;
    }
    setUpdatingId(invoiceId);
    const patch = {
      status: newStatus,
      can_edit_delivery: newStatus !== 'Delivered' && newStatus !== 'Received',
      ...(newStatus === 'Delivered' ? { delivered_at: new Date().toISOString() } : {}),
    };
    // Status changes apply to the products still active; cancelled ones stay cancelled.
    const { error } = await supabase.from('orders').update(patch).eq('order_id', invoiceId).neq('status', 'Cancelled');
    setUpdatingId(null);
    if (error) {
      setNotice({ type: 'error', msg: `Couldn't update order ${invoiceId}: ${error.message}` });
      return;
    }
    setInvoices(prev => prev.map(inv =>
      inv.invoice_id === invoiceId
        ? { ...inv, order_status: newStatus, items: inv.items.map(i => (i.cancelled ? i : { ...i, line_status: newStatus })) }
        : inv
    ));
  }

  // Follows the source filter. Online invoice records are deleted (as before); offline
  // invoices are the offline sales themselves, so they are only hidden from this page.
  async function handleDeleteAll() {
    if (selectedId == null) return;
    setDeleting(true);
    const offlineIds = sourceInvoices.filter(inv => inv.source === 'offline').map(inv => inv.sale_id);
    const ok = { error: null };
    const [{ error: onErr }, { error: offErr }] = await Promise.all([
      source !== 'offline' ? supabase.from('invoices').delete().eq('order_period_id', selectedId) : ok,
      source !== 'online' && offlineIds.length ? supabase.rpc('offline_sales_hide_invoices', { p_sale_ids: offlineIds }) : ok,
    ]);
    if (!onErr && !offErr) {
      setInvoices(prev => prev.filter(inv =>
        source === 'online' ? inv.source !== 'online' : source === 'offline' ? inv.source !== 'offline' : false));
      setSelected(null);
      setConfirmDelete(false);
    } else {
      alert('Delete failed. Please try again.');
      await loadInvoices(selectedId);
    }
    setDeleting(false);
  }

  // Exports what is shown: the source filter and any search.
  function handleDownloadExcel() {
    const ws = XLSX.utils.json_to_sheet(invoiceExportRows(filtered));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, 'Miss-Betty-Invoices.xlsx');
  }

  const sourceInvoices = source === 'all' ? invoices : invoices.filter(inv => inv.source === source);
  const filtered = sourceInvoices.filter(inv =>
    inv.invoice_id.toLowerCase().includes(query.toLowerCase()) ||
    (inv.customer_name ?? "").toLowerCase().includes(query.toLowerCase())
  );
  const onlineCount = sourceInvoices.filter(inv => inv.source === 'online').length;
  const offlineCount = sourceInvoices.length - onlineCount;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy">Invoices</h1>
        <PeriodSwitcher periods={periods} selectedId={selectedId} activeId={activePeriod?.id} onChange={selectPeriod} loading={periodsLoading} />
      </div>
      <p className="text-sm text-mbi-slate mb-4">All customer invoices — update order status here, or open an invoice to cancel a single product</p>

      {notice && !selected && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium border flex items-start justify-between gap-3 ${
          notice.type === 'error' ? 'bg-mbi-error-tint border-mbi-error/30 text-mbi-error' : 'bg-mbi-available-tint border-mbi-available/30 text-mbi-available'
        }`}>
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Search bar + Download */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative max-w-sm flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-mbi-slate" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by customer name or Invoice ID…"
            className="w-full border border-mbi-hairline rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-mbi-navy transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mbi-slate hover:text-mbi-navy-body"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setSource(f.key)}
              className={`mbi-press inline-flex h-9 items-center text-sm font-medium px-3.5 rounded-full border transition-colors whitespace-nowrap ${
                source === f.key
                  ? "bg-mbi-navy text-white border-mbi-navy"
                  : "bg-white border-mbi-navy/20 text-mbi-navy hover:border-mbi-navy"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleDownloadExcel}
          disabled={loading || filtered.length === 0}
          className="mbi-press flex items-center gap-2 bg-mbi-navy text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-mbi-navy-hover transition-colors disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Excel
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={loading || sourceInvoices.length === 0}
          className="flex items-center gap-2 bg-mbi-error text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-mbi-error/90 transition-colors disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Delete All
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sourceInvoices.length === 0 ? (
        <div className="bg-white rounded-mbi-card border border-mbi-hairline p-12 text-center text-mbi-slate text-sm">
          {source === 'online' ? 'No online invoices yet.' : source === 'offline' ? 'No offline invoices yet.' : 'No invoices yet.'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-mbi-card border border-mbi-hairline p-12 text-center text-mbi-slate text-sm">
          No invoices match <strong>"{query}"</strong>.
        </div>
      ) : (
        <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden sm:table-cell">Product Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide hidden md:table-cell">Items</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.invoice_id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                  <td className="px-5 py-3 font-semibold text-mbi-navy text-xs">
                    {inv.invoice_id}
                    {inv.source === 'offline' && (
                      <span className="ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-mbi-surface-soft text-mbi-slate whitespace-nowrap">Offline</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-mbi-navy">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-mbi-slate text-xs hidden sm:table-cell">
                    {inv.date ? new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {(() => {
                      const types = [...new Set(inv.items.map(i => i.product_status_name).filter(Boolean))];
                      if (types.length === 0) return <span className="text-mbi-slate text-xs">—</span>;
                      if (types.length === 1) return <ProductTypeBadge status={types[0]} />;
                      return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-mbi-surface-strong text-mbi-navy whitespace-nowrap">Mixed</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-mbi-slate hidden md:table-cell">
                    {inv.active_count} item{inv.active_count !== 1 ? 's' : ''}
                    {inv.cancelled_count > 0 && <span className="text-mbi-error"> · {inv.cancelled_count} cancelled</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-mbi-amber-ink">GHS {inv.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[inv.order_status] ?? 'bg-mbi-surface-soft text-mbi-navy-body'}`}>
                        {inv.order_status}
                      </span>
                      {inv.source === 'offline' ? (
                        <Link to="/admin/offline-buyers" className="text-xs font-semibold text-mbi-slate hover:text-mbi-amber-ink whitespace-nowrap">
                          Manage in Offline Buyers
                        </Link>
                      ) : (
                        <select
                          value={inv.order_status}
                          disabled={updatingId === inv.invoice_id}
                          onChange={e => handleStatusChange(inv.invoice_id, e.target.value)}
                          className="text-xs border border-mbi-hairline rounded-lg px-2 py-1 outline-none focus:border-mbi-navy disabled:opacity-60 cursor-pointer"
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(inv)}
                      className="text-xs font-semibold text-mbi-navy hover:text-mbi-amber-ink transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceModal
        invoice={selected}
        onClose={() => { setSelected(null); setNotice(null); }}
        onCancelLine={handleCancelLine}
        cancellingLineId={cancellingLineId}
        notice={notice}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-mbi-card shadow-mbi-float p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-mbi-navy mb-2">
              {source === 'online' ? 'Delete All Online Invoices?' : source === 'offline' ? 'Clear All Offline Invoices?' : 'Delete All Invoices?'}
            </h3>
            <div className="text-sm text-mbi-slate mb-5 space-y-2">
              {source !== 'offline' && onlineCount > 0 && (
                <p>This will permanently delete {onlineCount} online invoice record{onlineCount !== 1 ? 's' : ''} for this period. This can't be undone.</p>
              )}
              {source !== 'online' && offlineCount > 0 && (
                <p>{offlineCount} offline invoice{offlineCount !== 1 ? 's' : ''} will be removed from this page only. The offline sales and their PDF invoices stay on the Offline Buyers page.</p>
              )}
            </div>
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
