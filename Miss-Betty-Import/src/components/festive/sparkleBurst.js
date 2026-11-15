// A small festive burst (gold stars, red and white snowflakes) from the point where a shopper taps
// a button in the product area: Add to cart, Buy now, shelf cards. One delegated listener; each
// particle is a short-lived fixed <span> that removes itself. Never touches the click itself, so
// cart and checkout behave exactly as before. Skipped for people who ask for reduced motion.
const SHAPES = [
  { ch: "✦", color: "#F2C14E" },
  { ch: "❄", color: "#FFFFFF" },
  { ch: "✦", color: "#D7262E" },
  { ch: "★", color: "#F7D774" },
  { ch: "❄", color: "#D9E8F5" },
];
const COUNT = 7;

function burst(x, y) {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "xmas-burst";
  for (let i = 0; i < COUNT; i++) {
    const s = SHAPES[i % SHAPES.length];
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 26 + Math.random() * 22;
    const p = document.createElement("span");
    p.textContent = s.ch;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.color = s.color;
    p.style.fontSize = `${10 + Math.random() * 6}px`;
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 8}px`);
    p.style.animationDelay = `${Math.random() * 60}ms`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 900);
}

export function installSparkleBurst() {
  const onClick = e => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const btn = e.target instanceof Element ? e.target.closest("main button") : null;
    if (!btn || btn.disabled) return;
    let { clientX: x, clientY: y } = e;
    if (!x && !y) { // keyboard press: burst from the button's centre
      const r = btn.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    burst(x, y);
  };
  // Capture phase: product buttons stop their clicks from bubbling (so the card doesn't also open),
  // so the burst listens on the way down instead. It only reads the click, never changes it.
  document.addEventListener("click", onClick, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.querySelectorAll(".xmas-burst").forEach(n => n.remove());
  };
}
