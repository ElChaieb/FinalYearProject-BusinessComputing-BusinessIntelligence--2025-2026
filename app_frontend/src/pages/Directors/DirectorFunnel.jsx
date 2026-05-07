/**
 * Funnel.jsx — Conversion Rates Dashboard Page
 *
 * Changes vs previous version:
 *  - Row 1 KPI cards: current month vs last month (instead of Year n vs Year n-1)
 *  - Row 2 charts: new "Opportunities Won · n-1 vs n" bar chart inserted before Quotes Won chart
 *  - Row 3: FilterBar (from FilterContext.jsx) rendered above the detail table
 *
 * Mirrors the updated "Cnv rates" sheet from Book1.xlsx.
 *
 * Table layout (transposed — metrics as rows, periods as columns):
 *
 *   Rows:
 *     Opportunities | Won
 *                   | Lost
 *                   | Oppos -> Quotes %
 *     Quotes        | Won
 *                   | Lost
 *                   | Quotes -> Sales %
 *
 *   Columns: Jan n-1 | Jan | Feb n-1 | Feb | Mar n-1 | Mar | … n-1 | …n | Year n-1 | Year n
 *
 * Data contract — replace mock with your datawarehouse hook:
 *   useFunnelData() → { data: DataRow[], loading, error }
 *
 *   type DataRow = {
 *     period:     string,   // "Jan n-1" | "Jan" | "Feb n-1" | "Feb" | … | "Year n-1" | "Year n"
 *     oppoWon:   number,
 *     oppoLost:  number,
 *     quoteWon:  number,
 *     quoteLost: number,
 *   }
 *   (rates are computed automatically)
 */

import { useState, useMemo } from "react";
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FilterProvider,
  FilterBar,
  useFilter,
} from "../../components/FilterContext";

// ─── Design tokens (matching Charts.jsx / Power BI) ───────────────────────────
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
  textPrimary: "#252423",
  textMuted: "#605E5C",
  gridLine: "#E1DFDD",
  font: "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
  green: "#107C10",
  red: "#D13438",
};

const card = {
  background: "#FFFFFF",
  border: `1px solid ${PBI.border}`,
  borderRadius: 4,
  padding: "20px 24px 16px",
  fontFamily: PBI.font,
  boxShadow: "0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)",
};

