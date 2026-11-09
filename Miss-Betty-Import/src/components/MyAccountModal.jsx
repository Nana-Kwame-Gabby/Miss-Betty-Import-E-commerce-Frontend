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
    "w-full h-[52px] bg-mbi-surface-soft border border-mbi-hairline-soft rounded-lg px-3 text-base text-mbi-navy-body cursor-default outline-none";
  const editClass =
    "w-full h-[52px] border border-mbi-hairline rounded-lg px-3 text-base text-mbi-navy outline-none focus:border-mbi-navy transition-colors";

  return (
    <div
      className="fixed inset-0 bg-mbi-navy/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-mbi-card w-full max-w-sm shadow-mbi-float"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-mbi-hairline-soft">
          <h2 className="font-bold text-mbi-navy text-base">My Account</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-mbi-surface-soft transition-colors text-mbi-slate hover:text-mbi-navy-body"
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
              style={{ backgroundColor: "#F2AA25", color: "#1e2d3d" }}
            >
              {initials}
            </div>
          </div>

          {/* Full Name (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-mbi-navy mb-1.5">
              Full Name
            </label>
            <input readOnly value={user.fullName} className={readOnlyClass} />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-mbi-navy mb-1.5">
              Email Address
            </label>
            <input readOnly value={user.email} className={readOnlyClass} />
          </div>

          {/* Phone (editable) */}
          <div>
            <label className="block text-xs font-semibold text-mbi-navy mb-1.5">
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
            className={`w-full font-bold py-2.5 rounded-mbi-card text-sm transition-colors mt-0.5 ${
              saved
                ? "bg-mbi-available text-mbi-navy"
                : "bg-mbi-amber text-mbi-navy hover:bg-mbi-amber-press disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
