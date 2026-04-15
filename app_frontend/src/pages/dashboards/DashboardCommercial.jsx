// pages/dashboards/DashboardCommercial.jsx
import { useAuth } from "../../context/AuthContext";
import { useDateFilter } from "../../hooks/useDateFilter";
import { DateFilter } from "../../components/DateFilter";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useMeKpis, useMeQuotes, useMeMonthlyTarget, useMeRecentActivity,
} from "../../hooks/useDashboard";

const STATUS_COLOR = {
  Converted: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  Pending:   { bg: "bg-yellow-500/15",  text: "text-yellow-400"  },
  Lost:      { bg: "bg-red-500/15",     text: "text-red-400"     },
};

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
      <span className="w-4 h-px bg-emerald-500 inline-block" />
      {children}
    </h2>
  );
}

function StatCard({ label, value, sub, color = "#10b981" }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1" style={{ color }}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-gray-500 mt-2">{sub}</p>}
    </div>
  );
}

export default function DashboardCommercial() {
  const { user } = useAuth();
  const filter = useDateFilter();
  const year = new Date().getFullYear();

  const { data: kpis,     loading: lk  } = useMeKpis(filter.dates);
  const { data: monthly,  loading: lm  } = useMeQuotes(filter.dates);
  const { data: ytargets, loading: lyt } = useMeMonthlyTarget(year);
  const { data: activity, loading: la  } = useMeRecentActivity(10);

  const targetPct = kpis?.target_pct ?? 0;
  const sales     = kpis?.sales_this_month ?? 0;
  const target    = kpis?.target_this_month ?? 0;
  const remaining = Math.max(target - sales, 0);

  return (
    <div className="min-h-screen bg-[#0f1117] text-white px-8 py-6">

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-1">Personal Dashboard</p>
          <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{user?.role} · {user?.agency_name ?? "Your Agency"}</p>
        </div>
        <DateFilter filter={filter} />
      </div>

      <div className="space-y-8">

        <section>
          <SectionTitle>Monthly Target</SectionTitle>
          {lk ? <div className="bg-white/5 rounded-2xl p-6 animate-pulse h-32" /> : (
            <div className="bg-gradient-to-br from-emerald-900/30 to-white/5 border border-emerald-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-sm">Sales this period</p>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-5xl font-bold text-white">{sales}</span>
                    <span className="text-gray-500 text-lg mb-1">/ {target}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-bold ${targetPct >= 100 ? "text-emerald-400" : targetPct >= 75 ? "text-yellow-400" : "text-red-400"}`}>
                    {targetPct}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {targetPct >= 100 ? "Target reached!" : `${remaining} more to go`}
                  </p>
                </div>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${targetPct >= 100 ? "bg-emerald-400" : targetPct >= 75 ? "bg-yellow-400" : "bg-red-400"}`}
                  style={{ width: `${Math.min(targetPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{kpis?.quotes_this_month ?? 0} quotes created</span>
                <span>Conversion: <span className="text-emerald-400 font-semibold">{kpis?.conversion_rate ?? 0}%</span></span>
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Your KPIs — Selected Period</SectionTitle>
          {lk ? (
            <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="bg-white/5 rounded-2xl p-5 animate-pulse h-28" />)}</div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Sales"     value={kpis?.sales_this_month ?? 0}                                   color="#10b981" />
              <StatCard label="Total Quotes"    value={kpis?.quotes_this_month ?? 0}                                  color="#6366f1" />
              <StatCard label="Conversion Rate" value={`${kpis?.conversion_rate ?? 0}%`}                             color="#f59e0b" sub="quotes → sales" />
              <StatCard label="Revenue"         value={`${((kpis?.revenue_this_month ?? 0)/1000).toFixed(0)} K TND`} color="#60a5fa" />
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Monthly Performance</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-4">Quotes & Sales per Month</p>
              {lm ? <div className="h-56 animate-pulse bg-white/5 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthly ?? []} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
                    <Bar dataKey="quotes" fill="#1e3a5f" radius={[3, 3, 0, 0]} name="Quotes" />
                    <Bar dataKey="sales"  fill="#10b981" radius={[3, 3, 0, 0]} name="Sales"  />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-4">Sales vs Monthly Target</p>
              {lyt ? <div className="h-56 animate-pulse bg-white/5 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={ytargets ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="agency" tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
                    <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} name="My Sales" />
                    <Line type="monotone" dataKey="target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Target" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>Recent Quotes</SectionTitle>
          <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
            {la ? <div className="h-40 animate-pulse bg-white/5 m-4 rounded-xl" /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Quote ID", "Client", "Vehicle", "Date", "Status"].map((h) => (
                      <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(activity ?? []).map((q) => {
                    const s = STATUS_COLOR[q.status] ?? STATUS_COLOR.Pending;
                    return (
                      <tr key={q.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-400">{q.id}</td>
                        <td className="px-5 py-4 text-white font-medium">{q.client}</td>
                        <td className="px-5 py-4 text-gray-400">{q.model}</td>
                        <td className="px-5 py-4 text-gray-500 text-xs">{q.date}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{q.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
