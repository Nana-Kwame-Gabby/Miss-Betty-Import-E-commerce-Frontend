import { useEffect, useRef } from "react";

const reduceMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// One lightweight canvas snow engine (no DOM node per flake).
//   mode "contained": fills its positioned parent (the Christmas banner).
//   mode "page":      a fixed full-screen layer that sits behind the page content (z-0), so flakes
//                     only show in the gaps between product cards. It fades out as the shopper
//                     scrolls past the top of the page, keeping the deep product grid clean.
// The loop pauses off screen and in hidden tabs; reduced-motion visitors get one still frame
// (banner) or nothing at all (page).
export default function Snowfall({ mode = "contained", count = 40, color = "255,255,255", maxAlpha = 0.9, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const page = mode === "page";
    const still = reduceMotion();
    if (page && still) return;

    let w = 0, h = 0, raf = 0, last = 0, visible = true, fade = 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let flakes = [];

    const make = (anywhere) => {
      const r = 0.8 + Math.random() ** 2 * (page ? 2.2 : 2.6);
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -6 - Math.random() * 20,
        r,
        vy: 12 + r * 9 + Math.random() * 8,        // px per second: bigger flakes fall a little faster
        sway: 6 + Math.random() * 14,
        freq: 0.4 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        a: (0.35 + Math.random() * 0.65) * maxAlpha,
        crystal: r > 2.4,
      };
    };

    const resize = () => {
      const box = page ? { width: window.innerWidth, height: window.innerHeight } : canvas.parentElement.getBoundingClientRect();
      w = Math.max(1, Math.round(box.width));
      h = Math.max(1, Math.round(box.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // fewer flakes on small screens, so the banner text stays easy to read
      const n = page
        ? (w < 640 ? Math.round(count / 2) : count)
        : Math.max(14, Math.round(count * Math.min(1, w / 900)));
      flakes = Array.from({ length: n }, () => make(true));
      if (still) draw(0);
    };

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      for (const f of flakes) {
        const x = f.x + Math.sin(t * f.freq + f.phase) * f.sway;
        ctx.fillStyle = `rgba(${color},${(f.a * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        if (f.crystal) {
          // a hint of a six-armed crystal on the larger flakes
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI) / 3 + f.phase;
            const dx = Math.cos(ang) * f.r * 2.1, dy = Math.sin(ang) * f.r * 2.1;
            ctx.moveTo(x - dx, f.y - dy);
            ctx.lineTo(x + dx, f.y + dy);
          }
          ctx.stroke();
        }
      }
    }

    const tick = ts => {
      raf = 0;
      if (!visible || document.hidden || fade <= 0) { last = 0; return; }
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      const t = ts / 1000;
      for (const f of flakes) {
        f.y += f.vy * dt;
        if (f.y - f.r * 2 > h) Object.assign(f, make(false));
      }
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf && !still) raf = requestAnimationFrame(tick); };

    resize();
    run();

    const cleanups = [];
    const onVisibility = () => run();
    document.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

    if (page) {
      const onResize = () => resize();
      const onScroll = () => {
        const vh = window.innerHeight;
        fade = Math.max(0, Math.min(1, 1 - (window.scrollY - vh * 0.8) / (vh * 0.7)));
        canvas.style.opacity = String(fade);
        run();
      };
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      cleanups.push(() => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onScroll); });
    } else {
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      ro?.observe(canvas.parentElement);
      const io = typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); })
        : null;
      io?.observe(canvas);
      cleanups.push(() => { ro?.disconnect(); io?.disconnect(); });
    }

    return () => { cancelAnimationFrame(raf); cleanups.forEach(c => c()); };
  }, [mode, count, color, maxAlpha]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none ${mode === "page" ? "fixed inset-0 z-0 transition-opacity duration-300" : "absolute inset-0"} ${className}`}
    />
  );
}
