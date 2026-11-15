import ChristmasHero from "./ChristmasHero";
import ChristmasTrust from "./ChristmasTrust";

// Under the shop header: the photo hero and the trust strip. (Page-wide snow and decorations are
// in ChristmasAmbience.)
export default function ChristmasMain({ christmas, leaving = false }) {
  return (
    <div className={`transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <div className="relative z-[1]">
        <ChristmasHero headline={christmas.headline} message={christmas.message} photo={christmas.photo} />
        <ChristmasTrust />
      </div>
    </div>
  );
}
