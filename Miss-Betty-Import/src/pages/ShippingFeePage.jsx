import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { colourMap } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function ShippingFeePage() {
  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRows() {
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }

      const { data } = await supabase
        .from('orders')
        .select('*, products(product_name)')
        .eq('customer_id', cust.customer_id)
        .order('created_at', { ascending: false });

      setRows(data ?? []);
      setLoading(false);
    }
    loadRows();
  }, [session]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-3">🚚</div>
        <h2 className="text-xl font-bold text-[#1e2d3d] mb-2">No shipping info yet</h2>
        <p className="text-gray-400 mb-8">Shipping fees will appear here once your orders are processed.</p>
        <Link to="/shop" className="inline-block bg-[#F2AA25] text-white font-bold px-8 py-3 rounded-2xl hover:opacity-90">
          Shop Now
        </Link>
      </div>
    );
  }

  const grandTotal = rows.reduce((sum, r) => {
    const fee = Number(r.shipping_fee ?? 0);
    const qty = Number(r.quantity ?? 1);
    return sum + fee * qty;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <h1 className="text-xl sm:text-2xl font-bold text-[#1e2d3d] mb-1">Shipping Fees</h1>
      <p className="text-sm text-gray-400 mb-5">Shipping fee breakdown for your orders</p>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Order ID", "Items", "Size", "Colour", "Qty", "Shipping Fee (GHS/item)", "Total Shipping (GHS)"].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const fee = Number(row.shipping_fee ?? 0);
              const qty = Number(row.quantity ?? 1);
              const hasFee = fee > 0;
              return (
                <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-3 font-semibold text-[#F2AA25] text-xs whitespace-nowrap">{row.order_id}</td>
                  <td className="px-3 py-3 text-[#1e2d3d]">{row.products?.product_name ?? `Product #${row.product_id}`}</td>
                  <td className="px-3 py-3 text-gray-500">{row.size ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                        style={{ backgroundColor: colourMap[row.colour] || "#ccc" }}
                      />
                      <span className="text-gray-600">{row.colour ?? '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{qty}</td>
                  <td className="px-3 py-3 font-semibold text-[#1e2d3d]">
                    {hasFee ? `GHS ${fee.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-3 font-bold text-[#F2AA25]">
                    {hasFee ? `GHS ${(fee * qty).toLocaleString()}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {grandTotal > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#1e2d3d] bg-gray-50">
                <td colSpan={6} className="px-3 py-3 text-right font-bold text-[#1e2d3d] text-sm">Grand Total</td>
                <td className="px-3 py-3 font-bold text-[#F2AA25] text-sm">GHS {grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-3">
        {rows.map(row => {
          const fee = Number(row.shipping_fee ?? 0);
          const qty = Number(row.quantity ?? 1);
          const hasFee = fee > 0;
          return (
            <div key={row.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#F2AA25] text-sm">{row.order_id}</span>
                {hasFee && (
                  <span className="text-xs font-bold text-white bg-[#F2AA25] px-2.5 py-1 rounded-full">
                    GHS {(fee * qty).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-[#1e2d3d] mb-3">
                {row.products?.product_name ?? `Product #${row.product_id}`}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                <span><span className="font-semibold text-[#1e2d3d]">Size:</span> {row.size ?? '—'}</span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-[#1e2d3d]">Colour:</span>
                  <span className="w-2.5 h-2.5 rounded-full border border-gray-200 inline-block mx-1" style={{ backgroundColor: colourMap[row.colour] || "#ccc" }} />
                  {row.colour ?? '—'}
                </span>
                <span><span className="font-semibold text-[#1e2d3d]">Qty:</span> {qty}</span>
                <span><span className="font-semibold text-[#1e2d3d]">Fee/item:</span> {hasFee ? `GHS ${fee.toLocaleString()}` : '—'}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-400">Total Shipping</span>
                <span className="font-bold text-[#1e2d3d] text-sm">{hasFee ? `GHS ${(fee * qty).toLocaleString()}` : '—'}</span>
              </div>
            </div>
          );
        })}

        {grandTotal > 0 && (
          <div className="bg-[#1e2d3d] rounded-2xl p-4 flex justify-between items-center">
            <span className="text-white font-semibold text-sm">Grand Total</span>
            <span className="text-[#F2AA25] font-bold text-lg">GHS {grandTotal.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="mt-5 text-center">
        <Link to="/shop" className="inline-block text-[#F2AA25] font-semibold hover:underline">
          ← Continue Shopping
        </Link>
      </div>
    </div>
  );
}
