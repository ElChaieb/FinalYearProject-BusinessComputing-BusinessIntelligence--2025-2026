/**
 * CommercialRevenue.jsx — Individual Commercial Dashboard
 *
 * Simplified variant for a single commercial (salesman)
 * Focus on personal KPIs and performance
 *
 * Layout:
 *   • 4 KPI cards (Total Revenue, This Month, Deals Closed, Win Rate)
 *   • Monthly revenue trend chart
 *   • Revenue by category donut
 *   • Recent deals table
 */

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  FilterProvider,
  FilterBar,
  useFilter,
} from "../../components/CommercialFilterContext";
import Layout from "../../components/Layout";

const PBI = {
  colors: [
    "#118DFF",
    "#E66C37",
    "#12239E",
    "#ECC846",
    "#00B5D0",
    "#8764B8",
    "#D13438",
    "#107C10",
  ],
  pageBg: "#F3F2F1",
  border: "#E1DFDD",
  cardBg: "#FFFFFF",
  textPrimary: "#252423",
  textMuted: "#605E5C",
  gridLine: "#E1DFDD",
  font: "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
  green: "#107C10",
  red: "#D13438",
};

const card = {
  background: PBI.cardBg,
  border: `1px solid ${PBI.border}`,
  borderRadius: 4,
  padding: "20px 24px 16px",
  fontFamily: PBI.font,
  boxShadow: "0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)",
};

const THIS_YEAR = 2025;
const LAST_YEAR = 2024;
const COLOR_N = "#118DFF";
const COLOR_NM1 = "#E66C37";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ─── Mock data for individual commercial ─────────────────────────────────────
const MY_REVENUE = {
  total: 324500,
  totalLastYear: 278000,
  thisMonth: 42000,
  thisMonthLastYear: 35000,
  lastMonth: 38500,
};

const MY_DEALS = {
  total: 48,
  totalLastYear: 42,
  thisMonth: 6,
  thisMonthLastYear: 5,
  won: 38,
  lost: 10,
};

const MY_MONTHLY_REVENUE = MONTHS.map((m, i) => ({
  month: m,
  n: 22000 + i * 1800 + Math.random() * 3000,
  nMinus1: 18000 + i * 1500 + Math.random() * 2000,
}));

const MY_CATEGORY_REVENUE = [
  { name: "Electric", value: 95000, color: "#00B294" },
  { name: "SUV", value: 112000, color: "#118DFF" },
  { name: "Sedan", value: 68000, color: "#E66C37" },
  { name: "Compact", value: 49500, color: "#8764B8" },
];

const RECENT_DEALS = [
  {
    id: 1,
    client: "TechCorp Tunisia",
    product: "SUV Model D",
    value: 45000,
    date: "2025-05-02",
    status: "won",
  },
  {
    id: 2,
    client: "AutoGroup Sfax",
    product: "Electric Model B",
    value: 38000,
    date: "2025-04-28",
    status: "won",
  },
  {
    id: 3,
    client: "Mr. Ben Ali",
    product: "Sedan Model I",
    value: 22000,
    date: "2025-04-25",
    status: "won",
  },
  {
    id: 4,
    client: "LogiTrans",
    product: "Electric Model A",
    value: 35000,
    date: "2025-04-22",
    status: "lost",
  },
  {
    id: 5,
    client: "Family Ahmed",
    product: "SUV Model C",
    value: 28000,
    date: "2025-04-18",
    status: "won",
  },
];

// ─── Derived values ────────────────────────────────────────────────────────────
const now = new Date();
const curIdx = now.getMonth();
const prevIdx = curIdx > 0 ? curIdx - 1 : 11;
const totalN = MY_MONTHLY_REVENUE.reduce((s, m) => s + m.n, 0);
const totalNM1 = MY_MONTHLY_REVENUE.reduce((s, m) => s + m.nMinus1, 0);
const winRate = ((MY_DEALS.won / MY_DEALS.total) * 100).toFixed(1);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
};

