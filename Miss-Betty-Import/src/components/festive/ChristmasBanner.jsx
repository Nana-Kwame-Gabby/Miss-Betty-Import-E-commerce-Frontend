import { useState } from "react";
import Snowfall from "./Snowfall";

const dismissKey = (headline, message) => `mbimport_xmas_banner:${headline}|${message}`;
const wasDismissed = key => { try { return sessionStorage.getItem(key) === "1"; } catch { return false; } };

// Hanging glass baubles: offset from the right (px), string length (px), size (px), colour, sway delay (s)
const BAUBLES = [
  { right: 0, string: 26, size: 26, color: "#C8322B", delay: 0 },
  { right: 38, string: 46, size: 20, color: "#F2AA25", delay: 0.8 },
  { right: 70, string: 16, size: 22, color: "#1F7A4D", delay: 1.6 },
];

function Bauble({ string, size, color }) {
  return (
    <svg width={size + 4} height={string + size + 8} viewBox={`0 0 ${size + 4} ${string + size + 8}`} aria-hidden="true">
      <line x1={(size + 4) / 2} y1="0" x2={(size + 4) / 2} y2={string} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
      <rect x={(size + 4) / 2 - 3.5} y={string} width="7" height="5" rx="1" fill="#D9B45A" />
      <circle cx={(size + 4) / 2} cy={string + 5 + size / 2} r={size / 2} fill={color} />
      <ellipse cx={(size + 4) / 2 - size * 0.18} cy={string + 5 + size * 0.32} rx={size * 0.12} ry={size * 0.18} fill="#fff" opacity="0.45" />
      <path d={`M${2 + size * 0.12} ${string + 5 + size * 0.55} Q${(size + 4) / 2} ${string + 5 + size * 0.75} ${size + 2 - size * 0.12} ${string + 5 + size * 0.55}`} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
    </svg>
  );
}

const Star = ({ className = "" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path className="festive-sparkle" d="M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.7l7.1-.6z" fill="#F2AA25" />
  </svg>
);

const Gift = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="9" y="28" width="46" height="32" rx="3" fill="#C8322B" />
    <rect x="28.5" y="28" width="7" height="32" fill="#F2AA25" />
    <g className="festive-bob">
      <rect x="6" y="19" width="52" height="11" rx="2.5" fill="#D9443C" />
      <rect x="28.5" y="19" width="7" height="11" fill="#F2AA25" />
      <path d="M32 19c-3-7-12-9-13-4s8 5 13 4zm0 0c3-7 12-9 13-4s-8 5-13 4z" fill="#F2AA25" />
    </g>
  </svg>
);

// The festive promo band: a night-sky card in the brand navy with its own snowfall, hanging
// baubles, a sparkling star and a gift. Headline and message come from the admin.
// preview: shown inside the admin page (no dismiss, the button does nothing).
export default function ChristmasBanner({ headline, message, preview = false }) {
  const key = dismissKey(headline, message);
  const [dismissedKey, setDismissedKey] = useState(null);
  if (!preview && (dismissedKey === key || wasDismissed(key))) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
    setDismissedKey(key);
  };
  const shopGifts = () => {
    if (preview) return;
    const main = document.querySelector("main");
    if (!main) return;
    const header = document.querySelector("header")?.offsetHeight ?? 0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: main.getBoundingClientRect().top + window.scrollY - header - 4, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section aria-label="Christmas" className="festive-in relative isolate overflow-hidden rounded-mbi-card bg-mbi-navy text-white">
      <Snowfall mode="contained" count={42} />

      {/* hanging baubles, top right */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-12 h-24 w-28 origin-top-right scale-75 sm:right-16 sm:scale-100">
        {BAUBLES.map((b, i) => (
          <div key={i} className="festive-sway absolute top-0" style={{ right: b.right, animationDelay: `${b.delay}s` }}>
            <Bauble {...b} />
          </div>
        ))}
      </div>

      {/* a wrapped gift sitting in the snow, bottom right */}
      <div aria-hidden="true" className="pointer-events-none absolute right-4 bottom-2 max-[379px]:hidden sm:right-8">
        <Gift />
      </div>

      {/* snow drift along the bottom */}
      <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-5 w-full" viewBox="0 0 400 20" preserveAspectRatio="none">
        <path d="M0 12 Q40 4 90 10 T190 9 T290 11 T400 8 V20 H0Z" fill="#fff" fillOpacity="0.92" />
      </svg>

      <div className="relative z-10 max-w-[74%] px-4 pt-4 pb-7 sm:max-w-[62%] sm:px-8 sm:pt-7 sm:pb-10">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-mbi-amber uppercase sm:mb-1.5 sm:text-xs">
          <Star /> Christmas at Miss Betty
        </p>
        <h2 className="text-base leading-snug font-bold text-balance sm:text-2xl">{headline}</h2>
        {message && <p className="mt-0.5 text-[13px] leading-snug text-white/80 sm:mt-1 sm:text-base sm:leading-relaxed">{message}</p>}
        <button
          type="button"
          onClick={shopGifts}
          className="mbi-press mt-2.5 inline-flex h-9 items-center rounded-lg bg-mbi-amber px-4 text-sm font-semibold text-mbi-navy hover:bg-mbi-amber-press sm:mt-4 sm:h-11 sm:px-5"
        >
          Shop gifts
        </button>
      </div>

      {!preview && (
        <button
          type="button"
          onClick={dismiss}
          className="mbi-press absolute top-2 right-2 z-10 grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
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
