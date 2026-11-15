import { useEffect, useRef, useState } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";
import { CHRISTMAS_DEFAULT_PHOTO, CHRISTMAS_LIMITS } from "../../lib/christmas";
import { compressImage, deleteMedia, uploadMedia, validateFile } from "../../lib/media";
import ChristmasStrip from "../../components/festive/ChristmasStrip";
import ChristmasHero from "../../components/festive/ChristmasHero";
import ChristmasTrust from "../../components/festive/ChristmasTrust";

const FIELDS = [
  { key: "strip", label: "Promo strip (red bar above the header)", rows: 1, placeholder: "Christmas Special: Get up to *50% OFF* on selected items!" },
  { key: "headline", label: "Hero headline (under the word Christmas)", rows: 1, placeholder: "Shopping *Made Better!*" },
  { key: "message", label: "Hero message", rows: 2, placeholder: "Get amazing deals, festive offers and more this Christmas at Miss Betty Import." },
];

// One central switch for the Christmas decorations on the Home and Shop pages. Turning it on or
// off saves at once and every open customer page follows live, with no redeploy.
export default function AdminChristmasPage() {
  const { christmasActive, christmas, saveChristmas, settingsLoading } = useAppSettings();
  const [form, setForm] = useState({ strip: christmas.strip, headline: christmas.headline, message: christmas.message });
  const [switching, setSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(0); // upload progress 0..1, 0 = idle
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    setForm({ strip: christmas.strip, headline: christmas.headline, message: christmas.message });
  }, [christmas.strip, christmas.headline, christmas.message]);

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
    const err = await saveChristmas(christmasActive, { strip: form.strip.trim(), headline: form.headline.trim(), message: form.message.trim() });
    setSaving(false);
    if (err) setError(err.message || "Could not save the wording. Please try again.");
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateFile(file, "image");
    if (invalid) { setError(invalid); return; }
    setError("");
    setPhotoBusy(0.02);
    try {
      const small = await compressImage(file, 1800, 0.82);
      const [url] = await uploadMedia([{ file: small, kind: "image" }], f => setPhotoBusy(Math.max(0.02, f)));
      const old = christmas.photo;
      const err = await saveChristmas(christmasActive, { photo: url });
      if (err) { deleteMedia([url]); throw new Error(err.message); }
      if (old) deleteMedia([old]);
    } catch (err) {
      setError(err.message || "The photo could not be uploaded. Please try again.");
    }
    setPhotoBusy(0);
  }

  async function useDefaultPhoto() {
    setError("");
    const old = christmas.photo;
    const err = await saveChristmas(christmasActive, { photo: "" });
    if (err) setError(err.message || "Could not change the photo. Please try again.");
    else if (old) deleteMedia([old]);
  }

  const dirty = ["strip", "headline", "message"].some(k => form[k].trim() !== christmas[k]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-[-0.4px] text-mbi-navy mb-1">Christmas Animations</h1>
      <p className="text-sm text-mbi-slate mb-6">
        A red Christmas offer strip, a festive photo banner with falling snow, and a reassurance row on the Home and Shop pages. One switch controls both pages, and customers see the change straight away.
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

      {/* Wording */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-5">
        <h2 className="text-sm font-bold text-mbi-navy mb-1">Wording</h2>
        <p className="text-xs text-mbi-slate mb-4">Put *stars* around words to show them in yellow, e.g. Get up to *50% OFF*.</p>
        {FIELDS.map(f => (
          <div key={f.key} className="mb-3">
            <label className="block text-sm font-semibold text-mbi-navy mb-1.5" htmlFor={`xmas-${f.key}`}>{f.label}</label>
            <textarea
              id={`xmas-${f.key}`}
              value={form[f.key]}
              onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
              rows={f.rows}
              maxLength={CHRISTMAS_LIMITS[f.key]}
              placeholder={f.placeholder}
              className="w-full border border-mbi-hairline rounded-lg px-3 py-2.5 text-sm outline-none focus:border-mbi-navy resize-none"
            />
            <p className="text-xs text-mbi-slate mt-1">{form[f.key].length}/{CHRISTMAS_LIMITS[f.key]} characters</p>
          </div>
        ))}
        <button
          type="button"
          onClick={saveWording}
          disabled={saving || !form.headline.trim() || !dirty}
          className={`mbi-press mt-1 h-11 rounded-lg px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${saved ? "bg-mbi-available text-white" : "bg-mbi-navy text-white hover:bg-mbi-navy-hover"}`}
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save wording"}
        </button>
      </div>

      {/* Hero photo */}
      <div className="bg-white rounded-mbi-card border border-mbi-hairline p-5 mb-5">
        <h2 className="text-sm font-bold text-mbi-navy mb-1">Banner photo</h2>
        <p className="text-xs text-mbi-slate mb-3">A wide photo works best; the right-hand part shows on computers and the middle on phones.</p>
        <div className="flex flex-wrap items-center gap-4">
          <img src={christmas.photo || CHRISTMAS_DEFAULT_PHOTO} alt="Current Christmas banner photo" className="h-24 w-40 rounded-lg object-cover border border-mbi-hairline" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadPhoto} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!photoBusy}
              className="mbi-press h-10 rounded-lg bg-mbi-navy px-4 text-sm font-semibold text-white hover:bg-mbi-navy-hover disabled:opacity-60"
            >
              {photoBusy ? `Uploading… ${Math.round(photoBusy * 100)}%` : "Upload new photo"}
            </button>
            {christmas.photo && (
              <button
                type="button"
                onClick={useDefaultPhoto}
                disabled={!!photoBusy}
                className="mbi-press h-10 rounded-lg border border-mbi-navy/25 px-4 text-sm font-semibold text-mbi-navy hover:border-mbi-navy disabled:opacity-60"
              >
                Use the default photo
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 px-4 py-3 bg-mbi-error-tint border border-mbi-error/30 rounded-lg text-sm text-mbi-error">
          {error}
        </div>
      )}

      {/* Live preview */}
      <p className="text-xs font-semibold text-mbi-slate uppercase tracking-wide mb-2">Preview</p>
      <div className="overflow-hidden rounded-mbi-card border border-mbi-hairline">
        <ChristmasStrip preview text={form.strip} />
        <ChristmasHero preview headline={form.headline.trim() || christmas.headline} message={form.message.trim()} photo={christmas.photo} />
        <ChristmasTrust />
      </div>
      <p className="text-xs text-mbi-slate mt-2">
        Customers also see light snow behind the products near the top of the page. People who turn off animations on their phone see everything standing still.
      </p>
    </div>
  );
}
