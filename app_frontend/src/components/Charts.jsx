// Charts.jsx — Power BI light theme
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// Power BI palette
const PBI_BLUE   = "#0078d4";
const PBI_COLORS = [
  "#0078d4", // blue
  "#00b4d8", // cyan
  "#7c3aed", // purple
  "#f59e0b", // amber
  "#e84393", // pink
  "#107c10", // green
  "#d13438", // red
  "#8764b8", // violet
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ── Light tooltip (Power BI card style) ──────────────────────────
function LightTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #d2d0ce",
      borderRadius: 4,
      padding: "10px 14px",
      boxShadow: "0 4px 16px rgba(0,0,0,.12)",
      fontSize: 12,
      minWidth: 140,
    }}>
      <p style={{ marginBottom: 6, fontWeight: 600, color: "#605e5c", fontSize: 11 }}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey ?? entry.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
          <span style={{ color: "#605e5c", flex: 1 }}>{entry.dataKey ?? entry.name}</span>
          <span style={{ fontWeight: 600, color: "#201f1e", marginLeft: 12 }}>
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const fmt = (n) => `${Intl.NumberFormat("fr-FR").format(n)} TND`;

// ── Multi-line revenue chart ──────────────────────────────────────
export function RevenueLineChart({ data, series }) {
  return (
    <div style={{ marginTop: 24, height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#edebe9" strokeWidth={1} />
          <XAxis dataKey="date" tickLine={false} axisLine={false}
            tick={{ fontSize: 11, fill: "#a19f9d" }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#a19f9d" }} width={60}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
          <Tooltip content={<LightTooltip formatter={fmt} />}
            cursor={{ stroke: "#d2d0ce", strokeWidth: 1 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key}
              stroke={s.stroke} strokeWidth={2} dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: s.stroke }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Agency legend rows ────────────────────────────────────────────
export function AgencyLegend({ agencies, series }) {
  return (
    <ul style={{
      marginTop: 20, paddingTop: 20,
      borderTop: "1px solid #edebe9",
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: "12px 24px",
    }}>
      {agencies.map((a) => {
        const s = series.find((s) => s.key === a.agency);
        return (
          <li key={a.agency} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s?.stroke, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#201f1e" }}>{a.agency}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: a.changeType === "positive" ? "#107c10" : "#d13438", margin: 0 }}>{a.change}</p>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#201f1e" }}>{a.totalFmt}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Funnel stacked bar chart ──────────────────────────────────────
const FUNNEL_COLORS = { Opportunities: "#0078d4", Quotes: "#7c3aed", Sales: "#107c10" };

export function FunnelBarChart({ data }) {
  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#edebe9" />
          <XAxis dataKey="date" tickLine={false} axisLine={false}
            tick={{ fontSize: 11, fill: "#a19f9d" }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#a19f9d" }} width={32} />
          <Tooltip content={<LightTooltip />} cursor={{ fill: "#f3f2f1" }} />
          {Object.entries(FUNNEL_COLORS).map(([key, color], i, arr) => (
            <Bar key={key} dataKey={key} stackId="a" fill={color}
              radius={i === arr.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Funnel legend summary ─────────────────────────────────────────
export function FunnelLegend({ data }) {
  const keys = ["Opportunities", "Quotes", "Sales"];
  const totals = keys.map((k) => data.reduce((s, d) => s + (d[k] || 0), 0));
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {keys.map((k, i) => (
        <li key={k} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 0", borderBottom: i < keys.length - 1 ? "1px solid #edebe9" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: FUNNEL_COLORS[k] }} />
            <span style={{ fontSize: 13, color: "#605e5c" }}>{k}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>{totals[i]}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Agency comparison clickable bars ─────────────────────────────
export function AgencyComparisonBar({ data, dataKey, color = PBI_BLUE, formatter, onBarClick, selectedAgency }) {
  const max = Math.max(...data.map((d) => d[dataKey]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((item) => {
        const pct = Math.round((item[dataKey] / max) * 100);
        const isSelected = selectedAgency === item.agency;
        return (
          <button key={item.agency} onClick={() => onBarClick && onBarClick(item.agency)}
            style={{
              width: "100%", textAlign: "left",
              background: isSelected ? "#deecf9" : "#faf9f8",
              border: `1px solid ${isSelected ? "#0078d4" : "#edebe9"}`,
              borderRadius: 4, padding: "10px 14px", cursor: "pointer",
              transition: "all 0.12s",
            }}
            onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = "#f3f2f1"; e.currentTarget.style.borderColor = "#d2d0ce"; }}}
            onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = "#faf9f8"; e.currentTarget.style.borderColor = "#edebe9"; }}}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: isSelected ? "#0078d4" : "#201f1e" }}>{item.agency}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#201f1e" }}>
                {formatter ? formatter(item[dataKey]) : item[dataKey]}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#edebe9", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: isSelected ? PBI_BLUE : color,
                width: `${pct}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
            {isSelected && (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#0078d4", fontWeight: 600 }}>
                Click again to collapse · detail below ↓
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────
export function CategoryDonutChart({ data, dataKey = "sales", nameKey = "category" }) {
  const [active, setActive] = useState(null);
  const total = data.reduce((s, d) => s + d[dataKey], 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
      <div style={{ position: "relative", height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
              paddingAngle={2} dataKey={dataKey} strokeWidth={0}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}>
              {data.map((_, i) => (
                <Cell key={i} fill={PBI_COLORS[i % PBI_COLORS.length]}
                  opacity={active === null || active === i ? 1 : 0.25} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: 11, color: "#a19f9d" }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#201f1e" }}>{total}</span>
        </div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "default" }}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                background: PBI_COLORS[i % PBI_COLORS.length],
                opacity: active === null || active === i ? 1 : 0.3,
              }} />
              <span style={{ fontSize: 12, color: "#605e5c" }}>{item[nameKey]}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#201f1e" }}>{item[dataKey]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Mini horizontal bars ──────────────────────────────────────────
export function MiniBarChart({ data, nameKey, valueKey, color = PBI_BLUE }) {
  const max = Math.max(...data.map((d) => d[valueKey]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#605e5c", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item[nameKey]}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#edebe9", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: color,
              width: `${Math.round((item[valueKey] / max) * 100)}%`,
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#201f1e", width: 24, textAlign: "right" }}>{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

// ── City distribution bars ────────────────────────────────────────
export function CityBarChart({ data }) {
  const max = Math.max(...data.map((d) => d.clients));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((item) => (
        <div key={item.city} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#605e5c", width: 72, flexShrink: 0 }}>{item.city}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#edebe9", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: "#107c10",
              width: `${Math.round((item.clients / max) * 100)}%`,
            }} />
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
            <span style={{ color: "#a19f9d" }}>+{item.newClients}</span>
            <span style={{ fontWeight: 600, color: "#201f1e", width: 28, textAlign: "right" }}>{item.clients}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Revenue area chart ────────────────────────────────────────────
export function RevenueAreaChart({ data }) {
  return (
    <div style={{ height: 200, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PBI_BLUE} stopOpacity={0.15} />
              <stop offset="95%" stopColor={PBI_BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#edebe9" />
          <XAxis dataKey="date" tickLine={false} axisLine={false}
            tick={{ fontSize: 11, fill: "#a19f9d" }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#a19f9d" }} width={60}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
          <Tooltip content={<LightTooltip formatter={fmt} />}
            cursor={{ stroke: "#d2d0ce", strokeWidth: 1, strokeDasharray: "4 2" }} />
          <Area type="monotone" dataKey="Target" stroke="#f59e0b" strokeWidth={1.5}
            strokeDasharray="4 2" fill="none" dot={false} />
          <Area type="monotone" dataKey="Revenue" stroke={PBI_BLUE} strokeWidth={2}
            fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: PBI_BLUE, strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
