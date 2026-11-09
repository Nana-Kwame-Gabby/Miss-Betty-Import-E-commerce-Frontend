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
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('customer_id', custId)
      .order('created_at', { ascending: false });
    if (error) console.error('[MyReferralsPage] coupons fetch failed:', error.message);
    setCoupons(data ?? []);
  }

  async function refreshReferrals(custId) {
    const { data: refRows, error } = await supabase
      .from('referrals')
      .select('id, referred_customer_id, referral_code_used, created_at')
      .eq('referrer_customer_id', custId)
      .order('created_at', { ascending: false });
    if (error) console.error('[MyReferralsPage] referrals fetch failed:', error.message);

    const referredIds = [...new Set((refRows ?? []).map(r => r.referred_customer_id))];
    const { data: referredCustomers, error: custErr } = referredIds.length
      ? await supabase.from('customers').select('customer_id, customer_name').in('customer_id', referredIds)
      : { data: [], error: null };
    if (custErr) console.error('[MyReferralsPage] referred-customer names fetch failed:', custErr.message);

    const nameById = Object.fromEntries((referredCustomers ?? []).map(c => [c.customer_id, c.customer_name]));
    setReferrals((refRows ?? []).map(r => ({ ...r, customer_name: nameById[r.referred_customer_id] ?? null })));
  }

  useEffect(() => {
    async function init() {
      const { data: cust, error } = await supabase
        .from('customers')
        .select('customer_id, referral_code')
        .eq('auth_id', session.user.id)
        .single();
      if (error) console.error('[MyReferralsPage] customer lookup failed:', error.message);

      if (!cust) { setLoading(false); return; }
      setCustomerId(cust.customer_id);
      setReferralCode(cust.referral_code ?? "");

      await Promise.all([
        refreshCoupons(cust.customer_id),
        refreshReferrals(cust.customer_id),
      ]);
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
  const availableTotal   = availableCoupons.reduce((s, c) => s + Number(c.amount), 0);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      <h1 className="text-2xl sm:text-[28px] font-bold tracking-[-0.4px] text-mbi-navy mb-4 sm:mb-6">Referrals & coupons</h1>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-mbi-card p-4 text-center">
          <p className="text-2xl font-bold text-mbi-navy">{referrals.length}</p>
          <p className="text-xs text-mbi-slate font-medium mt-0.5">Successful Referrals</p>
        </div>
        <div className="bg-white rounded-mbi-card p-4 text-center">
          <p className="text-2xl font-bold text-mbi-available">{availableCoupons.length}</p>
          <p className="text-xs text-mbi-slate font-medium mt-0.5">
            Available Coupons {availableCoupons.length > 0 && `(GHS ${availableTotal.toLocaleString()})`}
          </p>
        </div>
      </div>

      {/* Referral code + share link */}
      <div className="bg-white rounded-mbi-card p-4 mb-4">
        <h2 className="font-bold text-mbi-navy text-base mb-1">Your Referral Code</h2>
        <p className="text-xs text-mbi-slate mb-3">
          Share this with friends — when they sign up with it, you get a GHS 100 coupon.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg text-mbi-navy bg-mbi-surface-soft rounded-lg px-4 py-2">
            {referralCode || "—"}
          </span>
          <div className="relative">
            <button
              onClick={handleShare}
              className="mbi-press flex items-center gap-1.5 bg-mbi-amber text-mbi-navy text-sm font-semibold px-4 py-2 rounded-lg hover:bg-mbi-amber-press transition-opacity"
            >
              Share Link
            </button>
            {copied && (
              <span className="absolute top-full left-0 mt-1 whitespace-nowrap bg-mbi-navy text-white text-xs font-semibold px-2 py-1 rounded-md">
                Link copied!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Coupons */}
      <div className="bg-white rounded-mbi-card p-4 mb-4">
        <h2 className="font-bold text-mbi-navy text-base mb-3">
          Available Coupons ({availableCoupons.length})
        </h2>
        {availableCoupons.length === 0 ? (
          <p className="text-sm text-mbi-slate">No coupons available yet — refer a friend to earn one.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableCoupons.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-mbi-available-tint border border-mbi-available/30 rounded-lg px-3 py-2.5">
                <span className="font-bold text-mbi-available text-sm">GHS {Number(c.amount).toLocaleString()} off</span>
                <span className="text-xs text-mbi-slate">
                  Earned {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {usedCoupons.length > 0 && (
          <>
            <h3 className="font-semibold text-mbi-navy text-sm mt-4 mb-2">Used Coupons ({usedCoupons.length})</h3>
            <div className="flex flex-col gap-2">
              {usedCoupons.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-mbi-surface-soft border border-mbi-hairline-soft rounded-lg px-3 py-2.5">
                  <span className="font-semibold text-mbi-slate text-sm">GHS {Number(c.amount).toLocaleString()} off</span>
                  <span className="text-xs text-mbi-slate">
                    Used on {c.used_order_id ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* People referred */}
      <div className="bg-white rounded-mbi-card p-4">
        <h2 className="font-bold text-mbi-navy text-base mb-3">
          People You've Referred ({referrals.length})
        </h2>
        {referrals.length === 0 ? (
          <p className="text-sm text-mbi-slate">Nobody has signed up with your code yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-mbi-navy font-medium">{r.customer_name ?? "—"}</span>
                <span className="text-xs text-mbi-slate">
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 text-center">
        <Link to="/shop" className="inline-block text-mbi-amber-ink font-semibold hover:underline">
          ← Continue Shopping
        </Link>
      </div>
    </div>
  );
}
