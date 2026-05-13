import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function groupByInvoiceId(rows) {
  const map = {};
  for (const row of rows) {
    if (!map[row.invoice_id]) map[row.invoice_id] = [];
    map[row.invoice_id].push(row);
  }
  return Object.entries(map).map(([invoice_id, items]) => ({
    invoice_id,
    customer_name: items[0].customer_name,
    date: items[0].date,
    items,
    total: items.reduce((s, r) => s + Number(r.total ?? 0), 0),
  }));
}

function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:bg-white print:inset-auto print:fixed print:top-0 print:left-0">
      <div id="invoice-print-area" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:rounded-none print:shadow-none print:max-h-none print:overflow-visible">
        {/* Print hide: close button */}
        <div className="flex justify-end px-6 pt-5 print:hidden">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Invoice Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1e2d3d]">INVOICE</h2>
              <p className="text-sm text-gray-500 mt-0.5">#{invoice.invoice_id}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[#1e2d3d]">Miss Betty Import</p>
              <p className="text-xs text-gray-400">Ghana</p>
              {invoice.date && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(invoice.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
            <p className="font-bold text-[#1e2d3d]">{invoice.customer_name}</p>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-[#1e2d3d]">
                <th className="text-left py-2 text-xs font-semibold text-[#1e2d3d] uppercase">Product</th>
                <th className="text-center py-2 text-xs font-semibold text-[#1e2d3d] uppercase hidden sm:table-cell">Size</th>
                <th className="text-center py-2 text-xs font-semibold text-[#1e2d3d] uppercase hidden sm:table-cell">Colour</th>
                <th className="text-center py-2 text-xs font-semibold text-[#1e2d3d] uppercase">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-[#1e2d3d] uppercase">Unit Price</th>
                <th className="text-right py-2 text-xs font-semibold text-[#1e2d3d] uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2.5 text-[#1e2d3d]">{item.product_name}</td>
                  <td className="py-2.5 text-center text-gray-500 hidden sm:table-cell">{item.size ?? '—'}</td>
                  <td className="py-2.5 text-center text-gray-500 hidden sm:table-cell">{item.colour ?? '—'}</td>
                  <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-500">GHS {Number(item.unit_price).toLocaleString()}</td>
                  <td className="py-2.5 text-right font-semibold text-[#1e2d3d]">GHS {Number(item.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#1e2d3d]">
                <td colSpan={3} className="py-3 hidden sm:table-cell" />
                <td colSpan={2} className="py-3 text-right font-bold text-[#1e2d3d] text-base">Grand Total</td>
                <td className="py-3 text-right font-bold text-[#F2AA25] text-base">GHS {invoice.total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          {/* Print button */}
          <div className="flex justify-end print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-[#1e2d3d] text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
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

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadInvoices() {
      const { data } = await supabase.from('invoices').select('*').order('date', { ascending: false });
      setInvoices(groupByInvoiceId(data ?? []));
      setLoading(false);
    }
    loadInvoices();
  }, []);

  const filtered = invoices.filter(inv =>
    inv.invoice_id.toLowerCase().includes(query.toLowerCase()) ||
    (inv.customer_name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Invoices</h1>
      <p className="text-sm text-gray-400 mb-4">All customer invoices</p>

      {/* Search bar */}
      <div className="relative mb-5 max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by customer name or Invoice ID…"
          className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400 text-sm">
          No invoices yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400 text-sm">
          No invoices match <strong>"{query}"</strong>.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Items</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.invoice_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-[#1e2d3d] text-xs">{inv.invoice_id}</td>
                  <td className="px-4 py-3 text-[#1e2d3d]">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                    {inv.date ? new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#F2AA25]">GHS {inv.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(inv)}
                      className="text-xs font-semibold text-[#1e2d3d] hover:text-[#F2AA25] transition-colors"
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

      <InvoiceModal invoice={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
