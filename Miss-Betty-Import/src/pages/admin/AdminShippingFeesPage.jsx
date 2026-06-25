import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from 'xlsx';

function buildFeeGroups(rows, existingFees) {
  const groupMap = {};
  rows.filter(r => r.products?.product_status?.status_name !== 'Available').forEach(row => {
    const key = `${row.product_id}::${row.size ?? ''}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        product_id: row.product_id,
        product_name: row.products?.product_name ?? `Product #${row.product_id}`,
        size: row.size || '—',
        size_raw: row.size ?? '',
        total_qty: 0,
        paid_qty: 0,
        unpaid_qty: 0,
        shipping_fee: 0,
        customer_rows: [],
        latest_order_at: 0,
      };
    }
    const qty = Number(row.quantity ?? 1);
    const paid = !!row.shipping_fee_paid;
    groupMap[key].total_qty += qty;
    if (paid) groupMap[key].paid_qty += qty;
    else groupMap[key].unpaid_qty += qty;

    const orderTs = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (orderTs > groupMap[key].latest_order_at) {
      groupMap[key].latest_order_at = orderTs;
    }

    const name = row.customers?.customer_name ?? 'Unknown';
    const existing = groupMap[key].customer_rows.find(c => c.name === name && c.paid === paid);
    if (existing) { existing.qty += qty; }
    else { groupMap[key].customer_rows.push({ name, qty, paid }); }
  });

  const feeMap = {};
  (existingFees ?? []).forEach(r => {
    const key = `${r.product_id}::${r.size ?? ''}`;
    feeMap[key] = r;
  });

  return Object.values(groupMap).filter(g => {
    const key = `${g.product_id}::${g.size_raw}`;
    const feeRecord = feeMap[key];
    if (!feeRecord?.dismissed_at) return true;
    const dismissedAt = new Date(feeRecord.dismissed_at).getTime();
    return g.latest_order_at > dismissedAt;
  }).map(g => {
    const key = `${g.product_id}::${g.size_raw}`;
    const feeRecord = feeMap[key];
    g.shipping_fee = (feeRecord && !feeRecord.dismissed_at)
      ? Number(feeRecord.shipping_fee ?? 0)
      : 0;
    return g;
  });
}

