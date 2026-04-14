// pages/dashboards/DashboardAgence.jsx
// Used by: Responsable d'Agence
//
// Scoped to their agency only. user.agency_id filters all DWH queries.
// Shows agency KPIs + team ranking (their commercials only).
//
// Replace dummy data with api calls to:
//   GET /dashboard/agency/kpis?agency_id={user.agency_id}&from=...&to=...
//   GET /dashboard/agency/team?agency_id={user.agency_id}&from=...&to=...
//   GET /dashboard/agency/revenue?agency_id={user.agency_id}&from=...&to=...
//   GET /dashboard/agency/targets?agency_id={user.agency_id}&from=...&to=...

import { useAuth } from "../../context/AuthContext";
import { useDateFilter } from "../../hooks/useDateFilter";
import { DateFilter } from "../../components/DateFilter";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ── Dummy data ────────────────────────────────────────────────
const REVENUE_DATA = [
  { month: "Jan", revenue: 820000  },
  { month: "Feb", revenue: 650000  },
  { month: "Mar", revenue: 940000  },
  { month: "Apr", revenue: 1100000 },
  { month: "May", revenue: 980000  },
  { month: "Jun", revenue: 1350000 },
];

const TEAM_DATA = [
  { rank: 1, name: "Ahmed Ben Salem",   sales: 18, quotes: 62, rate: "72%", target: 20 },
  { rank: 2, name: "Sana Trabelsi",     sales: 15, quotes: 54, rate: "68%", target: 18 },
  { rank: 3, name: "Karim Louati",      sales: 12, quotes: 48, rate: "61%", target: 18 },
  { rank: 4, name: "Nadia Mansouri",    sales:  8, quotes: 39, rate: "54%", target: 15 },
];

const FUNNEL = [
  { stage: "Opportunities", value: 148, pct: 100 },
  { stage: "Quotes",         value: 87,  pct: 59  },
  { stage: "Sales",          value: 53,  pct: 36  },
];

const VEHICLE_DATA = [
  { model: "GX3",     sales: 14 },
  { model: "Coolray", sales: 11 },
  { model: "Tugella",  sales: 9  },
  { model: "KX7",     sales: 7  },
  { model: "Emgrand", sales: 6  },
];

const fmt = (n) =>
  n >= 1e6 ? `${(n/1e6).toFixed(2)} M TND`
  : n >= 1e3 ? `${(n/1e3).toFixed(0)} K TND`
  : `${n} TND`;

function KpiCard({ label, value, sub, trend }) {
  const up = trend > 0;
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
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

  // When connected to API: user.agency_id will scope all queries
  const agencyName = user?.agency_name ?? "My Agency";

  return (
    <div className="min-h-screen bg-[#0f1117] text-white px-8 py-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-widest mb-1">
            Agency Dashboard
          </p>
          <h1 className="text-2xl font-bold text-white">
            {agencyName}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome, <span className="text-gray-300">{user?.name}</span>
          </p>
        </div>
        <DateFilter filter={filter} />
      </div>

      <div className="space-y-8">

        {/* Agency KPIs */}
        <section>
          <SectionTitle>Agency KPIs</SectionTitle>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Revenue"         value="5.84 M TND" trend={11}  sub="this period" />
            <KpiCard label="Sales Closed"    value="53"         trend={6}   sub="confirmed"   />
            <KpiCard label="Quotes Created"  value="87"         trend={3}   sub="this period" />
            <KpiCard label="Conversion Rate" value="35.8%"      trend={-1}  sub="opp → sale"  />
          </div>
        </section>

        {/* Revenue trend + funnel side by side */}
        <section>
          <SectionTitle>Revenue Trend & Funnel</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-4">Monthly Revenue</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={REVENUE_DATA}>
                  <defs>
                    <linearGradient id="agenceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }}
                    formatter={(v) => [fmt(v), "Revenue"]}
                    labelStyle={{ color: "#9ca3af" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#agenceGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-6">Conversion Funnel</p>
              <div className="space-y-4">
                {FUNNEL.map((f) => (
                  <div key={f.stage}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">{f.stage}</span>
                      <span className="text-white font-semibold">
                        {f.value} <span className="text-gray-500 font-normal">({f.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-6 bg-white/5 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg"
                        style={{ width: `${f.pct}%`, background: `hsl(${230 + f.pct * 0.5}, 70%, ${40 + f.pct * 0.1}%)` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/8 text-xs text-gray-500 flex justify-between">
                <span>Opp → Sale: <span className="text-emerald-400 font-semibold">35.8%</span></span>
                <span>Quote → Sale: <span className="text-emerald-400 font-semibold">60.9%</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* Top vehicles */}
        <section>
          <SectionTitle>Best-Selling Models — This Agency</SectionTitle>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={VEHICLE_DATA} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis type="category" dataKey="model" tick={{ fill: "#d1d5db", fontSize: 12 }} width={70} />
                <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
                <Bar dataKey="sales" radius={[0, 4, 4, 0]} name="Sales">
                  {VEHICLE_DATA.map((_, i) => (
                    <Cell key={i} fill={`hsl(${230 + i * 15}, 70%, ${55 - i * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Team ranking */}
        <section>
          <SectionTitle>Team Ranking</SectionTitle>
          <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {["Rank", "Commercial", "Sales", "Quotes", "Conv. Rate", "vs Target"].map((h) => (
                    <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-5 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TEAM_DATA.map((c) => {
                  const pct = Math.round((c.sales / c.target) * 100);
                  const over = pct >= 100;
                  return (
                    <tr key={c.rank} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-4">
                        <span className={`text-sm font-bold ${c.rank === 1 ? "text-yellow-400" : c.rank === 2 ? "text-gray-300" : c.rank === 3 ? "text-amber-600" : "text-gray-500"}`}>
                          #{c.rank}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-white">{c.name}</td>
                      <td className="px-5 py-4 text-white font-semibold">{c.sales}</td>
                      <td className="px-5 py-4 text-gray-400">{c.quotes}</td>
                      <td className="px-5 py-4 text-emerald-400 font-semibold">{c.rate}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden w-20">
                            <div
                              className={`h-full rounded-full ${over ? "bg-emerald-500" : "bg-yellow-500"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${over ? "text-emerald-400" : "text-yellow-400"}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
