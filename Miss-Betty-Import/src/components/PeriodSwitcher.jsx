export default function PeriodSwitcher({ periods, selectedId, activeId, onChange, loading }) {
  if (loading || periods.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Period</span>
      <select
        value={selectedId ?? ""}
        onChange={e => onChange(Number(e.target.value))}
        className="text-xs font-semibold border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-[#F2AA25] transition-colors bg-white text-[#1e2d3d]"
      >
        {periods.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{p.id === activeId ? " (Active)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
