import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const W = 60, H = 72; // drawn size; phones scale it down in christmas.css

// Keeps Santa standing on top of the real Ask Betty button, wherever that button is: it follows
// window resizes and the button's own moves (e.g. the raised position for signed-in shoppers).
function useLauncherSpot() {
  const [spot, setSpot] = useState(null);
  useEffect(() => {
    let launcher = null, ro = null, mo = null, raf = 0, tries = 0, timer = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!launcher?.isConnected) return;
        const r = launcher.getBoundingClientRect();
        if (!r.width) { setSpot(null); return; } // button hidden (e.g. a product sheet is open)
        setSpot({ x: r.left + r.width / 2, y: r.top });
      });
    };
    const attach = () => {
      launcher = document.querySelector(".chat-launcher");
      if (!launcher) {
        if (tries++ < 40) timer = setTimeout(attach, 250); // the chat button mounts with the app
        return;
      }
      ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
      ro?.observe(launcher);
      mo = new MutationObserver(measure);
      mo.observe(launcher, { attributes: true, attributeFilter: ["class", "style"] });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sheet-open", "data-action-bar"] });
      measure();
    };
    attach();
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return spot;
}

// An original, friendly Santa who dances on top of the Ask Betty button while Christmas is on.
// Purely decorative: never takes a tap. He hops down into the button when the chat opens and
// pops back up when it closes (rules in christmas.css keyed to html[data-chat-open]).
export default function DancingSanta() {
  const spot = useLauncherSpot();
  if (!spot) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="xmas-santa"
      style={{ left: `${Math.round(spot.x - W / 2)}px`, top: `${Math.round(spot.y - H + 6)}px` }}
    >
      <svg width={W} height={H} viewBox="0 0 60 72">
        <ellipse cx="30" cy="70" rx="15" ry="2.2" fill="#1e2d3d" opacity="0.18" />
        <g className="santa-body">
          {/* legs and boots */}
          <g className="santa-leg santa-leg-l">
            <rect x="20" y="52" width="7" height="10" rx="2" fill="#C8202A" />
            <path d="M17 60h11v5a2 2 0 0 1-2 2h-8a3 3 0 0 1-3-3z" fill="#1e2d3d" />
          </g>
          <g className="santa-leg santa-leg-r">
            <rect x="33" y="52" width="7" height="10" rx="2" fill="#C8202A" />
            <path d="M32 60h11v4a3 3 0 0 1-3 3h-8a2 2 0 0 1-2-2z" fill="#1e2d3d" />
          </g>

          {/* arms (behind the coat), each waving from the shoulder */}
          <g className="santa-arm santa-arm-l">
            <path d="M18 34c-5 2-8 7-8 12" stroke="#C8202A" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="10" cy="47" r="3.6" fill="#1F7A4D" />
            <rect x="7" y="42" width="7" height="2.6" rx="1.3" fill="#fff" transform="rotate(-10 10 43)" />
          </g>
          <g className="santa-arm santa-arm-r">
            <path d="M42 34c5 2 8 7 8 12" stroke="#C8202A" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="50" cy="47" r="3.6" fill="#1F7A4D" />
            <rect x="46" y="42" width="7" height="2.6" rx="1.3" fill="#fff" transform="rotate(10 50 43)" />
          </g>

          {/* coat */}
          <path d="M17 34c0-4 6-7 13-7s13 3 13 7l2 18a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="#D7262E" />
          <rect x="15" y="51" width="30" height="4.5" rx="2.2" fill="#fff" />
          <rect x="28.4" y="28" width="3.2" height="23" fill="#fff" opacity="0.9" />
          <rect x="16.5" y="42" width="27" height="4.2" fill="#1e2d3d" />
          <rect x="26.6" y="41.2" width="6.8" height="5.8" rx="1" fill="none" stroke="#F2C14E" strokeWidth="1.6" />

          {/* head */}
          <g className="santa-head">
            <circle cx="30" cy="20" r="8.5" fill="#F3C6A5" />
            <circle cx="25.4" cy="22" r="2" fill="#F08A8A" opacity="0.65" />
            <circle cx="34.6" cy="22" r="2" fill="#F08A8A" opacity="0.65" />
            <circle cx="27" cy="18.6" r="1.1" fill="#1e2d3d" />
            <circle cx="33" cy="18.6" r="1.1" fill="#1e2d3d" />
            {/* beard and moustache */}
            <path d="M21 21c0 7 4 12 9 12s9-5 9-12c-2 3-5 4-9 4s-7-1-9-4z" fill="#fff" />
            <path d="M24.5 23.5c2-2 4-2 5.5-.6 1.5-1.4 3.5-1.4 5.5.6-2 1.3-4 1.2-5.5.2-1.5 1-3.5 1.1-5.5-.2z" fill="#F4F4F4" stroke="#E2E2E2" strokeWidth=".4" />
            <circle cx="30" cy="21.4" r="1.5" fill="#E77D6E" />
            {/* hat */}
            <path d="M21.5 15c1-8 7-11 13-9 4 1.5 6 5 7 9" fill="#D7262E" />
            <path className="santa-hat-tip" d="M34.5 6c4-1 8 1 9.5 5" stroke="#D7262E" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <circle className="santa-pom" cx="44.5" cy="12" r="3.2" fill="#fff" />
            <rect x="20" y="13.2" width="20.5" height="4.6" rx="2.3" fill="#fff" />
          </g>
        </g>
        {/* a little gold sparkle, now and then */}
        <path className="santa-sparkle" d="M52 6l1.2 2.8L56 10l-2.8 1.2L52 14l-1.2-2.8L48 10l2.8-1.2z" fill="#F2C14E" />
      </svg>
    </div>,
    document.body,
  );
}
