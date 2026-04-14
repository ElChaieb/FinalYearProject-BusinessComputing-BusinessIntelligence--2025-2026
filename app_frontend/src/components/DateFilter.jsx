// components/DateFilter.jsx
// Reusable date range filter bar used by all dashboards.

import { useDateFilter } from "../hooks/useDateFilter";

export function DateFilter({ filter }) {
  const { preset, setPreset, customFrom, setFrom, customTo, setTo, PRESETS } = filter;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
        Period
      </span>
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p.value
                ? "bg-blue-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <span className="text-gray-600 text-xs">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setTo(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
}
