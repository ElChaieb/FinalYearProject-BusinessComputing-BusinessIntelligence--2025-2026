// panels/AgencyPanel.jsx
//
// Used in two contexts:
//   1. Drill-down from Global dashboard (Sections 1–4) — receives agencyName + filter
//   2. AgencyManagerDashboard — full page, receives agencyName from JWT (user.agency_name)
//
// Agency manager can click into any commercial to see their CommercialPanel.
// CommercialPanel data is fetched via /dashboard/agency/commercial/:id/* endpoints
// so the agency manager's JWT is used (scoped + verified server-side).

import { useState } from "react";
import StatCard from "../../components/StatCard";
import StatCard1 from "../../components/StatCard1";
import {
  RevenueAreaChart,
  FunnelLegend,
  MiniBarChart,
} from "../../components/Charts";
import CommercialPanel from "./CommercialPanel";
import {
  useAgencyKpis,
  useAgencyRevenueByMonth,
  useAgencyCommercials,
} from "../../hooks/useDashboard";

const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)} M TND`
    : n >= 1_000
      ? `${Math.round(n / 1_000)} K TND`
      : `${n} TND`;

export default function AgencyPanel({ agencyName, filter, onClose }) {
  const [selectedCommercial, setSelectedCommercial] = useState(null);

  const { data: kpis, loading: lk } = useAgencyKpis(filter, agencyName);
  const { data: revenue, loading: lr } = useAgencyRevenueByMonth(filter, agencyName);
  const { data: commercials, loading: lc } = useAgencyCommercials(filter, agencyName);

  // Build funnel data for FunnelLegend from kpis
  const funnelRows = kpis
    ? [
        {
          Opportunities: kpis.opportunities,
          Quotes: kpis.quotes,
          Sales: kpis.sales,
        },
      ]
    : [];

  const agencyKpis = kpis
    ? [
        { name: "Total Sales", stat: String(kpis.sales), change: undefined },
        { name: "Total Revenue", stat: fmt(kpis.revenue), change: undefined },
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-4 h-px bg-blue-600 inline-block" />
          Agency — {agencyName}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs font-semibold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
          >
            [ Close ]
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {lk
          ? [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse h-20"
              />
            ))
          : agencyKpis.map((kpi) =>
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

      {/* Revenue area + funnel */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
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
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h4 className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-tight">
              Funnel
            </h4>
            {lk ? (
              <div className="h-32 animate-pulse bg-slate-700/40 rounded-xl" />
            ) : (
              <>
                <FunnelLegend data={funnelRows} />
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <ConvRow label="Opp → Quote" value={kpis?.convOQ ?? "—"} />
                  <ConvRow label="Quote → Sale" value={kpis?.convQS ?? "—"} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Commercial performance table */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h4 className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-tight">
          Commercial Performance
          <span className="ml-2 text-blue-500 normal-case font-normal">
            — click to drill down
          </span>
        </h4>
        {lc ? (
          <div className="h-40 animate-pulse bg-slate-700/40 rounded-xl mt-4" />
        ) : (
          <div className="mt-4 space-y-2">
            {(commercials ?? []).map((c) => (
              <CommercialRow
                key={c.id}
                commercial={c}
                maxSales={commercials[0]?.sales ?? 1}
                isSelected={selectedCommercial?.id === c.id}
                onClick={() =>
                  setSelectedCommercial(
                    selectedCommercial?.id === c.id ? null : c,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Commercial drill-down panel */}
      {selectedCommercial && (
        <div className="mt-6 bg-slate-900 border border-blue-600/40 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-px bg-blue-600 inline-block" />
              Commercial — {selectedCommercial.name}
            </h3>
            <button
              onClick={() => setSelectedCommercial(null)}
              className="text-xs font-semibold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
            >
              [ Close ]
            </button>
          </div>
          {/* CommercialPanel uses /agency/commercial/:id/* endpoints */}
          <CommercialPanel
            commercialId={selectedCommercial.id}
            commercialName={selectedCommercial.name}
            filter={filter}
            mode="agency"
          />
        </div>
      )}
    </div>
  );
}

function ConvRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function CommercialRow({ commercial, maxSales, isSelected, onClick }) {
  const pct = Math.round((commercial.sales / (maxSales || 1)) * 100);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
        isSelected
          ? "border-blue-600/50 bg-slate-800"
          : "border-transparent hover:bg-slate-800/50"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {commercial.name}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
              commercial.changeType === "positive"
                ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20"
                : "bg-red-400/10 text-red-400 ring-red-400/20"
            }`}
          >
            {commercial.change}
          </span>
        </div>
        <div className="flex gap-4 text-xs text-slate-400 tabular-nums">
          <span>{commercial.convRate} conv.</span>
          <span className="font-semibold text-white">
            {commercial.revenueFmt}
          </span>
          <span>{commercial.sales} sales</span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isSelected ? "#60a5fa" : "#3b82f6",
          }}
        />
      </div>
      {isSelected && (
        <p className="mt-1 text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
          Detail below ↓
        </p>
      )}
    </button>
  );
}
