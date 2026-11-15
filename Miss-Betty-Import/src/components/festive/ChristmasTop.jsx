import ChristmasStrip from "./ChristmasStrip";

// Above the shop header: the red Christmas promo strip.
export default function ChristmasTop({ christmas, leaving = false }) {
  return (
    <div className={`transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <ChristmasStrip text={christmas.strip} />
    </div>
  );
}
