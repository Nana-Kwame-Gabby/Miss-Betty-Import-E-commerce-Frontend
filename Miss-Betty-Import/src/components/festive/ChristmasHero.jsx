import { useEffect } from "react";
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

// A small Santa hat that sits on the "C" of the script title.
const SantaHat = () => (
  <svg viewBox="0 0 100 80" aria-hidden="true" className="festive-hat pointer-events-none absolute -top-[0.42em] -left-[0.2em] w-[0.95em]">
    <path d="M12 58 C 20 28, 46 6, 74 14 C 84 17, 90 26, 92 38 C 80 30, 66 30, 60 36 C 52 44, 50 52, 52 60 Z" fill="#D7262E" />
    <path d="M60 36 C 66 30, 80 30, 92 38 L 90 44 C 80 38, 68 38, 62 42 Z" fill="#A9161D" opacity="0.6" />
    <rect x="4" y="54" width="58" height="16" rx="8" fill="#fff" />
    <circle cx="91" cy="44" r="8.5" fill="#fff" />
  </svg>
);

// Full-width Christmas hero from the owner's mockup: the photo sharp on the right, melting into a
// blurred, mirrored copy of itself that fills the rest of the banner with soft tree lights;
// falling snow; a script "Christmas" with a Santa hat; the admin's headline (*starred* words in
// yellow) and message; and a "Shop Christmas Deals" button. Always shown while Christmas is on.
// Phones get a short horizontal banner (about 170 px); computers the full 440 px hero.
export default function ChristmasHero({ headline, message, photo, preview = false }) {
  useScriptFont();
  const src = photo || CHRISTMAS_DEFAULT_PHOTO;

  return (
    <section aria-label="Christmas" className="festive-in relative isolate overflow-hidden bg-[#2B1A12] text-white">
      {/* backfill: the photo's own trees and lights, softly blurred, so there is no flat block */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="absolute -inset-[8%] h-[116%] w-[116%] max-w-none -scale-x-100 object-cover [filter:blur(6px)_brightness(0.72)_saturate(1.1)]"
      />
      {/* the sharp photo on the right, fading in from the left */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[55%] [mask-image:linear-gradient(to_right,transparent,black_38%)] md:w-[60%] md:[mask-image:linear-gradient(to_right,transparent,black_30%)]">
        <img
          src={src}
          alt=""
          decoding="async"
          className={`h-full w-full object-cover md:transform-none md:object-[40%_30%] ${
            // phones: the default photo is mirrored so the shopper stands on the right, clear of the text
            photo ? "object-[62%_25%]" : "-scale-x-100 object-[70%_22%]"
          }`}
        />
      </div>
      {/* a gentle darkening behind the text, not a block: the trees stay visible through it */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,12,6,0.62)_0%,rgba(24,12,6,0.42)_38%,rgba(24,12,6,0)_64%)]" />
      <Snowfall mode="contained" count={70} maxAlpha={0.85} />

      <div className="relative z-10 mx-auto flex min-h-[168px] max-w-7xl flex-col justify-center px-4 py-3 sm:min-h-[230px] sm:px-6 sm:py-6 md:min-h-[440px] md:py-8 lg:px-8">
        <h2 className="max-w-[62%] sm:max-w-[55%] md:max-w-xl">
          <span
            className="relative inline-block pt-1 text-[34px] leading-[0.95] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] sm:pt-2 sm:text-[52px] md:text-[96px]"
            style={{ fontFamily: '"Kaushan Script", "Brush Script MT", cursive' }}
          >
            <SantaHat />
            Christmas
          </span>
          <span className="mt-0.5 block text-[17px] leading-[1.15] font-extrabold tracking-[-0.01em] sm:mt-1 sm:text-[26px] md:mt-2 md:text-[52px] md:leading-[1.05] md:tracking-[-0.02em]">
            {highlightParts(headline).map((p, i) =>
              p.hi ? <span key={i} className="text-[#FFC72C]">{p.text}</span> : <span key={i}>{p.text}</span>)}
          </span>
        </h2>
        {message && (
          <p className="mt-2 hidden max-w-md text-sm leading-relaxed text-white/85 sm:block md:mt-4 md:text-lg">{message}</p>
        )}
        <div className="mt-2.5 sm:mt-4 md:mt-7">
          <button
            type="button"
            onClick={() => { if (!preview) scrollToProducts(); }}
            className="mbi-press inline-flex h-9 items-center gap-1.5 rounded-full bg-[#CC4A0B] px-3.5 text-sm font-bold whitespace-nowrap text-white shadow-[0_6px_18px_rgba(204,74,11,0.35)] hover:bg-[#B53F08] sm:h-11 sm:gap-2 sm:px-5 sm:text-base md:h-14 md:px-8 md:text-[19px]"
          >
            Shop Christmas Deals
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}
