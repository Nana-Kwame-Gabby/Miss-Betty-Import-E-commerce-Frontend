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
  const [stats, setStats] = useState({ products: 0, orders: 0, customers: 0, revenue: 0, shippingCollected: 0 });
  const [paymentRows, setPaymentRows] = useState([]);
  const [custTotals, setCustTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadStats() {
      const [
        { count: products },
        { count: orders },
        { count: customers },
        { data: invoiceData },
        { data: paymentData },
        { data: allOrderData },
        { data: allFeeData },
      ] = await Promise.all([
        supabase.from('products').select('product_id', { count: 'exact', head: true }),
        supabase.from('orders').select('order_id', { count: 'exact', head: true }),
        supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
        supabase.from('invoices').select('total'),
        supabase.from('shipping_fee_payments')
          .select('customer_id, amount_paid, paid_at, customers(customer_name)')
          .order('paid_at', { ascending: false }),
        supabase.from('orders').select('customer_id, product_id, size, quantity'),
        supabase.from('product_size_shipping_fees').select('product_id, size, shipping_fee'),
      ]);

      const revenue = (invoiceData ?? []).reduce((sum, r) => sum + Number(r.total ?? 0), 0);
      const shippingCollected = (paymentData ?? []).reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);

      const feeMap = {};
      (allFeeData ?? []).forEach(f => {
        feeMap[`${f.product_id}::${f.size}`] = Number(f.shipping_fee ?? 0);
      });
      const totalByCustomer = {};
      (allOrderData ?? []).forEach(o => {
        const fee = feeMap[`${o.product_id}::${o.size ?? ''}`] ?? 0;
        totalByCustomer[o.customer_id] = (totalByCustomer[o.customer_id] ?? 0) + fee * Number(o.quantity ?? 1);
      });

      // Compute running balance per customer (sorted chronologically, then re-sorted newest-first)
      const custPayments = {};
      (paymentData ?? []).forEach(r => {
        if (!custPayments[r.customer_id]) custPayments[r.customer_id] = [];
        custPayments[r.customer_id].push({ ...r });
      });
      const enriched = [];
      Object.values(custPayments).forEach(payments => {
        payments.sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at));
        let cumulative = 0;
        payments.forEach(p => {
          cumulative += Number(p.amount_paid);
          p.balance = Math.max(0, (totalByCustomer[p.customer_id] ?? 0) - cumulative);
          enriched.push(p);
        });
      });
      enriched.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));

      setStats({ products: products ?? 0, orders: orders ?? 0, customers: customers ?? 0, revenue, shippingCollected });
      setPaymentRows(enriched);
      setCustTotals(totalByCustomer);
      setLoading(false);
    }
    loadStats();
  }, []);

  const filteredPayments = paymentRows.filter(r =>
    (r.customers?.customer_name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Dashboard</h1>
      <p className="text-sm text-gray-400 mb-6">Overview of your store</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
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
        <StatCard
          title="Shipping Collected"
          value={`GHS ${stats.shippingCollected.toLocaleString()}`}
          loading={loading}
          color="bg-cyan-50"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          }
        />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-8">
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

      {/* ── Shipping Fee Payments ───────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1e2d3d]">Shipping Fee Payments</h2>
            <p className="text-xs text-gray-400 mt-0.5">All shipping fee payments made by customers</p>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by customer name…"
              className="border border-gray-200 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:border-[#F2AA25] transition-colors w-52"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#F2AA25] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {query ? `No payments match "${query}".` : "No shipping fee payments yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer Name</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Total Shipping Fee</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((r, i) => {
                  const d = new Date(r.paid_at);
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-[#1e2d3d]">{r.customers?.customer_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1e2d3d] hidden sm:table-cell">
                        {custTotals[r.customer_id] > 0 ? `GHS ${custTotals[r.customer_id].toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#F2AA25]">GHS {Number(r.amount_paid).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {r.balance === 0
                          ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Paid in Full</span>
                          : <span className="text-[#1e2d3d]">GHS {r.balance.toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
