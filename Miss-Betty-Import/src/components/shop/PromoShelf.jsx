import { useEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import { markShelfSeen } from "../../hooks/usePromoShelves";

const COPY = {
  ready: { title: "Ready to deliver", sub: "In stock in Ghana, delivered sooner" },
  popular: { title: "Most ordered", sub: "What other shoppers buy most" },
};

const ReadyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const PopularIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const Arrow = ({ dir }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "prev" ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
  </svg>
);

const arrowClass = "mbi-press grid place-items-center size-9 rounded-full border border-mbi-navy/20 bg-white text-mbi-navy hover:border-mbi-navy disabled:opacity-30 disabled:pointer-events-none";

// A labelled, swipeable row of normal product cards that spans the whole product grid
// (DESIGN.md "Promoted shelf"). Phones show the band edge to edge.
export default function PromoShelf({ kind, items, cardProps }) {
  const { title, sub } = COPY[kind];
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const [ends, setEnds] = useState({ start: true, end: false });

  // Once half the shelf has been on screen, its products count as seen for this visit.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { markShelfSeen(items.map(p => p.id)); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [items]);

  function updateEnds() {
    const r = rowRef.current;
    if (!r) return;
    setEnds({ start: r.scrollLeft <= 4, end: r.scrollLeft + r.clientWidth >= r.scrollWidth - 4 });
  }
  useEffect(updateEnds, [items]);

  const page = dir => {
    const r = rowRef.current;
    if (!r) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    r.scrollBy({ left: (dir === "next" ? 1 : -1) * r.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      className="col-span-full -mx-4 bg-mbi-amber-band px-4 py-5 sm:mx-0 sm:rounded-mbi-card sm:px-5 lg:px-6"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white text-mbi-amber-ink">
            {kind === "ready" ? <ReadyIcon /> : <PopularIcon />}
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight text-mbi-navy">{title}</h2>
            <p className="text-sm text-mbi-navy-body">{sub}</p>
          </div>
        </div>
        <div className="hidden gap-2 lg:flex">
          <button type="button" onClick={() => page("prev")} disabled={ends.start} className={arrowClass} aria-label={`Previous ${title} products`}><Arrow dir="prev" /></button>
          <button type="button" onClick={() => page("next")} disabled={ends.end} className={arrowClass} aria-label={`More ${title} products`}><Arrow dir="next" /></button>
        </div>
      </div>

      <div
        ref={rowRef}
        onScroll={updateEnds}
        className="no-scrollbar relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 lg:gap-6"
      >
        {items.map(p => (
          <div key={p.id} className="flex w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-4.5rem)/4)] [&>article]:min-w-0 [&>article]:flex-1">
            {/* the card stretches to the tallest in the row, so every card's buttons line up */}
            <ProductCard product={p} {...cardProps} />
          </div>
        ))}
      </div>
    </section>
  );
}
