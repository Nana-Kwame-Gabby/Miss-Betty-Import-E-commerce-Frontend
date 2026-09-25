import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSelectedOrderPeriod } from "../../hooks/useSelectedOrderPeriod";
import PeriodSwitcher from "../../components/PeriodSwitcher";
import SalesStatCards from "./SalesStatCards";
import { summariseSales } from "../../lib/salesSummary";

// Financial overview for Available Goods (in-stock items) only. Pre-order sales are on
// the main dashboard. No Shipping Collected card: Available Goods carry no shipping fee.
export default function AdminAvailableDashboard() {
  const { periods, activePeriod, selectedId, selectPeriod, loading: periodsLoading } = useSelectedOrderPeriod();
  const [stats, setStats]     = useState({ products: 0, orders: 0, customers: 0, revenue: 0, cost: 0, profit: 0, misc: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedId == null) return;

    async function loadStats() {
      setLoading(true);
      const [{ count: products }, { data: orderRows }] = await Promise.all([
        supabase.from('products')
          .select('product_id, product_status!inner(status_name)', { count: 'exact', head: true })
          .eq('product_status.status_name', 'Available'),
        supabase.from('orders')
          .select('customer_id, quantity, unit_price, status, cost_price, profit, misc_amount')
          .eq('deleted_by_admin', false)
          .eq('order_period_id', selectedId)
          .eq('product_type', 'Available'),
      ]);
      setStats({ products: products ?? 0, ...summariseSales(orderRows ?? []) });
      setLoading(false);
    }
    loadStats();
  }, [selectedId]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-[#1e2d3d]">Available Goods Dashboard</h1>
        <PeriodSwitcher periods={periods} selectedId={selectedId} activeId={activePeriod?.id} onChange={selectPeriod} loading={periodsLoading} />
      </div>
      <p className="text-sm text-gray-400 mb-4">Available Goods sales only. Pre-order sales are on the Pre-order Dashboard.</p>

      <SalesStatCards stats={stats} loading={loading} />

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Upload a Product", to: "/admin/products", color: "bg-blue-500" },
            { label: "View Available Orders", to: "/admin/available-orders", color: "bg-amber-500" },
            { label: "View Invoices", to: "/admin/invoices", color: "bg-green-500" },
          ].map(link => (
            <a
              key={link.to}
              href={link.to}
              className={`${link.color} text-white text-sm font-semibold px-4 py-3 rounded-xl hover:opacity-90 transition-opacity text-center block`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
