import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function MyReferralsPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState(null);
  const [referralCode, setReferralCode] = useState("");
  const [coupons, setCoupons] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);

  async function refreshCoupons(custId) {
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('customer_id', custId)
      .order('created_at', { ascending: false });
    setCoupons(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data: cust } = await supabase
        .from('customers')
        .select('customer_id, referral_code')
        .eq('auth_id', session.user.id)
        .single();

      if (!cust) { setLoading(false); return; }
      setCustomerId(cust.customer_id);
      setReferralCode(cust.referral_code ?? "");

      const [, { data: refRows }] = await Promise.all([
        refreshCoupons(cust.customer_id),
        supabase
          .from('referrals')
          .select('created_at, customers!referrals_referred_customer_id_fkey(customer_name)')
          .eq('referrer_customer_id', cust.customer_id)
          .order('created_at', { ascending: false }),
      ]);
      setReferrals(refRows ?? []);
      setLoading(false);
    }
    init();
  }, [session]);

  // Live-update the coupon list when a new one is earned or one gets used elsewhere.
  useEffect(() => {
    if (!customerId) return;
    const channel = supabase
      .channel(`my_coupons_realtime_${customerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons', filter: `customer_id=eq.${customerId}` },
        () => refreshCoupons(customerId))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [customerId]);

  const shareUrl = `${window.location.origin}/signup?ref=${referralCode}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join Miss Betty Import", url: shareUrl });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing to do
    }
  }

  const availableCoupons = coupons.filter(c => c.status === 'available');
  const usedCoupons      = coupons.filter(c => c.status === 'used');

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      <h1 className="text-lg sm:text-xl font-bold text-[#1e2d3d] mb-3 sm:mb-5">My Referrals & Coupons</h1>

      {/* Referral code + share link */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="font-bold text-[#1e2d3d] text-base mb-1">Your Referral Code</h2>
        <p className="text-xs text-gray-400 mb-3">
          Share this with friends — when they sign up with it, you get a GHS 100 coupon.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg text-[#1e2d3d] bg-gray-100 rounded-xl px-4 py-2">
            {referralCode || "—"}
          </span>
          <div className="relative">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-[#F2AA25] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              Share Link
            </button>
            {copied && (
              <span className="absolute top-full left-0 mt-1 whitespace-nowrap bg-[#1e2d3d] text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-sm">
                Link copied!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Coupons */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="font-bold text-[#1e2d3d] text-base mb-3">
          Available Coupons ({availableCoupons.length})
        </h2>
        {availableCoupons.length === 0 ? (
          <p className="text-sm text-gray-400">No coupons available yet — refer a friend to earn one.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableCoupons.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                <span className="font-bold text-green-700 text-sm">GHS {Number(c.amount).toLocaleString()} off</span>
                <span className="text-xs text-gray-400">
                  Earned {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {usedCoupons.length > 0 && (
          <>
            <h3 className="font-semibold text-[#1e2d3d] text-sm mt-4 mb-2">Used Coupons ({usedCoupons.length})</h3>
            <div className="flex flex-col gap-2">
              {usedCoupons.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <span className="font-semibold text-gray-500 text-sm">GHS {Number(c.amount).toLocaleString()} off</span>
                  <span className="text-xs text-gray-400">
                    Used on {c.used_order_id ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* People referred */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-bold text-[#1e2d3d] text-base mb-3">
          People You've Referred ({referrals.length})
        </h2>
        {referrals.length === 0 ? (
          <p className="text-sm text-gray-400">Nobody has signed up with your code yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {referrals.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[#1e2d3d] font-medium">{r.customers?.customer_name ?? "—"}</span>
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
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
