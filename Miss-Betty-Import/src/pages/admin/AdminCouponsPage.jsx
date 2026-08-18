import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700",
  used:      "bg-gray-100 text-gray-500",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [{ data: couponRows }, { data: referralRows }] = await Promise.all([
      supabase
        .from('coupons')
        .select('*, customers(customer_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('referrals')
        .select(`
          created_at,
          referral_code_used,
          referrer:customers!referrals_referrer_customer_id_fkey(customer_name),
          referred:customers!referrals_referred_customer_id_fkey(customer_name)
        `)
        .order('created_at', { ascending: false }),
    ]);
    setCoupons(couponRows ?? []);
    setReferrals(referralRows ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Coupons & Referrals</h1>
      <p className="text-sm text-gray-400 mb-6">Read-only overview — coupons are earned automatically via referrals</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Coupons */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Coupons ({coupons.length})</h2>
            </div>
            {coupons.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No coupons issued yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Earned</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Used On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{c.customers?.customer_name ?? `Customer #${c.customer_id}`}</td>
                        <td className="px-4 py-3 text-gray-600">GHS {Number(c.amount).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[c.status] ?? STATUS_COLORS.used}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.used_order_id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Referrals */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Referrals ({referrals.length})</h2>
            </div>
            {referrals.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No referrals yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Referrer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Referred</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Code Used</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{r.referrer?.customer_name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{r.referred?.customer_name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{r.referral_code_used}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
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