// ─── Mock data — replace with your datawarehouse hook ─────────────────────────
const MOCK_DATA = [
  { period: "Jan n-1",  oppoWon: 120, oppoLost: 45,  quoteWon: 98,   quoteLost: 22,  saleWon: 74,   saleLost: 24  },
  { period: "Jan",      oppoWon: 175, oppoLost: 50,  quoteWon: 148,  quoteLost: 27,  saleWon: 118,  saleLost: 30  },
  { period: "Feb n-1",  oppoWon: 135, oppoLost: 38,  quoteWon: 112,  quoteLost: 23,  saleWon: 89,   saleLost: 23  },
  { period: "Feb",      oppoWon: 182, oppoLost: 53,  quoteWon: 155,  quoteLost: 27,  saleWon: 124,  saleLost: 31  },
  { period: "Mar n-1",  oppoWon: 142, oppoLost: 52,  quoteWon: 118,  quoteLost: 24,  saleWon: 95,   saleLost: 23  },
  { period: "Mar",      oppoWon: 190, oppoLost: 57,  quoteWon: 162,  quoteLost: 28,  saleWon: 130,  saleLost: 32  },
  { period: "Apr n-1",  oppoWon: 148, oppoLost: 49,  quoteWon: 122,  quoteLost: 26,  saleWon: 98,   saleLost: 24  },
  { period: "Apr",      oppoWon: 198, oppoLost: 58,  quoteWon: 168,  quoteLost: 30,  saleWon: 135,  saleLost: 33  },
  { period: "May n-1",  oppoWon: 155, oppoLost: 54,  quoteWon: 128,  quoteLost: 27,  saleWon: 102,  saleLost: 26  },
  { period: "May",      oppoWon: 205, oppoLost: 62,  quoteWon: 174,  quoteLost: 31,  saleWon: 140,  saleLost: 34  },
  { period: "Jun n-1",  oppoWon: 160, oppoLost: 56,  quoteWon: 133,  quoteLost: 27,  saleWon: 106,  saleLost: 27  },
  { period: "Jun",      oppoWon: 210, oppoLost: 64,  quoteWon: 178,  quoteLost: 32,  saleWon: 143,  saleLost: 35  },
  { period: "Jul n-1",  oppoWon: 145, oppoLost: 50,  quoteWon: 120,  quoteLost: 25,  saleWon: 96,   saleLost: 24  },
  { period: "Jul",      oppoWon: 195, oppoLost: 59,  quoteWon: 165,  quoteLost: 30,  saleWon: 132,  saleLost: 33  },
  { period: "Aug n-1",  oppoWon: 138, oppoLost: 47,  quoteWon: 114,  quoteLost: 24,  saleWon: 91,   saleLost: 23  },
  { period: "Aug",      oppoWon: 185, oppoLost: 55,  quoteWon: 157,  quoteLost: 28,  saleWon: 126,  saleLost: 31  },
  { period: "Sep n-1",  oppoWon: 150, oppoLost: 53,  quoteWon: 124,  quoteLost: 26,  saleWon: 99,   saleLost: 25  },
  { period: "Sep",      oppoWon: 200, oppoLost: 60,  quoteWon: 170,  quoteLost: 30,  saleWon: 136,  saleLost: 34  },
  { period: "Oct n-1",  oppoWon: 158, oppoLost: 55,  quoteWon: 131,  quoteLost: 27,  saleWon: 105,  saleLost: 26  },
  { period: "Oct",      oppoWon: 208, oppoLost: 63,  quoteWon: 176,  quoteLost: 32,  saleWon: 141,  saleLost: 35  },
  { period: "Nov n-1",  oppoWon: 162, oppoLost: 57,  quoteWon: 134,  quoteLost: 28,  saleWon: 107,  saleLost: 27  },
  { period: "Nov",      oppoWon: 215, oppoLost: 65,  quoteWon: 182,  quoteLost: 33,  saleWon: 146,  saleLost: 36  },
  { period: "Dec n-1",  oppoWon: 170, oppoLost: 59,  quoteWon: 140,  quoteLost: 29,  saleWon: 112,  saleLost: 28  },
  { period: "Dec",      oppoWon: 220, oppoLost: 67,  quoteWon: 187,  quoteLost: 33,  saleWon: 150,  saleLost: 37  },
  { period: "Year n-1", oppoWon: 1720, oppoLost: 588, quoteWon: 1435, quoteLost: 285, saleWon: 1148, saleLost: 287 },
  { period: "Year n",   oppoWon: 1890, oppoLost: 620, quoteWon: 1610, quoteLost: 280, saleWon: 1288, saleLost: 322 },
];

// ─── Current month / last month labels ────────────────────────────────────────
// Update these two constants when wiring to real data.
// "Mar" = current month key in MOCK_DATA; "Feb" = last month key.
const CURRENT_MONTH_KEY = "Mar"; // e.g. data.find(d => d.period === CURRENT_MONTH_KEY)
const PREVIOUS_MONTH_KEY = "Feb"; // e.g. data.find(d => d.period === PREVIOUS_MONTH_KEY)
const CURRENT_MONTH_LABEL = "Mar";
const PREVIOUS_MONTH_LABEL = "Feb";

// ─── Per-agency breakdown (replace with datawarehouse hook) ───────────────────
const AGENCIES = [
  {
    name: "Agency A",
    oppoWon: 634,
    oppoLost: 198,
    quoteWon: 540,
    quoteLost: 94,
  },
  {
    name: "Agency B",
    oppoWon: 498,
    oppoLost: 172,
    quoteWon: 420,
    quoteLost: 78,
  },
  {
    name: "Agency C",
    oppoWon: 381,
    oppoLost: 138,
    quoteWon: 318,
    quoteLost: 63,
  },
  {
    name: "Agency D",
    oppoWon: 247,
    oppoLost: 82,
    quoteWon: 204,
    quoteLost: 43,
  },
  { name: "Agency E", oppoWon: 130, oppoLost: 30, quoteWon: 128, quoteLost: 2 },
];

