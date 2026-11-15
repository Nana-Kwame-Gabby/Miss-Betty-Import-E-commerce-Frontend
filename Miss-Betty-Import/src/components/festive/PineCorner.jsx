// A pine sprig with red berries, drawn for the top-left corner; flip={true} mirrors it for the
// right. Purely decorative.
const NEEDLE = "#2E6B3A", NEEDLE_LIGHT = "#4C8F4E", NEEDLE_DARK = "#1D4A28";

// Needles along a branch: [x, y, angle] at even steps, alternating sides.
function needles(x1, y1, x2, y2, n, len) {
  const out = [];
  const dx = (x2 - x1) / n, dy = (y2 - y1) / n;
  const base = Math.atan2(y2 - y1, x2 - x1);
  for (let i = 1; i <= n; i++) {
    const x = x1 + dx * i, y = y1 + dy * i;
    for (const side of [-1, 1]) {
      const a = base + side * 0.75;
      out.push([x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, (i + (side > 0 ? 1 : 0)) % 3]);
    }
  }
  return out;
}

const BRANCHES = [
  [0, 6, 92, 40, 15, 15],
  [0, 30, 70, 78, 12, 13],
  [20, 0, 64, 22, 8, 11],
  [44, 22, 104, 30, 9, 12],
];
const COLORS = [NEEDLE, NEEDLE_LIGHT, NEEDLE_DARK];

export default function PineCorner({ flip = false, className = "" }) {
  return (
    <svg
      viewBox="0 0 120 100"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {BRANCHES.map(([x1, y1, x2, y2, n, len], b) => (
        <g key={b}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5A3A22" strokeWidth="2" strokeLinecap="round" />
          {needles(x1, y1, x2, y2, n, len).map(([ax, ay, bx, by, c], i) => (
            <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={COLORS[c]} strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </g>
      ))}
      {[[60, 48, 5.5], [69, 52, 5], [62, 58, 4.6], [86, 36, 4.4]].map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill="#C8202A" />
          <circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.55" />
        </g>
      ))}
    </svg>
  );
}
