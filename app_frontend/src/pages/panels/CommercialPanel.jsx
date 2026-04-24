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
                className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse h-20"
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
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h4 className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-tight">
              Monthly Revenue
            </h4>
            {lr ? (
              <div className="h-48 animate-pulse bg-slate-700/40 rounded-xl mt-2" />
            ) : (
              <RevenueAreaChart data={revenue ?? []} />
            )}
          </div>
        </div>

        {/* Top vehicles */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
              Top Vehicles Sold
            </h4>
            {lv ? (
              <div className="h-48 animate-pulse bg-slate-700/40 rounded-xl" />
            ) : (
              <MiniBarChart
                data={vehicles ?? []}
                nameKey="vehicle"
                valueKey="sales"
                color="#8b5cf6"
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent sales table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
          Recent Sales
        </h4>
        {la ? (
          <div className="h-40 animate-pulse bg-slate-700/40 rounded-xl" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Date", "Vehicle", "Client", "Amount"].map((h) => (
                  <th
                    key={h}
                    className={`pb-2 text-slate-500 font-semibold text-xs uppercase tracking-wider ${h === "Amount" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {(recent ?? []).map((s, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-slate-400">{s.date}</td>
                  <td className="py-2.5 text-slate-200 font-medium">
                    {s.vehicle}
                  </td>
                  <td className="py-2.5 text-slate-400">{s.client}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-400">
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
