import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function buildFeeGroups(rows, existingFees) {
  const groupMap = {};
  rows.forEach(row => {
    const key = `${row.product_id}::${row.size ?? ''}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        product_id: row.product_id,
        product_name: row.products?.product_name ?? `Product #${row.product_id}`,
        size: row.size || '—',
        size_raw: row.size ?? '',
        total_quantity: 0,
        shipping_fee: 0,
      };
    }
    groupMap[key].total_quantity += Number(row.quantity ?? 1);
  });
  (existingFees ?? []).forEach(r => {
    const key = `${r.product_id}::${r.size}`;
    if (groupMap[key]) groupMap[key].shipping_fee = Number(r.shipping_fee ?? 0);
  });
  return Object.values(groupMap);
}

export default function AdminShippingFeesPage() {
  const [feeGroups, setFeeGroups] = useState([]);
  const [feeInputs, setFeeInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data }, { data: existingFees }] = await Promise.all([
      supabase
        .from('orders')
        .select('product_id, size, quantity, products(product_name)')
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

  async function handleFeeBlur(productId, sizeRaw, sizeDisplay, value) {
    const parsed = value === '' ? 0 : parseFloat(value);
    if (isNaN(parsed)) return;
    const key = `${productId}::${sizeRaw}`;
    setSavingKey(key);
    await supabase
      .from('product_size_shipping_fees')
      .upsert({ product_id: productId, size: sizeRaw, shipping_fee: parsed }, { onConflict: 'product_id,size' });
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
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#1e2d3d]">
              Product / Size ({feeGroups.length})
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Enter one fee per product + size. It applies to all customers who ordered that combination.
            </p>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Shipping Fee (GHS)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Shipping (GHS)</th>
                  </tr>
                </thead>
                <tbody>
                  {feeGroups.map(group => {
                    const key = `${group.product_id}::${group.size_raw}`;
                    const fee = group.shipping_fee;
                    const total = fee > 0 ? fee * group.total_quantity : null;
                    return (
                      <tr key={key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{group.product_name}</td>
                        <td className="px-4 py-3 text-gray-600">{group.size}</td>
                        <td className="px-4 py-3 text-center font-bold text-[#1e2d3d]">{group.total_quantity}</td>
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
                        <td className="px-4 py-3 text-right font-bold text-[#F2AA25]">
                          {total != null ? `GHS ${total.toLocaleString()}` : '—'}
                        </td>
                      </tr>
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
