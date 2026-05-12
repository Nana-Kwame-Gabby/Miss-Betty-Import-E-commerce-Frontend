import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { mockOrders, colourMap } from "../data/mockData";
import { useUser } from "../context/UserContext";

const ghanaRegions = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "North East", "Savannah",
];

const statusStyles = {
  Delivered: "bg-green-100 text-green-700",
  Processing: "bg-blue-100 text-blue-700",
  Pending: "bg-amber-100 text-amber-700",
  Cancelled: "bg-red-100 text-red-600",
};

function DeliveryUpdateModal({ order, onClose, onSave }) {
  const { user } = useUser();
  const [region, setRegion] = useState(order.delivery?.region || "");
  const [town, setTown] = useState(order.delivery?.town || "");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleSave() {
    const e = {};
    if (!region) e.region = "Please select a region.";
    if (!town.trim()) e.town = "Town / city is required.";
    if (Object.keys(e).length) return setErrors(e);
    onSave(order.order_id, { region, town });
    onClose();
  }

  const readOnlyClass =
    "w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 cursor-default outline-none";
  const inputClass = (field) =>
    `w-full border rounded-2xl px-4 py-3 text-sm outline-none transition-colors ${
      errors[field] ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[#F2AA25]"
    }`;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-[#1e2d3d] text-lg">Update Delivery</h2>
            <span className="text-xs font-semibold text-[#F2AA25] bg-amber-50 px-2 py-0.5 rounded-full mt-1 inline-block">
              {order.order_id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Read-only contact info */}
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">Full Name</label>
            <input readOnly value={user.fullName} className={readOnlyClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">Email Address</label>
            <input readOnly value={user.email} className={readOnlyClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">Phone Number</label>
            <input readOnly value={user.phone} className={readOnlyClass} />
          </div>

          {/* Editable delivery fields */}
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">Region</label>
            <select
              value={region}
              onChange={e => { setRegion(e.target.value); setErrors(p => ({ ...p, region: "" })); }}
              className={inputClass("region")}
            >
              <option value="">Select region</option>
              {ghanaRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">Town / City</label>
            <input
              type="text"
              value={town}
              onChange={e => { setTown(e.target.value); setErrors(p => ({ ...p, town: "" })); }}
              placeholder="e.g. Kumasi"
              className={inputClass("town")}
            />
            {errors.town && <p className="text-red-500 text-xs mt-1">{errors.town}</p>}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-2xl text-sm hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-[#F2AA25] text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState(mockOrders);
  const [editingOrder, setEditingOrder] = useState(null);

  function handleDeliverySave(orderId, delivery) {
    setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, delivery } : o));
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="text-7xl mb-6">📦</div>
        <h2 className="text-2xl font-bold text-[#1e2d3d] mb-2">No orders yet</h2>
        <p className="text-gray-400 mb-8">You haven't placed any orders. Start shopping!</p>
        <Link to="/shop" className="inline-block bg-[#F2AA25] text-white font-bold px-8 py-3 rounded-2xl hover:opacity-90">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#1e2d3d] mb-8">My Orders</h1>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Order ID", "Date", "Items", "Size", "Colour", "Total", "Status", ""].map(h => (
                <th key={h} className="text-left px-4 py-4 font-semibold text-[#1e2d3d] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => (
              <tr key={order.order_id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-4 py-4 font-semibold text-[#F2AA25] whitespace-nowrap">{order.order_id}</td>
                <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                  {new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="block">{item.name} ×{item.qty}</span>
                  ))}
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="block">{item.size}</span>
                  ))}
                </td>
                <td className="px-4 py-4">
                  {order.items.map((item, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                        style={{ backgroundColor: colourMap[item.colour] || "#ccc" }}
                      />
                      <span className="text-gray-600">{item.colour}</span>
                    </span>
                  ))}
                </td>
                <td className="px-4 py-4 font-bold text-[#1e2d3d] whitespace-nowrap">
                  GHS {order.total.toLocaleString()}
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[order.status] || "bg-gray-100 text-gray-600"}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {order.canEditDelivery && (
                    <button
                      onClick={() => setEditingOrder(order)}
                      className="text-xs font-semibold text-[#F2AA25] border border-[#F2AA25] px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap"
                    >
                      Edit Delivery
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-4">
        {orders.map(order => (
          <div key={order.order_id} className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-[#F2AA25]">{order.order_id}</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[order.status] || "bg-gray-100 text-gray-600"}`}>
                {order.status}
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-2">
              {new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <div className="text-sm text-gray-600 mb-3 flex flex-col gap-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                    style={{ backgroundColor: colourMap[item.colour] || "#ccc" }}
                  />
                  <span>{item.name} — {item.size}, {item.colour} ×{item.qty}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="font-bold text-[#1e2d3d]">GHS {order.total.toLocaleString()}</span>
            </div>
            {order.canEditDelivery && (
              <button
                onClick={() => setEditingOrder(order)}
                className="mt-3 w-full text-sm font-semibold text-[#F2AA25] border border-[#F2AA25] py-2 rounded-xl hover:bg-amber-50 transition-colors"
              >
                Edit Delivery Info
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link to="/shop" className="inline-block text-[#F2AA25] font-semibold hover:underline">
          ← Continue Shopping
        </Link>
      </div>

      {editingOrder && (
        <DeliveryUpdateModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={handleDeliverySave}
        />
      )}
    </div>
  );
}
