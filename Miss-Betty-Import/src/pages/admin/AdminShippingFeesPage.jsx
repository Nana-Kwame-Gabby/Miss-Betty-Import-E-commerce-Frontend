import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from 'xlsx';
import { useSelectedOrderPeriod } from "../../hooks/useSelectedOrderPeriod";
import PeriodSwitcher from "../../components/PeriodSwitcher";

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

  // Every product/size with orders stays listed, so a removed fee can always be set again.
  return Object.values(groupMap).map(g => {
    const key = `${g.product_id}::${g.size_raw}`;
    const feeRecord = feeMap[key];
    g.shipping_fee = (feeRecord && !feeRecord.dismissed_at)
      ? Number(feeRecord.shipping_fee ?? 0)
      : 0;
    return g;
  });
}

const MAX_FEE = 100000;
const feeText = fee => (fee > 0 ? String(fee) : '');

// Returns { value } for a valid fee (rounded to 2 decimals) or { error } with a message.
function parseFee(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { error: 'Enter an amount, or use Remove to clear the fee.' };
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return { error: 'Enter an amount greater than 0.' };
  if (n > MAX_FEE) return { error: `That looks too large (max GHS ${MAX_FEE.toLocaleString()}).` };
  return { value: Math.round(n * 100) / 100 };
}

