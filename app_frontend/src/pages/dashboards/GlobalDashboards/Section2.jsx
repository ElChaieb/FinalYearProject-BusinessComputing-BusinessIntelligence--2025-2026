// pages/Dashboards/GlobalDashboards/Section2.jsx — Conversion Funnel
// Level-0 : 3 stat cards (total opps, quotes, sales)
// Level-1 : funnel stacked bar (col-span-2) + funnel totals + conv rates (col-span-1)
// Level-2 : per-agency funnel comparison bars (switchable metric)
// Level-3 : AgencyPanel inline

import { useState } from "react";
import StatCard from "../../../components/StatCard";
import {
  FunnelBarChart,
  FunnelLegend,
  AgencyComparisonBar,
} from "../../../components/Charts";
import AgencyPanel from "../../panels/AgencyPanel";
import { TabBar } from "./Section1";
import {
  useGlobalSection2Kpis,
  useGlobalFunnelByMonth,
  useGlobalAgencyFunnel,
} from "../../../hooks/useDashboard";

const METRIC_OPTIONS = [
  { key: "opportunities", label: "Opportunities", color: "#3b82f6" },
  { key: "quotes", label: "Quotes", color: "#8b5cf6" },
  { key: "sales", label: "Sales", color: "#10b981" },
];

export default function Section2({
  filter,
  isExpanded,
  setIsExpanded,
  activeTab,
  setActiveTab,
}) {
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [funnelMetric, setFunnelMetric] = useState("opportunities");

  const { data: kpis, loading: lk } = useGlobalSection2Kpis(filter);
  const { data: funnelData, loading: lf } = useGlobalFunnelByMonth(filter);
  const { data: agencyFunnel, loading: laf } = useGlobalAgencyFunnel(filter);

  const activeMetric = METRIC_OPTIONS.find((m) => m.key === funnelMetric);

  // Overall conv rates from totals
  const totalOppos = (funnelData ?? []).reduce(
    (s, r) => s + r.Opportunities,
    0,
  );
  const totalQuotes = (funnelData ?? []).reduce((s, r) => s + r.Quotes, 0);
  const totalSales = (funnelData ?? []).reduce((s, r) => s + r.Sales, 0);
  const convOQ = totalOppos
    ? `${((totalQuotes / totalOppos) * 100).toFixed(1)}%`
    : "0%";
  const convQS = totalQuotes
    ? `${((totalSales / totalQuotes) * 100).toFixed(1)}%`
    : "0%";

  const section2_data = kpis
    ? [
        {
          name: "Total Opportunities",
          stat: String(kpis.total_opportunities),
          change: undefined,
        },
        {
          name: "Total Quotes",
          stat: String(kpis.total_quotes),
          change: undefined,
        },
        {
          name: "Total Sales",
          stat: String(kpis.total_sales),
          change: undefined,
        },
      ]
    : [];

  const handleAgencyClick = (agency) =>
    setSelectedAgency((prev) => (prev === agency ? null : agency));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="w-4 h-px bg-blue-600 inline-block" />
          Conversion Rates
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ fontSize: 12, fontWeight: 600, color: "#0078d4", background: "none", border: "none", cursor: "pointer" }}
        >
          {isExpanded ? "[ Collapse ]" : "[ Expand ]"}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        {lk
          ? [...Array(3)].map((_, i) => (
              <div
                key={i}
                style={{ borderRadius: 4, border: "1px solid #edebe9", background: "#f3f2f1", padding: 16, height: 96 }} className="animate-pulse"
              />
            ))
          : section2_data.map((item) => <StatCard key={item.name} {...item} />)}

        {isExpanded && (
          <>
            <div className="lg:col-span-3 pt-2">
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Level-1 */}
            <div className="lg:col-span-2">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                  {activeTab === "monthly" ? "Monthly" : "Yearly"} Funnel Volume
                </h4>
                {lf ? (
                  <div style={{ height: 192, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <FunnelBarChart data={funnelData ?? []} />
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                  Funnel Totals
                </h4>
                {lf ? (
                  <div style={{ height: 128, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <>
                    <FunnelLegend data={funnelData ?? []} />
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #edebe9", display: "flex", flexDirection: "column", gap: 8 }}>
                      <ConvRate label="Opp → Quote" value={convOQ} color="#0078d4" />
                      <ConvRate label="Quote → Sale" value={convQS} color="#7c3aed" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Level-2 */}
            <div className="lg:col-span-3">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    Agency Comparison
                    <span style={{ marginLeft: 8, color: "#0078d4", fontWeight: 400, textTransform: "none", fontSize: 12 }}>
                      — click to drill down
                    </span>
                  </h4>
                  <div style={{ display: "flex", background: "#f3f2f1", padding: 3, borderRadius: 4, border: "1px solid #edebe9", gap: 2 }}>
                    {METRIC_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setFunnelMetric(m.key)}
                        style={{
                          padding: "4px 12px", fontSize: 11, fontWeight: 700,
                          borderRadius: 3, border: "none", cursor: "pointer",
                          textTransform: "uppercase",
                          background: funnelMetric === m.key ? "#fff" : "transparent",
                          color: funnelMetric === m.key ? "#0078d4" : "#a19f9d",
                          boxShadow: funnelMetric === m.key ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {laf ? (
                  <div style={{ height: 160, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <AgencyComparisonBar
                    data={agencyFunnel ?? []}
                    dataKey={funnelMetric}
                    color={activeMetric.color}
                    onBarClick={handleAgencyClick}
                    selectedAgency={selectedAgency}
                  />
                )}

                {!laf && (agencyFunnel ?? []).length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #edebe9", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 8 }}>
                    {(agencyFunnel ?? []).map((a) => (
                      <button
                        key={a.agency}
                        onClick={() => handleAgencyClick(a.agency)}
                        style={{
                          textAlign: "left", borderRadius: 4, padding: "10px 12px",
                          border: `1px solid ${selectedAgency === a.agency ? "#0078d4" : "#edebe9"}`,
                          background: selectedAgency === a.agency ? "#deecf9" : "#faf9f8",
                          cursor: "pointer", transition: "all 0.1s",
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#201f1e", margin: "0 0 4px" }}>{a.agency}</p>
                        <p style={{ fontSize: 11, color: "#605e5c", margin: "0 0 2px" }}>
                          O→Q: <span style={{ fontWeight: 600, color: "#0078d4" }}>{a.convOQ}</span>
                        </p>
                        <p style={{ fontSize: 11, color: "#605e5c", margin: 0 }}>
                          Q→S: <span style={{ fontWeight: 600, color: "#7c3aed" }}>{a.convQS}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Level-3 */}
            {selectedAgency && (
              <div className="lg:col-span-3">
                <div style={{ background: "#fff", border: "1px solid #0078d4", borderRadius: 4, padding: 24, boxShadow: "0 2px 8px rgba(0,120,212,.12)" }}>
                  <AgencyPanel
                    agencyName={selectedAgency}
                    filter={filter}
                    onClose={() => setSelectedAgency(null)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ConvRate({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#605e5c" }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
