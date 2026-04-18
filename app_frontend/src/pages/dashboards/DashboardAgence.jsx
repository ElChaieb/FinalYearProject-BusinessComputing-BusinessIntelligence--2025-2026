// pages/dashboards/DashboardAgence.jsx
import { useAuth } from "../../context/AuthContext";
import { useDateFilter } from "../../hooks/useDateFilter";
import { DateFilter } from "../../components/DateFilter";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  useAgencyKpis, useAgencyRevenue, useAgencyTeam, useAgencyTargets,
} from "../../hooks/useDashboard";

const fmt = (n) =>
  n >= 1e6 ? `${(n/1e6).toFixed(2)}  TND`
  : n >= 1e3 ? `${(n/1e3).toFixed(0)}  TND`
  : `${n} TND`;

function KpiCard({ label, value, sub, trend }) {
  const up = trend > 0;
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1">{value ?? "—"}</p>
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
      <span className="w-4 h-px bg-indigo-500 inline-block" />
      {children}
    </h2>
  );
}

export default function DashboardAgence() {
  const { user } = useAuth();
  const filter = useDateFilter();

  const { data: kpis,    loading: lk } = useAgencyKpis(filter.dates);
  const { data: revenue, loading: lr } = useAgencyRevenue(filter.dates);
  const { data: team,    loading: lt } = useAgencyTeam(filter.dates);
  const { data: targets, loading: lta } = useAgencyTargets(filter.dates);

  // Build funnel from kpis for the funnel display
  const funnelData = kpis
    ? [
        { stage: "Opportunities", value: kpis.opportunities ?? 0 },
        { stage: "Quotes",        value: kpis.quotes ?? 0 },
        { stage: "Sales",         value: kpis.sales ?? 0 },
      ]
    : [];

  // Top vehicles from team data isn't available via agency hook — use team sales as proxy
  // (vehicle breakdown requires a separate endpoint; show team ranking instead)

  return (
    <div className="min-h-screen bg-[#0f1117] text-white px-8 py-6">

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-widest mb-1">Agency Dashboard</p>
          <h1 className="text-2xl font-bold text-white">{user?.agency_name ?? "My Agency"}</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome, <span className="text-gray-300">{user?.name}</span></p>
        </div>
        <DateFilter filter={filter} />
      </div>

      <div className="space-y-8">

        {/* Agency KPIs */}
        <section>
          <SectionTitle>Agency KPIs</SectionTitle>
          {lk ? (
            <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="bg-white/5 rounded-2xl p-5 animate-pulse h-28" />)}</div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="Revenue"         value={fmt(kpis?.revenue ?? 0)}          sub="this period" />
              <KpiCard label="Sales Closed"    value={kpis?.sales ?? 0}                 sub="confirmed" />
              <KpiCard label="Quotes Created"  value={kpis?.quotes ?? 0}                sub="this period" />
              <KpiCard label="Conversion Rate" value={`${kpis?.conversion_rate ?? 0}%`} sub="opp → sale" />
            </div>
          )}
        </section>

        {/* Revenue + Funnel */}
        <section>
          <SectionTitle>Revenue Trend & Funnel</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-4">Monthly Revenue</p>
              {lr ? <div className="h-56 animate-pulse bg-white/5 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenue ?? []}>
                    <defs>
                      <linearGradient id="agenceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} formatter={(v) => [fmt(v), "Revenue"]} labelStyle={{ color: "#9ca3af" }} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#agenceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-6">Conversion Funnel</p>
              {lk ? <div className="h-40 animate-pulse bg-white/5 rounded-xl" /> : (
                <div className="space-y-4">
                  {funnelData.map((f, i) => {
                    const pct = funnelData[0]?.value > 0 ? Math.round((f.value / funnelData[0].value) * 100) : 0;
                    return (
                      <div key={f.stage}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400">{f.stage}</span>
                          <span className="text-white font-semibold">
                            {f.value} <span className="text-gray-500 font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-6 bg-white/5 rounded-lg overflow-hidden">
                          <div className="h-full rounded-lg" style={{ width: `${pct}%`, background: `hsl(${230 + i * 20}, 70%, 55%)` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {kpis && (
                <div className="mt-5 pt-4 border-t border-white/8 text-xs text-gray-500 flex justify-between">
                  <span>Opp → Sale: <span className="text-emerald-400 font-semibold">{kpis.conversion_rate ?? 0}%</span></span>
                  <span>Target: <span className={`font-semibold ${kpis.target_pct >= 100 ? "text-emerald-400" : "text-yellow-400"}`}>{kpis.target_pct ?? 0}%</span></span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Team ranking */}
        <section>
          <SectionTitle>Team Ranking</SectionTitle>
          <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
            {lt ? <div className="h-40 animate-pulse bg-white/5 m-4 rounded-xl" /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Rank", "Commercial", "Sales", "Quotes", "Conv. Rate", "vs Target"].map((h) => (
                      <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(team ?? []).map((c) => {
                    const pct = c.target > 0 ? Math.round((c.sales / c.target) * 100) : 0;
                    const over = pct >= 100;
                    return (
                      <tr key={c.rank} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-5 py-4">
                          <span className={`text-sm font-bold ${c.rank === 1 ? "text-yellow-400" : c.rank === 2 ? "text-gray-300" : c.rank === 3 ? "text-amber-600" : "text-gray-500"}`}>#{c.rank}</span>
                        </td>
                        <td className="px-5 py-4 font-medium text-white">{c.name}</td>
                        <td className="px-5 py-4 text-white font-semibold">{c.sales}</td>
                        <td className="px-5 py-4 text-gray-400">{c.quotes}</td>
                        <td className="px-5 py-4 text-emerald-400 font-semibold">{c.rate}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden w-20">
                              <div className={`h-full rounded-full ${over ? "bg-emerald-500" : "bg-yellow-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${over ? "text-emerald-400" : "text-yellow-400"}`}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Targets per commercial */}
        <section>
          <SectionTitle>Targets vs Actuals — Per Commercial</SectionTitle>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            {lta ? <div className="h-40 animate-pulse bg-white/5 rounded-xl" /> : (
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
    </div>
  );
}
