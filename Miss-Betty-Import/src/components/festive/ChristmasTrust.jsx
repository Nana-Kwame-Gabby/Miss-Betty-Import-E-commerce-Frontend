import PineCorner from "./PineCorner";

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[22px] shrink-0 text-mbi-navy md:size-[34px]">
    {children}
  </svg>
);

const ITEMS = [
  {
    title: "Fast Delivery", line: "Across Ghana",
    icon: <Icon><path d="M1 6h13v10H1z" /><path d="M14 9h4l3 3v4h-7" /><circle cx="5.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></Icon>,
  },
  {
    title: "Secure Payments", line: "Pay with Confidence",
    icon: <Icon><path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Icon>,
  },
  {
    title: "24/7 Support", line: "We're here to help",
    icon: <Icon><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.5" y="13" width="4" height="6" rx="1.5" /><rect x="17.5" y="13" width="4" height="6" rx="1.5" /><path d="M19.5 19c0 1.5-1.5 2.5-4 2.5h-2" /></Icon>,
  },
  {
    title: "Great Discounts", line: "This Christmas",
    icon: <Icon><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M2 6h20v3H2zM12 6v15" /><path d="M12 6c-1.5-3-5-4-5.5-2s2.5 2 5.5 2zm0 0c1.5-3 5-4 5.5-2s-2.5 2-5.5 2z" /></Icon>,
  },
];

// The reassurance row under the Christmas hero: four across at every size. Phones stack each
// item's icon over a small title and line; computers put the icon beside the text.
export default function ChristmasTrust() {
  return (
    <div className="relative bg-mbi-surface-soft">
      <PineCorner className="absolute top-1/2 left-0 hidden h-28 -translate-y-1/2 2xl:block" />
      <PineCorner flip className="absolute top-1/2 right-0 hidden h-28 -translate-y-1/2 2xl:block" />
      <ul className="mx-auto grid max-w-7xl grid-cols-4 px-2 py-3 sm:px-6 md:py-5 lg:px-8">
        {ITEMS.map((it, i) => (
          <li key={it.title} className={`flex min-w-0 flex-col items-center gap-1 px-1 text-center md:flex-row md:justify-center md:gap-3.5 md:px-2 md:text-left ${i ? "border-l border-mbi-border-strong" : ""}`}>
            {it.icon}
            <div className="min-w-0">
              <p className="text-[11px] leading-tight font-bold text-mbi-navy sm:text-xs md:text-base">{it.title}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-mbi-slate sm:text-[11px] md:mt-0 md:text-sm">{it.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
