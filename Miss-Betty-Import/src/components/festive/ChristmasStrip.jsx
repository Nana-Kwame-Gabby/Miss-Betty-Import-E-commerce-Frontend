import { highlightParts } from "../../lib/christmas";
import Snowfall from "./Snowfall";
import PineCorner from "./PineCorner";
import { scrollToProducts } from "./scrollToProducts";

const GiftIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <rect x="4" y="13" width="24" height="16" rx="2" fill="#F2AA25" />
    <rect x="3" y="9" width="26" height="6" rx="1.5" fill="#FFC72C" />
    <rect x="14" y="9" width="4" height="20" fill="#2E8B57" />
    <path d="M16 9c-2-4-7-6-8-3s4 3 8 3zm0 0c2-4 7-6 8-3s-4 3-8 3z" fill="#2E8B57" />
  </svg>
);

// The admin's strip text: the part before the first colon in bold, *starred* words in yellow.
function StripText({ text }) {
  const colon = text.indexOf(":");
  const lead = colon > 0 && colon < 40 ? text.slice(0, colon + 1) : "";
  const rest = lead ? text.slice(colon + 1) : text;
  return (
    <p className="min-w-0 text-[13px] leading-tight font-medium text-white sm:text-base">
      {lead && <strong className="font-bold">{lead.replace(/\*/g, "")}</strong>}
      {highlightParts(rest).map((p, i) =>
        p.hi ? <strong key={i} className="font-bold text-[#FFC72C]">{p.text}</strong> : <span key={i}>{p.text}</span>)}
    </p>
  );
}

// Red promo strip that sits above the shop header while Christmas is on.
export default function ChristmasStrip({ text, preview = false }) {
  if (!text?.trim()) return null;
  return (
    <div role="region" aria-label="Christmas offer" className="relative isolate overflow-hidden bg-[#B5121B]">
      <Snowfall mode="contained" count={22} maxAlpha={0.75} />
      <PineCorner className="absolute -top-3 -left-2 hidden h-16 md:block" />
      <PineCorner flip className="absolute -top-3 -right-2 hidden h-16 md:block" />
      <div className="relative z-10 mx-auto flex min-h-11 max-w-7xl items-center justify-center gap-2.5 px-4 py-1.5 sm:gap-4 sm:px-6 lg:px-8">
        <span className="hidden sm:block"><GiftIcon /></span>
        <StripText text={text} />
        <button
          type="button"
          onClick={() => { if (!preview) scrollToProducts(); }}
          className="mbi-press inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#FFC72C] px-3 text-[13px] font-bold whitespace-nowrap text-[#7A1F00] hover:bg-[#FFD452] sm:h-9 sm:px-5 sm:text-sm"
        >
          Shop Now
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
