import { useEffect, useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";
import { CHRISTMAS_LIMITS } from "../../lib/christmas";
import ChristmasBanner from "../../components/festive/ChristmasBanner";

// One central switch for the Christmas decorations on the Home and Shop pages. Turning it on or
// off saves at once and every open customer page follows live, with no redeploy.
export default function AdminChristmasPage() {
  const { christmasActive, christmasHeadline, christmasMessage, saveChristmas, settingsLoading } = useAppSettings();
  const [headline, setHeadline] = useState(christmasHeadline);
  const [message, setMessage] = useState(christmasMessage);
  const [switching, setSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setHeadline(christmasHeadline); }, [christmasHeadline]);
  useEffect(() => { setMessage(christmasMessage); }, [christmasMessage]);

  async function toggle() {
    setSwitching(true);
    setError("");
    const err = await saveChristmas(!christmasActive);
    if (err) setError(err.message || "Could not switch the Christmas decorations. Please try again.");
    setSwitching(false);
  }

  async function saveWording() {
    setSaving(true);
    setError("");
    const err = await saveChristmas(christmasActive, headline.trim(), message.trim());
    setSaving(false);
    if (err) setError(err.message || "Could not save the wording. Please try again.");
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }

  const dirty = headline.trim() !== christmasHeadline || message.trim() !== christmasMessage;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy mb-1">Christmas Animations</h1>
      <p className="text-sm text-mbi-slate mb-6">
        Festive lights, falling snow and a Christmas banner on the Home and Shop pages. One switch controls both pages, and customers see the change straight away.
      </p>

      {/* The switch */}
      <div className={`rounded-mbi-card p-5 mb-5 border-2 ${christmasActive ? "bg-mbi-available-tint border-mbi-available/30" : "bg-white border-mbi-hairline"}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${christmasActive ? "bg-mbi-available" : "bg-mbi-border-strong"}`} />
              <h2 className="text-base font-bold text-mbi-navy">{christmasActive ? "Christmas is on" : "Christmas is off"}</h2>
            </div>
            <p className="mt-0.5 ml-4.5 text-sm text-mbi-slate">
              {christmasActive
                ? "Customers see the Christmas decorations on Home and Shop now."
                : "Home and Shop look as normal. Switch on to bring in the Christmas decorations."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={christmasActive}
            aria-label="Christmas Animations"
            onClick={toggle}
            disabled={switching || settingsLoading}
            className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${christmasActive ? "bg-mbi-available" : "bg-mbi-border-strong"}`}
          >
            <span className={`inline-block size-6 rounded-full bg-white shadow transition-transform duration-200 ${christmasActive ? "translate-x-9" : "translate-x-1"}`} />
          </button>
        </div>
        {switching && <p className="mt-2 ml-4.5 text-xs text-mbi-slate">Saving…</p>}
      </div>

      {/* Banner wording */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-5">
        <h2 className="text-sm font-bold text-mbi-navy mb-3">Banner wording</h2>
        <label className="block text-sm font-semibold text-mbi-navy mb-1.5" htmlFor="xmas-headline">Headline</label>
        <input
          id="xmas-headline"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          maxLength={CHRISTMAS_LIMITS.headline}
          placeholder="e.g. Christmas Sale: up to 20% off"
          className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy"
        />
        <p className="text-xs text-mbi-slate mt-1 mb-3">{headline.length}/{CHRISTMAS_LIMITS.headline} characters</p>
        <label className="block text-sm font-semibold text-mbi-navy mb-1.5" htmlFor="xmas-message">Message</label>
        <textarea
          id="xmas-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          maxLength={CHRISTMAS_LIMITS.message}
          placeholder="e.g. Gifts for everyone you love, delivered across Ghana."
          className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none"
        />
        <p className="text-xs text-mbi-slate mt-1">{message.length}/{CHRISTMAS_LIMITS.message} characters</p>
        <button
          type="button"
          onClick={saveWording}
          disabled={saving || !headline.trim() || !dirty}
          className={`mbi-press mt-4 h-11 rounded-lg px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${saved ? "bg-mbi-available text-white" : "bg-mbi-navy text-white hover:bg-mbi-navy-hover"}`}
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save wording"}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-5 px-4 py-3 bg-mbi-error-tint border border-mbi-error/30 rounded-lg text-sm text-mbi-error">
          {error}
        </div>
      )}

      {/* Live preview */}
      <p className="text-xs font-semibold text-mbi-slate uppercase tracking-wide mb-2">Preview</p>
      <ChristmasBanner preview headline={headline.trim() || christmasHeadline} message={message.trim()} />
      <p className="text-xs text-mbi-slate mt-2">
        Customers also see a string of fairy lights under the header and light snow behind the products near the top of the page. People who turn off animations on their phone see everything standing still.
      </p>
    </div>
  );
}
