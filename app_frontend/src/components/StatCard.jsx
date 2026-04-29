// StatCard.jsx — Power BI light theme
export default function StatCard({ name, stat, change, changeType }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #edebe9",
      borderRadius: 4,
      padding: "16px 18px",
      boxShadow: "0 1px 3px rgba(0,0,0,.07)",
      borderTop: "3px solid #0078d4",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {name}
        </span>
        {change && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 2,
            background: changeType === "positive" ? "#dff6dd" : "#fde7e9",
            color: changeType === "positive" ? "#107c10" : "#d13438",
            whiteSpace: "nowrap", flexShrink: 0,
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
