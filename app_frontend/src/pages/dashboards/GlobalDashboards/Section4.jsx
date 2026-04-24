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
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-4 h-px bg-blue-600 inline-block" />
          Customer Segmentation
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
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-tight">
                  Clients by Governorate
                </h4>
                <p className="text-[11px] text-slate-600 mb-4">
                  Bar = total clients · small number = new this period
                </p>
                {ls ? (
                  <div className="h-64 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <CityBarChart data={states ?? []} />
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
                  Top Governorates
                </h4>
                {ls ? (
                  <div className="h-48 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <ul className="divide-y divide-slate-700/60">
                    {(states ?? []).slice(0, 5).map((c, i) => (
                      <li
                        key={c.city}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-600 w-4">
                            {i + 1}
                          </span>
                          <span className="text-slate-300">{c.city}</span>
                        </div>
                        <div className="flex gap-3 tabular-nums text-xs">
                          <span className="text-emerald-500">
                            +{c.newClients}
                          </span>
                          <span className="font-medium text-white">
                            {c.clients}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Level-2 — Agency client comparison */}
            <div className="lg:col-span-3">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs text-slate-500 uppercase font-bold tracking-tight">
                    Agency Comparison — Clients
                    <span className="ml-2 text-blue-500 normal-case font-normal">
                      — click to drill down
                    </span>
                  </h4>
                  <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
                    {METRIC_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setClientMetric(m.key)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                          clientMetric === m.key
                            ? "bg-slate-700 text-white"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {lac ? (
                  <div className="h-40 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <>
                    <AgencyComparisonBar
                      data={agClients ?? []}
                      dataKey={clientMetric}
                      color="#f59e0b"
                      onBarClick={handleAgencyClick}
                      selectedAgency={selectedAgency}
                    />
                    <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-5 gap-3">
                      {(agClients ?? []).map((a) => (
                        <button
                          key={a.agency}
                          onClick={() => handleAgencyClick(a.agency)}
                          className={`text-left rounded-xl p-3 border transition-all ${
                            selectedAgency === a.agency
                              ? "border-amber-600/50 bg-slate-900"
                              : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
                          }`}
                        >
                          <p className="text-xs font-semibold text-white">
                            {a.agency}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Repeat:{" "}
                            <span className="text-amber-400">
                              {a.repeatRate}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            +{a.newClients} new
                          </p>
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
