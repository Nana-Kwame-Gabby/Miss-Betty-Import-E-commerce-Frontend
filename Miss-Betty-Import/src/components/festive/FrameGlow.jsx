import { useEffect, useRef } from "react";
import { useAppSettings } from "../../context/AppSettingsContext";

// One observer for every card: a frame's snow only falls while it is on screen.
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

// A soft red glow with gently falling glowing red snow, sitting *behind* a product photo's
// frame, so it shows as a festive halo around the edges and never over the picture (styles in
// christmas.css, which only applies on Home and Shop). Shown only while Christmas is on.
export default function FrameGlow() {
  const { christmasActive } = useAppSettings();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watch(el);
  }, [christmasActive]);

  if (!christmasActive) return null;
  return (
    <span ref={ref} aria-hidden="true" className="xmas-glow">
      <b />
    </span>
  );
}
