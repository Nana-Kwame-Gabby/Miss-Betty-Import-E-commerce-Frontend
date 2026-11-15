// A decorated Christmas tree for the left side of the Christmas hero: deep green tiers, warm
// glowing lights that twinkle slowly, baubles, a gold star and gifts at its foot. Drawn (not a
// photo) so it fills the banner's height at any size; purely decorative.

// Small deterministic random, so the tree looks the same on every render and every device.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const CX = 200;
// [apex y, bottom y, half width at the bottom]
const TIERS = [
  [34, 128, 66],
  [80, 186, 100],
  [128, 248, 134],
  [178, 314, 166],
  [232, 384, 196],
];

// A tier: a triangle whose bottom edge droops in soft scallops, like branch tips.
function tierPath([top, bottom, w]) {
  const scallops = 6 + Math.round(w / 40);
  let d = `M${CX} ${top} L${CX + w} ${bottom}`;
  for (let i = scallops; i > 0; i--) {
    const x1 = CX - w + ((i - 0.5) * 2 * w) / scallops;
    const x0 = CX - w + ((i - 1) * 2 * w) / scallops;
    d += ` Q${x1.toFixed(1)} ${(bottom + 12).toFixed(1)} ${x0.toFixed(1)} ${bottom}`;
  }
  return `${d} Z`;
}

// Points along a sagging garland across a tier, from left to right.
function garland([top, bottom, w], t, n) {
  const y = top + (bottom - top) * t;
  const half = w * ((y - top) / (bottom - top)) * 0.92;
  return Array.from({ length: n }, (_, i) => {
    const f = n === 1 ? 0.5 : i / (n - 1);
    return [CX - half + 2 * half * f, y + Math.sin(f * Math.PI) * 10];
  });
}

const rand = rng(20251224);
const LIGHT_COLOURS = ["#FFE3A3", "#FFC861", "#FFF4D6", "#FFB36B"];
const LIGHTS = TIERS.flatMap((tier, ti) =>
  [0.45, 0.82].flatMap(t => garland(tier, t, 4 + ti * 2)).map(([x, y], i) => ({
    x, y, c: LIGHT_COLOURS[(i + ti) % LIGHT_COLOURS.length], d: (rand() * 3.2).toFixed(2), r: 2.6 + rand() * 1.4,
  })));
const BAUBLE_COLOURS = [["#C8202A", "#8E1219"], ["#E7B44C", "#A87818"], ["#D9DDE6", "#8E95A3"], ["#B3123B", "#760A25"]];
const BAUBLES = TIERS.flatMap((tier, ti) =>
  garland(tier, 0.66, 2 + ti).map(([x, y], i) => ({ x: x + (rand() - 0.5) * 10, y: y + 6, r: 6 + ti * 0.9 + rand() * 2, col: BAUBLE_COLOURS[(i + ti * 2) % 4] })));
const NEEDLES = TIERS.flatMap(([top, bottom, w]) =>
  Array.from({ length: Math.round(w / 3) }, () => {
    const y = top + 18 + rand() * (bottom - top - 14);
    const half = w * ((y - top) / (bottom - top));
    const x = CX + (rand() * 2 - 1) * half * 0.95;
    const a = Math.PI / 2 + (x < CX ? 0.6 : -0.6) + (rand() - 0.5) * 0.5;
    return [x, y, x + Math.cos(a) * 9, y + Math.sin(a) * 9, rand() > 0.5];
  }));

export default function ChristmasTree({ className = "" }) {
  return (
    <svg viewBox="0 0 400 440" aria-hidden="true" className={`pointer-events-none ${className}`} preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="xt-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F7C46" />
          <stop offset="1" stopColor="#174A2A" />
        </linearGradient>
        <linearGradient id="xt-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="xt-glow">
          <stop offset="0" stopColor="#FFD98A" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="xt-halo">
          <stop offset="0" stopColor="#FFC56B" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFC56B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* warm light around the tree, so it sits in the scene rather than on it */}
      <ellipse cx={CX} cy="250" rx="230" ry="210" fill="url(#xt-halo)" />

      {/* trunk and gifts */}
      <rect x={CX - 16} y="378" width="32" height="40" rx="3" fill="#4A2C1A" />
      <g>
        <rect x="104" y="392" width="62" height="44" rx="3" fill="#B5121B" />
        <rect x="131" y="392" width="8" height="44" fill="#F2C14E" />
        <path d="M135 392c-6-12-22-14-22-6s14 7 22 6zm0 0c6-12 22-14 22-6s-14 7-22 6z" fill="#F2C14E" />
        <rect x="232" y="404" width="54" height="32" rx="3" fill="#2E7D4F" />
        <rect x="255" y="404" width="8" height="32" fill="#F7F3EA" />
        <rect x="282" y="414" width="40" height="22" rx="3" fill="#E7B44C" />
        <rect x="298" y="414" width="7" height="22" fill="#B5121B" />
      </g>

      {/* the tree: tiers from the bottom up so upper tiers overlap lower ones */}
      {[...TIERS].reverse().map((tier, i) => (
        <g key={i}>
          <path d={tierPath(tier)} fill="url(#xt-green)" />
          <path d={tierPath(tier)} fill="url(#xt-shade)" />
        </g>
      ))}
      {NEEDLES.map(([x1, y1, x2, y2, light], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={light ? "#3F9157" : "#123D22"} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      ))}

      {/* baubles */}
      {BAUBLES.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.col[0]} />
          <circle cx={b.x + b.r * 0.25} cy={b.y + b.r * 0.25} r={b.r * 0.75} fill={b.col[1]} opacity="0.45" />
          <circle cx={b.x - b.r * 0.35} cy={b.y - b.r * 0.35} r={b.r * 0.28} fill="#fff" opacity="0.7" />
        </g>
      ))}

      {/* lights: a soft glow plus a bright core, twinkling out of step */}
      {LIGHTS.map((l, i) => (
        <g key={i} className="festive-light" style={{ animationDelay: `${l.d}s` }}>
          <circle cx={l.x} cy={l.y} r={l.r * 3.4} fill="url(#xt-glow)" />
          <circle cx={l.x} cy={l.y} r={l.r} fill={l.c} />
        </g>
      ))}

      {/* star */}
      <circle cx={CX} cy="30" r="30" fill="url(#xt-glow)" />
      <path className="festive-sparkle" d={`M${CX} 10l6.5 13.5 14.8 1.6-11 10 3.2 14.6L${CX} 42.4l-13.5 7.3 3.2-14.6-11-10 14.8-1.6z`} fill="#F7C948" stroke="#E2A51E" strokeWidth="1" />
    </svg>
  );
}
