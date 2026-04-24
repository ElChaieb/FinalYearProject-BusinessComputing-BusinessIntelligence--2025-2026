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
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-4 h-px bg-blue-600 inline-block" />
          Conversion Rates
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
        >
          {isExpanded ? "[ Collapse ]" : "[ Expand ]"}
        </button>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        {lk
          ? [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse h-24"
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
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
                  {activeTab === "monthly" ? "Monthly" : "Yearly"} Funnel Volume
                </h4>
                {lf ? (
                  <div className="h-48 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <FunnelBarChart data={funnelData ?? []} />
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
                  Funnel Totals
                </h4>
                {lf ? (
                  <div className="h-32 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <>
                    <FunnelLegend data={funnelData ?? []} />
                    <div className="mt-6 pt-4 border-t border-slate-700 space-y-2">
                      <ConvRate
                        label="Opp → Quote"
                        value={convOQ}
                        color="text-blue-400"
                      />
                      <ConvRate
                        label="Quote → Sale"
                        value={convQS}
                        color="text-violet-400"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Level-2 */}
            <div className="lg:col-span-3">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs text-slate-500 uppercase font-bold tracking-tight">
                    Agency Comparison
                    <span className="ml-2 text-blue-500 normal-case font-normal">
                      — click to drill down
                    </span>
                  </h4>
                  <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
                    {METRIC_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setFunnelMetric(m.key)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                          funnelMetric === m.key
                            ? "bg-slate-700 text-white"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {laf ? (
                  <div className="h-40 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <AgencyComparisonBar
                    data={agencyFunnel ?? []}
                    dataKey={funnelMetric}
                    color={activeMetric.color}
                    onBarClick={handleAgencyClick}
                    selectedAgency={selectedAgency}
                  />
                )}

                {/* Per-agency conv rate badges */}
                {!laf && (agencyFunnel ?? []).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-5 gap-3">
                    {(agencyFunnel ?? []).map((a) => (
                      <button
                        key={a.agency}
                        onClick={() => handleAgencyClick(a.agency)}
                        className={`text-left rounded-xl p-3 border transition-all ${
                          selectedAgency === a.agency
                            ? "border-blue-600/50 bg-slate-900"
                            : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
                        }`}
                      >
                        <p className="text-xs font-semibold text-white">
                          {a.agency}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          O→Q: <span className="text-blue-400">{a.convOQ}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Q→S:{" "}
                          <span className="text-violet-400">{a.convQS}</span>
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

function ConvRate({ label, value, color }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
