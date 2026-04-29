// DashboardLayout.jsx — Power BI light theme
import Sidebar from "./Sidebar";
import { DateRangePicker, DEFAULT_PRESETS } from "./DateRangePicker";
import { useFilter } from "../context/FilterContext";

export default function DashboardLayout({ title, subtitle, children, breadcrumb = null }) {
  const { range, setRange } = useFilter();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f2f1" }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <header style={{
          position: "sticky", top: 0, zIndex: 30,
          height: 56,
          background: "#fff",
          borderBottom: "1px solid #edebe9",
          display: "flex", alignItems: "center",
          padding: "0 24px", gap: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {breadcrumb && breadcrumb.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {breadcrumb.map((crumb, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
                        <path d="M4 2l4 4-4 4" stroke="#605e5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <span style={{
                      fontSize: 13,
                      fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                      color: i === breadcrumb.length - 1 ? "#201f1e" : "#a19f9d",
                    }}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#201f1e", lineHeight: 1.2 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 2 }}>{subtitle}</div>}
              </div>
            )}
          </div>

          {/* Date filter */}
          <div style={{ flexShrink: 0, width: 300 }}>
            <DateRangePicker value={range} onChange={setRange} presets={DEFAULT_PRESETS} />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "24px 24px 48px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
