import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function StatCard({ title, value, icon, color, loading }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-[#1e2d3d]">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, customers: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const [
        { count: products },
        { count: orders },
        { count: customers },
        { data: invoiceData },
      ] = await Promise.all([
        supabase.from('products').select('product_id', { count: 'exact', head: true }),
        supabase.from('orders').select('order_id', { count: 'exact', head: true }),
        supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
        supabase.from('invoices').select('total'),
      ]);

      const revenue = (invoiceData ?? []).reduce((sum, r) => sum + Number(r.total ?? 0), 0);
      setStats({ products: products ?? 0, orders: orders ?? 0, customers: customers ?? 0, revenue });
      setLoading(false);
    }
    loadStats();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Dashboard</h1>
      <p className="text-sm text-gray-400 mb-6">Overview of your store</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Products"
          value={stats.products}
          loading={loading}
          color="bg-blue-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          }
        />
        <StatCard
          title="Total Orders"
          value={stats.orders}
          loading={loading}
          color="bg-amber-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          }
        />
        <StatCard
          title="Total Customers"
          value={stats.customers}
          loading={loading}
          color="bg-purple-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          }
        />
        <StatCard
          title="Total Revenue"
          value={`GHS ${stats.revenue.toLocaleString()}`}
          loading={loading}
          color="bg-green-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          }
        />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#1e2d3d] mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Upload a Product", to: "/admin/products", color: "bg-blue-500" },
            { label: "View Orders", to: "/admin/orders", color: "bg-amber-500" },
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
