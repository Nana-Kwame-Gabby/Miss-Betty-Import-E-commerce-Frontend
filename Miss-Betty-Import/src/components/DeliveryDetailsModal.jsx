import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";

const ghanaRegions = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Brong-Ahafo",
  "Western North", "Ahafo", "Bono East", "Oti", "North East", "Savannah",
];

export default function DeliveryDetailsModal({ onClose }) {
  const { user, updateDelivery } = useUser();
  const [phone,  setPhone]  = useState(user.phone);
  const [region, setRegion] = useState(user.deliveryRegion);
  const [town,   setTown]   = useState(user.deliveryTown);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSave() {
    const e = {};
    if (!phone.trim())  e.phone  = "Phone number is required.";
    if (!region)        e.region = "Please select a region.";
    if (!town.trim())   e.town   = "Town / city is required.";
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    await updateDelivery(phone.trim(), region, town.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  const unchanged =
    phone === user.phone &&
    region === user.deliveryRegion &&
    town === user.deliveryTown;

  const inputClass = (field) =>
    `w-full border rounded-2xl px-4 py-2.5 text-sm outline-none transition-colors ${
      errors[field]
        ? "border-red-400 focus:border-red-400"
        : "border-gray-300 focus:border-[#F2AA25]"
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
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-[#1e2d3d] text-base">Delivery Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            These details will be pre-filled automatically on every checkout.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: "" })); }}
              placeholder="e.g. 0244000000"
              className={inputClass("phone")}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
              Region
            </label>
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
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
              Town / City
            </label>
            <input
              type="text"
              value={town}
              onChange={e => { setTown(e.target.value); setErrors(p => ({ ...p, town: "" })); }}
              placeholder="e.g. Kumasi"
              className={inputClass("town")}
            />
            {errors.town && <p className="text-red-500 text-xs mt-1">{errors.town}</p>}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || unchanged}
            className={`w-full font-bold py-2.5 rounded-2xl text-sm transition-colors mt-0.5 ${
              saved
                ? "bg-green-500 text-white"
                : "bg-[#F2AA25] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
