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
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-4 h-px bg-blue-600 inline-block" />
          Revenue
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
        >
          {isExpanded ? "[ Collapse ]" : "[ Expand ]"}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-5">
        {lk
          ? [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse h-24"
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
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-2 uppercase font-bold tracking-tight">
                  {activeTab === "monthly" ? "Monthly" : "Yearly"} Revenue — All
                  Agencies
                </h4>
                {lr || la ? (
                  <div className="h-64 animate-pulse bg-slate-700/40 rounded-xl" />
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
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-tight">
                  Agency Comparison
                  <span className="ml-2 text-blue-500 normal-case font-normal">
                    — click to drill down
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 mb-4">
                  Total revenue per agency
                </p>
                {la ? (
                  <div className="h-40 animate-pulse bg-slate-700/40 rounded-xl" />
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
                <div className="bg-slate-800 border border-blue-600/40 rounded-2xl p-6 shadow-xl">
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
    <div className="flex items-center gap-3">
      <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700">
        {["monthly", "yearly"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
              activeTab === tab
                ? "bg-slate-700 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
        Showing {activeTab} analytics
      </span>
      <div className="h-px bg-slate-800 flex-1" />
    </div>
  );
}
