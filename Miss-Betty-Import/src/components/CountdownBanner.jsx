// Countdown pill (DESIGN.md notice style): the admin's countdown title with the days and
// minutes left, in navy on amber tint. `data` comes from useActiveCountdown(); `stacked` is
// kept for callers but the pill wraps on its own.
export default function CountdownDisplay({ data }) {
  if (!data) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-mbi-amber-tint px-3 py-1.5 text-sm text-mbi-navy" role="timer" aria-live="off">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-mbi-amber-ink">
        <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
      </svg>
      <span className="font-semibold">{data.title}</span>
      <span className="font-bold tabular whitespace-nowrap">
        {data.days}d {data.hours ?? 0}h {String(data.minutes).padStart(2, "0")}m
      </span>
    </div>
  );
}
