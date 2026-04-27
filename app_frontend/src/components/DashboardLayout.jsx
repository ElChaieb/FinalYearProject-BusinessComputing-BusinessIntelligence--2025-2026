// components/DashboardLayout.jsx
// Shared layout shell: sidebar + topbar (with global date filter) + main content area
// Date filter is read from FilterContext — shared across all pages automatically.

import Sidebar from "./Sidebar";
import { DateRangePicker, DEFAULT_PRESETS } from "./DateRangePicker";
import { useFilter } from "../context/FilterContext";

export default function DashboardLayout({
  title,
  subtitle,
  children,
  breadcrumb = null,
}) {
  const { range, setRange } = useFilter();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1a" }}>
      <Sidebar />

      {/* Main area — offset by sidebar width */}
      <div style={{ marginLeft: 220, flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <header style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 60,
          background: "#0d1117",
          borderBottom: "1px solid #1e2530",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: 16,
        }}>
          {/* Title + breadcrumb */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {breadcrumb && breadcrumb.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {breadcrumb.map((crumb, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.3 }}>
                        <path d="M4 2l4 4-4 4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <span style={{
                      fontSize: 13,
                      fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
                      color: i === breadcrumb.length - 1 ? "#f1f5f9" : "#475569",
                    }}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", lineHeight: 1.2 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{subtitle}</div>}
              </div>
            )}
          </div>

          {/* Global date filter — single instance, shared across all pages */}
          <div style={{ flexShrink: 0, width: 300 }}>
            <DateRangePicker
              value={range}
              onChange={setRange}
              presets={DEFAULT_PRESETS}
            />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "28px 28px 48px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