// ─── Per-agency breakdown — previous year (replace with datawarehouse hook) ───
const AGENCIES_PREV = [
  { name: "Agency A", oppoWon: 580, oppoLost: 175, quoteWon: 490, quoteLost: 90 },
  { name: "Agency B", oppoWon: 450, oppoLost: 155, quoteWon: 378, quoteLost: 72 },
  { name: "Agency C", oppoWon: 340, oppoLost: 120, quoteWon: 282, quoteLost: 58 },
  { name: "Agency D", oppoWon: 210, oppoLost: 70,  quoteWon: 174, quoteLost: 36 },
  { name: "Agency E", oppoWon: 110, oppoLost: 25,  quoteWon: 108, quoteLost: 2  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtN = (n) => (n != null ? n.toLocaleString() : "—");
const calcOQ = (d) =>
  d.oppoWon ? +((d.quoteWon / d.oppoWon) * 100).toFixed(1) : null;

// ─── Custom tooltip ────────────────────────────────────────────────────────────
const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${PBI.border}`,
        borderRadius: 2,
        padding: "8px 12px",
        fontFamily: PBI.font,
        boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        fontSize: 12,
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
        <p key={i} style={{ margin: "2px 0", color: e.color }}>
          <span style={{ color: PBI.textMuted }}>{e.name}: </span>
          <strong>{e.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── KPI card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, delta, positive, color }) => (
  <div style={{
    ...card,
    padding: "16px 20px",
    borderLeft: `4px solid ${color || PBI.border}`,
  }}>
    <p style={{ margin: "0 0 6px", fontSize: 11, color: PBI.textMuted }}>
      {label}
    </p>
    <p
      style={{
        margin: 0,
        fontSize: 26,
        fontWeight: 600,
        color: color || PBI.textPrimary,
        lineHeight: 1.2,
      }}
    >
      {value}
    </p>
    {delta != null && (
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 12,
          color: positive ? PBI.green : PBI.red,
        }}
      >
        {positive ? "▲" : "▼"} {delta}
      </p>
    )}
  </div>
);

// ─── Transposed conversion table (exact Excel layout) ─────────────────────────
const ConvTable = ({ data }) => {
  const thBase = {
    padding: "7px 10px",
    fontSize: 11,
    fontWeight: 600,
    color: PBI.textMuted,
    background: "#F3F2F1",
    borderBottom: `1px solid ${PBI.border}`,
    borderRight: `1px solid ${PBI.border}`,
    whiteSpace: "nowrap",
    textAlign: "center",
  };
  const tdNum = (isYear) => ({
    padding: "5px 10px",
    fontSize: 12,
    color: PBI.textPrimary,
    textAlign: "right",
    borderBottom: `1px solid ${PBI.border}`,
    borderRight: `1px solid ${PBI.border}`,
    whiteSpace: "nowrap",
    background: isYear ? "#F3F2F1" : "#fff",
    fontWeight: isYear ? 600 : 400,
  });
  const tdRate = (color, isYear) => ({
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 700,
    color,
    textAlign: "center",
    borderBottom: `1px solid ${PBI.border}`,
    borderRight: `1px solid ${PBI.border}`,
    whiteSpace: "nowrap",
    background: isYear
      ? color === PBI.colors[0]
        ? "#D6EAFF"
        : "#FFE8DC"
      : color === PBI.colors[0]
        ? "#F0F6FF"
        : "#FFF5F0",
  });

  const ROWS = [
    { group: "Opportunities", label: "Won", key: "oppoWon", type: "num" },
    { group: null, label: "Lost", key: "oppoLost", type: "num" },
    {
      group: null,
      label: "Oppos → Quotes %",
      key: "oqRate",
      type: "rate",
      color: PBI.colors[0],
    },
    { group: "Quotes", label: "Won", key: "quoteWon", type: "num" },
    { group: null, label: "Lost", key: "quoteLost", type: "num" },
    {
      group: null,
      label: "Quotes → Sales %",
      key: "qsRate",
      type: "rate",
      color: PBI.colors[1],
    },
  ];

  const enriched = data.map((col) => ({
    ...col,
    oqRate: col.oppoWon
      ? +((col.quoteWon / col.oppoWon) * 100).toFixed(1)
      : null,
    qsRate: col.quoteWon
      ? +((col.quoteLost / col.quoteWon) * 100).toFixed(1)
      : null,
  }));

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          fontFamily: PBI.font,
          fontSize: 12,
          minWidth: "100%",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: "left", minWidth: 120 }}>
              Stage
            </th>
            <th style={{ ...thBase, textAlign: "left", minWidth: 150 }}>
              Metric
            </th>
            {data.map((col) => {
              const isYear = col.period.toLowerCase().includes("year");
              const isPrev =
                col.period.includes("n-1") || col.period.includes("n-");
              return (
                <th
                  key={col.period}
                  style={{
                    ...thBase,
                    minWidth: 85,
                    color: isYear
                      ? PBI.textPrimary
                      : isPrev
                        ? PBI.textMuted
                        : PBI.colors[0],
                    background: isYear ? "#EDEBE9" : "#F3F2F1",
                  }}
                >
                  {col.period}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, ri) => {
            const isFirstInGroup = row.group != null;
            const groupSize =
              row.group === "Opportunities" || row.group === "Quotes" ? 3 : 0;
            const groupColor =
              row.group === "Opportunities" ? PBI.colors[2] : PBI.colors[4];
            return (
              <tr
                key={ri}
                style={{ background: ri % 2 === 0 ? "#fff" : "#FAFAF9" }}
              >
                {isFirstInGroup ? (
                  <td
                    rowSpan={groupSize}
                    style={{
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: groupColor,
                      background: "#F7F6F5",
                      verticalAlign: "middle",
                      textAlign: "left",
                      borderBottom: `1px solid ${PBI.border}`,
                      borderRight: `1px solid ${PBI.border}`,
                    }}
                  >
                    {row.group}
                  </td>
                ) : null}
                <td
                  style={{
                    padding: "5px 10px",
                    fontSize: 12,
                    color: row.type === "rate" ? row.color : PBI.textPrimary,
                    fontStyle: row.type === "rate" ? "italic" : "normal",
                    paddingLeft:
                      !isFirstInGroup && row.type !== "rate" ? 22 : 10,
                    borderBottom: `1px solid ${PBI.border}`,
                    borderRight: `1px solid ${PBI.border}`,
                    background: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.label}
                </td>
                {enriched.map((col) => {
                  const val = col[row.key];
                  const isYear = col.period.toLowerCase().includes("year");
                  if (row.type === "rate") {
                    return (
                      <td key={col.period} style={tdRate(row.color, isYear)}>
                        {val != null ? val + "%" : "—"}
                      </td>
                    );
                  }
                  return (
                    <td key={col.period} style={tdNum(isYear)}>
                      {fmtN(val)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Single donut ring (no wrapper) ──────────────────────────────────────────
const DonutRing = ({ data, total, label }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
    <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="76%"
            dataKey="value"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PBI.colors[i % PBI.colors.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(val, name) => [
              `${val.toLocaleString()} (${total ? ((val / total) * 100).toFixed(1) : 0}%)`,
              name,
            ]}
            contentStyle={{
              fontFamily: PBI.font,
              fontSize: 10,
              border: `1px solid ${PBI.border}`,
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,.12)",
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
        <span style={{ fontSize: 11, fontWeight: 700, color: PBI.textPrimary, lineHeight: 1.1 }}>
          {total.toLocaleString()}
        </span>
        <span style={{ fontSize: 8, color: PBI.textMuted, marginTop: 1 }}>total</span>
      </div>
    </div>
    <span style={{ fontSize: 9, fontWeight: 600, color: PBI.textMuted, letterSpacing: 0.3 }}>
      {label}
    </span>
  </div>
);

// ─── Donut card — single donut, one year ─────────────────────────────────────
const DonutCard = ({ title, agencies, valueKey }) => {
  const donutData = agencies.map((a) => ({ name: a.name, value: a[valueKey] || 0 }));
  const total = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: PBI.textPrimary }}>
        {title}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <DonutRing data={donutData} total={total} label="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: 1 }}>
          {donutData.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: PBI.font }}>
              <span style={{
                width: 8, height: 8, borderRadius: 1, flexShrink: 0,
                background: PBI.colors[i % PBI.colors.length], display: "inline-block",
              }} />
              <span style={{ fontSize: 10, color: PBI.textMuted, whiteSpace: "nowrap" }}>
                {d.name}:
              </span>
              <strong style={{ fontSize: 11, color: PBI.textPrimary }}>
                {d.value.toLocaleString()}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DFunnel() {
  return (
    <FilterProvider>
      <FunnelPageInner />
    </FilterProvider>
  );
}

function FunnelPageInner() {
  const data = MOCK_DATA; // ← swap with useFunnelData() hook result

  // Funnel (Year n)
  const yearN = data.find((d) => d.period === "Year n") || {};
  const yearPrev = data.find((d) => d.period === "Year n-1") || {};
  const funnelData = [
    {
      name: "Opportunities",
      value: (yearN.oppoWon || 0) + (yearN.oppoLost || 0),
      fill: PBI.colors[0],
    },
    { name: "Quotes Won", value: yearN.quoteWon || 0, fill: PBI.colors[2] },
    { name: "Sales Won", value: yearN.saleWon || 0, fill: PBI.colors[7] },
  ];
  const oqRateN = yearN.oppoWon
    ? ((yearN.quoteWon / yearN.oppoWon) * 100).toFixed(1)
    : "—";
  const qsRateN = yearN.quoteWon
    ? ((yearN.saleWon / yearN.quoteWon) * 100).toFixed(1)
    : "—";

  // ── Bar chart data: n-1 vs n by month ─────────────────────────────────────
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const oppoCompareData = months.map((m) => {
    const prev = data.find((d) => d.period === `${m} n-1`) || {};
    const curr = data.find((d) => d.period === m) || {};
    return { month: m, "n-1": prev.oppoWon || 0, n: curr.oppoWon || 0 };
  });
  const quoteCompareData = months.map((m) => {
    const prev = data.find((d) => d.period === `${m} n-1`) || {};
    const curr = data.find((d) => d.period === m) || {};
    return { month: m, "n-1": prev.quoteWon || 0, n: curr.quoteWon || 0 };
  });

  return (
    <div
      style={{
        background: PBI.pageBg,
        minHeight: "100vh",
        padding: "20px 24px",
        fontFamily: PBI.font,
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: PBI.textPrimary,
          }}
        >
          Conversion Rates
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: PBI.textMuted }}>
          Opportunities → Quotes → Sales · {CURRENT_MONTH_LABEL} vs{" "}
          {PREVIOUS_MONTH_LABEL}
        </p>
      </div>

      {/* ── Filter bar ── */}
      <FilterBar style={{ marginBottom: 16 }} />

      {/* ── Row 2: Funnel (tall left) + 3×2 KPI grid (right) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 3fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* LEFT — Funnel card, spans both rows via alignSelf stretch */}
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 13,
              fontWeight: 600,
              color: PBI.textPrimary,
            }}
          >
            Funnel (Year n)
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: PBI.textMuted }}>
            Oppos → Quotes → Sales
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <FunnelChart>
              <Tooltip content={<PBITooltip />} />
              <Funnel
                dataKey="value"
                data={funnelData}
                isAnimationActive
                lastShapeType="rectangle"
              >
                <LabelList
                  position="right"
                  fill={PBI.textPrimary}
                  style={{ fontSize: 11, fontFamily: PBI.font }}
                  formatter={(v) => v.toLocaleString()}
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginTop: 8,
            }}
          >
            {[
              { label: "Oppos→Quotes", rate: oqRateN, color: PBI.colors[0] },
              { label: "Quotes→Sales", rate: qsRateN, color: PBI.colors[7] },
            ].map(({ label, rate, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color }}>
                  {rate}%
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 10,
                    color: PBI.textMuted,
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — 3×4 KPI grid (Year n top 2 rows, Year n-1 bottom 2 rows) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {/* Row 1 — Opportunities Year n (colored) */}
          <KpiCard label="Opportunities Won"  value={fmtN(yearN.oppoWon)}  delta={null} positive={true}  color={PBI.colors[7]} />
          <KpiCard label="Opportunities Lost" value={fmtN(yearN.oppoLost)} delta={null} positive={false} color={PBI.colors[6]} />
          <KpiCard
            label="Oppos Conv. Rate"
            value={yearN.oppoWon && yearN.oppoLost ? +((yearN.oppoWon / (yearN.oppoWon + yearN.oppoLost)) * 100).toFixed(1) + "%" : "—"}
            delta={null} positive={true} color={PBI.colors[0]}
          />

          {/* Row 2 — Opportunities Year n-1 (no color) */}
          <KpiCard label="Opportunities Won (n-1)"  value={fmtN(yearPrev.oppoWon)}  delta={null} positive={true}  />
          <KpiCard label="Opportunities Lost (n-1)" value={fmtN(yearPrev.oppoLost)} delta={null} positive={false} />
          <KpiCard
            label="Oppos Conv. Rate (n-1)"
            value={yearPrev.oppoWon && yearPrev.oppoLost ? +((yearPrev.oppoWon / (yearPrev.oppoWon + yearPrev.oppoLost)) * 100).toFixed(1) + "%" : "—"}
            delta={null} positive={true}
          />
          
          {/* Row 3 — Quotes Year n (colored) */}
          <KpiCard label="Quotes Won"  value={fmtN(yearN.quoteWon)}  delta={null} positive={true}  color={PBI.colors[7]} />
          <KpiCard label="Quotes Lost" value={fmtN(yearN.quoteLost)} delta={null} positive={false} color={PBI.colors[6]} />
          <KpiCard
            label="Quotes Conv. Rate"
            value={yearN.quoteWon && yearN.quoteLost ? +((yearN.quoteWon / (yearN.quoteWon + yearN.quoteLost)) * 100).toFixed(1) + "%" : "—"}
            delta={null} positive={true} color={PBI.colors[0]}
          />

          {/* Row 4 — Quotes Year n-1 (no color) */}
          <KpiCard label="Quotes Won (n-1)"  value={fmtN(yearPrev.quoteWon)}  delta={null} positive={true}  />
          <KpiCard label="Quotes Lost (n-1)" value={fmtN(yearPrev.quoteLost)} delta={null} positive={false} />
          <KpiCard
            label="Quotes Conv. Rate (n-1)"
            value={yearPrev.quoteWon && yearPrev.quoteLost ? +((yearPrev.quoteWon / (yearPrev.quoteWon + yearPrev.quoteLost)) * 100).toFixed(1) + "%" : "—"}
            delta={null} positive={true}
          />
        </div>
      </div>

      {/* ── Bar charts: Oppos Won n-1 vs n | Quotes Won n-1 vs n ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { title: "Opportunities Won · n-1 vs n", data: oppoCompareData },
          { title: "Quotes Won · n-1 vs n",        data: quoteCompareData },
        ].map(({ title, data: chartData }) => (
          <div key={title} style={card}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: PBI.textPrimary }}>
              {title}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: PBI.textMuted }}>By month</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="30%" barGap={3} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={PBI.gridLine} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: PBI.textMuted, fontFamily: PBI.font }} axisLine={{ stroke: PBI.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: PBI.textMuted, fontFamily: PBI.font }} axisLine={{ stroke: PBI.border }} tickLine={false} />
                <Tooltip content={<PBITooltip />} cursor={{ fill: "rgba(17,141,255,.06)" }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: PBI.font }} />
                <Bar dataKey="n-1" fill={PBI.colors[3]} radius={[2, 2, 0, 0]} maxBarSize={32} />
                <Bar dataKey="n"   fill={PBI.colors[0]} radius={[2, 2, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* ── Row 3: Filter bar + Detail table ── */}
      <div style={{ ...card, padding: "20px 24px" }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 13,
            fontWeight: 600,
            color: PBI.textPrimary,
          }}
        >
          Conversion Rate Detail
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: PBI.textMuted }}>
          Metrics as rows · Periods as columns (Jan n-1 → Year n) · Rates
          auto-calculated
        </p>

        {/* FilterBar moved to top of page */}
        <ConvTable data={MOCK_DATA} />
      </div>

      {/* ── Donut rows: 4 rows (Oppos n-1, Oppos n, Quotes n-1, Quotes n) ── */}
      {[
        {
          rowLabel: "Opportunities",
          yearLabel: "Year n-1",
          agencies: AGENCIES_PREV.map((a) => ({ ...a, oppoTotal: a.oppoWon + a.oppoLost, quoteTotal: a.quoteWon + a.quoteLost })),
          cards: [
            { title: "Total Opportunities", valueKey: "oppoTotal" },
            { title: "Won Opportunities",   valueKey: "oppoWon"   },
            { title: "Lost Opportunities",  valueKey: "oppoLost"  },
          ],
        },
        {
          rowLabel: "Opportunities",
          yearLabel: "Year n",
          agencies: AGENCIES.map((a) => ({ ...a, oppoTotal: a.oppoWon + a.oppoLost, quoteTotal: a.quoteWon + a.quoteLost })),
          cards: [
            { title: "Total Opportunities", valueKey: "oppoTotal" },
            { title: "Won Opportunities",   valueKey: "oppoWon"   },
            { title: "Lost Opportunities",  valueKey: "oppoLost"  },
          ],
        },
        {
          rowLabel: "Quotes",
          yearLabel: "Year n-1",
          agencies: AGENCIES_PREV.map((a) => ({ ...a, oppoTotal: a.oppoWon + a.oppoLost, quoteTotal: a.quoteWon + a.quoteLost })),
          cards: [
            { title: "Total Quotes", valueKey: "quoteTotal" },
            { title: "Won Quotes",   valueKey: "quoteWon"   },
            { title: "Lost Quotes",  valueKey: "quoteLost"  },
          ],
        },
        {
          rowLabel: "Quotes",
          yearLabel: "Year n",
          agencies: AGENCIES.map((a) => ({ ...a, oppoTotal: a.oppoWon + a.oppoLost, quoteTotal: a.quoteWon + a.quoteLost })),
          cards: [
            { title: "Total Quotes", valueKey: "quoteTotal" },
            { title: "Won Quotes",   valueKey: "quoteWon"   },
            { title: "Lost Quotes",  valueKey: "quoteLost"  },
          ],
        },
      ].map(({ rowLabel, yearLabel, agencies, cards }, idx) => (
        <div key={idx} style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: PBI.textPrimary, fontFamily: PBI.font }}>
            {rowLabel} — Share by Agency
            <span style={{ fontSize: 11, fontWeight: 400, color: PBI.textMuted, marginLeft: 8 }}>
              {yearLabel}
            </span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {cards.map((c) => (
              <DonutCard key={c.title} title={c.title} valueKey={c.valueKey} agencies={agencies} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/*
 ┌────────────────────────────────────────────────────────────────────┐
 │  HOW TO WIRE YOUR DATAWAREHOUSE                                    │
 │                                                                    │
 │  1. Create a custom hook:                                          │
 │       const { data, loading, error } = useFunnelData()             │
 │                                                                    │
 │  2. Replace `const data = MOCK_DATA` with the hook result.        │
 │                                                                    │
 │  3. Update CURRENT_MONTH_KEY / PREVIOUS_MONTH_KEY to reflect      │
 │     the actual current and previous calendar months.               │
 │                                                                    │
 │  4. Each item must match this shape:                               │
 │     {                                                              │
 │       period:    string,   // "Jan n-1" | "Jan" | "Feb n-1" |     │
 │                            //  "Feb" | "Mar n-1" | "Mar" |        │
 │                            //  "… n-1" | "…n" |                   │
 │                            //  "Year n-1" | "Year n"              │
 │       oppoWon:   number,                                           │
 │       oppoLost:  number,                                           │
 │       quoteWon:  number,                                           │
 │       quoteLost: number,                                           │
 │     }                                                              │
 │  Conversion rates are computed automatically in the component.    │
 └────────────────────────────────────────────────────────────────────┘
*/
