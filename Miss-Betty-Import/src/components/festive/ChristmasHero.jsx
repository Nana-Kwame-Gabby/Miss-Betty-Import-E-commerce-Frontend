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

// Full-width Christmas hero from the owner's mockup: a plain warm background taken from the
// photo's own edge colours, the photo sharp on the right with only a short soft edge (so its
// Christmas tree stays clearly visible); falling snow; a script "Christmas" with a Santa hat; the admin's headline (*starred* words in
// yellow) and message; and a "Shop Christmas Deals" button. Always shown while Christmas is on.
// Phones get a short horizontal banner (about 190 px); computers the full 440 px hero.
export default function ChristmasHero({ headline, message, photo, preview = false }) {
  useScriptFont();
  const src = photo || CHRISTMAS_DEFAULT_PHOTO;

  return (
    <section
      aria-label="Christmas"
      className="festive-in relative isolate overflow-hidden text-white"
      // the photo's own left-edge colours, top to bottom, so background and photo meet without a seam
      style={{ background: "linear-gradient(180deg, #5B3C2A 0%, #7A4231 55%, #8A4636 100%)" }}
    >
      {/* the sharp photo on the right, with only a short soft edge */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[48%] [mask-image:linear-gradient(to_right,transparent,black_14%)] sm:w-[52%] md:w-[60%]">
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
      <Snowfall mode="contained" count={70} maxAlpha={0.85} />

      <div className="relative z-10 mx-auto flex min-h-[188px] max-w-7xl flex-col justify-center px-4 py-3 sm:min-h-[240px] sm:px-6 sm:py-6 md:min-h-[440px] md:py-8 lg:px-8">
        <h2 className="max-w-[56%] sm:max-w-[50%] md:max-w-[42%]">
          <span
            className="relative inline-block pt-1 text-[32px] leading-[0.95] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] sm:pt-2 sm:text-[52px] md:text-[64px] lg:text-[88px]"
            style={{ fontFamily: '"Kaushan Script", "Brush Script MT", cursive' }}
          >
            <SantaHat />
            Christmas
          </span>
          <span className="mt-0.5 block text-[16px] leading-[1.15] font-extrabold tracking-[-0.01em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)] sm:mt-1 sm:text-[26px] md:mt-2 md:text-[36px] md:leading-[1.05] md:tracking-[-0.02em] lg:text-[46px]">
            {highlightParts(headline).map((p, i) =>
              p.hi ? <span key={i} className="text-[#FFC72C]">{p.text}</span> : <span key={i}>{p.text}</span>)}
          </span>
        </h2>
        {message && (
          <p className="mt-1 line-clamp-3 max-w-[56%] text-[12px] leading-snug text-white/90 sm:mt-2 sm:max-w-[50%] sm:text-sm sm:leading-relaxed md:mt-4 md:max-w-[42%] md:text-lg">{message}</p>
        )}
        <div className="mt-2 sm:mt-4 md:mt-7">
          <button
            type="button"
            onClick={() => { if (!preview) scrollToProducts(); }}
            className="mbi-press inline-flex h-8 items-center gap-1.5 rounded-full bg-[#CC4A0B] px-3 text-[13px] font-bold whitespace-nowrap text-white shadow-[0_6px_18px_rgba(204,74,11,0.35)] hover:bg-[#B53F08] sm:h-11 sm:gap-2 sm:px-5 sm:text-base md:h-14 md:px-8 md:text-[19px]"
          >
            Shop Christmas Deals
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}