const pct = (curr, prev) => {
  if (!prev) return null;
  const d = ((curr - prev) / prev) * 100;
  return { label: `${Math.abs(d).toFixed(1)}%`, up: d >= 0 };
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, trend, subValue }) => (
  <div style={{ ...card, padding: "16px 20px" }}>
    <p style={{ margin: "0 0 6px", fontSize: 11, color: PBI.textMuted }}>
      {label}
    </p>
    <p
      style={{
        margin: 0,
        fontSize: 26,
        fontWeight: 600,
        color: PBI.textPrimary,
        lineHeight: 1.2,
      }}
    >
      {value}
    </p>
    {trend && (
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 12,
          color: trend.up ? PBI.green : PBI.red,
        }}
      >
        {trend.up ? "▲" : "▼"} {trend.label}
      </p>
    )}
    {subValue && (
      <p style={{ margin: "4px 0 0", fontSize: 10, color: PBI.textMuted }}>
        {subValue}
      </p>
    )}
  </div>
);

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        position: "relative",
        zIndex: 10,
        background: "#fff",
        border: `1px solid ${PBI.border}`,
        borderRadius: 2,
        padding: "10px 14px",
        fontFamily: PBI.font,
        boxShadow: "0 4px 16px rgba(0,0,0,.18), 0 1px 4px rgba(0,0,0,.10)",
        fontSize: 12,
        pointerEvents: "none",
      }}
    >
      {label && (
        <p
          style={{ margin: "0 0 6px", fontWeight: 600, color: PBI.textPrimary }}
        >
          {label}
        </p>
      )}
      {payload.map((e, i) => (
        <p key={i} style={{ margin: "2px 0", color: e.fill }}>
          <span style={{ color: PBI.textMuted }}>{e.name}: </span>
          <strong>{fmt(e.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Revenue trend chart ─────────────────────────────────────────────────────
const RevenueTrendChart = () => {
  const data = MY_MONTHLY_REVENUE.map((m) => ({
    month: m.month,
    [LAST_YEAR]: m.nMinus1,
    [THIS_YEAR]: m.n,
  }));

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 13,
          fontWeight: 600,
          color: PBI.textPrimary,
        }}
      >
        Monthly Revenue — {THIS_YEAR} vs {LAST_YEAR}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: PBI.textMuted }}>
        Your personal revenue trend
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          barCategoryGap="30%"
          barGap={3}
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke={PBI.gridLine} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: PBI.textMuted, fontFamily: PBI.font }}
            axisLine={{ stroke: PBI.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: PBI.textMuted, fontFamily: PBI.font }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip
            content={<PBITooltip />}
            cursor={{ fill: "rgba(17,141,255,.06)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: PBI.font, paddingTop: 8 }}
          />
          <Bar
            dataKey={LAST_YEAR}
            name={String(LAST_YEAR)}
            fill={COLOR_NM1}
            radius={[2, 2, 0, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey={THIS_YEAR}
            name={String(THIS_YEAR)}
            fill={COLOR_N}
            radius={[2, 2, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Category donut chart ─────────────────────────────────────────────────────
const CategoryDonut = () => {
  const total = MY_CATEGORY_REVENUE.reduce((s, c) => s + c.value, 0);

  return (
    <div style={{ ...card, padding: "16px 20px" }}>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 12,
          fontWeight: 600,
          color: PBI.textPrimary,
        }}
      >
        Revenue by Category
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 10, color: PBI.textMuted }}>
        Your sales distribution
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            position: "relative",
            width: 100,
            height: 100,
            flexShrink: 0,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={MY_CATEGORY_REVENUE}
                cx="50%"
                cy="50%"
                innerRadius="54%"
                outerRadius="78%"
                dataKey="value"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {MY_CATEGORY_REVENUE.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(val) => fmt(val)}
                contentStyle={{
                  fontFamily: PBI.font,
                  fontSize: 11,
                  border: `1px solid ${PBI.border}`,
                  borderRadius: 2,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{ fontSize: 12, fontWeight: 700, color: PBI.textPrimary }}
            >
              {fmtShort(total)}
            </span>
            <span style={{ fontSize: 8, color: PBI.textMuted }}>total</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            flex: 1,
          }}
        >
          {MY_CATEGORY_REVENUE.map((d, i) => {
            const share = ((d.value / total) * 100).toFixed(1);
            return (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    flexShrink: 0,
                    background: d.color,
                  }}
                />
                <span style={{ fontSize: 10, color: PBI.textMuted, flex: 1 }}>
                  {d.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: PBI.textPrimary,
                  }}
                >
                  {share}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Recent deals table ─────────────────────────────────────────────────────
const RecentDealsTable = () => {
  const thBase = {
    padding: "6px 10px",
    fontSize: 10,
    fontWeight: 600,
    color: PBI.textMuted,
    background: "#F3F2F1",
    borderBottom: `1px solid ${PBI.border}`,
    borderRight: `1px solid ${PBI.border}`,
    textAlign: "left",
  };

  return (
    <div style={{ ...card, padding: "16px 20px" }}>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          fontWeight: 600,
          color: PBI.textPrimary,
        }}
      >
        Recent Deals
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            fontFamily: PBI.font,
            fontSize: 11,
            width: "100%",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thBase, minWidth: 120 }}>Client</th>
              <th style={{ ...thBase, minWidth: 100 }}>Product</th>
              <th style={{ ...thBase, minWidth: 80, textAlign: "right" }}>
                Value
              </th>
              <th style={{ ...thBase, minWidth: 70 }}>Date</th>
              <th style={{ ...thBase, minWidth: 60 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_DEALS.map((deal) => (
              <tr key={deal.id} style={{ background: "#fff" }}>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${PBI.border}`,
                    borderRight: `1px solid ${PBI.border}`,
                  }}
                >
                  {deal.client}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${PBI.border}`,
                    borderRight: `1px solid ${PBI.border}`,
                    color: PBI.textMuted,
                  }}
                >
                  {deal.product}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${PBI.border}`,
                    borderRight: `1px solid ${PBI.border}`,
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {fmt(deal.value)}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${PBI.border}`,
                    borderRight: `1px solid ${PBI.border}`,
                    color: PBI.textMuted,
                  }}
                >
                  {deal.date}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${PBI.border}`,
                    borderRight: `1px solid ${PBI.border}`,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      background: deal.status === "won" ? "#DFF6DD" : "#FDE7E9",
                      color: deal.status === "won" ? PBI.green : PBI.red,
                    }}
                  >
                    {deal.status === "won" ? "Won" : "Lost"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CRevenue() {
  return (
    <Layout>
      <FilterProvider>
        <RevenueInner />
      </FilterProvider>
    </Layout>
  );
}

function RevenueInner() {
  return (
    <div
      style={{
        background: PBI.pageBg,
        minHeight: "100vh",
        padding: "20px 24px",
        fontFamily: PBI.font,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: PBI.textPrimary,
          }}
        >
          My Performance
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: PBI.textMuted }}>
          Individual commercial dashboard · {THIS_YEAR}
        </p>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KpiCard
          label="Total Revenue"
          value={fmt(MY_REVENUE.total)}
          trend={pct(MY_REVENUE.total, MY_REVENUE.totalLastYear)}
          subValue={`${fmt(MY_REVENUE.totalLastYear)} last year`}
        />
        <KpiCard
          label={`This Month — ${MONTHS_FULL[curIdx]}`}
          value={fmt(MY_REVENUE.thisMonth)}
          trend={pct(MY_REVENUE.thisMonth, MY_REVENUE.thisMonthLastYear)}
          subValue={`vs ${MONTHS_FULL[curIdx]} ${LAST_YEAR}`}
        />
        <KpiCard
          label="Deals Closed"
          value={MY_DEALS.total}
          trend={pct(MY_DEALS.total, MY_DEALS.totalLastYear)}
          subValue={`${MY_DEALS.thisMonth} this month`}
        />
        <KpiCard
          label="Win Rate"
          value={`${winRate}%`}
          subValue={`${MY_DEALS.won} won / ${MY_DEALS.total} total`}
        />
      </div>

      {/* Charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <RevenueTrendChart />
        <CategoryDonut />
      </div>

      {/* Recent deals */}
      <RecentDealsTable />
    </div>
  );
}
