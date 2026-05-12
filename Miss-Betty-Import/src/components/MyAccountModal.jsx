import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";

export default function MyAccountModal({ onClose }) {
  const { user, updatePhone } = useUser();
  const [phone, setPhone] = useState(user.phone);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const initials = user.fullName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function handleSave() {
    updatePhone(phone);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  }

  const readOnlyClass =
    "w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-500 cursor-default outline-none";
  const editClass =
    "w-full border border-gray-300 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-[#F2AA25] transition-colors";

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
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-[#1e2d3d] text-base">My Account</h2>
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
          {/* Avatar */}
          <div className="flex justify-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base"
              style={{ backgroundColor: "#F2AA25" }}
            >
              {initials}
            </div>
          </div>

          {/* Full Name (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
              Full Name
            </label>
            <input readOnly value={user.fullName} className={readOnlyClass} />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
              Email Address
            </label>
            <input readOnly value={user.email} className={readOnlyClass} />
          </div>

          {/* Phone (editable) */}
          <div>
            <label className="block text-xs font-semibold text-[#1e2d3d] uppercase tracking-wide mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setSaved(false); }}
              className={editClass}
              placeholder="+233 24 123 4567"
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={phone === user.phone || !phone.trim()}
            className={`w-full font-bold py-2.5 rounded-2xl text-sm transition-colors mt-0.5 ${
              saved
                ? "bg-green-500 text-white"
                : "bg-[#F2AA25] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
