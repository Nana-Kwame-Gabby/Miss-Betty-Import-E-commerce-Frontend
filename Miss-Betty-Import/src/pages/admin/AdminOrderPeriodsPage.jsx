import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

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
    loadData();
  }

  const activePeriod = periods.find(p => p.is_active) ?? null;
  const pastPeriods = periods.filter(p => !p.is_active);

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Order Periods</h1>
      <p className="text-sm text-gray-400 mb-6">
        Manage the active ordering cycle and browse past, archived periods
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active period card */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 mb-2 inline-block">
                  Active Period
                </span>
                <h2 className="text-lg font-bold text-[#1e2d3d]">{activePeriod?.name ?? "—"}</h2>
                {activePeriod && (
                  <p className="text-xs text-gray-400 mt-1">
                    Opened {new Date(activePeriod.opened_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {activePeriod && (
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="font-bold text-[#1e2d3d]">{stats[activePeriod.id]?.orderCount ?? 0}</span> orders ·{" "}
                    <span className="font-bold text-[#F2AA25]">GHS {(stats[activePeriod.id]?.revenue ?? 0).toLocaleString()}</span> revenue
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowCloseModal(true)}
                className="bg-[#1e2d3d] text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                Close Period &amp; Start New
              </button>
            </div>
          </div>

          {/* Past periods */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1e2d3d]">Past Periods ({pastPeriods.length})</h2>
              <p className="text-xs text-gray-400 mt-0.5">Every past period stays fully browsable and editable</p>
            </div>
            {pastPeriods.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No closed periods yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Opened</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Closed</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Orders</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastPeriods.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(p.opened_at).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3 text-gray-500">{p.closed_at ? new Date(p.closed_at).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="px-4 py-3 text-center font-bold text-[#1e2d3d]">{stats[p.id]?.orderCount ?? 0}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#F2AA25]">GHS {(stats[p.id]?.revenue ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-x-2 gap-y-1">
                            {VIEW_LINKS.map(v => (
                              <Link
                                key={v.to}
                                to={`${v.to}?period=${p.id}`}
                                className="text-xs font-semibold text-[#F2AA25] hover:underline whitespace-nowrap"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[#1e2d3d] mb-1">Close &amp; Start New Period</h3>
            <p className="text-sm text-gray-400 mb-4">
              "{activePeriod?.name}" will be archived — every order, invoice, and shipping fee stays fully intact and editable. The admin views clear to show only the new period going forward.
            </p>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">New Period Name</label>
            <input
              type="text"
              value={newPeriodName}
              onChange={e => setNewPeriodName(e.target.value)}
              placeholder="e.g. Period 2"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F2AA25] transition-colors mb-4"
            />
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCloseModal(false); setError(null); }}
                disabled={closing}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseAndStartNew}
                disabled={closing || !newPeriodName.trim()}
                className="flex-1 bg-[#F2AA25] text-white font-bold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {closing ? "Closing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
