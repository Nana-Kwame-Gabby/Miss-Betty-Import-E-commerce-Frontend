// Grid layout, loading skeleton and empty state for the Shop and Home product lists
// (DESIGN.md Layout: 2 / 3 / 4 columns).
export const GRID_CLASS = "grid grid-cols-2 gap-x-2.5 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-6";

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className={GRID_CLASS} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/5] rounded-mbi-card bg-mbi-surface-soft" />
          <div className="mt-3 h-3 w-1/3 rounded-full bg-mbi-surface-soft" />
          <div className="mt-2 h-4 w-4/5 rounded-full bg-mbi-surface-soft" />
          <div className="mt-2 h-4 w-1/3 rounded-full bg-mbi-surface-soft" />
          <div className="mt-3 flex gap-1.5">
            <div className="h-11 flex-1 rounded-lg bg-mbi-surface-soft" />
            <div className="h-11 flex-1 rounded-lg bg-mbi-surface-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NoProductsFound({ onClear }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-mbi-surface-soft text-mbi-slate">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
      </div>
      <p className="mt-4 text-xl font-bold text-mbi-navy">No products found</p>
      <p className="mt-1 text-base text-mbi-slate">Try a different search, category or filter.</p>
      <button
        type="button"
        onClick={onClear}
        className="mbi-press mt-5 h-11 rounded-lg border border-mbi-navy/25 px-5 text-sm font-semibold text-mbi-navy hover:border-mbi-navy"
      >
        Clear search and filters
      </button>
    </div>
  );
}

export function ShowMore({ moreRef, onShowAll }) {
  return (
    <div ref={moreRef} className="flex justify-center pt-10 pb-4">
      <button
        type="button"
        onClick={onShowAll}
        className="mbi-press h-11 rounded-lg border border-mbi-navy/25 px-6 text-sm font-semibold text-mbi-navy hover:border-mbi-navy"
      >
        Show more products
      </button>
    </div>
  );
}
