// Shared chart primitives — all styled to match the original dark slate palette
// bg-slate-800/900, border-slate-700, text-slate-400/500

import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ── Shared dark tooltip (same look as original RevenueChart tooltip) ──────────
function DarkTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl text-xs">
      <p className="mb-1.5 font-medium text-slate-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey ?? entry.name} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-sm" style={{ background: entry.color || entry.stroke || entry.fill }} />
          <span className="text-slate-300">{entry.dataKey ?? entry.name}</span>
          <span className="ml-auto pl-4 font-medium text-white">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const fmt = (n) => `€${Intl.NumberFormat("fr-FR").format(n)}`;

// ── Multi-line revenue chart (Section 1 level-1) ──────────────────────────────
// Mirrors original RevenueChart style
export function RevenueLineChart({ data, series }) {
  return (
    <div className="mt-8 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
          <XAxis dataKey="date" tickLine={false} axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }} dy={10} />
          <Tooltip content={<DarkTooltip formatter={fmt} />}
            cursor={{ stroke: "#334155", strokeWidth: 1 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key}
              stroke={s.stroke} strokeWidth={2.5} dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: s.stroke }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Agency legend rows (below revenue line chart) ─────────────────────────────
export function AgencyLegend({ agencies, series }) {
  return (
    <ul className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-800 pt-6">
      {agencies.map((a) => {
        const s = series.find((s) => s.key === a.agency);
        return (
          <li key={a.agency} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s?.stroke }} />
              <span className="text-sm font-medium text-white">{a.agency}</span>
            </div>
            <div className="text-right">
              <p className={classNames(
                a.changeType === "positive" ? "text-emerald-400" : "text-red-400",
                "text-sm font-medium"
              )}>{a.change}</p>
              <span className="text-xs font-semibold text-slate-300">{a.totalFmt}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Funnel stacked bar chart (Section 2 level-1) ──────────────────────────────
const FUNNEL_COLORS = { Opportunities: "#3b82f6", Quotes: "#8b5cf6", Sales: "#10b981" };

export function FunnelBarChart({ data }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
          <XAxis dataKey="date" tickLine={false} axisLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }} interval="preserveStartEnd" />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: "currentColor", opacity: 0.04 }} />
          {Object.entries(FUNNEL_COLORS).map(([key, color], i, arr) => (
            <Bar key={key} dataKey={key} stackId="a" fill={color}
              radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Funnel legend summary ─────────────────────────────────────────────────────
export function FunnelLegend({ data }) {
  const keys = ["Opportunities", "Quotes", "Sales"];
  const totals = keys.map((k) => data.reduce((s, d) => s + (d[k] || 0), 0));
  return (
    <ul className="mt-4 divide-y divide-slate-800">
      {keys.map((k, i) => (
        <li key={k} className="flex items-center justify-between py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: FUNNEL_COLORS[k] }} />
            <span className="text-slate-400">{k}</span>
          </div>
          <span className="font-medium text-white tabular-nums">{totals[i]}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Agency comparison clickable bars (level-2 for all sections) ───────────────
export function AgencyComparisonBar({ data, dataKey, color = "#3b82f6", formatter, onBarClick, selectedAgency }) {
  const max = Math.max(...data.map((d) => d[dataKey]));
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.round((item[dataKey] / max) * 100);
        const isSelected = selectedAgency === item.agency;
        return (
          <button key={item.agency} onClick={() => onBarClick && onBarClick(item.agency)}
            className={classNames(
              "w-full text-left group rounded-xl px-4 py-3 transition-all border",
              isSelected
                ? "border-blue-600/50 bg-slate-800"
                : "border-transparent hover:bg-slate-800/60 border-slate-700/0"
            )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                {item.agency}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {formatter ? formatter(item[dataKey]) : item[dataKey]}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: isSelected ? "#60a5fa" : color }} />
            </div>
            {isSelected && (
              <p className="mt-1.5 text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                Click again to collapse · detail below ↓
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Donut chart (Section 3 — vehicle categories) ──────────────────────────────
const DONUT_COLORS = ["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899"];

export function CategoryDonutChart({ data, dataKey = "sales", nameKey = "category" }) {
  const [active, setActive] = useState(null);
  const total = data.reduce((s, d) => s + d[dataKey], 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={88}
              paddingAngle={2} dataKey={dataKey} strokeWidth={0}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}>
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                  opacity={active === null || active === i ? 1 : 0.25} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-sm font-semibold text-white">{total}</span>
        </div>
      </div>
      <ul className="space-y-2.5">
        {data.map((item, i) => (
          <li key={i} className="flex items-center justify-between text-sm cursor-default"
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length],
                  opacity: active === null || active === i ? 1 : 0.3 }} />
              <span className="text-slate-400">{item[nameKey]}</span>
            </div>
            <span className="font-medium text-white tabular-nums">{item[dataKey]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Mini horizontal bars (brands, vehicles, etc.) ─────────────────────────────
export function MiniBarChart({ data, nameKey, valueKey, color = "#8b5cf6" }) {
  const max = Math.max(...data.map((d) => d[valueKey]));
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{item[nameKey]}</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full"
              style={{ width: `${Math.round((item[valueKey] / max) * 100)}%`, background: color }} />
          </div>
          <span className="text-xs font-semibold text-white tabular-nums w-6 text-right">{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

// ── City distribution bars (Section 4 level-1) ────────────────────────────────
export function CityBarChart({ data }) {
  const max = Math.max(...data.map((d) => d.clients));
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.city} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-20 shrink-0">{item.city}</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.round((item.clients / max) * 100)}%` }} />
          </div>
          <div className="flex gap-2 tabular-nums text-xs">
            <span className="text-slate-500">+{item.newClients}</span>
            <span className="font-semibold text-white w-8 text-right">{item.clients}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Revenue area chart (CommercialPanel — revenue vs target) ──────────────────
export function RevenueAreaChart({ data }) {
  return (
    <div className="h-48 -mb-2 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickLine={false} axisLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }} interval="preserveStartEnd" />
          <Tooltip content={<DarkTooltip formatter={fmt} />}
            cursor={{ stroke: "#6b7280", strokeWidth: 1, strokeDasharray: "4 2" }} />
          <Area type="monotone" dataKey="Target" stroke="#f59e0b" strokeWidth={1.5}
            strokeDasharray="4 2" fill="none" dot={false} />
          <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2}
            fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
