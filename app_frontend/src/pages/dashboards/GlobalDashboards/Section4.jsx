// pages/Dashboards/GlobalDashboards/Section4.jsx — Customer Segmentation
// Level-0 : 3 stat cards (highest state, least state, total clients)
// Level-1 : state distribution bars (col-span-2) + top states list (col-span-1)
// Level-2 : agency client comparison (total / new clients toggle)
// Level-3 : AgencyPanel inline
// Note: "clients" = people who actually bought (fact_sales), restricted to 24 Tunisian governorates

import { useState } from "react";
import StatCard from "../../../components/StatCard";
import { CityBarChart, AgencyComparisonBar } from "../../../components/Charts";
import AgencyPanel from "../../panels/AgencyPanel";
import { TabBar } from "./Section1";
import {
  useGlobalSection4Kpis,
  useGlobalClientsByState,
  useGlobalAgencyClients,
} from "../../../hooks/useDashboard";

const METRIC_OPTIONS = [
  { key: "totalClients", label: "Total" },
  { key: "newClients", label: "New" },
];

export default function Section4({
  filter,
  isExpanded,
  setIsExpanded,
  activeTab,
  setActiveTab,
}) {
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [clientMetric, setClientMetric] = useState("totalClients");

  const { data: kpis, loading: lk } = useGlobalSection4Kpis(filter);
  const { data: states, loading: ls } = useGlobalClientsByState(filter);
  const { data: agClients, loading: lac } = useGlobalAgencyClients(filter);

  const section4_data = kpis
    ? [
        {
          name: "Highest Client Base",
          stat: kpis.highest_state
            ? `${kpis.highest_state} : ${kpis.highest_count}`
            : "—",
        },
        {
          name: "Least Client Base",
          stat: kpis.lowest_state
            ? `${kpis.lowest_state} : ${kpis.lowest_count}`
            : "—",
        },
        {
          name: "Total Clients",
          stat: String(kpis.total_clients ?? "—"),
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
          Customer Segmentation
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
          : section4_data.map((item) => (
              <StatCard key={item.name} name={item.name} stat={item.stat} />
            ))}

        {isExpanded && (
          <>
            <div className="lg:col-span-3 pt-2">
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Level-1 — State distribution */}
            <div className="lg:col-span-2">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Clients by Governorate
                </h4>
                <p style={{ fontSize: 11, color: "#605e5c", marginBottom: 16 }}>
                  Bar = total clients · small number = new this period
                </p>
                {ls ? (
                  <div style={{ height: 240, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <CityBarChart data={states ?? []} />
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                  Top Governorates
                </h4>
                {ls ? (
                  <div style={{ height: 192, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {(states ?? []).slice(0, 5).map((c, i) => (
                      <li
                        key={c.city}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #edebe9" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#a19f9d", width: 16 }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: 13, color: "#201f1e" }}>{c.city}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                          <span style={{ color: "#107c10", fontWeight: 600 }}>+{c.newClients}</span>
                          <span style={{ fontWeight: 700, color: "#201f1e" }}>{c.clients}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Level-2 — Agency client comparison */}
            <div className="lg:col-span-3">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    Agency Comparison — Clients
                    <span style={{ marginLeft: 8, color: "#0078d4", fontWeight: 400, textTransform: "none", fontSize: 12 }}>
                      — click to drill down
                    </span>
                  </h4>
                  <div style={{ display: "flex", background: "#f3f2f1", padding: 3, borderRadius: 4, border: "1px solid #edebe9", gap: 2 }}>
                    {METRIC_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setClientMetric(m.key)}
                        style={{
                          padding: "4px 12px", fontSize: 11, fontWeight: 700,
                          borderRadius: 3, border: "none", cursor: "pointer",
                          textTransform: "uppercase",
                          background: clientMetric === m.key ? "#fff" : "transparent",
                          color: clientMetric === m.key ? "#0078d4" : "#a19f9d",
                          boxShadow: clientMetric === m.key ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {lac ? (
                  <div style={{ height: 160, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <>
                    <AgencyComparisonBar
                      data={agClients ?? []}
                      dataKey={clientMetric}
                      color="#f59e0b"
                      onBarClick={handleAgencyClick}
                      selectedAgency={selectedAgency}
                    />
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #edebe9", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 8 }}>
                      {(agClients ?? []).map((a) => (
                        <button
                          key={a.agency}
                          onClick={() => handleAgencyClick(a.agency)}
                          style={{
                            textAlign: "left", borderRadius: 4, padding: "10px 12px",
                            border: `1px solid ${selectedAgency === a.agency ? "#c19c00" : "#edebe9"}`,
                            background: selectedAgency === a.agency ? "#fff4ce" : "#faf9f8",
                            cursor: "pointer", transition: "all 0.1s",
                          }}
                        >
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#201f1e", margin: "0 0 4px" }}>{a.agency}</p>
                          <p style={{ fontSize: 11, color: "#605e5c", margin: "0 0 2px" }}>
                            Repeat: <span style={{ fontWeight: 600, color: "#c19c00" }}>{a.repeatRate}</span>
                          </p>
                          <p style={{ fontSize: 11, color: "#605e5c", margin: 0 }}>+{a.newClients} new</p>
                        </button>
                      ))}
                    </div>
                  </>
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
