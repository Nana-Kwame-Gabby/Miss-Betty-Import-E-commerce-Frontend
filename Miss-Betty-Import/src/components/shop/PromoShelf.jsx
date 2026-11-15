import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import { markShelfSeen } from "../../hooks/usePromoShelves";

const COPY = {
  ready: { title: "Ready to deliver", sub: "In stock in Ghana, delivered sooner" },
  popular: { title: "Most ordered", sub: "What other shoppers buy most" },
};

const SPEED = 28;          // px per second: a card drifts past in roughly 6–8 s
const RESUME_AFTER = 4000; // ms after a touch, swipe or arrow press before the drift picks up again

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

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const isKeyboardFocus = el => {
  try { return el.matches(":focus-visible"); } catch { return false; }
};

// A labelled, swipeable row of normal product cards that spans the whole product grid
// (DESIGN.md "Promoted shelf"). Phones show the band edge to edge.
//
// When there are more products than fit, the row drifts slowly right-to-left in an endless loop:
// the real scroll row is advanced a fraction of a pixel per frame, and once a card has fully left
// on the left it is moved to the end (with the scroll position corrected in the same layout pass,
// so nothing visibly jumps). Each product appears once. The drift pauses while the shelf is
// hovered, touched, keyboard-focused, paged with the arrows, off screen or in a hidden tab, and
// never runs for people who ask their device to reduce motion.
export default function PromoShelf({ kind, items, cardProps }) {
  const { title, sub } = COPY[kind];
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const engineRef = useRef(null); // the drift controller, live while looping
  const shiftRef = useRef(0);     // scroll correction owed once a reorder has rendered
  const afterRef = useRef(null);  // work to run right after that correction (arrow paging)
  const [ends, setEnds] = useState({ start: true, end: false });
  const [offset, setOffset] = useState(0);
  const [canLoop, setCanLoop] = useState(false);
  const [reduce, setReduce] = useState(prefersReducedMotion);
  const loop = canLoop && !reduce;

  const n = items.length;
  const first = n ? ((offset % n) + n) % n : 0;
  const shown = first ? [...items.slice(first), ...items.slice(0, first)] : items;

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

  // Follow the device's reduce-motion setting live.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Loop only when the products overflow the shelf by more than a card; a short shelf stays still.
  useEffect(() => {
    const r = rowRef.current;
    if (!r || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const c = r.children;
      setCanLoop(c.length >= 3 && r.scrollWidth - r.clientWidth > c[1].offsetLeft + 8);
    });
    ro.observe(r);
    return () => ro.disconnect();
  }, [items]);

  // A reorder just rendered: move the scroll position by the same distance so the picture holds still.
  useLayoutEffect(() => {
    const shift = shiftRef.current;
    if (!shift) return;
    shiftRef.current = 0;
    const r = rowRef.current;
    if (r) r.scrollLeft += shift;
    engineRef.current?.shifted(shift);
    const after = afterRef.current;
    afterRef.current = null;
    after?.();
  }, [offset]);

  // The drift itself.
  useEffect(() => {
    const r = rowRef.current, sec = sectionRef.current;
    if (!loop || !r || !sec) return;
    const pauses = new Set(["offscreen"]); // starts held until the shelf is seen on screen
    const timers = {};
    let raf = 0, last = 0, pos = r.scrollLeft, idle = 0, touching = false;

    // k > 0 moves the first k cards to the end; k < 0 moves the last |k| cards to the front.
    const rotate = k => {
      const c = r.children, m = c.length;
      if (!k || shiftRef.current || m < 3) return false;
      if (k > 0) {
        shiftRef.current = c[0].offsetLeft - c[k].offsetLeft;
      } else {
        const gap = c[1].offsetLeft - c[0].offsetLeft - c[0].offsetWidth, end = c[m - 1];
        shiftRef.current = end.offsetLeft + end.offsetWidth + gap - c[m + k].offsetLeft;
      }
      setOffset(o => o + k);
      return true;
    };
    // How many leading cards have fully left the shelf on the left.
    const passed = () => {
      const c = r.children, x = r.scrollLeft;
      let k = 0;
      while (k < c.length - 2 && c[k + 1].offsetLeft < x - 1) k++;
      return k;
    };

    const tick = ts => {
      raf = 0;
      if (pauses.size) { last = 0; return; }
      if (!last) { last = ts; pos = r.scrollLeft; }
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      pos = Math.min(r.scrollWidth - r.clientWidth, pos + SPEED * dt);
      r.scrollLeft = pos;
      if (!shiftRef.current && r.children[1].offsetLeft < pos - 1) rotate(1);
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf && !pauses.size) { last = 0; raf = requestAnimationFrame(tick); } };
    const pause = (why, resumeIn) => {
      clearTimeout(timers[why]);
      pauses.add(why);
      if (resumeIn) timers[why] = setTimeout(() => { pauses.delete(why); run(); }, resumeIn);
    };
    const resume = why => { clearTimeout(timers[why]); pauses.delete(why); run(); };

    // After someone scrolls by hand, quietly re-balance the cards so the loop never runs dry either way.
    const normalize = () => {
      if (touching || shiftRef.current) return;
      const a = document.activeElement;
      if (a && r.contains(a) && isKeyboardFocus(a)) return;
      const k = passed();
      if (k) rotate(k);
      else if (r.scrollLeft < 1) rotate(-1);
    };

    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => (e.isIntersecting ? resume("offscreen") : pause("offscreen")))
      : null;
    if (io) io.observe(sec); else resume("offscreen");
    const onVisibility = () => (document.hidden ? pause("hidden") : resume("hidden"));
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    engineRef.current = {
      shifted: shift => { pos += shift; },
      hover: (on, e) => { if (e.pointerType === "mouse") (on ? pause("hover") : resume("hover")); },
      touch: on => {
        touching = on;
        pause("touch", on ? 0 : RESUME_AFTER);
        if (!on) { clearTimeout(idle); idle = setTimeout(normalize, 150); }
      },
      focus: (on, e) => {
        if (on) { if (isKeyboardFocus(e.target)) pause("focus"); }
        else if (!sec.contains(e.relatedTarget)) resume("focus");
      },
      scrolled: () => {
        if (!pauses.size) return; // our own drift
        if (pauses.has("touch") && !touching) pause("touch", RESUME_AFTER); // momentum: wait for it to settle
        clearTimeout(idle);
        idle = setTimeout(normalize, 150);
      },
      arrow: dir => {
        pause("arrow", RESUME_AFTER);
        const step = r.clientWidth * 0.9;
        const go = () => r.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
        const c = r.children, x = r.scrollLeft;
        // Make room first, so each press always moves a full page and the loop never hits an end.
        if (dir === "prev" && x < step) {
          const gap = c[1].offsetLeft - c[0].offsetLeft - c[0].offsetWidth;
          let k = 0, room = x;
          while (k < c.length - 2 && room < step) {
            const card = c[c.length - 1 - k];
            if (card.offsetLeft < x + r.clientWidth) break; // only cards that are off screen on the right
            room += card.offsetWidth + gap;
            k++;
          }
          if (k && rotate(-k)) { afterRef.current = go; return; }
        } else if (dir === "next" && x + step > r.scrollWidth - r.clientWidth) {
          const k = passed();
          if (k && rotate(k)) { afterRef.current = go; return; }
        }
        go();
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      Object.values(timers).forEach(clearTimeout);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engineRef.current = null;
    };
  }, [loop]);

  function updateEnds() {
    const r = rowRef.current;
    if (!r) return;
    setEnds({ start: r.scrollLeft <= 4, end: r.scrollLeft + r.clientWidth >= r.scrollWidth - 4 });
  }
  useEffect(updateEnds, [items]);

  const page = dir => {
    if (engineRef.current) return engineRef.current.arrow(dir);
    const r = rowRef.current;
    if (!r) return;
    r.scrollBy({ left: (dir === "next" ? 1 : -1) * r.clientWidth * 0.9, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      onPointerEnter={e => engineRef.current?.hover(true, e)}
      onPointerLeave={e => engineRef.current?.hover(false, e)}
      onFocus={e => engineRef.current?.focus(true, e)}
      onBlur={e => engineRef.current?.focus(false, e)}
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
          <button type="button" onClick={() => page("prev")} disabled={!loop && ends.start} className={arrowClass} aria-label={`Previous ${title} products`}><Arrow dir="prev" /></button>
          <button type="button" onClick={() => page("next")} disabled={!loop && ends.end} className={arrowClass} aria-label={`More ${title} products`}><Arrow dir="next" /></button>
        </div>
      </div>

      <div
        ref={rowRef}
        onScroll={() => { updateEnds(); engineRef.current?.scrolled(); }}
        onTouchStart={() => engineRef.current?.touch(true)}
        onTouchEnd={() => engineRef.current?.touch(false)}
        onTouchCancel={() => engineRef.current?.touch(false)}
        className={`no-scrollbar relative -mx-4 flex scroll-px-4 gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 lg:gap-6 ${loop ? "" : "snap-x snap-mandatory"}`}
      >
        {shown.map(p => (
          <div key={p.id} className="flex w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-4.5rem)/4)] [&>article]:min-w-0 [&>article]:flex-1">
            {/* the card stretches to the tallest in the row, so every card's buttons line up */}
            <ProductCard product={p} {...cardProps} />
          </div>
        ))}
      </div>
    </section>
  );
}
