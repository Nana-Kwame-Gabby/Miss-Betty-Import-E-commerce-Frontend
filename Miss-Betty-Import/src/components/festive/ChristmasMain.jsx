import { useEffect } from "react";
import ChristmasHero from "./ChristmasHero";
import ChristmasTrust from "./ChristmasTrust";
import Snowfall from "./Snowfall";

// Under the shop header: the photo hero, the trust strip, and light snow behind the page.
export default function ChristmasMain({ christmas, leaving = false }) {
  useEffect(() => {
    // Lifts the page content above the snow layer (see "html[data-christmas]" in App.css).
    document.documentElement.setAttribute("data-christmas", "");
    return () => document.documentElement.removeAttribute("data-christmas");
  }, []);

  return (
    <div className={`transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <Snowfall mode="page" count={24} color="143,163,186" maxAlpha={0.7} />
      <div className="relative z-[1]">
        <ChristmasHero headline={christmas.headline} message={christmas.message} photo={christmas.photo} />
        <ChristmasTrust />
      </div>
    </div>
  );
}
