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
                style={{ borderRadius: 4, border: "1px solid #edebe9", background: "#f3f2f1", padding: 16, height: 80 }} className="animate-pulse"
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
        <div className="lg:col-span-1">
          <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
              Funnel
            </h4>
            {lk ? (
              <div style={{ height: 128, borderRadius: 4, background: "#f3f2f1" }} className="animate-pulse" />
            ) : (
              <>
                <FunnelLegend data={funnelRows} />
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #edebe9", display: "flex", flexDirection: "column", gap: 8 }}>
                  <ConvRow label="Opp → Quote" value={kpis?.convOQ ?? "—"} />
                  <ConvRow label="Quote → Sale" value={kpis?.convQS ?? "—"} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Commercial performance table */}
      <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
        <h4 style={{ fontSize: 11, fontWeight: 700, color: "#605e5c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Commercial Performance
          <span className="ml-2 text-blue-500 normal-case font-normal">
            — click to drill down
          </span>
        </h4>
        {lc ? (
          <div style={{ height: 160, borderRadius: 4, background: "#f3f2f1", marginTop: 16 }} className="animate-pulse" />
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
        <div style={{ marginTop: 24, background: "#fff", border: "1px solid #0078d4", borderRadius: 4, padding: 24, boxShadow: "0 2px 8px rgba(0,120,212,.12)" }}>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#605e5c" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#201f1e" }}>{value}</span>
    </div>
  );
}

function CommercialRow({ commercial, maxSales, isSelected, onClick }) {
  const pct = Math.round((commercial.sales / (maxSales || 1)) * 100);
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", borderRadius: 4, padding: "10px 14px",
        border: isSelected ? "1px solid #0078d4" : "1px solid #edebe9",
        background: isSelected ? "#deecf9" : "#faf9f8",
        cursor: "pointer", transition: "all 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>
            {commercial.name}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 2,
            background: commercial.changeType === "positive" ? "#dff6dd" : "#fde7e9",
            color: commercial.changeType === "positive" ? "#107c10" : "#d13438",
          }}>
            {commercial.change}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#a19f9d" }}>
          <span>{commercial.convRate} conv.</span>
          <span style={{ fontWeight: 600, color: "#201f1e" }}>
            {commercial.revenueFmt}
          </span>
          <span>{commercial.sales} sales</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#edebe9", overflow: "hidden" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isSelected ? "#0078d4" : "#5ba4d5",
          }}
        />
      </div>
      {isSelected && (
        <p style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: "#0078d4", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Detail below ↓
        </p>
      )}
    </button>
  );
}
