function StatBox({ value, label }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-red-600 font-extrabold text-sm sm:text-base">{String(value).padStart(2, "0")}</span>
      <span className="text-red-600 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

// Plain-text countdown display — no box/card background, just red text on whatever page
// background it's placed on. `stacked` controls whether the title sits above the Day/Min
// pair (mobile) or beside it (desktop); `data` comes from useActiveCountdown().
export default function CountdownDisplay({ data, stacked }) {
  if (!data) return null;
  return (
    <div className={`flex items-center gap-1.5 ${stacked ? "flex-col" : "flex-row"}`}>
      <span className={`text-red-600 font-semibold text-[10px] sm:text-xs truncate ${stacked ? "max-w-[5rem] text-center" : "max-w-[8rem]"}`}>
        {data.title}
      </span>
      <div className="flex items-center gap-2">
        <StatBox value={data.days} label="Days" />
        <StatBox value={data.minutes} label="Min" />
      </div>
    </div>
  );
}
