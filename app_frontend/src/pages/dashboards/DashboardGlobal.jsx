// pages/dashboards/DashboardGlobal.jsx
// Used by: Directeur Général, Directeur Commercial, Administrateur BI
//
// DG priority: global KPIs → revenue trend → agency comparison → top commercials
// DC priority: conversion funnel → vehicle performance → agency KPIs → targets
//
// Both roles see identical data. The tab switcher lets each default to their priority.
// All data points map to DWH queries — replace dummy data with api calls
// when FastAPI dashboard endpoints are ready.

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDateFilter } from "../../hooks/useDateFilter";
import { DateFilter } from "../../components/DateFilter";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, FunnelChart, Funnel, LabelList, PieChart, Pie, Legend,
} from "recharts";

// ── Dummy data (replace with api calls) ──────────────────────
const REVENUE_DATA = [
  { month: "Jan", revenue: 1240000, target: 1100000 },
  { month: "Feb", revenue: 980000,  target: 1100000 },
  { month: "Mar", revenue: 1450000, target: 1200000 },
  { month: "Apr", revenue: 1320000, target: 1200000 },
  { month: "May", revenue: 1680000, target: 1300000 },
  { month: "Jun", revenue: 2100000, target: 1300000 },
  { month: "Jul", revenue: 1890000, target: 1400000 },
  { month: "Aug", revenue: 1600000, target: 1400000 },
  { month: "Sep", revenue: 2200000, target: 1500000 },
  { month: "Oct", revenue: 1950000, target: 1500000 },
  { month: "Nov", revenue: 2400000, target: 1600000 },
  { month: "Dec", revenue: 2800000, target: 1600000 },
];

const AGENCY_DATA = [
  { agency: "Akouda",   revenue: 4200000, sales: 38, quotes: 142 },
  { agency: "Birkassa", revenue: 3100000, sales: 27, quotes: 98  },
  { agency: "Sfax",     revenue: 5600000, sales: 51, quotes: 189 },
  { agency: "Gabès",    revenue: 2800000, sales: 23, quotes: 87  },
  { agency: "Ben Arous",revenue: 3900000, sales: 34, quotes: 121 },
];

const TOP_COMMERCIALS = [
  { rank: 1, name: "Ahmed Ben Salem",   agency: "Sfax",     sales: 18, revenue: 2100000, rate: "72%" },
  { rank: 2, name: "Sana Trabelsi",     agency: "Akouda",   sales: 15, revenue: 1750000, rate: "68%" },
  { rank: 3, name: "Karim Louati",      agency: "Ben Arous",sales: 14, revenue: 1640000, rate: "65%" },
  { rank: 4, name: "Nadia Mansouri",    agency: "Sfax",     sales: 12, revenue: 1400000, rate: "61%" },
  { rank: 5, name: "Youssef Ghazouani", agency: "Birkassa", sales: 11, revenue: 1280000, rate: "58%" },
];

const FUNNEL_DATA = [
  { name: "Opportunities", value: 624, fill: "#3b82f6" },
  { name: "Quotes",        value: 412, fill: "#6366f1" },
  { name: "Sales",         value: 173, fill: "#8b5cf6" },
];

const VEHICLE_DATA = [
  { model: "GX3",     quotes: 89, sales: 34 },
  { model: "Tugella",  quotes: 76, sales: 28 },
  { model: "Coolray",  quotes: 68, sales: 25 },
  { model: "KX7",     quotes: 54, sales: 20 },
  { model: "Emgrand", quotes: 43, sales: 16 },
  { model: "Atlas",   quotes: 38, sales: 14 },
];

const CHANNEL_DATA = [
  { name: "Walk-in",    value: 38, fill: "#3b82f6" },
  { name: "Phone",      value: 28, fill: "#6366f1" },
  { name: "Online",     value: 21, fill: "#8b5cf6" },
  { name: "Referral",   value: 13, fill: "#a78bfa" },
];

