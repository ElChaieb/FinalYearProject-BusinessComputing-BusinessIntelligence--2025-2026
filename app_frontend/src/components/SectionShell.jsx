// Reusable section shell — wraps the expand/collapse + tab bar logic
// so each Section file only needs to care about its content

const SECTION_COLORS = {
  blue:   { accent: "bg-blue-600",   ring: "ring-blue-500/30",  tab: "bg-blue-500/10 text-blue-400 border-blue-500/40" },
  violet: { accent: "bg-violet-600", ring: "ring-violet-500/30",tab: "bg-violet-500/10 text-violet-400 border-violet-500/40" },
  emerald:{ accent: "bg-emerald-600",ring: "ring-emerald-500/30",tab:"bg-emerald-500/10 text-emerald-400 border-emerald-500/40" },
  amber:  { accent: "bg-amber-600",  ring: "ring-amber-500/30", tab: "bg-amber-500/10 text-amber-400 border-amber-500/40" },
};

export function SectionShell({
  title,
  icon,
  color = "blue",
  isExpanded,
  setIsExpanded,
  activeTab,
  setActiveTab,
  kpis,
  level1Content,
  level2Content,
  level3Content,
}) {
  const c = SECTION_COLORS[color];

  const tabs = [
    { id: "monthly", label: "Monthly" },
    { id: "yearly",  label: "Yearly"  },
  ];

  return (
    <div className="space-y-0">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <span className={`w-4 h-px ${c.accent} inline-block`} />
          {icon && <span className="text-base leading-none">{icon}</span>}
          {title}
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-blue-500 hover:text-blue-400 uppercase tracking-tighter transition-colors"
        >
          {isExpanded ? "[ Collapse ]" : "[ Expand ]"}
        </button>
      </div>

      {/* ── Level-0: KPI cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {kpis.map((item) => (
          <KpiCard key={item.name} {...item} />
        ))}
      </div>

      {/* ── Expanded levels ── */}
      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* tab switcher */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                    activeTab === t.id
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          {/* Level-1: detailed charts */}
          {level1Content && (
            <LevelBlock label="Level 1 — Detailed Analytics" color={color}>
              {level1Content}
            </LevelBlock>
          )}

          {/* Level-2: agency comparison (clickable) */}
          {level2Content && (
            <LevelBlock label="Level 2 — Agency Comparison" color={color}>
              {level2Content}
            </LevelBlock>
          )}

          {/* Level-3: commercial panel (rendered when agency is selected) */}
          {level3Content && (
            <LevelBlock label="Level 3 — Commercial Detail" color={color}>
              {level3Content}
            </LevelBlock>
          )}
        </div>
      )}
    </div>
  );
}

function LevelBlock({ label, color, children }) {
  const c = SECTION_COLORS[color];
  return (
    <div className={`rounded-2xl border border-slate-700/60 bg-slate-900/40 ring-1 ${c.ring} overflow-hidden`}>
      <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${c.tab}`}>
          {label}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KpiCard({ name, stat, change, changeType }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <dt className="text-xs font-medium text-slate-400 leading-tight">{name}</dt>
        {change && (
          <span className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
            changeType === "positive"
              ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20"
              : "bg-red-400/10 text-red-400 ring-red-400/20"
          }`}>
            {change}
          </span>
        )}
      </div>
      <dd className="mt-2 text-2xl font-bold text-white tracking-tight">{stat}</dd>
    </div>
  );
}