export default function AdminShippingFeesPage() {
  const { periods, activePeriod, selectedId, selectPeriod, loading: periodsLoading } = useSelectedOrderPeriod();
  const [feeGroups, setFeeGroups] = useState([]);
  const [feeInputs, setFeeInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [rowStatus, setRowStatus] = useState({}); // key -> { type: 'saved' | 'error', msg }
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  useEffect(() => { if (selectedId != null) loadData(); }, [selectedId]);

  const isDirty = g => {
    const key = `${g.product_id}::${g.size_raw}`;
    return String(feeInputs[key] ?? '').trim() !== feeText(g.shipping_fee);
  };
  const hasUnsaved = feeGroups.some(isDirty);

  // Warn before leaving the page with fees typed but not saved.
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  async function loadData() {
    setLoading(true);
    const [{ data }, { data: existingFees }] = await Promise.all([
      supabase
        .from('orders')
        .select('product_id, size, quantity, shipping_fee_paid, created_at, products(product_name, product_status(status_name)), customers(customer_name)')
        .eq('deleted_by_admin', false)
        .eq('order_period_id', selectedId)
        .neq('status', 'Cancelled') // cancelled lines no longer count toward quantities or fees
        .order('created_at', { ascending: false }),
      supabase.from('product_size_shipping_fees').select('*').eq('order_period_id', selectedId),
    ]);

    const groups = buildFeeGroups(data ?? [], existingFees);
    setFeeGroups(groups);

    const inputs = {};
    groups.forEach(g => {
      const key = `${g.product_id}::${g.size_raw}`;
      inputs[key] = feeText(g.shipping_fee);
    });
    setFeeInputs(inputs);
    setRowStatus({});
    setLoading(false);
  }

  function showStatus(key, status) {
    setRowStatus(prev => ({ ...prev, [key]: status }));
    if (status.type === 'saved') {
      setTimeout(() => setRowStatus(prev => (prev[key] === status ? { ...prev, [key]: undefined } : prev)), 2500);
    }
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

  // One fee per (order period, product, size). Buyers with unpaid orders read this row live,
  // so saving here updates every affected buyer; paid orders keep the fee copied at payment.
  async function writeFee(group, fee, dismissed) {
    const { data, error } = await supabase
      .from('product_size_shipping_fees')
      .upsert(
        {
          order_period_id: selectedId,
          product_id: group.product_id,
          size: group.size_raw,
          shipping_fee: fee,
          dismissed_at: dismissed ? new Date().toISOString() : null,
        },
        { onConflict: 'order_period_id,product_id,size' }
      )
      .select('shipping_fee, dismissed_at')
      .single();
    return { saved: data, error };
  }

  function applySavedFee(group, saved) {
    const key = `${group.product_id}::${group.size_raw}`;
    const fee = saved.dismissed_at ? 0 : Number(saved.shipping_fee ?? 0);
    setFeeGroups(prev => prev.map(g =>
      g.product_id === group.product_id && g.size_raw === group.size_raw ? { ...g, shipping_fee: fee } : g
    ));
    setFeeInputs(prev => ({ ...prev, [key]: feeText(fee) }));
  }

  async function saveFee(group) {
    const key = `${group.product_id}::${group.size_raw}`;
    if (savingKey === key || !isDirty(group)) return;
    const { value, error: invalid } = parseFee(feeInputs[key]);
    if (invalid) { showStatus(key, { type: 'error', msg: invalid }); return; }
    if (value === group.shipping_fee) {
      setFeeInputs(prev => ({ ...prev, [key]: feeText(value) })); // e.g. "50.00" → "50", nothing to save
      return;
    }
    setSavingKey(key);
    const { saved, error } = await writeFee(group, value, false);
    setSavingKey(null);
    if (error || !saved) {
      showStatus(key, { type: 'error', msg: `Couldn't save: ${error?.message ?? 'no response from the server'}. Please try again.` });
      return;
    }
    applySavedFee(group, saved);
    showStatus(key, { type: 'saved', msg: 'Saved ✓' });
  }

  async function handleDeleteFee(group) {
    const key = `${group.product_id}::${group.size_raw}`;
    if (!window.confirm('Remove the shipping fee for this product/size?')) return;
    setSavingKey(key);
    const { saved, error } = await writeFee(group, 0, true);
    setSavingKey(null);
    if (error || !saved) {
      showStatus(key, { type: 'error', msg: `Couldn't remove the fee: ${error?.message ?? 'no response from the server'}.` });
      return;
    }
    applySavedFee(group, saved);
    showStatus(key, { type: 'saved', msg: 'Fee removed' });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-[#1e2d3d]">Shipping Fees</h1>
        <PeriodSwitcher periods={periods} selectedId={selectedId} activeId={activePeriod?.id} onChange={selectPeriod} loading={periodsLoading} />
      </div>
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
                    const dirty = isDirty(group);

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
                                inputMode="decimal"
                                value={feeInputs[key] ?? ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  setFeeInputs(prev => ({ ...prev, [key]: v }));
                                  if (rowStatus[key]) setRowStatus(prev => ({ ...prev, [key]: undefined }));
                                }}
                                onBlur={() => saveFee(group)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveFee(group); } }}
                                placeholder="0.00"
                                aria-label={`Shipping fee for ${group.product_name} ${group.size}`}
                                className={`w-24 border rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F2AA25] transition-colors ${
                                  rowStatus[key]?.type === 'error' ? 'border-red-400' : dirty ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                                }`}
                              />
                              {savingKey === key ? (
                                <div className="w-3.5 h-3.5 border-2 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
                              ) : dirty ? (
                                <button
                                  type="button"
                                  onMouseDown={e => e.preventDefault() /* keep focus so blur doesn't save twice */}
                                  onClick={() => saveFee(group)}
                                  className="text-xs font-semibold bg-[#1e2d3d] text-white px-2.5 py-1 rounded-lg hover:opacity-90 transition-opacity"
                                >
                                  Save
                                </button>
                              ) : null}
                            </div>
                            {rowStatus[key] ? (
                              <p className={`text-[11px] mt-1 ${rowStatus[key].type === 'error' ? 'text-red-600' : 'text-green-600 font-semibold'}`}>
                                {rowStatus[key].msg}
                              </p>
                            ) : dirty && savingKey !== key ? (
                              <p className="text-[11px] mt-1 text-amber-600">Unsaved</p>
                            ) : null}
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
                                  onClick={() => handleDeleteFee(group)}
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
