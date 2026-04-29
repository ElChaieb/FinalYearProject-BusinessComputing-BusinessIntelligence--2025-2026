// StatCard1.jsx — Power BI light theme
export default function StatCard1({ name, stat, previousStat }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #edebe9",
      borderRadius: 4,
      padding: "16px 18px",
      boxShadow: "0 1px 3px rgba(0,0,0,.07)",
      borderTop: "3px solid #7c3aed",
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {name}
      </span>
      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#201f1e", letterSpacing: "-0.02em" }}>{stat}</span>
        <span style={{ fontSize: 12, color: "#a19f9d" }}>from {previousStat}</span>
      </div>
    </div>
  );
}
