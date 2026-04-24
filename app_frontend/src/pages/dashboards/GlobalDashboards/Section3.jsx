// pages/Dashboards/GlobalDashboards/Section3.jsx — Vehicle Trends
// Level-0 : 3 stat cards (most sold, least sold, avg category sales)
// Level-1 : category donut (col-span-2) + top brands mini bars (col-span-1)
// Level-2 : agency comparison + summary badges
// Level-3 : AgencyPanel inline

import { useState } from "react";
import StatCard from "../../../components/StatCard";
import {
  CategoryDonutChart,
  MiniBarChart,
  AgencyComparisonBar,
} from "../../../components/Charts";
import AgencyPanel from "../../panels/AgencyPanel";
import { TabBar } from "./Section1";
import {
  useGlobalSection3Kpis,
  useGlobalCategories,
  useGlobalBrands,
  useGlobalAgencyVehicles,
} from "../../../hooks/useDashboard";

export default function Section3({
  filter,
  isExpanded,
  setIsExpanded,
  activeTab,
  setActiveTab,
}) {
  const [selectedAgency, setSelectedAgency] = useState(null);

  const { data: kpis, loading: lk } = useGlobalSection3Kpis(filter);
  const { data: cats, loading: lc } = useGlobalCategories(filter);
  const { data: brands, loading: lb } = useGlobalBrands(filter);
  const { data: agVeh, loading: lav } = useGlobalAgencyVehicles(filter);

  const section3_data = kpis
    ? [
        {
          name: "Most Sold Category",
          stat: kpis.most_sold_category
            ? `${kpis.most_sold_category} : ${kpis.most_sold_count}`
            : "—",
        },
        {
          name: "Least Sold Category",
          stat: kpis.least_sold_category
            ? `${kpis.least_sold_category} : ${kpis.least_sold_count}`
            : "—",
        },
        {
          name: "Avg Category Sales",
          stat: String(kpis.avg_category_sales ?? "—"),
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
          Trends
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
          : section3_data.map((item) => (
              <StatCard key={item.name} name={item.name} stat={item.stat} />
            ))}

        {isExpanded && (
          <>
            <div className="lg:col-span-3 pt-2">
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* Level-1 */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
                  Sales by Vehicle Category
                </h4>
                {lc ? (
                  <div className="h-48 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <CategoryDonutChart
                    data={cats ?? []}
                    dataKey="sales"
                    nameKey="category"
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
                  Top Brands
                </h4>
                {lb ? (
                  <div className="h-48 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <MiniBarChart
                    data={brands ?? []}
                    nameKey="brand"
                    valueKey="sales"
                    color="#8b5cf6"
                  />
                )}
              </div>
            </div>

            {/* Level-2 */}
            <div className="lg:col-span-3">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-tight">
                  Agency Comparison — Units Sold
                  <span className="ml-2 text-blue-500 normal-case font-normal">
                    — click to drill down
                  </span>
                </h4>
                {lav ? (
                  <div className="h-40 animate-pulse bg-slate-700/40 rounded-xl" />
                ) : (
                  <>
                    <AgencyComparisonBar
                      data={agVeh ?? []}
                      dataKey="totalSales"
                      color="#10b981"
                      onBarClick={handleAgencyClick}
                      selectedAgency={selectedAgency}
                    />
                    <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-5 gap-3">
                      {(agVeh ?? []).map((a) => (
                        <button
                          key={a.agency}
                          onClick={() => handleAgencyClick(a.agency)}
                          className={`text-left rounded-xl p-3 border transition-all ${
                            selectedAgency === a.agency
                              ? "border-emerald-600/50 bg-slate-900"
                              : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
                          }`}
                        >
                          <p className="text-xs font-semibold text-white">
                            {a.agency}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {a.topCategory}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {a.topBrand}
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
