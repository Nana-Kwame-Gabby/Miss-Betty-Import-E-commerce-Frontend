import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import EmailAnnouncementModal from "./EmailAnnouncementModal";

const VIEW_LINKS = [
  { to: "/admin/orders",           label: "Pre-Orders" },
  { to: "/admin/available-orders", label: "Available" },
  { to: "/admin/shipping-fees",    label: "Shipping Fees" },
  { to: "/admin/invoices",         label: "Invoices" },
  { to: "/admin",                  label: "Dashboard" },
];

export default function AdminOrderPeriodsPage() {
  const [periods, setPeriods] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);
  const [announce, setAnnounce] = useState(null); // { kind, justSwitched }

  async function loadData() {
    setLoading(true);
    const { data: periodRows } = await supabase
      .from("order_periods")
      .select("*")
      .order("opened_at", { ascending: false });

    const list = periodRows ?? [];
    setPeriods(list);

    const statEntries = await Promise.all(list.map(async (p) => {
      const [{ count: orderCount }, { data: invoiceRows }] = await Promise.all([
        supabase.from("orders").select("order_id", { count: "exact", head: true })
          .eq("order_period_id", p.id).eq("deleted_by_admin", false),
        supabase.from("invoices").select("total").eq("order_period_id", p.id),
      ]);
      const revenue = (invoiceRows ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
      return [p.id, { orderCount: orderCount ?? 0, revenue }];
    }));
    setStats(Object.fromEntries(statEntries));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCloseAndStartNew() {
    const name = newPeriodName.trim();
    if (!name) return;
    setClosing(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("close_and_open_order_period", {
      new_period_name: name,
    });
    if (rpcError) {
      setError(rpcError.message);
      setClosing(false);
      return;
    }
    setShowCloseModal(false);
    setNewPeriodName("");
    setClosing(false);
    await loadData();
    // Offer the closed / new-period announcement emails.
    setAnnounce({ kind: "period_closed", justSwitched: true });
  }

  const activePeriod = periods.find(p => p.is_active) ?? null;
  const pastPeriods = periods.filter(p => !p.is_active);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy mb-1">Order Periods</h1>
      <p className="text-sm text-mbi-slate mb-6">
        Manage the active ordering cycle and browse past, archived periods
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-mbi-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active period card */}
          <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-mbi-available-tint text-mbi-available mb-2 inline-block">
                  Active Period
                </span>
                <h2 className="text-lg font-bold text-mbi-navy">{activePeriod?.name ?? "—"}</h2>
                {activePeriod && (
                  <p className="text-xs text-mbi-slate mt-1">
                    Opened {new Date(activePeriod.opened_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {activePeriod && (
                  <p className="text-sm text-mbi-slate mt-2">
                    <span className="font-bold text-mbi-navy">{stats[activePeriod.id]?.orderCount ?? 0}</span> orders ·{" "}
                    <span className="font-bold text-mbi-amber-ink">GHS {(stats[activePeriod.id]?.revenue ?? 0).toLocaleString()}</span> revenue
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAnnounce({ kind: "period_opened", justSwitched: false })}
                  className="mbi-press border border-mbi-navy text-mbi-navy font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-mbi-surface-soft transition-colors"
                >
                  Email Customers
                </button>
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="mbi-press bg-mbi-navy text-white font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-mbi-navy-hover transition-colors"
                >
                  Close Period &amp; Start New
                </button>
              </div>
            </div>
          </div>

          {/* Past periods */}
          <div className="bg-white rounded-mbi-card border border-mbi-hairline overflow-hidden">
            <div className="px-5 py-4 border-b border-mbi-hairline-soft">
              <h2 className="text-sm font-bold text-mbi-navy">Past Periods ({pastPeriods.length})</h2>
              <p className="text-xs text-mbi-slate mt-0.5">Every past period stays fully browsable and editable</p>
            </div>
            {pastPeriods.length === 0 ? (
              <div className="text-center py-12 text-mbi-slate text-sm">No closed periods yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mbi-hairline-soft bg-mbi-surface-soft">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Opened</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Closed</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Orders</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">Revenue</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-mbi-slate uppercase tracking-wide">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastPeriods.map(p => (
                      <tr key={p.id} className="border-b border-mbi-hairline-soft hover:bg-mbi-surface-soft transition-colors">
                        <td className="px-5 py-3 font-semibold text-mbi-navy">{p.name}</td>
                        <td className="px-4 py-3 text-mbi-slate">{new Date(p.opened_at).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3 text-mbi-slate">{p.closed_at ? new Date(p.closed_at).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="px-4 py-3 text-center font-bold text-mbi-navy">{stats[p.id]?.orderCount ?? 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-mbi-amber-ink">GHS {(stats[p.id]?.revenue ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-x-2 gap-y-1">
                            {VIEW_LINKS.map(v => (
                              <Link
                                key={v.to}
                                to={`${v.to}?period=${p.id}`}
                                className="text-xs font-semibold text-mbi-amber-ink hover:underline whitespace-nowrap"
                              >
                                {v.label}
                              </Link>
                            ))}
                          </div>
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

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-mbi-card shadow-mbi-float w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-mbi-navy mb-1">Close &amp; Start New Period</h3>
            <p className="text-sm text-mbi-slate mb-4">
              "{activePeriod?.name}" will be archived — every order, invoice, and shipping fee stays fully intact and editable. The admin views clear to show only the new period going forward.
            </p>
            <label className="text-xs font-semibold text-mbi-slate uppercase tracking-wide mb-1 block">New Period Name</label>
            <input
              type="text"
              value={newPeriodName}
              onChange={e => setNewPeriodName(e.target.value)}
              placeholder="e.g. Period 2"
              autoFocus
              className="w-full border border-mbi-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-mbi-navy transition-colors mb-4"
            />
            {error && <p className="text-xs text-mbi-error mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCloseModal(false); setError(null); }}
                disabled={closing}
                className="flex-1 border-2 border-mbi-hairline text-mbi-slate font-bold text-sm py-2.5 rounded-lg hover:bg-mbi-surface-soft transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseAndStartNew}
                disabled={closing || !newPeriodName.trim()}
                className="mbi-press flex-1 bg-mbi-amber text-mbi-navy font-bold text-sm py-2.5 rounded-lg hover:bg-mbi-amber-press transition-opacity disabled:opacity-50"
              >
                {closing ? "Closing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {announce && (
        <EmailAnnouncementModal
          initialKind={announce.kind}
          justSwitched={announce.justSwitched}
          activeName={activePeriod?.name}
          closedName={pastPeriods[0]?.name}
          onClose={() => setAnnounce(null)}
        />
      )}
    </div>
  );
}
