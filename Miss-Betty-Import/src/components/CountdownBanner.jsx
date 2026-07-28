function StatBox({ value, label }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-red-600 font-extrabold text-xl sm:text-2xl">{String(value).padStart(2, "0")}</span>
      <span className="text-red-600 text-[10px] sm:text-xs font-bold uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

// Plain-text countdown display — no box/card background, just red text on whatever page
// background it's placed on. `stacked` controls whether the title sits above the Day/Min
// pair (mobile) or beside it (desktop); `data` comes from useActiveCountdown().
export default function CountdownDisplay({ data, stacked }) {
  if (!data) return null;
  return (
    <div className={`flex items-center gap-1.5 -mt-1 ${stacked ? "flex-col" : "flex-row"}`}>
      <span className="text-red-600 font-bold text-sm sm:text-base leading-tight text-center w-16 sm:w-20">
        {data.title}
      </span>
      <div className="flex items-center gap-1.5">
        <StatBox value={data.days} label="Days" />
        <StatBox value={data.minutes} label="Min" />
      </div>
    </div>
  );
}
