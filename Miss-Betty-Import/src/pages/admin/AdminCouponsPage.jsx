import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700",
  used:      "bg-gray-100 text-gray-500",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);

    const [{ data: couponRows, error: couponErr }, { data: referralRows, error: referralErr }] = await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
    ]);
    if (couponErr) console.error('[AdminCouponsPage] coupons fetch failed:', couponErr.message);
    if (referralErr) console.error('[AdminCouponsPage] referrals fetch failed:', referralErr.message);

    const rows = couponRows ?? [];
    const refs = referralRows ?? [];

    const customerIds = [...new Set([
      ...rows.map(c => c.customer_id),
      ...refs.map(r => r.referrer_customer_id),
      ...refs.map(r => r.referred_customer_id),
    ])];

    const { data: customerRows, error: custErr } = customerIds.length
      ? await supabase.from('customers').select('customer_id, customer_name, email, referral_code').in('customer_id', customerIds)
      : { data: [], error: null };
    if (custErr) console.error('[AdminCouponsPage] customers fetch failed:', custErr.message);

    setCoupons(rows);
    setReferrals(refs);
    setCustomersById(Object.fromEntries((customerRows ?? []).map(c => [c.customer_id, c])));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const customerName = id => customersById[id]?.customer_name ?? `Customer #${id}`;

  // Per-customer summary: every customer who either owns a coupon or has referred
  // someone, with counts/values rolled up from the flat coupons/referrals rows above.
  const summaryIds = [...new Set([
    ...coupons.map(c => c.customer_id),
    ...referrals.map(r => r.referrer_customer_id),
  ])];
  const summaryRows = summaryIds.map(id => {
    const own = coupons.filter(c => c.customer_id === id);
    const available = own.filter(c => c.status === 'available');
    const used = own.filter(c => c.status === 'used');
    return {
      customer_id: id,
      customer_name: customersById[id]?.customer_name ?? `Customer #${id}`,
      email: customersById[id]?.email ?? "—",
      referral_code: customersById[id]?.referral_code ?? "—",
      referralCount: referrals.filter(r => r.referrer_customer_id === id).length,
      availableCount: available.length,
      availableValue: available.reduce((s, c) => s + Number(c.amount), 0),
      usedCount: used.length,
      usedValue: used.reduce((s, c) => s + Number(c.amount), 0),
    };
  }).sort((a, b) => b.referralCount - a.referralCount);

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
          {/* Per-customer summary */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Customer Summary ({summaryRows.length})</h2>
            </div>
            {summaryRows.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No referral or coupon activity yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Referral Code</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Referrals</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Available</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map(s => (
                      <tr key={s.customer_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{s.customer_name}</td>
                        <td className="px-4 py-3 text-gray-500">{s.email}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{s.referral_code}</td>
                        <td className="px-4 py-3 text-center font-bold text-[#1e2d3d]">{s.referralCount}</td>
                        <td className="px-4 py-3 text-green-700">
                          {s.availableCount} {s.availableCount > 0 && `(GHS ${s.availableValue.toLocaleString()})`}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {s.usedCount} {s.usedCount > 0 && `(GHS ${s.usedValue.toLocaleString()})`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Coupons history */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Coupon History ({coupons.length})</h2>
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
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{customerName(c.customer_id)}</td>
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

          {/* Referral history */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Referral History ({referrals.length})</h2>
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
                    {referrals.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{customerName(r.referrer_customer_id)}</td>
                        <td className="px-4 py-3 text-gray-600">{customerName(r.referred_customer_id)}</td>
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
