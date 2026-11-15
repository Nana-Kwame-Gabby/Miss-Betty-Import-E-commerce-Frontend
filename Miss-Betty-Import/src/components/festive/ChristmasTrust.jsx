import PineCorner from "./PineCorner";

const Icon = ({ children }) => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-mbi-navy">
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

// The reassurance row under the Christmas hero.
export default function ChristmasTrust() {
  return (
    <div className="relative bg-mbi-surface-soft">
      <PineCorner className="absolute top-1/2 left-0 hidden h-28 -translate-y-1/2 2xl:block" />
      <PineCorner flip className="absolute top-1/2 right-0 hidden h-28 -translate-y-1/2 2xl:block" />
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-3 gap-y-4 px-4 py-4 sm:px-6 md:grid-cols-4 md:gap-0 md:py-5 lg:px-8">
        {ITEMS.map((it, i) => (
          <li key={it.title} className={`flex items-center gap-2.5 md:justify-center md:gap-3.5 ${i ? "md:border-l md:border-mbi-border-strong" : ""}`}>
            {it.icon}
            <div className="min-w-0">
              <p className="text-sm leading-tight font-bold text-mbi-navy md:text-base">{it.title}</p>
              <p className="text-xs leading-tight text-mbi-slate md:text-sm">{it.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