export default function AdminShippingFeesPage() {
  const [feeGroups, setFeeGroups] = useState([]);
  const [feeInputs, setFeeInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data }, { data: existingFees }] = await Promise.all([
      supabase
        .from('orders')
        .select('product_id, size, quantity, shipping_fee_paid, created_at, products(product_name, product_status(status_name)), customers(customer_name)')
        .eq('deleted_by_admin', false)
        .order('created_at', { ascending: false }),
      supabase.from('product_size_shipping_fees').select('*'),
    ]);

    const groups = buildFeeGroups(data ?? [], existingFees);
    setFeeGroups(groups);

    const inputs = {};
    groups.forEach(g => {
      const key = `${g.product_id}::${g.size_raw}`;
      inputs[key] = g.shipping_fee > 0 ? String(g.shipping_fee) : '';
    });
    setFeeInputs(inputs);
    setLoading(false);
  }

  function toggleExpand(key) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleDownloadExcel() {
    const data = feeGroups.map(g => ({
      'Product Name':        g.product_name,
      'Size':                g.size,
      'Total Qty':           g.total_qty,
      'Paid Qty':            g.paid_qty,
      'Unpaid Qty':          g.unpaid_qty,
      'Shipping Fee (GHS)':  g.shipping_fee > 0 ? g.shipping_fee : '',
      'Outstanding (GHS)':   g.shipping_fee > 0 ? g.shipping_fee * g.unpaid_qty : '',
      'Total Charged (GHS)': g.shipping_fee > 0 ? g.shipping_fee * g.total_qty : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipping Fees');
    XLSX.writeFile(wb, 'Miss-Betty-Shipping-Fees.xlsx');
  }

  async function handleDeleteFee(productId, sizeRaw, sizeDisplay) {
    const key = `${productId}::${sizeRaw}`;
    if (!window.confirm('Remove the shipping fee for this product/size?')) return;
    await supabase
      .from('product_size_shipping_fees')
      .upsert(
        { product_id: productId, size: sizeRaw, shipping_fee: 0, dismissed_at: new Date().toISOString() },
        { onConflict: 'product_id,size' }
      );
    setFeeGroups(prev => prev.filter(g =>
      !(g.product_id === productId && g.size === sizeDisplay)
    ));
    setFeeInputs(prev => ({ ...prev, [key]: '' }));
  }

  async function handleFeeBlur(productId, sizeRaw, sizeDisplay, value) {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) return;
    const key = `${productId}::${sizeRaw}`;
    setSavingKey(key);
    await supabase
      .from('product_size_shipping_fees')
      .upsert(
        { product_id: productId, size: sizeRaw, shipping_fee: parsed, dismissed_at: null },
        { onConflict: 'product_id,size' }
      );
    setFeeGroups(prev => prev.map(g =>
      g.product_id === productId && g.size === sizeDisplay ? { ...g, shipping_fee: parsed } : g
    ));
    setSavingKey(null);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Shipping Fees</h1>
      <p className="text-sm text-gray-400 mb-6">Set shipping fees per product and size</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#1e2d3d]">
                Product / Size ({feeGroups.length})
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Enter one fee per product + size. Click a row to see customer payment details.
              </p>
            </div>
            <button
              onClick={handleDownloadExcel}
              disabled={feeGroups.length === 0}
              className="flex items-center gap-1.5 bg-[#1e2d3d] text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Excel
            </button>
          </div>

          {feeGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Size</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Qty</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Paid</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Shipping Fee (GHS)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Outstanding (GHS)</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {feeGroups.map(group => {
                    const key = `${group.product_id}::${group.size_raw}`;
                    const fee = group.shipping_fee;
                    const outstanding = fee > 0 ? fee * group.unpaid_qty : null;
                    const isExpanded = expandedKeys.has(key);

                    const statusBadge = group.unpaid_qty === 0
                      ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">All Paid</span>
                      : group.paid_qty > 0
                        ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Partial</span>
                        : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">Unpaid</span>;

                    return (
                      <>
                        <tr key={key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{group.product_name}</td>
                          <td className="px-4 py-3 text-gray-600">{group.size}</td>
                          <td className="px-4 py-3 text-center font-bold text-[#1e2d3d]">{group.total_qty}</td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className={group.paid_qty > 0 ? "font-bold text-green-600" : "text-gray-400"}>
                              {group.paid_qty}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">{statusBadge}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={feeInputs[key] ?? ''}
                                onChange={e => setFeeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                onBlur={e => handleFeeBlur(group.product_id, group.size_raw, group.size, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                placeholder="0.00"
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F2AA25] transition-colors"
                              />
                              {savingKey === key && (
                                <div className="w-3.5 h-3.5 border-2 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#F2AA25] hidden md:table-cell">
                            {outstanding != null ? `GHS ${outstanding.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleExpand(key)}
                                title={isExpanded ? 'Collapse' : 'Show customers'}
                                className="text-gray-400 hover:text-[#1e2d3d] transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="15" height="15"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                              {group.shipping_fee > 0 && (
                                <button
                                  onClick={() => handleDeleteFee(group.product_id, group.size_raw, group.size)}
                                  title="Remove fee"
                                  className="text-gray-300 hover:text-red-400 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={key + '-detail'}>
                            <td colSpan={8} className="px-5 pb-4 pt-0 bg-gray-50 border-b border-gray-100">
                              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 pt-3">Customer Breakdown</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400">
                                    <th className="text-left pb-1.5 font-semibold">Customer</th>
                                    <th className="text-center pb-1.5 font-semibold">Qty</th>
                                    <th className="text-left pb-1.5 font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.customer_rows.map((c, i) => (
                                    <tr key={i} className="border-t border-gray-200">
                                      <td className="py-1.5 font-medium text-[#1e2d3d]">{c.name}</td>
                                      <td className="py-1.5 text-center text-gray-600">{c.qty}</td>
                                      <td className="py-1.5">
                                        {c.paid
                                          ? <span className="font-semibold text-green-600">✓ Paid</span>
                                          : <span className="font-semibold text-amber-600">● Awaiting</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
