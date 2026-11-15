import { useEffect, useRef } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";

// One observer for every card: a frame's snowflakes only move while it is on screen.
let observer = null;
function watch(el) {
  if (typeof IntersectionObserver === "undefined") { el.dataset.inView = ""; return () => {}; }
  observer ??= new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) e.target.dataset.inView = "";
      else delete e.target.dataset.inView;
    }
  }, { rootMargin: "60px" });
  observer.observe(el);
  return () => observer?.unobserve(el);
}

// Three small red snowflakes that circle a product photo's frame while Christmas Animations are
// on (styles in christmas.css, which only applies on Home and Shop). Decorative only: never
// in the way of a tap, gone completely when Christmas is switched off.
export default function FrameFlakes() {
  const { christmasActive } = useAppSettings();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watch(el);
  }, [christmasActive]);

  if (!christmasActive) return null;
  return (
    <span ref={ref} aria-hidden="true" className="xmas-frame">
      <i style={{ "--d": "0%" }} />
      <i style={{ "--d": "33.333%" }} />
      <i style={{ "--d": "66.667%" }} />
    </span>
  );
}
