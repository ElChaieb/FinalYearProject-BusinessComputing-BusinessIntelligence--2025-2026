// pages/dashboards/DashboardGlobal.jsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDateFilter } from "../../hooks/useDateFilter";
import { DateFilter } from "../../components/DateFilter";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  useGlobalKpis, useGlobalRevenue, useGlobalAgencies,
  useGlobalTopCommercials, useGlobalFunnel, useGlobalVehicles,
  useGlobalChannels, useGlobalTargets,
} from "../../hooks/useDashboard";

const fmt = (n) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(2)} M TND`
  : n >= 1000  ? `${(n / 1000).toFixed(0)} K TND`
  : `${n} TND`;

function KpiCard({ label, value, sub, trend, accent = "#3b82f6" }) {
  const up = trend > 0;
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 backdrop-blur-sm hover:border-white/15 transition-all">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value ?? "—"}
      </p>
      <div className="flex items-center gap-2 mt-2">
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${up ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
            {up ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
      <span className="w-4 h-px bg-blue-600 inline-block" />
      {children}
    </h2>
  );
}

function Skeleton() {
  return <div className="bg-white/5 rounded-2xl p-5 animate-pulse h-32" />;
}

const DEFAULT_TAB = {
  "Directeur Général":    "overview",
  "Directeur Commercial": "commercial",
  "Administrateur BI":    "overview",
};

export default function DashboardGlobal() {
  const { user } = useAuth();
  const filter = useDateFilter();
  const [tab, setTab] = useState(DEFAULT_TAB[user?.role] ?? "overview");

  return (
    <div className="min-h-screen bg-[#0f1117] text-white px-8 py-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {user?.role === "Directeur Commercial" ? "Commercial Performance" : "Global Overview"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome back, <span className="text-gray-300">{user?.name}</span>
          </p>
        </div>
        <DateFilter filter={filter} />
      </div>

      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit mb-8">
        {[
          { id: "overview",   label: "Global Overview" },
          { id: "commercial", label: "Commercial View" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview"
        ? <OverviewTab filter={filter} />
        : <CommercialTab filter={filter} />}
    </div>
  );
}

function OverviewTab({ filter }) {
  const { data: kpis,        loading: lk } = useGlobalKpis(filter.dates);
  const { data: revenue,     loading: lr } = useGlobalRevenue(filter.dates);
  const { data: agencies,    loading: la } = useGlobalAgencies(filter.dates);
  const { data: commercials, loading: lc } = useGlobalTopCommercials(filter.dates, 5);

  return (
    <div className="space-y-8">

      <section>
        <SectionTitle>Global KPIs</SectionTitle>
        {lk ? <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} />)}</div> : (
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Total Revenue"   value={fmt(kpis?.total_revenue ?? 0)}        />
            <KpiCard label="Total Sales"      value={kpis?.total_sales ?? 0}               sub="confirmed" />
            <KpiCard label="Total Quotes"     value={kpis?.total_quotes ?? 0}              sub="created" />
            <KpiCard label="Conversion Rate"  value={`${kpis?.conversion_rate ?? 0}%`}    sub="opp → sale" />
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Revenue Trend vs Target</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          {lr ? <div className="h-64 animate-pulse bg-white/5 rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenue ?? []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }}
                  formatter={(v, name) => [fmt(v), name]}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
                <Line type="monotone" dataKey="target"  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Target" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Agency Comparison</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-4">Revenue by Agency (TND)</p>
            {la ? <div className="h-56 animate-pulse bg-white/5 rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agencies ?? []} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="agency" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} formatter={(v) => [fmt(v), "Revenue"]} labelStyle={{ color: "#9ca3af" }} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {(agencies ?? []).map((_, i) => (
                      <Cell key={i} fill={["#3b82f6","#6366f1","#8b5cf6","#a78bfa","#60a5fa"][i % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-4">Sales vs Quotes by Agency</p>
            {la ? <div className="h-56 animate-pulse bg-white/5 rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agencies ?? []} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="agency" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
                  <Bar dataKey="quotes" fill="#334155" radius={[3, 3, 0, 0]} name="Quotes" />
                  <Bar dataKey="sales"  fill="#3b82f6" radius={[3, 3, 0, 0]} name="Sales"  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Top Commercials Ranking</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          {lc ? <div className="h-40 animate-pulse bg-white/5 m-4 rounded-xl" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {["Rank","Name","Agency","Sales","Revenue","Conv. Rate"].map((h) => (
                    <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(commercials ?? []).map((c) => (
                  <tr key={c.rank} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <span className={`text-sm font-bold ${c.rank === 1 ? "text-yellow-400" : c.rank === 2 ? "text-gray-300" : c.rank === 3 ? "text-amber-600" : "text-gray-500"}`}>#{c.rank}</span>
                    </td>
                    <td className="px-5 py-4 font-medium text-white">{c.name}</td>
                    <td className="px-5 py-4 text-gray-400">{c.agency}</td>
                    <td className="px-5 py-4 text-white font-semibold">{c.sales}</td>
                    <td className="px-5 py-4 text-white">{fmt(c.revenue)}</td>
                    <td className="px-5 py-4"><span className="text-emerald-400 font-semibold">{c.rate}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function CommercialTab({ filter }) {
  const { data: kpis,     loading: lk } = useGlobalKpis(filter.dates);
  const { data: funnel,   loading: lf } = useGlobalFunnel(filter.dates);
  const { data: channels, loading: lch } = useGlobalChannels(filter.dates);
  const { data: vehicles, loading: lv } = useGlobalVehicles(filter.dates);
  const { data: targets,  loading: lt } = useGlobalTargets(filter.dates);

  const FILLS = ["#3b82f6","#6366f1","#8b5cf6","#a78bfa"];

  return (
    <div className="space-y-8">

      <section>
        <SectionTitle>Commercial KPIs</SectionTitle>
        {lk ? <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} />)}</div> : (
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Total Opportunities" value={kpis?.total_opportunities ?? 0} sub="this period" />
            <KpiCard label="Quotes Created"       value={kpis?.total_quotes ?? 0}        sub="this period" />
            <KpiCard label="Sales Closed"         value={kpis?.total_sales ?? 0}         sub="confirmed"  />
            <KpiCard label="Avg Quotes/Sale"      value={kpis?.avg_quotes_per_sale?.toFixed(1) ?? "—"} sub="efficiency" />
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Conversion Funnel</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-6">Opportunity → Quote → Sale</p>
            {lf ? <div className="h-40 animate-pulse bg-white/5 rounded-xl" /> : (
              <div className="space-y-3">
                {(funnel ?? []).map((stage, i) => {
                  const pct = Math.round((stage.value / (funnel[0]?.value || 1)) * 100);
                  return (
                    <div key={stage.name}>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{stage.name}</span>
                        <span className="font-semibold text-white">{stage.value} <span className="text-gray-500">({pct}%)</span></span>
                      </div>
                      <div className="h-8 bg-white/5 rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg transition-all" style={{ width: `${pct}%`, background: FILLS[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-4">Lead Acquisition Channels</p>
            {lch ? <div className="h-56 animate-pulse bg-white/5 rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={channels ?? []} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                    {(channels ?? []).map((_, i) => <Cell key={i} fill={FILLS[i % 4]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} formatter={(v, name) => [`${v}%`, name]} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#9ca3af", fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Vehicle Performance</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-4">Quotes vs Sales by Model (top 10)</p>
          {lv ? <div className="h-60 animate-pulse bg-white/5 rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={vehicles ?? []} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="model" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
                <Bar dataKey="quotes" fill="#1e3a5f" radius={[3, 3, 0, 0]} name="Quotes" />
                <Bar dataKey="sales"  fill="#3b82f6" radius={[3, 3, 0, 0]} name="Sales"  />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Agency Targets vs Actuals (Sales)</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          {lt ? <div className="h-40 animate-pulse bg-white/5 rounded-xl" /> : (
            <div className="space-y-4">
              {(targets ?? []).map((a) => {
                const pct = a.target > 0 ? Math.round((a.actual / a.target) * 100) : 0;
                const over = pct >= 100;
                return (
                  <div key={a.agency}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 font-medium">{a.agency}</span>
                      <span className={over ? "text-emerald-400 font-semibold" : "text-yellow-400 font-semibold"}>
                        {a.actual} / {a.target} ({pct}%)
                      </span>
                    </div>
                    <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${over ? "bg-emerald-500" : "bg-yellow-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
