import { useState, useEffect } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";

export default function AdminPromoAlertPage() {
  const { promoActive, promoMessage, savePromoAlert } = useAppSettings();

  const [active,    setActive]    = useState(promoActive);
  const [message,   setMessage]   = useState(promoMessage);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { setActive(promoActive);   }, [promoActive]);
  useEffect(() => { setMessage(promoMessage); }, [promoMessage]);

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    const error = await savePromoAlert(active, message);
    setSaving(false);
    if (error) {
      setSaveError(error.message || "Failed to save. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-[#1e2d3d] mb-1">Promo Alert</h1>
      <p className="text-sm text-gray-500 mb-6">
        Control the promotional banner shown to customers on the Home and Shop pages.
      </p>

      {/* Status toggle */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[#1e2d3d] text-sm">Banner Status</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {active ? "Visible to customers" : "Hidden from customers"}
            </p>
          </div>
          <button
            onClick={() => setActive(v => !v)}
            className={`relative inline-flex h-7 items-center rounded-full transition-colors focus:outline-none ${
              active ? "bg-[#F2AA25]" : "bg-gray-300"
            }`}
            style={{ width: "52px" }}
            aria-label="Toggle promo banner"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                active ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Message editor */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <label className="block text-sm font-semibold text-[#1e2d3d] mb-2">
          Promotional Message
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="🎉 Big Promo! Enjoy discounts on selected products for a limited time."
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F2AA25] resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          {message.length}/200 characters. Include an emoji for visual impact.
        </p>
      </div>

      {/* Live preview */}
      {message.trim() && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
          <div className="flex justify-center items-center py-2.5 bg-[#1e2d3d] rounded-xl overflow-hidden">
            <p
              className="text-xl font-extrabold tracking-wide text-center whitespace-nowrap select-none"
              style={{ color: "#F2AA25", textShadow: "0 0 14px rgba(242,170,37,0.55), 0 1px 3px rgba(0,0,0,0.35)" }}
            >
              {message}
            </p>
          </div>
          {!active && (
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Toggle ON above to make this visible to customers.
            </p>
          )}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="font-semibold">Save failed:</span> {saveError}
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !message.trim()}
        className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
          saved ? "bg-green-500" : "bg-[#F2AA25] hover:opacity-90"
        }`}
      >
        {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
