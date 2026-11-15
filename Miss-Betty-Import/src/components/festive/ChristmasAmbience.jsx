import { useEffect } from "react";
import Snowfall from "./Snowfall";
import DancingSanta from "./DancingSanta";
import { installSparkleBurst } from "./sparkleBurst";
import "./christmas.css";

// The festive layer for the whole Home / Shop page (the banner itself lives in ChristmasMain):
// snow that keeps falling behind the content all the way down, the decorations in christmas.css
// (lights under the header, dressed shelves, a snowy footer), a little sparkle when a shopper
// taps a product button, and a Santa dancing on the Ask Betty button. Everything hangs off html[data-christmas], set here, so
// switching Christmas off removes it all at once.
export default function ChristmasAmbience({ leaving = false }) {
  useEffect(() => {
    // Also lifts the page content above the snow layer (see "html[data-christmas]" in App.css).
    document.documentElement.setAttribute("data-christmas", "");
    const removeBurst = installSparkleBurst();
    return () => {
      document.documentElement.removeAttribute("data-christmas");
      removeBurst();
    };
  }, []);

  return (
    <div className={`transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <Snowfall mode="page" count={30} color="143,163,186" maxAlpha={0.7} fadeOnScroll={false} />
      {!leaving && <DancingSanta />}
    </div>
  );
}
