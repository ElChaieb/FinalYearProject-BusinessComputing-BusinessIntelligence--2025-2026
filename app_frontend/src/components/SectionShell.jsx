// SectionShell.jsx — Power BI light theme

const SECTION_COLORS = {
  blue:    { accent: "#0078d4", tab: { bg: "#deecf9", color: "#0078d4", border: "#bdd6f0" } },
  violet:  { accent: "#7c3aed", tab: { bg: "#f0eafb", color: "#7c3aed", border: "#d4bfef" } },
  emerald: { accent: "#107c10", tab: { bg: "#dff6dd", color: "#107c10", border: "#9fd89f" } },
  amber:   { accent: "#c19c00", tab: { bg: "#fff4ce", color: "#c19c00", border: "#f0d060" } },
};

export function SectionShell({
  title, icon, color = "blue",
  isExpanded, setIsExpanded,
  activeTab, setActiveTab,
  kpis, level1Content, level2Content, level3Content,
}) {
  const c = SECTION_COLORS[color];
  const tabs = [{ id: "monthly", label: "Monthly" }, { id: "yearly", label: "Yearly" }];

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, color: "#605e5c",
          textTransform: "uppercase", letterSpacing: "0.08em",
          display: "flex", alignItems: "center", gap: 8, margin: 0,
        }}>
          <span style={{ width: 16, height: 3, background: c.accent, borderRadius: 2, display: "inline-block" }} />
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            fontSize: 12, fontWeight: 600, color: c.accent,
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          {isExpanded ? "▲ Collapse" : "▼ Expand"}
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
        {kpis.map((item) => <KpiCard key={item.name} {...item} accentColor={c.accent} />)}
      </div>

      {/* Expanded levels */}
      {isExpanded && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", background: "#f3f2f1",
              borderRadius: 4, border: "1px solid #edebe9", padding: 3,
            }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: "4px 14px", fontSize: 11, fontWeight: 700,
                    borderRadius: 3, border: "none", cursor: "pointer",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    transition: "all 0.1s",
                    background: activeTab === t.id ? "#fff" : "transparent",
                    color: activeTab === t.id ? c.accent : "#a19f9d",
                    boxShadow: activeTab === t.id ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ height: 1, flex: 1, background: "#edebe9" }} />
          </div>

          {level1Content && <LevelBlock label="Detailed Analytics" color={color}>{level1Content}</LevelBlock>}
          {level2Content && <LevelBlock label="Agency Comparison" color={color}>{level2Content}</LevelBlock>}
          {level3Content && <LevelBlock label="Commercial Detail" color={color}>{level3Content}</LevelBlock>}
        </div>
      )}
    </div>
  );
}

function LevelBlock({ label, color, children }) {
  const c = SECTION_COLORS[color];
  return (
    <div style={{
      background: "#fff", border: "1px solid #edebe9",
      borderRadius: 4, overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,.07)",
    }}>
      <div style={{
        padding: "8px 16px", borderBottom: "1px solid #edebe9",
        background: "#faf9f8", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", padding: "2px 8px",
          background: c.tab.bg, color: c.tab.color,
          border: `1px solid ${c.tab.border}`, borderRadius: 2,
        }}>
          {label}
        </span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function KpiCard({ name, stat, change, changeType, accentColor }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #edebe9",
      borderTop: `3px solid ${accentColor}`,
      borderRadius: 4, padding: "14px 16px",
      boxShadow: "0 1px 3px rgba(0,0,0,.06)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.4 }}>
          {name}
        </span>
        {change && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 2, flexShrink: 0,
            background: changeType === "positive" ? "#dff6dd" : "#fde7e9",
            color: changeType === "positive" ? "#107c10" : "#d13438",
          }}>
            {change}
          </span>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700, color: "#201f1e", letterSpacing: "-0.02em" }}>
        {stat}
      </div>
    </div>
  );
}
