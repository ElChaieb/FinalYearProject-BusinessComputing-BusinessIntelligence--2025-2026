// panels/CommercialPanel.jsx
//
// mode="agency"  → data from /dashboard/agency/commercial/:id/*  (agency manager drill-down)
// mode="me"      → data from /dashboard/me/*                     (commercial's own dashboard)
//
// No target line (fact_targets removed from DWH v4).

import StatCard from "../../components/StatCard";
import StatCard1 from "../../components/StatCard1";
import { RevenueAreaChart, MiniBarChart } from "../../components/Charts";
import {
  // Agency-scoped (manager viewing a commercial)
  useAgencyCommercialKpis,
  useAgencyCommercialRevenue,
  useAgencyCommercialVehicles,
  useAgencyCommercialRecentSales,
  // Self-scoped (commercial viewing own data)
  useMeKpis,
  useMeRevenueByMonth,
  useMeTopVehicles,
  useMeRecentSales,
} from "../../hooks/useDashboard";

const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)} M TND`
    : n >= 1_000
      ? `${Math.round(n / 1_000)} K TND`
      : `${n} TND`;

export default function CommercialPanel({
  commercialId,
  commercialName,
  filter,
  mode = "me",
}) {
  const isAgencyMode = mode === "agency";

  // Hooks — only one set will actually fire (the other gets null path → skipped)
  const agKpis = useAgencyCommercialKpis(
    isAgencyMode ? commercialId : null,
    filter,
  );
  const agRevenue = useAgencyCommercialRevenue(
    isAgencyMode ? commercialId : null,
    filter,
  );
  const agVehicles = useAgencyCommercialVehicles(
    isAgencyMode ? commercialId : null,
    filter,
  );
  const agRecent = useAgencyCommercialRecentSales(
    isAgencyMode ? commercialId : null,
    filter,
  );

  const meKpis = useMeKpis(!isAgencyMode ? filter : null);
  const meRevenue = useMeRevenueByMonth(!isAgencyMode ? filter : null);
  const meVehicles = useMeTopVehicles(!isAgencyMode ? filter : null);
  const meRecent = useMeRecentSales(!isAgencyMode ? filter : null);

  const { data: kpis, loading: lk } = isAgencyMode ? agKpis : meKpis;
  const { data: revenue, loading: lr } = isAgencyMode ? agRevenue : meRevenue;
  const { data: vehicles, loading: lv } = isAgencyMode
    ? agVehicles
    : meVehicles;
  const { data: recent, loading: la } = isAgencyMode ? agRecent : meRecent;

  const kpiCards = kpis
    ? [
        { name: "Total Sales", stat: String(kpis.sales), change: undefined },
        {
          name: "Opportunities",
          stat: String(kpis.opportunities),
          change: undefined,
        },
        {
          name: "Opp → Quote",
          stat: kpis.convOQ,
          previousStat: "opp→quote rate",
        },
        {
          name: "Quote → Sale",
          stat: kpis.convQS,
          previousStat: "quote→sale rate",
        },
      ]
    : [];

  return (
    <div>
      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {lk
          ? [...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{ borderRadius: 4, border: "1px solid #edebe9", background: "#f3f2f1", padding: 16, height: 80 }} className="animate-pulse"
              />
            ))
          : kpiCards.map((kpi) =>
              kpi.previousStat ? (
                <StatCard1
                  key={kpi.name}
                  name={kpi.name}
                  stat={kpi.stat}
                  previousStat={kpi.previousStat}
                />
              ) : (
                <StatCard
                  key={kpi.name}
                  name={kpi.name}
                  stat={kpi.stat}
                  change={kpi.change}
                  changeType={kpi.changeType}
                />
              ),
            )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Revenue area chart */}
        <div className="lg:col-span-2">
          <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              Monthly Revenue
            </h4>
            {lr ? (
              <div style={{ height: 192, borderRadius: 4, background: "#f3f2f1", marginTop: 8 }} className="animate-pulse" />
            ) : (
              <RevenueAreaChart data={revenue ?? []} />
            )}
          </div>
        </div>

        {/* Top vehicles */}
        <div className="lg:col-span-1">
          <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
              Top Vehicles Sold
            </h4>
            {lv ? (
              <div style={{ height: 192, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
            ) : (
              <MiniBarChart
                data={vehicles ?? []}
                nameKey="vehicle"
                valueKey="sales"
                color="#7c3aed"
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent sales table */}
      <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
        <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
          Recent Sales
        </h4>
        {la ? (
          <div style={{ height: 160, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #edebe9" }}>
                {["Date", "Vehicle", "Client", "Amount"].map((h) => (
                  <th
                    key={h}
                    style={{
                      paddingBottom: 10, fontSize: 10, fontWeight: 700,
                      color: "#a19f9d", textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: h === "Amount" ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f2f1" }}>
                  <td style={{ padding: "10px 0", color: "#a19f9d" }}>{s.date}</td>
                  <td style={{ padding: "10px 0", fontWeight: 600, color: "#201f1e" }}>
                    {s.vehicle}
                  </td>
                  <td style={{ padding: "10px 0", color: "#605e5c" }}>{s.client}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, color: "#107c10" }}>
                    {s.amountFmt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
