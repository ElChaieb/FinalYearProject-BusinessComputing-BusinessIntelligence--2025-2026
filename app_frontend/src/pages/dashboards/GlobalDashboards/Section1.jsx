// pages/Dashboards/GlobalDashboards/Section1.jsx — Revenue
// Level-0 : 5 stat cards (total revenue, avg sale, highest sale, lowest sale, sales count)
// Level-1 : multi-agency revenue line chart + agency legend
// Level-2 : agency comparison clickable bars
// Level-3 : AgencyPanel inline

import { useState } from "react";
import StatCard from "../../../components/StatCard";
import StatCard1 from "../../../components/StatCard1";
import {
  RevenueLineChart,
  AgencyLegend,
  AgencyComparisonBar,
} from "../../../components/Charts";
import AgencyPanel from "../../panels/AgencyPanel";
import {
  useGlobalSection1Kpis,
  useGlobalRevenueByMonth,
  useGlobalAgencySummary,
} from "../../../hooks/useDashboard";

const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)} M TND`
    : n >= 1_000
      ? `${Math.round(n / 1_000)} K TND`
      : `${n} TND`;

export default function Section1({
  filter,
  isExpanded,
  setIsExpanded,
  activeTab,
  setActiveTab,
}) {
  const [selectedAgency, setSelectedAgency] = useState(null);

  const { data: kpis, loading: lk } = useGlobalSection1Kpis(filter);
  const { data: revenue, loading: lr } = useGlobalRevenueByMonth(filter);
  const { data: agencies, loading: la } = useGlobalAgencySummary(filter);

  // Build series from returned agency names (dynamic — no hardcoded list)
  const STROKE_PALETTE = [
    "#3b82f6",
    "#06b6d4",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#10b981",
    "#ef4444",
    "#a78bfa",
  ];
  const series = (agencies ?? []).map((a, i) => ({
    key: a.agency,
    stroke: a.stroke ?? STROKE_PALETTE[i % STROKE_PALETTE.length],
  }));

  // Build section1_data cards from API response
  const section1_data = kpis
    ? [
        {
          name: "Total Revenue",
          stat: fmt(kpis.total_revenue),
          change: undefined,
          changeType: undefined,
        },
        {
          name: "Average Sale Value",
          stat: fmt(kpis.avg_sale_value),
          change: undefined,
          changeType: undefined,
        },
        {
          name: "Highest Sale Value",
          stat: fmt(kpis.highest_sale_value),
          previousStat: "period high",
        },
        {
          name: "Lowest Sale Value",
          stat: fmt(kpis.lowest_sale_value),
          previousStat: "period low",
        },
        {
          name: "Sales Count",
          stat: String(kpis.sales_count),
          change: undefined,
          changeType: undefined,
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
          Revenue
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ fontSize: 12, fontWeight: 600, color: "#0078d4", background: "none", border: "none", cursor: "pointer" }}
        >
          {isExpanded ? "[ Collapse ]" : "[ Expand ]"}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-5">
        {lk
          ? [...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{ borderRadius: 4, border: "1px solid #edebe9", background: "#f3f2f1", padding: 16, height: 96 }} className="animate-pulse"
              />
            ))
          : section1_data.map((item) =>
              item.previousStat ? (
                <StatCard1
                  key={item.name}
                  name={item.name}
                  stat={item.stat}
                  previousStat={item.previousStat}
                />
              ) : (
                <StatCard
                  key={item.name}
                  name={item.name}
                  stat={item.stat}
                  change={item.change}
                  changeType={item.changeType}
                />
              ),
            )}

        {isExpanded && (
          <>
            <div className="lg:col-span-5 pt-2">
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Level-1 — Revenue line chart */}
            <div className="lg:col-span-5">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {activeTab === "monthly" ? "Monthly" : "Yearly"} Revenue — All
                  Agencies
                </h4>
                {lr || la ? (
                  <div style={{ height: 240, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <>
                    <RevenueLineChart data={revenue ?? []} series={series} />
                    <AgencyLegend agencies={agencies ?? []} series={series} />
                  </>
                )}
              </div>
            </div>

            {/* Level-2 — Agency comparison */}
            <div className="lg:col-span-5">
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Agency Comparison
                  <span className="ml-2 text-blue-500 normal-case font-normal">
                    — click to drill down
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 mb-4">
                  Total revenue per agency
                </p>
                {la ? (
                  <div style={{ height: 160, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <AgencyComparisonBar
                    data={agencies ?? []}
                    dataKey="total"
                    color="#3b82f6"
                    formatter={fmt}
                    onBarClick={handleAgencyClick}
                    selectedAgency={selectedAgency}
                  />
                )}
              </div>
            </div>

            {/* Level-3 — Agency detail panel */}
            {selectedAgency && (
              <div className="lg:col-span-5">
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

export function TabBar({ activeTab, setActiveTab }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", background: "#f3f2f1", padding: 3, borderRadius: 4, border: "1px solid #edebe9" }}>
        {["monthly", "yearly"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 14px", fontSize: 11, fontWeight: 700,
              borderRadius: 3, border: "none", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.04em",
              background: activeTab === tab ? "#fff" : "transparent",
              color: activeTab === tab ? "#0078d4" : "#a19f9d",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,.1)" : "none",
              transition: "all 0.1s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#a19f9d", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Showing {activeTab} analytics
      </span>
      <div style={{ height: 1, flex: 1, background: "#edebe9" }} />
    </div>
  );
}
