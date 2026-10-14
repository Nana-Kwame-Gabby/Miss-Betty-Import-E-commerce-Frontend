import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSelectedOrderPeriod } from "../../hooks/useSelectedOrderPeriod";
import PeriodSwitcher from "../../components/PeriodSwitcher";
import { getVariantPricing } from "../../lib/priceUtils";
import { imgFallback, thumbUrl } from "../../lib/imageUrl";

// Sales paid to the admin directly (not through the app). Prices are never typed here:
// they come from the product's settings, and the database recomputes them on save
// (offline_sale_save), which also moves Available-goods stock.

const normalizeName = s => String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const round2 = n => Math.round(n * 100) / 100;
const ghs = n => `GHS ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const splitList = s => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);
const variantKey = (productId, size, colour) => `${productId}::${size ?? ''}::${colour ?? ''}`;

function productOptions(p) {
  const sizes = Array.isArray(p?.size_pricing) && p.size_pricing.length > 0
    ? p.size_pricing.map(e => e.size)
    : splitList(p?.size);
  return { sizes, colours: splitList(p?.colour) };
}

// Totals for sale lines (amounts per unit × quantity).
function sumLines(lines) {
  const t = { units: 0, revenue: 0, cost: 0, misc: 0, profit: 0, discount: 0 };
  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    t.units    += q;
    t.revenue  += Number(l.unit_price ?? 0) * q;
    t.cost     += Number(l.cost_price ?? 0) * q;
    t.misc     += Number(l.misc_amount ?? 0) * q;
    t.profit   += Number(l.profit ?? 0) * q;
    t.discount += Number(l.discount_amount ?? 0) * q;
  }
  for (const k of ['revenue', 'cost', 'misc', 'profit', 'discount']) t[k] = round2(t[k]);
  return t;
}

let lineSeq = 0;
const blankLine = () => ({ key: `new-${++lineSeq}`, item_id: null, product_id: null, product_name: '', size: '', colour: '', quantity: '1', saved: null });

export default function AdminOfflineBuyersPage() {
  const { periods, activePeriod, selectedId, selectPeriod, loading: periodsLoading } = useSelectedOrderPeriod();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [editing, setEditing] = useState(null); // null | { sale } (sale null = new)
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', msg }

  useEffect(() => {
    supabase
      .from('products')
      .select('product_id, product_name, product_image_url, unit_price, discount_price, cost_price, profit, misc_amount, size, colour, size_pricing, product_status(status_name), product_variant_stock(size, colour, stock_quantity)')
      .is('archived_at', null)
      .order('product_name')
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError('');
      const { data, error } = await supabase
        .from('offline_sales')
        .select('*, offline_sale_items(*)')
        .eq('order_period_id', selectedId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setLoadError(`Couldn't load offline sales: ${error.message}`);
      setSales((data ?? []).map(s => ({ ...s, offline_sale_items: [...(s.offline_sale_items ?? [])].sort((a, b) => a.id - b.id) })));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [selectedId]);

  async function reload() {
    const { data } = await supabase
      .from('offline_sales')
      .select('*, offline_sale_items(*)')
      .eq('order_period_id', selectedId)
      .order('created_at', { ascending: false });
    setSales((data ?? []).map(s => ({ ...s, offline_sale_items: [...(s.offline_sale_items ?? [])].sort((a, b) => a.id - b.id) })));
  }

  // Stock figures change with every sale, so refresh them after saving/cancelling/deleting.
  async function reloadStock() {
    const { data } = await supabase
      .from('products')
      .select('product_id, product_variant_stock(size, colour, stock_quantity)')
      .is('archived_at', null);
    const byId = new Map((data ?? []).map(p => [p.product_id, p.product_variant_stock]));
    setProducts(prev => prev.map(p => (byId.has(p.product_id) ? { ...p, product_variant_stock: byId.get(p.product_id) } : p)));
  }

  function flash(type, msg) {
    setNotice({ type, msg });
    if (type === 'success') setTimeout(() => setNotice(n => (n?.msg === msg ? null : n)), 3500);
  }

  const buyerTerm = normalizeName(buyerSearch);
  const productTerm = normalizeName(productSearch);
  const visibleSales = useMemo(() => sales.filter(s =>
    (showCancelled || s.status === 'Active')
    && (!buyerTerm || normalizeName(s.buyer_name).includes(buyerTerm))
    && (!productTerm || s.offline_sale_items.some(i => normalizeName(i.product_name_snapshot).includes(productTerm)))
  ), [sales, showCancelled, buyerTerm, productTerm]);

  const activeSales = sales.filter(s => s.status === 'Active');
  const periodTotals = sumLines(activeSales.flatMap(s => s.offline_sale_items));
  const buyerCount = new Set(activeSales.map(s => normalizeName(s.buyer_name))).size;
  const cancelledCount = sales.length - activeSales.length;

  function toggle(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCancel(sale) {
    if (!window.confirm(`Cancel ${sale.buyer_name}'s offline sale? It will be kept for your records but left out of the totals, and any Available stock will be put back.`)) return;
    setBusyId(sale.id);
    const { error } = await supabase.rpc('offline_sale_cancel', { p_sale_id: sale.id });
    setBusyId(null);
    if (error) return flash('error', `Couldn't cancel the sale: ${error.message}`);
    await Promise.all([reload(), reloadStock()]);
    flash('success', `${sale.buyer_name}'s sale was cancelled.`);
  }

  async function handleDelete(sale) {
    const stockNote = sale.status === 'Active' ? ' Any Available stock will be put back.' : '';
    if (!window.confirm(`Permanently delete ${sale.buyer_name}'s offline sale? This can't be undone.${stockNote}`)) return;
    setBusyId(sale.id);
    const { error } = await supabase.rpc('offline_sale_delete', { p_sale_id: sale.id });
    setBusyId(null);
    if (error) return flash('error', `Couldn't delete the sale: ${error.message}`);
    await Promise.all([reload(), reloadStock()]);
    flash('success', `${sale.buyer_name}'s sale was deleted.`);
  }

  async function handleSaved(saleId, isNew, buyer) {
    setEditing(null);
    await Promise.all([reload(), reloadStock()]);
    setExpanded(prev => new Set(prev).add(saleId));
    flash('success', isNew ? `Offline sale for ${buyer} recorded.` : `${buyer}'s sale was updated.`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-[#1e2d3d]">Offline Buyers</h1>
        <PeriodSwitcher periods={periods} selectedId={selectedId} activeId={activePeriod?.id} onChange={selectPeriod} loading={periodsLoading} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-gray-400">Sales paid to you directly, outside the app. Not included in the dashboards.</p>
        <button
          onClick={() => setEditing({ sale: null })}
          disabled={selectedId == null}
          className="flex items-center gap-1.5 bg-[#F2AA25] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <span className="text-lg leading-none">+</span> Record offline sale
        </button>
      </div>

      {notice && (
        <div className={`mb-4 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-3 ${notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Period totals (active sales only) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Buyers', value: buyerCount },
          { label: 'Units sold', value: periodTotals.units },
          { label: 'Revenue', value: ghs(periodTotals.revenue), strong: true },
          { label: 'Cost', value: ghs(periodTotals.cost) },
          { label: 'Misc', value: ghs(periodTotals.misc) },
          { label: 'Profit', value: ghs(periodTotals.profit), accent: true },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl shadow-sm px-4 py-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-base font-bold mt-0.5 ${c.accent ? 'text-green-600' : c.strong ? 'text-[#F2AA25]' : 'text-[#1e2d3d]'}`}>
              {loading ? '…' : c.value}
            </p>
          </div>
        ))}
      </div>
      {!loading && periodTotals.discount > 0 && (
        <p className="text-xs text-gray-400 -mt-4 mb-6">Includes {ghs(periodTotals.discount)} in product discounts.</p>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-[#1e2d3d] mr-auto">
            Sales ({(buyerTerm || productTerm) ? `${visibleSales.length} of ${showCancelled ? sales.length : activeSales.length}` : (showCancelled ? sales.length : activeSales.length)})
          </h2>
          <SearchBox value={buyerSearch} onChange={setBuyerSearch} placeholder="Search buyer name…" />
          <SearchBox value={productSearch} onChange={setProductSearch} placeholder="Search product…" />
          {cancelledCount > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} className="accent-[#F2AA25]" />
              Show cancelled ({cancelledCount})
            </label>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-12 text-sm text-red-600">{loadError}</div>
        ) : visibleSales.length === 0 ? (
          <div className="text-center py-12 text-sm">
            {(buyerTerm || productTerm) ? (
              <>
                <p className="text-gray-400">No sales match your search.</p>
                <button type="button" onClick={() => { setBuyerSearch(''); setProductSearch(''); }} className="mt-2 text-xs font-semibold text-[#F2AA25] hover:underline">
                  Clear search
                </button>
              </>
            ) : (
              <p className="text-gray-400">No offline sales recorded in this period yet.</p>
            )}
          </div>
        ) : (
          <ul>
            {visibleSales.map(sale => {
              const t = sumLines(sale.offline_sale_items);
              const isOpen = expanded.has(sale.id);
              const cancelled = sale.status === 'Cancelled';
              return (
                <li key={sale.id} className="border-b border-gray-50 last:border-b-0">
                  <div className={`px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${cancelled ? 'opacity-60' : ''}`}>
                    <button onClick={() => toggle(sale.id)} className="flex-1 min-w-[180px] text-left group" aria-expanded={isOpen}>
                      <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className="text-gray-400 shrink-0 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                        <span className="font-semibold text-[#1e2d3d] group-hover:text-[#F2AA25] transition-colors">{sale.buyer_name}</span>
                        {cancelled && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Cancelled</span>}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5 ml-[22px]">
                        {new Date(sale.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{sale.offline_sale_items.length} product{sale.offline_sale_items.length !== 1 ? 's' : ''} · {t.units} unit{t.units !== 1 ? 's' : ''}
                      </span>
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1e2d3d]">{ghs(t.revenue)}</p>
                      <p className="text-[11px] text-green-600 font-semibold">Profit {ghs(t.profit)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {busyId === sale.id ? (
                        <div className="w-4 h-4 m-2 border-2 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          {!cancelled && (
                            <IconButton title="Edit" onClick={() => setEditing({ sale })}>
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </IconButton>
                          )}
                          {!cancelled && (
                            <IconButton title="Cancel sale" onClick={() => handleCancel(sale)}>
                              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </IconButton>
                          )}
                          <IconButton title="Delete" danger onClick={() => handleDelete(sale)}>
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      {sale.note && <p className="text-xs text-gray-500 pt-3"><span className="font-semibold">Note:</span> {sale.note}</p>}
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full text-xs min-w-[640px]">
                          <thead>
                            <tr className="text-gray-400 text-left">
                              <th className="pb-2 font-semibold">Product</th>
                              <th className="pb-2 font-semibold">Colour</th>
                              <th className="pb-2 font-semibold">Size</th>
                              <th className="pb-2 font-semibold text-center">Qty</th>
                              <th className="pb-2 font-semibold text-right">Unit price</th>
                              <th className="pb-2 font-semibold text-right">Cost</th>
                              <th className="pb-2 font-semibold text-right">Misc</th>
                              <th className="pb-2 font-semibold text-right">Profit</th>
                              <th className="pb-2 font-semibold text-right">Line total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.offline_sale_items.map(i => (
                              <tr key={i.id} className="border-t border-gray-200 align-top">
                                <td className="py-2 pr-3 font-medium text-[#1e2d3d]">
                                  {i.product_name_snapshot}
                                  <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${i.product_type === 'Available' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>
                                    {i.product_type}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-gray-600">{i.colour || '—'}</td>
                                <td className="py-2 pr-3 text-gray-600">{i.size || '—'}</td>
                                <td className="py-2 text-center font-bold text-[#1e2d3d]">{i.quantity}</td>
                                <td className="py-2 text-right">
                                  <PriceCell unit={i.unit_price} original={i.original_price} discount={i.discount_amount} />
                                </td>
                                <td className="py-2 text-right text-gray-600">{ghs(i.cost_price)}</td>
                                <td className="py-2 text-right text-gray-600">{ghs(i.misc_amount)}</td>
                                <td className="py-2 text-right text-green-600 font-semibold">{ghs(i.profit)}</td>
                                <td className="py-2 text-right font-bold text-[#1e2d3d]">{ghs(i.unit_price * i.quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300 text-[#1e2d3d]">
                              <td colSpan={3} className="pt-2 font-bold">Sale total</td>
                              <td className="pt-2 text-center font-bold">{t.units}</td>
                              <td className="pt-2 text-right text-gray-500">{t.discount > 0 ? `−${ghs(t.discount)} disc.` : ''}</td>
                              <td className="pt-2 text-right font-semibold">{ghs(t.cost)}</td>
                              <td className="pt-2 text-right font-semibold">{ghs(t.misc)}</td>
                              <td className="pt-2 text-right font-bold text-green-600">{ghs(t.profit)}</td>
                              <td className="pt-2 text-right font-bold text-[#F2AA25]">{ghs(t.revenue)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <SaleForm
          sale={editing.sale}
          products={products}
          periodId={editing.sale?.order_period_id ?? selectedId}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full sm:w-52">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace('…', '')}
        className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}

function IconButton({ title, onClick, danger, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-2 rounded-lg transition-colors ${danger ? 'text-gray-300 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-[#1e2d3d] hover:bg-gray-100'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function PriceCell({ unit, original, discount }) {
  return (
    <span className="whitespace-nowrap">
      {Number(discount) > 0 && <span className="text-gray-400 line-through mr-1">{ghs(original)}</span>}
      <span className="font-semibold text-[#1e2d3d]">{ghs(unit)}</span>
      {Number(discount) > 0 && <span className="block text-[10px] text-red-500 font-semibold">−{ghs(discount)} discount</span>}
    </span>
  );
}

// ── Record / edit form ────────────────────────────────────────────────────────

function SaleForm({ sale, products, periodId, onClose, onSaved }) {
  const productById = useMemo(() => new Map(products.map(p => [p.product_id, p])), [products]);
  const [buyer, setBuyer] = useState(sale?.buyer_name ?? '');
  const [note, setNote] = useState(sale?.note ?? '');
  const [lines, setLines] = useState(() => sale
    ? sale.offline_sale_items.map(i => ({
        key: `item-${i.id}`, item_id: i.id, product_id: i.product_id, product_name: i.product_name_snapshot,
        size: i.size ?? '', colour: i.colour ?? '', quantity: String(i.quantity), saved: i,
      }))
    : [blankLine()]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Units this sale already holds per variant (put back first when an edit is saved).
  const heldBySale = useMemo(() => {
    const m = {};
    if (sale?.status === 'Active') {
      for (const i of sale.offline_sale_items) {
        if (i.product_type === 'Available') {
          const k = variantKey(i.product_id, i.size, i.colour);
          m[k] = (m[k] ?? 0) + i.quantity;
        }
      }
    }
    return m;
  }, [sale]);

  function lineInfo(line) {
    const product = line.product_id != null ? productById.get(line.product_id) : null;
    const { sizes, colours } = productOptions(product);
    const keptVariant = line.saved
      && line.saved.product_id === line.product_id
      && (line.saved.size ?? '') === line.size
      && (line.saved.colour ?? '') === line.colour;
    const ready = keptVariant || (product != null && (!sizes.length || line.size) && (!colours.length || line.colour));
    const pricing = !ready ? null
      : keptVariant ? line.saved
      : getVariantPricing(product, line.size || null);
    const isAvailable = keptVariant ? line.saved.product_type === 'Available' : product?.product_status?.status_name === 'Available';
    let stock = null;
    if (ready && isAvailable && product) {
      const row = (product.product_variant_stock ?? []).find(r => r.size === line.size && r.colour === line.colour);
      if (row) stock = row.stock_quantity + (heldBySale[variantKey(line.product_id, line.size || null, line.colour || null)] ?? 0);
    }
    return { product, sizes, colours, keptVariant, pricing, stock, isAvailable, locked: keptVariant && !product };
  }

  const infos = lines.map(lineInfo);
  const qtyOf = l => (/^\d+$/.test(l.quantity) ? Number(l.quantity) : 0);
  const totals = sumLines(lines.map((l, i) => (infos[i].pricing ? { ...infos[i].pricing, quantity: qtyOf(l) } : { quantity: qtyOf(l) })));

  // Units requested per tracked variant across all lines (for the oversell warning).
  const requested = {};
  lines.forEach((l, i) => {
    if (infos[i].stock != null) {
      const k = variantKey(l.product_id, l.size, l.colour);
      requested[k] = (requested[k] ?? 0) + qtyOf(l);
    }
  });

  function update(key, patch) {
    setDirty(true);
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function chooseProduct(key, p) {
    const { sizes, colours } = productOptions(p);
    update(key, {
      product_id: p.product_id, product_name: p.product_name,
      size: sizes.length === 1 ? sizes[0] : '', colour: colours.length === 1 ? colours[0] : '',
    });
  }

  function validate() {
    const errs = {};
    if (!buyer.trim()) errs.buyer = "Enter the buyer's name.";
    lines.forEach((l, i) => {
      const info = infos[i];
      // A kept line (unchanged variant) only needs a valid quantity.
      if (!info.keptVariant && l.product_id == null) errs[l.key] = 'Choose a product from the list.';
      else if (!info.keptVariant && !info.product) errs[l.key] = 'This product is no longer in the shop. Choose another.';
      else if (!info.keptVariant && info.sizes.length && !l.size) errs[l.key] = 'Choose a size.';
      else if (!info.keptVariant && info.colours.length && !l.colour) errs[l.key] = 'Choose a colour.';
      else if (!/^\d+$/.test(l.quantity) || Number(l.quantity) < 1 || Number(l.quantity) > 10000) errs[l.key] = 'Quantity must be a whole number from 1 to 10,000.';
    });
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    setFormError('');
    if (Object.values(errs).some(Boolean)) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    const items = lines.map(l => ({
      product_id: l.product_id,
      size: l.size || null,
      colour: l.colour || null,
      quantity: Number(l.quantity),
      ...(l.item_id ? { item_id: l.item_id } : {}),
    }));
    const { data, error } = await supabase.rpc('offline_sale_save', {
      p_sale_id: sale?.id ?? null,
      p_buyer_name: buyer.trim(),
      p_order_period_id: periodId,
      p_note: note.trim() || null,
      p_items: items,
    });
    setSaving(false);
    if (error) {
      setFormError(`Couldn't save: ${error.message}`);
      return;
    }
    onSaved(data, !sale, buyer.trim());
  }

  function handleClose() {
    if (dirty && !window.confirm('Discard the changes to this sale?')) return;
    onClose();
  }

  // Close on Escape.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !saving) handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget && !saving) handleClose(); }}>
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-4xl sm:rounded-2xl shadow-xl flex flex-col max-h-full sm:max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-sale-title"
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 id="offline-sale-title" className="text-base font-bold text-[#1e2d3d]">{sale ? 'Edit offline sale' : 'Record offline sale'}</h2>
          <button type="button" onClick={handleClose} disabled={saving} aria-label="Close" className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="offline-buyer">Buyer's name</label>
          <input
            id="offline-buyer"
            value={buyer}
            onChange={e => { setBuyer(e.target.value); setDirty(true); setErrors(p => ({ ...p, buyer: undefined })); }}
            maxLength={120}
            placeholder="e.g. Akosua Mensah"
            autoFocus={!sale}
            className={`w-full sm:max-w-sm border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors ${errors.buyer ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors.buyer && <p className="text-[11px] text-red-600 mt-1">{errors.buyer}</p>}

          <div className="flex items-center justify-between mt-5 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</h3>
            <p className="text-[11px] text-gray-400">Prices come from each product's settings.</p>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => {
              const info = infos[idx];
              const k = variantKey(line.product_id, line.size, line.colour);
              const oversell = info.stock != null && (requested[k] ?? 0) > info.stock;
              const qty = qtyOf(line);
              return (
                <div key={line.key} className={`rounded-xl border p-3 ${errors[line.key] ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-[220px]">
                      <ProductPicker
                        products={products}
                        value={line.product_name}
                        locked={info.locked}
                        onPick={p => chooseProduct(line.key, p)}
                        onType={text => update(line.key, { product_name: text, product_id: null, size: '', colour: '' })}
                      />
                    </div>
                    {info.colours.length > 0 && (
                      <select
                        value={line.colour}
                        onChange={e => update(line.key, { colour: e.target.value })}
                        aria-label="Colour"
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-[#F2AA25]"
                      >
                        <option value="">Colour…</option>
                        {info.colours.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                    {info.sizes.length > 0 && (
                      <select
                        value={line.size}
                        onChange={e => update(line.key, { size: e.target.value })}
                        aria-label="Size"
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-[#F2AA25]"
                      >
                        <option value="">Size…</option>
                        {info.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {info.locked && (line.colour || line.size) && (
                      <span className="text-xs text-gray-500 px-1 py-2">{[line.colour, line.size].filter(Boolean).join(' · ')}</span>
                    )}
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="1"
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={e => update(line.key, { quantity: e.target.value })}
                      aria-label="Quantity"
                      className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25]"
                    />
                    <button
                      type="button"
                      onClick={() => { setDirty(true); setLines(prev => prev.filter(l => l.key !== line.key)); }}
                      disabled={lines.length === 1}
                      title="Remove this product"
                      aria-label="Remove this product"
                      className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  {info.pricing ? (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-6 gap-x-3 gap-y-1 text-xs">
                      <Figure label="Cost" value={ghs(info.pricing.cost_price)} />
                      <Figure label="Profit" value={ghs(info.pricing.profit)} className="text-green-600" />
                      <Figure label="Misc" value={ghs(info.pricing.misc_amount)} />
                      <div className="sm:col-span-2">
                        <span className="text-gray-400">Selling price </span>
                        <PriceCell unit={info.pricing.unit_price} original={info.pricing.original_price} discount={info.pricing.discount_amount} />
                      </div>
                      <Figure label={`Total (${qty})`} value={ghs(info.pricing.unit_price * qty)} className="text-[#F2AA25] font-bold" />
                    </div>
                  ) : line.product_id != null ? (
                    <p className="mt-2 text-xs text-gray-400">Choose {[info.colours.length && !line.colour && 'a colour', info.sizes.length && !line.size && 'a size'].filter(Boolean).join(' and ')} to see the price.</p>
                  ) : null}

                  <div className="flex flex-wrap gap-x-3 mt-1">
                    {info.keptVariant && <p className="text-[11px] text-gray-400">Price as recorded on {new Date(sale.created_at).toLocaleDateString()}.</p>}
                    {info.stock != null && (
                      <p className={`text-[11px] font-semibold ${oversell ? 'text-amber-600' : 'text-gray-400'}`}>
                        {oversell
                          ? `Only ${Math.max(info.stock, 0)} in stock — the extra units will be counted as oversold.`
                          : `${info.stock} in stock`}
                      </p>
                    )}
                  </div>
                  {errors[line.key] && <p className="text-[11px] text-red-600 mt-1">{errors[line.key]}</p>}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { setDirty(true); setLines(prev => [...prev, blankLine()]); }}
            disabled={lines.length >= 100}
            className="mt-3 text-sm font-semibold text-[#F2AA25] hover:underline disabled:opacity-40"
          >
            + Add another product
          </button>

          <label className="block text-xs font-semibold text-gray-500 mt-5 mb-1" htmlFor="offline-note">Note (optional)</label>
          <textarea
            id="offline-note"
            value={note}
            onChange={e => { setNote(e.target.value); setDirty(true); }}
            maxLength={1000}
            rows={2}
            placeholder="e.g. Paid by MoMo on 12 Oct"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25] resize-y"
          />
        </div>

        {/* Sale totals */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 sm:rounded-b-2xl">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs mb-3">
            <Figure label="Units" value={totals.units} />
            <Figure label="Cost" value={ghs(totals.cost)} />
            <Figure label="Misc" value={ghs(totals.misc)} />
            <Figure label="Discount" value={totals.discount > 0 ? `−${ghs(totals.discount)}` : ghs(0)} />
            <Figure label="Profit" value={ghs(totals.profit)} className="text-green-600 font-bold" />
            <Figure label="Total amount" value={ghs(totals.revenue)} className="text-[#F2AA25] font-bold text-sm" />
          </div>
          {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleClose} disabled={saving} className="px-4 py-2 text-sm font-semibold text-gray-500 rounded-xl hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#1e2d3d] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : sale ? 'Save changes' : 'Record sale'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Figure({ label, value, className = '' }) {
  return (
    <div>
      <span className="block text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`font-semibold text-[#1e2d3d] ${className}`}>{value}</span>
    </div>
  );
}

// Type-to-search product field with a suggestion list (keyboard: ↑ ↓ Enter Esc).
function ProductPicker({ products, value, locked, onPick, onType }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const term = normalizeName(value);
  const matches = useMemo(() => {
    if (!term) return products.slice(0, 8);
    const starts = [], contains = [];
    for (const p of products) {
      const n = normalizeName(p.product_name);
      if (n.startsWith(term)) starts.push(p);
      else if (n.includes(term)) contains.push(p);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [products, term]);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (locked) {
    return (
      <div className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-[#1e2d3d]" title="This product is no longer in the shop; the line keeps its recorded details.">
        {value} <span className="text-[11px] text-gray-400">(no longer listed)</span>
      </div>
    );
  }

  function pick(p) {
    onPick(p);
    setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={value}
        onChange={e => { onType(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
          else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
        }}
        placeholder="Start typing a product name…"
        aria-label="Product"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors"
      />
      {open && (
        <ul role="listbox" className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400">No products match “{value.trim()}”.</li>
          ) : matches.map((p, i) => {
            const status = p.product_status?.status_name ?? '';
            return (
              <li
                key={p.product_id}
                role="option"
                aria-selected={i === active}
                onMouseDown={e => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${i === active ? 'bg-amber-50' : ''}`}
              >
                {p.product_image_url
                  ? <img src={thumbUrl(p.product_image_url, 80)} onError={imgFallback(p.product_image_url)} alt="" loading="lazy" className="w-8 h-8 rounded-lg object-cover shrink-0 bg-gray-100" />
                  : <span className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />}
                <span className="flex-1 min-w-0 truncate text-[#1e2d3d]">{p.product_name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${status === 'Available' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>
                  {status || 'Pre-order'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