const TARGETS_DATA = [
  { agency: "Akouda",   actual: 38, target: 40 },
  { agency: "Birkassa", actual: 27, target: 30 },
  { agency: "Sfax",     actual: 51, target: 45 },
  { agency: "Gabès",    actual: 23, target: 35 },
  { agency: "Ben Arous",actual: 34, target: 35 },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(2)} M TND`
    : n >= 1000
    ? `${(n / 1000).toFixed(0)} K TND`
    : `${n} TND`;

function KpiCard({ label, value, sub, trend, accent = "#3b82f6" }) {
  const up = trend > 0;
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 backdrop-blur-sm hover:border-white/15 transition-all">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
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

// ── Tabs ─────────────────────────────────────────────────────
const TABS = [
  { id: "overview",    label: "Overview",    roles: ["Directeur Général", "Administrateur BI"] },
  { id: "commercial",  label: "Commercial",  roles: ["Directeur Commercial"] },
];

const DEFAULT_TAB = {
  "Directeur Général":    "overview",
  "Directeur Commercial": "commercial",
  "Administrateur BI":    "overview",
};

// ── Main component ────────────────────────────────────────────
export default function DashboardGlobal() {
  const { user } = useAuth();
  const filter = useDateFilter();
  const [tab, setTab] = useState(DEFAULT_TAB[user?.role] ?? "overview");

  return (
    <div className="min-h-screen bg-[#0f1117] text-white px-8 py-6">

      {/* Header */}
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

      {/* Tab switcher — both roles can switch between views */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit mb-8">
        {[
          { id: "overview",   label: "Global Overview" },
          { id: "commercial", label: "Commercial View" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewTab /> : <CommercialTab />}
    </div>
  );
}

// ── Overview tab (DG priority) ────────────────────────────────
function OverviewTab() {
  return (
    <div className="space-y-8">

      {/* Global KPIs */}
      <section>
        <SectionTitle>Global KPIs</SectionTitle>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Revenue"     value="18.6 M TND" trend={12}  sub="vs last year" />
          <KpiCard label="Total Sales"        value="173"        trend={8}   sub="confirmed" />
          <KpiCard label="Total Quotes"       value="412"        trend={5}   sub="created" />
          <KpiCard label="Conversion Rate"    value="27.7%"      trend={-2}  sub="opp → sale" />
        </div>
      </section>

      {/* Revenue trend */}
      <section>
        <SectionTitle>Revenue Trend vs Target</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={REVENUE_DATA}>
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
        </div>
      </section>

      {/* Agency comparison */}
      <section>
        <SectionTitle>Agency Comparison</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-4">Revenue by Agency (TND)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={AGENCY_DATA} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="agency" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }}
                  formatter={(v) => [fmt(v), "Revenue"]}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {AGENCY_DATA.map((_, i) => (
                    <Cell key={i} fill={["#3b82f6","#6366f1","#8b5cf6","#a78bfa","#60a5fa"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-4">Sales vs Quotes by Agency</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={AGENCY_DATA} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="agency" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
                <Bar dataKey="quotes" fill="#334155" radius={[3, 3, 0, 0]} name="Quotes" />
                <Bar dataKey="sales"  fill="#3b82f6" radius={[3, 3, 0, 0]} name="Sales"  />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top commercials */}
      <section>
        <SectionTitle>Top Commercials Ranking</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {["Rank","Name","Agency","Sales","Revenue","Conv. Rate"].map((h) => (
                  <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wide px-5 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_COMMERCIALS.map((c) => (
                <tr key={c.rank} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4">
                    <span className={`text-sm font-bold ${c.rank === 1 ? "text-yellow-400" : c.rank === 2 ? "text-gray-300" : c.rank === 3 ? "text-amber-600" : "text-gray-500"}`}>
                      #{c.rank}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium text-white">{c.name}</td>
                  <td className="px-5 py-4 text-gray-400">{c.agency}</td>
                  <td className="px-5 py-4 text-white font-semibold">{c.sales}</td>
                  <td className="px-5 py-4 text-white">{fmt(c.revenue)}</td>
                  <td className="px-5 py-4">
                    <span className="text-emerald-400 font-semibold">{c.rate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

// ── Commercial tab (DC priority) ──────────────────────────────
function CommercialTab() {
  return (
    <div className="space-y-8">

      {/* Commercial KPIs */}
      <section>
        <SectionTitle>Commercial KPIs</SectionTitle>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Opportunities" value="624"   trend={15}  sub="this period" />
          <KpiCard label="Quotes Created"       value="412"   trend={8}   sub="this period" />
          <KpiCard label="Sales Closed"         value="173"   trend={8}   sub="confirmed"  />
          <KpiCard label="Avg Quotes/Sale"      value="2.4"   trend={-5}  sub="efficiency" />
        </div>
      </section>

      {/* Conversion funnel */}
      <section>
        <SectionTitle>Conversion Funnel</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-6">Opportunity → Quote → Sale</p>
            <div className="space-y-3">
              {FUNNEL_DATA.map((stage, i) => {
                const pct = Math.round((stage.value / FUNNEL_DATA[0].value) * 100);
                return (
                  <div key={stage.name}>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{stage.name}</span>
                      <span className="font-semibold text-white">{stage.value} <span className="text-gray-500">({pct}%)</span></span>
                    </div>
                    <div className="h-8 bg-white/5 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all"
                        style={{ width: `${pct}%`, background: stage.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-white/8 flex justify-between text-xs text-gray-500">
              <span>Opp → Sale: <span className="text-emerald-400 font-semibold">27.7%</span></span>
              <span>Quote → Sale: <span className="text-emerald-400 font-semibold">42.0%</span></span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-4">Lead Acquisition Channels</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={CHANNEL_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                  {CHANNEL_DATA.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }}
                  formatter={(v, name) => [`${v}%`, name]}
                />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ color: "#9ca3af", fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Vehicle performance */}
      <section>
        <SectionTitle>Vehicle Performance</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <p className="text-xs text-gray-500 mb-4">Quotes vs Sales by Model (top 6)</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={VEHICLE_DATA} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="model" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1c1f2e", border: "1px solid #ffffff15", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} />
              <Bar dataKey="quotes" fill="#1e3a5f" radius={[3, 3, 0, 0]} name="Quotes" />
              <Bar dataKey="sales"  fill="#3b82f6" radius={[3, 3, 0, 0]} name="Sales"  />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Targets vs actuals */}
      <section>
        <SectionTitle>Agency Targets vs Actuals (Sales)</SectionTitle>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <div className="space-y-4">
            {TARGETS_DATA.map((a) => {
              const pct = Math.round((a.actual / a.target) * 100);
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
                    <div
                      className={`h-full rounded-full transition-all ${over ? "bg-emerald-500" : "bg-yellow-500"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
