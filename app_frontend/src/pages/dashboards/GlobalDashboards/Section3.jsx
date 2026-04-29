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
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="w-4 h-px bg-blue-600 inline-block" />
          Trends
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
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                  Sales by Vehicle Category
                </h4>
                {lc ? (
                  <div style={{ height: 192, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
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
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                  Top Brands
                </h4>
                {lb ? (
                  <div style={{ height: 192, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
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
              <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Agency Comparison — Units Sold
                  <span className="ml-2 text-blue-500 normal-case font-normal">
                    — click to drill down
                  </span>
                </h4>
                {lav ? (
                  <div style={{ height: 160, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
                ) : (
                  <>
                    <AgencyComparisonBar
                      data={agVeh ?? []}
                      dataKey="totalSales"
                      color="#10b981"
                      onBarClick={handleAgencyClick}
                      selectedAgency={selectedAgency}
                    />
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #edebe9", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 8 }}>
                      {(agVeh ?? []).map((a) => (
                        <button
                          key={a.agency}
                          onClick={() => handleAgencyClick(a.agency)}
                          style={{
                            textAlign: "left", borderRadius: 4, padding: "10px 12px",
                            border: `1px solid ${selectedAgency === a.agency ? "#107c10" : "#edebe9"}`,
                            background: selectedAgency === a.agency ? "#dff6dd" : "#faf9f8",
                            cursor: "pointer", transition: "all 0.1s",
                          }}
                        >
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#201f1e", margin: "0 0 4px" }}>{a.agency}</p>
                          <p style={{ fontSize: 11, color: "#605e5c", margin: "0 0 2px" }}>{a.topCategory}</p>
                          <p style={{ fontSize: 11, color: "#605e5c", margin: 0 }}>{a.topBrand}</p>
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
