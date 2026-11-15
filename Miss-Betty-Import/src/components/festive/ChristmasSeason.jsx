import { useEffect } from "react";
import ChristmasLights from "./ChristmasLights";
import ChristmasBanner from "./ChristmasBanner";
import Snowfall from "./Snowfall";

// Everything customers see while Christmas Animations are on: fairy lights under the header,
// the festive banner, and a light scatter of snow behind the page content.
// leaving: the admin just switched Christmas off, so everything fades away before unmounting.
export default function ChristmasSeason({ headline, message, leaving = false }) {
  // Lifts the page content above the snow layer (see "html[data-christmas]" in App.css).
  useEffect(() => {
    document.documentElement.setAttribute("data-christmas", "");
    return () => document.documentElement.removeAttribute("data-christmas");
  }, []);

  return (
    <div className={`transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <Snowfall mode="page" count={24} color="143,163,186" maxAlpha={0.7} />
      <div className="relative z-[1]">
        <ChristmasLights />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <ChristmasBanner headline={headline} message={message} />
        </div>
      </div>
    </div>
  );
}
