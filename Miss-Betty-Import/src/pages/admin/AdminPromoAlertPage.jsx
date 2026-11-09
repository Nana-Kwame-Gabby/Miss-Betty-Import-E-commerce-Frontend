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
      <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy mb-1">Promo Alert</h1>
      <p className="text-sm text-mbi-slate mb-6">
        Control the promotional banner shown to customers on the Home and Shop pages.
      </p>

      {/* Status toggle */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-mbi-navy text-sm">Banner Status</p>
            <p className="text-xs text-mbi-slate mt-0.5">
              {active ? "Visible to customers" : "Hidden from customers"}
            </p>
          </div>
          <button
            onClick={() => setActive(v => !v)}
            className={`relative inline-flex h-7 items-center rounded-full transition-colors focus:outline-none ${
              active ? "bg-mbi-amber" : "bg-mbi-border-strong"
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
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-5">
        <label className="block text-sm font-semibold text-mbi-navy mb-2">
          Promotional Message
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="🎉 Big Promo! Enjoy discounts on selected products for a limited time."
          className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none"
        />
        <p className="text-xs text-mbi-slate mt-1">
          {message.length}/200 characters. Include an emoji for visual impact.
        </p>
      </div>

      {/* Live preview */}
      {message.trim() && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-mbi-slate uppercase tracking-wide mb-2">Preview</p>
          {/* Same band the shop shows (components/shop/ShopNotice.jsx) */}
          <div className="flex items-start gap-3 rounded-mbi-card bg-mbi-amber-tint px-4 py-3 text-mbi-navy">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-mbi-amber-ink">
              <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>
            </svg>
            <p className="flex-1 text-sm font-medium leading-relaxed">{message}</p>
          </div>
          {!active && (
            <p className="text-xs text-mbi-slate mt-1.5 text-center">
              Toggle ON above to make this visible to customers.
            </p>
          )}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mb-4 px-4 py-3 bg-mbi-error-tint border border-mbi-error/30 rounded-lg text-sm text-mbi-error">
          <span className="font-semibold">Save failed:</span> {saveError}
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !message.trim()}
        className={`w-full py-3 rounded-lg text-sm font-bold text-mbi-navy transition-all disabled:opacity-50 ${
          saved ? "bg-mbi-available" : "bg-mbi-amber hover:bg-mbi-amber-press"
        }`}
      >
        {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
