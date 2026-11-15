import { useEffect, useState } from "react";
import { CHRISTMAS_DEFAULT_PHOTO, highlightParts } from "../../lib/christmas";
import Snowfall from "./Snowfall";
import { scrollToProducts } from "./scrollToProducts";

// The script face for the "Christmas" title, fetched only when the hero shows and trimmed to
// just the letters it draws.
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Kaushan+Script&display=swap&text=Christmas";
function useScriptFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

const dismissKey = (headline, message) => `mbimport_xmas_hero:${headline}|${message}`;
const wasDismissed = key => { try { return sessionStorage.getItem(key) === "1"; } catch { return false; } };

// A small Santa hat that sits on the "C" of the script title.
const SantaHat = () => (
  <svg viewBox="0 0 100 80" aria-hidden="true" className="festive-hat pointer-events-none absolute -top-[0.42em] -left-[0.2em] w-[0.95em]">
    <path d="M12 58 C 20 28, 46 6, 74 14 C 84 17, 90 26, 92 38 C 80 30, 66 30, 60 36 C 52 44, 50 52, 52 60 Z" fill="#D7262E" />
    <path d="M60 36 C 66 30, 80 30, 92 38 L 90 44 C 80 38, 68 38, 62 42 Z" fill="#A9161D" opacity="0.6" />
    <rect x="4" y="54" width="58" height="16" rx="8" fill="#fff" />
    <circle cx="91" cy="44" r="8.5" fill="#fff" />
  </svg>
);

// Full-width Christmas hero from the owner's mockup: warm dark background, the photo on the
// right fading into it, snow falling, a script "Christmas" with a Santa hat, the admin's
// headline (*starred* words in yellow) and message, and a "Shop Christmas Deals" button.
export default function ChristmasHero({ headline, message, photo, preview = false }) {
  const key = dismissKey(headline, message);
  const [dismissedKey, setDismissedKey] = useState(null);
  useScriptFont();
  if (!preview && (dismissedKey === key || wasDismissed(key))) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
    setDismissedKey(key);
  };

  return (
    <section
      aria-label="Christmas"
      className="festive-in relative isolate overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 10% 28%, rgba(255,186,96,0.20), transparent 18%)," +
          "radial-gradient(circle at 26% 82%, rgba(255,150,70,0.16), transparent 20%)," +
          "radial-gradient(circle at 44% 14%, rgba(255,214,140,0.12), transparent 14%)," +
          "linear-gradient(90deg, #2B1A12 0%, #3A2418 60%, #3A2418 100%)",
      }}
    >
      <img
        src={photo || CHRISTMAS_DEFAULT_PHOTO}
        alt=""
        aria-hidden="true"
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover md:left-auto md:w-[60%] md:transform-none md:object-[40%_30%] md:[mask-image:linear-gradient(to_right,transparent,black_30%)] ${
          // phones: the default photo is mirrored so the shopper stands on the right, clear of the text
          photo ? "object-[62%_30%]" : "-scale-x-100 object-[75%_30%]"
        }`}
      />
      {/* phones: keep the text readable over the photo */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#2B1A12]/95 via-[#2B1A12]/70 to-[#2B1A12]/10 md:hidden" />
      <Snowfall mode="contained" count={70} maxAlpha={0.85} />

      <div className="relative z-10 mx-auto flex min-h-[340px] max-w-7xl flex-col justify-center px-4 py-8 sm:px-6 md:min-h-[440px] lg:px-8">
        <h2 className="max-w-[17rem] sm:max-w-md md:max-w-xl">
          <span
            className="relative inline-block pt-2 text-[56px] leading-[0.95] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] sm:text-[72px] md:text-[96px]"
            style={{ fontFamily: '"Kaushan Script", "Brush Script MT", cursive' }}
          >
            <SantaHat />
            Christmas
          </span>
          <span className="mt-1 block text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-4xl md:mt-2 md:text-[52px]">
            {highlightParts(headline).map((p, i) =>
              p.hi ? <span key={i} className="text-[#FFC72C]">{p.text}</span> : <span key={i}>{p.text}</span>)}
          </span>
        </h2>
        {message && (
          <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-white/85 sm:max-w-md md:mt-4 md:text-lg">{message}</p>
        )}
        <div className="mt-5 md:mt-7">
          <button
            type="button"
            onClick={() => { if (!preview) scrollToProducts(); }}
            className="mbi-press inline-flex h-12 items-center gap-2 rounded-full bg-[#CC4A0B] px-6 text-base font-bold text-white shadow-[0_6px_18px_rgba(204,74,11,0.35)] hover:bg-[#B53F08] md:h-14 md:px-8 md:text-[19px]"
          >
            Shop Christmas Deals
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      {!preview && (
        <button
          type="button"
          onClick={dismiss}
          className="mbi-press absolute top-2 right-2 z-10 grid size-9 place-items-center rounded-full bg-black/25 text-white/90 hover:bg-black/40 hover:text-white"
          aria-label="Close the Christmas banner"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </section>
  );
}
