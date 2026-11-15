// A string of fairy lights hanging just under the shop header. Purely decorative: it takes no
// clicks and screen readers skip it. Bulbs twinkle slowly and out of step with each other.
const BULBS = [
  { fill: "#F2AA25", glow: "rgba(242,170,37,0.55)" },  // brand amber
  { fill: "#C8322B", glow: "rgba(200,50,43,0.45)" },   // berry red
  { fill: "#1F7A4D", glow: "rgba(31,122,77,0.45)" },   // pine green
  { fill: "#FFF4D6", glow: "rgba(242,170,37,0.35)" },  // warm white
];
const CELL = 46;   // px between bulbs
const CELLS = 56;  // enough for wide screens; the row is clipped to the page width

export default function ChristmasLights() {
  return (
    <div aria-hidden="true" className="pointer-events-none h-6 overflow-hidden bg-white">
      <div className="flex w-max">
        {Array.from({ length: CELLS }, (_, i) => {
          const b = BULBS[i % BULBS.length];
          return (
            <svg key={i} width={CELL} height="24" viewBox={`0 0 ${CELL} 24`} className="shrink-0">
              <path d={`M0 2 Q${CELL / 2} 11 ${CELL} 2`} fill="none" stroke="#33475b" strokeOpacity="0.55" strokeWidth="1.2" />
              <rect x={CELL / 2 - 2} y="6.5" width="4" height="3.5" rx="0.8" fill="#5c6b7a" />
              <g className="festive-bulb" style={{ animationDelay: `${((i * 37) % 23) / 10}s`, filter: `drop-shadow(0 0 3px ${b.glow})` }}>
                <ellipse cx={CELL / 2} cy="14.5" rx="3.4" ry="5" fill={b.fill} stroke="rgba(30,45,61,0.25)" strokeWidth="0.6" />
                <ellipse cx={CELL / 2 - 1.1} cy="12.6" rx="0.9" ry="1.6" fill="#fff" opacity="0.55" />
              </g>
            </svg>
          );
        })}
      </div>
    </div>
  );
}
