/**
 * Revenue.jsx — Revenue Dashboard Page
 *
 * Changes vs previous version:
 *  - FilterBar (from FilterContext.jsx) rendered above the breakdown table
 *  - 4 Agency-share donut charts below the table:
 *      1. Current month revenue by agency
 *      2. Last month revenue by agency
 *      3. Current year (n) revenue by agency
 *      4. Last year (n-1) revenue by agency
 *
 * Layout:
 *   • 3 KPI cards (Total Revenue, This Month, Last Month)
 *   • 1 unified grouped bar chart — all 12 months, n-1 vs n side-by-side
 *   • FilterBar + Breakdown table (Categories as row groups, Models as sub-rows)
 *   • Agency-share donut row (4 charts)
 *
 * Data contract — replace CATEGORIES mock with your DWH hook:
 *   type CategoryData = {
 *     id:     string,
 *     label:  string,
 *     color:  string,
 *     models: {
 *       model:  string,
 *       months: Array<{ n: number, nMinus1: number }>,  // index 0=Jan … 11=Dec
 *     }[]
 *   }
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
} from "../../components/FilterContext";
import Layout from "../../components/Layout";

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Design tokens ────────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Mock data ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "electric",
    label: "Electric",
    color: "#00B294",
    models: [
      {
        model: "Model A",
        months: MONTHS.map((_, i) => ({
          n: 18000 + i * 900,
          nMinus1: 14000 + i * 700,
        })),
      },
      {
        model: "Model B",
        months: MONTHS.map((_, i) => ({
          n: 12000 + i * 500,
          nMinus1: 9000 + i * 400,
        })),
      },
    ],
  },
  {
    id: "suv",
    label: "SUV",
    color: "#118DFF",
    models: [
      {
        model: "Model C",
        months: MONTHS.map((_, i) => ({
          n: 22000 + i * 1100,
          nMinus1: 18000 + i * 900,
        })),
      },
      {
        model: "Model D",
        months: MONTHS.map((_, i) => ({
          n: 19000 + i * 800,
          nMinus1: 16000 + i * 700,
        })),
      },
      {
        model: "Model E",
        months: MONTHS.map((_, i) => ({
          n: 15000 + i * 600,
          nMinus1: 12000 + i * 500,
        })),
      },
    ],
  },
  {
    id: "suv_compact",
    label: "SUV Compact",
    color: "#8764B8",
    models: [
      {
        model: "Model F",
        months: MONTHS.map((_, i) => ({
          n: 14000 + i * 700,
          nMinus1: 11000 + i * 600,
        })),
      },
      {
        model: "Model G",
        months: MONTHS.map((_, i) => ({
          n: 11000 + i * 500,
          nMinus1: 9000 + i * 400,
        })),
      },
    ],
  },
  {
    id: "sedan",
    label: "Sedan",
    color: "#E66C37",
    models: [
      {
        model: "Model H",
        months: MONTHS.map((_, i) => ({
          n: 16000 + i * 800,
          nMinus1: 13000 + i * 700,
        })),
      },
      {
        model: "Model I",
        months: MONTHS.map((_, i) => ({
          n: 10000 + i * 400,
          nMinus1: 8000 + i * 350,
        })),
      },
    ],
  },
  {
    id: "coupe",
    label: "Coupe",
    color: "#D13438",
    models: [
      {
        model: "Model J",
        months: MONTHS.map((_, i) => ({
          n: 9000 + i * 450,
          nMinus1: 7000 + i * 380,
        })),
      },
    ],
  },
];

// ─── Mock agency revenue data ──────────────────────────────────────────────────
// Replace with your DWH hook. Each agency has revenue per month for n and nMinus1.
// Index 0 = Jan, 11 = Dec.
const AGENCY_REVENUE = [
  {
    id: "agency_tunis",
    label: "Tunis",
    color: "#118DFF",
    months: MONTHS.map((_, i) => ({
      n: 95000 + i * 3200,
      nMinus1: 78000 + i * 2800,
    })),
  },
  {
    id: "agency_sfax",
    label: "Sfax",
    color: "#E66C37",
    months: MONTHS.map((_, i) => ({
      n: 72000 + i * 2400,
      nMinus1: 58000 + i * 2000,
    })),
  },
  {
    id: "agency_sousse",
    label: "Sousse",
    color: "#12239E",
    months: MONTHS.map((_, i) => ({
      n: 61000 + i * 2100,
      nMinus1: 49000 + i * 1800,
    })),
  },
  {
    id: "agency_nabeul",
    label: "Nabeul",
    color: "#00B5D0",
    months: MONTHS.map((_, i) => ({
      n: 43000 + i * 1600,
      nMinus1: 35000 + i * 1300,
    })),
  },
  {
    id: "agency_bizerte",
    label: "Bizerte",
    color: "#8764B8",
    months: MONTHS.map((_, i) => ({
      n: 29000 + i * 1100,
      nMinus1: 23000 + i * 900,
    })),
  },
];

// ─── Derived aggregates ───────────────────────────────────────────────────────
const allModels = CATEGORIES.flatMap((c) => c.models);
const MONTHLY_TOTALS = MONTHS.map((abbr, i) => ({
  abbr,
  full: MONTHS_FULL[i],
  n: allModels.reduce((s, m) => s + m.months[i].n, 0),
  nMinus1: allModels.reduce((s, m) => s + m.months[i].nMinus1, 0),
}));

const totalN = MONTHLY_TOTALS.reduce((s, m) => s + m.n, 0);
const totalNM1 = MONTHLY_TOTALS.reduce((s, m) => s + m.nMinus1, 0);
const now = new Date();
const curIdx = now.getMonth();
const prevIdx = curIdx > 0 ? curIdx - 1 : 11;
const thisMonN = MONTHLY_TOTALS[curIdx].n;
const thisMonNM1 = MONTHLY_TOTALS[curIdx].nMinus1;
const lastMonN = MONTHLY_TOTALS[prevIdx].n;
const lastMonNM1 = MONTHLY_TOTALS[prevIdx].nMinus1;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M TND`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k TND`;
  return `${n} TND`;
};

const pct = (curr, prev) => {
  if (!prev) return null;
  const d = ((curr - prev) / prev) * 100;
  return { label: `${Math.abs(d).toFixed(1)}% vs ${LAST_YEAR}`, up: d >= 0 };
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, trend }) => (
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

// ─── Unified bar chart ────────────────────────────────────────────────────────
const RevenueBarChart = () => {
  const data = MONTHLY_TOTALS.map((m) => ({
    month: m.abbr,
    [LAST_YEAR]: m.nMinus1,
    [THIS_YEAR]: m.n,
  }));

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: PBI.textPrimary,
            }}
          >
            Monthly Revenue — {THIS_YEAR} vs {LAST_YEAR}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: PBI.textMuted }}>
            All categories combined · year-over-year by month
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
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
            formatter={(val) => (
              <span style={{ color: PBI.textMuted }}>{val}</span>
            )}
          />
          <Bar
            dataKey={LAST_YEAR}
            name={String(LAST_YEAR)}
            fill={COLOR_NM1}
            radius={[2, 2, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey={THIS_YEAR}
            name={String(THIS_YEAR)}
            fill={COLOR_N}
            radius={[2, 2, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Breakdown table ──────────────────────────────────────────────────────────
const RevenueTable = ({ expandedCats, toggleCat }) => {
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
  const tdNum = (isTotal, isNM1, override = {}) => ({
    padding: "5px 10px",
    fontSize: 12,
    textAlign: "right",
    borderBottom: `1px solid ${PBI.border}`,
    borderRight: `1px solid ${PBI.border}`,
    whiteSpace: "nowrap",
    background: isTotal ? "#F3F2F1" : "#fff",
    fontWeight: isTotal ? 600 : 400,
    color: isNM1 ? PBI.textMuted : PBI.textPrimary,
    ...override,
  });

  return (
    <div style={{ padding: "20px 0px" }}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 13,
          fontWeight: 600,
          color: PBI.textPrimary,
        }}
      >
        Revenue Breakdown by Category &amp; Model
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: PBI.textMuted }}>
        Click a category to expand its models · {THIS_YEAR} vs {LAST_YEAR} per
        month
      </p>


      <div style={{ ...card, overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            fontFamily: PBI.font,
            fontSize: 12,
            minWidth: "100%",
          }}
        >
          <thead>
            {/* Row 1 — month group headers */}
            <tr>
              <th
                style={{
                  ...thBase,
                  textAlign: "left",
                  minWidth: 160,
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                }}
              >
                Category / Model
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  colSpan={2}
                  style={{
                    ...thBase,
                    textAlign: "center",
                    borderLeft: `1px solid ${PBI.border}`,
                  }}
                >
                  {m}
                </th>
              ))}
              <th
                colSpan={2}
                style={{
                  ...thBase,
                  textAlign: "center",
                  borderLeft: `2px solid ${PBI.border}`,
                  background: "#EDEBE9",
                  color: PBI.textPrimary,
                }}
              >
                Total
              </th>
            </tr>
            {/* Row 2 — year sub-headers */}
            <tr>
              <th
                style={{
                  ...thBase,
                  textAlign: "left",
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                }}
              />
              {MONTHS.map((m) => (
                <>
                  <th
                    key={`${m}-nm1`}
                    style={{
                      ...thBase,
                      color: COLOR_NM1,
                      borderLeft: `1px solid ${PBI.border}`,
                      minWidth: 88,
                    }}
                  >
                    {LAST_YEAR}
                  </th>
                  <th
                    key={`${m}-n`}
                    style={{ ...thBase, color: COLOR_N, minWidth: 88 }}
                  >
                    {THIS_YEAR}
                  </th>
                </>
              ))}
              <th
                style={{
                  ...thBase,
                  color: COLOR_NM1,
                  borderLeft: `2px solid ${PBI.border}`,
                  background: "#EDEBE9",
                  minWidth: 88,
                }}
              >
                {LAST_YEAR}
              </th>
              <th
                style={{
                  ...thBase,
                  color: COLOR_N,
                  background: "#EDEBE9",
                  minWidth: 88,
                }}
              >
                {THIS_YEAR}
              </th>
            </tr>
          </thead>

          <tbody>
            {CATEGORIES.map((cat) => {
              const isOpen = expandedCats.includes(cat.id);
              const catMonths = MONTHS.map((_, mi) => ({
                n: cat.models.reduce((s, m) => s + m.months[mi].n, 0),
                nMinus1: cat.models.reduce(
                  (s, m) => s + m.months[mi].nMinus1,
                  0,
                ),
              }));
              const catTotalN = catMonths.reduce((s, m) => s + m.n, 0);
              const catTotalNM1 = catMonths.reduce((s, m) => s + m.nMinus1, 0);

              return (
                <>
                  {/* Category row */}
                  <tr
                    key={cat.id}
                    onClick={() => toggleCat(cat.id)}
                    style={{ cursor: "pointer", background: "#F7F6F5" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#EDEBE9")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#F7F6F5")
                    }
                  >
                    <td
                      style={{
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: PBI.textPrimary,
                        whiteSpace: "nowrap",
                        verticalAlign: "middle",
                        borderBottom: `1px solid ${PBI.border}`,
                        borderRight: `1px solid ${PBI.border}`,
                        background: "inherit",
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          background: cat.color,
                          marginRight: 7,
                          verticalAlign: "middle",
                        }}
                      />
                      <span
                        style={{
                          marginRight: 6,
                          fontSize: 10,
                          color: PBI.textMuted,
                        }}
                      >
                        {isOpen ? "▼" : "▶"}
                      </span>
                      {cat.label}
                    </td>
                    {catMonths.map((cm, mi) => (
                      <>
                        <td
                          key={`cat-${cat.id}-${mi}-nm1`}
                          style={tdNum(false, true, {
                            borderLeft: `1px solid ${PBI.border}`,
                            fontWeight: 600,
                            background: "#F7F6F5",
                          })}
                        >
                          {fmt(cm.nMinus1)}
                        </td>
                        <td
                          key={`cat-${cat.id}-${mi}-n`}
                          style={tdNum(false, false, {
                            fontWeight: 600,
                            background: "#F7F6F5",
                          })}
                        >
                          {fmt(cm.n)}
                        </td>
                      </>
                    ))}
                    <td
                      style={tdNum(true, true, {
                        borderLeft: `2px solid ${PBI.border}`,
                        fontWeight: 700,
                        background: "#EDEBE9",
                      })}
                    >
                      {fmt(catTotalNM1)}
                    </td>
                    <td
                      style={tdNum(true, false, {
                        fontWeight: 700,
                        background: "#EDEBE9",
                      })}
                    >
                      {fmt(catTotalN)}
                    </td>
                  </tr>

                  {/* Model rows */}
                  {isOpen &&
                    cat.models.map((mod, ri) => {
                      const modTotalN = mod.months.reduce((s, m) => s + m.n, 0);
                      const modTotalNM1 = mod.months.reduce(
                        (s, m) => s + m.nMinus1,
                        0,
                      );
                      const rowBg = ri % 2 === 0 ? "#fff" : "#FAFAF9";
                      return (
                        <tr
                          key={`${cat.id}-${mod.model}`}
                          style={{ background: rowBg }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#F3F2F1")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = rowBg)
                          }
                        >
                          <td
                            style={{
                              padding: "5px 10px 5px 28px",
                              fontSize: 12,
                              color: PBI.textMuted,
                              whiteSpace: "nowrap",
                              borderBottom: `1px solid ${PBI.border}`,
                              borderRight: `1px solid ${PBI.border}`,
                              background: "inherit",
                              position: "sticky",
                              left: 0,
                              zIndex: 2,
                            }}
                          >
                            {mod.model}
                          </td>
                          {mod.months.map((mm, mi) => (
                            <>
                              <td
                                key={`mod-${mod.model}-${mi}-nm1`}
                                style={tdNum(false, true, {
                                  borderLeft: `1px solid ${PBI.border}`,
                                })}
                              >
                                {fmt(mm.nMinus1)}
                              </td>
                              <td
                                key={`mod-${mod.model}-${mi}-n`}
                                style={tdNum(false, false)}
                              >
                                {fmt(mm.n)}
                              </td>
                            </>
                          ))}
                          <td
                            style={tdNum(true, true, {
                              borderLeft: `2px solid ${PBI.border}`,
                            })}
                          >
                            {fmt(modTotalNM1)}
                          </td>
                          <td style={tdNum(true, false)}>{fmt(modTotalN)}</td>
                        </tr>
                      );
                    })}
                </>
              );
            })}

            {/* Grand total row */}
            <tr style={{ background: "#DEECF9" }}>
              <td
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: PBI.textPrimary,
                  borderBottom: `1px solid ${PBI.border}`,
                  borderRight: `1px solid ${PBI.border}`,
                  position: "sticky",
                  left: 0,
                  background: "#DEECF9",
                  zIndex: 2,
                }}
              >
                Grand Total
              </td>
              {MONTHLY_TOTALS.map((mt, mi) => (
                <>
                  <td
                    key={`gt-${mi}-nm1`}
                    style={tdNum(false, true, {
                      borderLeft: `1px solid ${PBI.border}`,
                      fontWeight: 700,
                      background: "#DEECF9",
                    })}
                  >
                    {fmt(mt.nMinus1)}
                  </td>
                  <td
                    key={`gt-${mi}-n`}
                    style={tdNum(false, false, {
                      fontWeight: 700,
                      background: "#DEECF9",
                    })}
                  >
                    {fmt(mt.n)}
                  </td>
                </>
              ))}
              <td
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  borderBottom: `1px solid ${PBI.border}`,
                  borderRight: `1px solid ${PBI.border}`,
                  borderLeft: `2px solid ${PBI.border}`,
                  color: COLOR_NM1,
                  background: "#C7E0F4",
                }}
              >
                {fmt(totalNM1)}
              </td>
              <td
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  borderBottom: `1px solid ${PBI.border}`,
                  borderRight: `1px solid ${PBI.border}`,
                  color: COLOR_N,
                  background: "#C7E0F4",
                }}
              >
                {fmt(totalN)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Agency share donut card ──────────────────────────────────────────────────
const AgencyDonutCard = ({ title, subtitle, slices }) => {
  const total = slices.reduce((s, d) => s + d.value, 0);

  const donutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
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
          fontSize: 11,
          pointerEvents: "none",
        }}
      >
        <p
          style={{ margin: "0 0 3px", fontWeight: 600, color: PBI.textPrimary }}
        >
          {d.name}
        </p>
        <p style={{ margin: 0, color: d.payload.color }}>
          {fmtShort(d.value)}
          <span style={{ color: PBI.textMuted, marginLeft: 6 }}>
            ({total ? ((d.value / total) * 100).toFixed(1) : 0}%)
          </span>
        </p>
      </div>
    );
  };

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
        {title}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 10, color: PBI.textMuted }}>
        {subtitle}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Donut */}
        <div
          style={{
            position: "relative",
            width: 120,
            height: 120,
            flexShrink: 0,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius="54%"
                outerRadius="78%"
                dataKey="value"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {slices.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={donutTooltip} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centre total */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: PBI.textPrimary,
                lineHeight: 1.1,
              }}
            >
              {fmtShort(total)}
            </span>
            <span style={{ fontSize: 8, color: PBI.textMuted, marginTop: 2 }}>
              total
            </span>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 0,
            flex: 1,
          }}
        >
          {slices.map((d, i) => {
            const share = total ? ((d.value / total) * 100).toFixed(1) : 0;
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
                    display: "inline-block",
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: PBI.textMuted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: PBI.textPrimary,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {share}%
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div
                    style={{
                      height: 3,
                      background: "#F3F2F1",
                      borderRadius: 2,
                      marginTop: 2,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 2,
                        width: `${share}%`,
                        background: d.color,
                        transition: "width .3s ease",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Agency donut row — 4 cards ───────────────────────────────────────────────
const AgencyDonutRow = () => {
  // Build slices for each of the 4 periods
  const makeSlices = (valueKey) =>
    AGENCY_REVENUE.map((a) => ({
      name: a.label,
      color: a.color,
      value: valueKey(a),
    }));

  // Current month (curIdx) — Year n
  const currentMonthSlices = makeSlices((a) => a.months[curIdx].n);
  // Last month (prevIdx)   — Year n
  const lastMonthSlices = makeSlices((a) => a.months[prevIdx].n);
  // Current year (n)       — sum all months
  const currentYearSlices = makeSlices((a) =>
    a.months.reduce((s, m) => s + m.n, 0),
  );
  // Last year (n-1)        — sum all months
  const lastYearSlices = makeSlices((a) =>
    a.months.reduce((s, m) => s + m.nMinus1, 0),
  );

  const CARDS = [
    {
      title: "Agency Share — Current Month",
      subtitle: `${MONTHS_FULL[curIdx]} ${THIS_YEAR}`,
      slices: currentMonthSlices,
    },
    {
      title: `Agency Share — Year ${THIS_YEAR}`,
      subtitle: "Full year to date",
      slices: currentYearSlices,
    },
    {
      title: "Agency Share — Last Month",
      subtitle: `${MONTHS_FULL[prevIdx]} ${THIS_YEAR}`,
      slices: lastMonthSlices,
    },
    {
      title: `Agency Share — Year ${LAST_YEAR}`,
      subtitle: "Full previous year",
      slices: lastYearSlices,
    },
  ];

  const ROWS = [
    { rowLabel: "Monthly", cards: CARDS.slice(0, 2) },
    { rowLabel: "Yearly", cards: CARDS.slice(2, 4) },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 13,
          fontWeight: 600,
          color: PBI.textPrimary,
          fontFamily: PBI.font,
        }}
      >
        Revenue by Agency
        <span
          style={{
            fontSize: 11,
            fontWeight: 400,
            color: PBI.textMuted,
            marginLeft: 8,
          }}
        >
          Share of total revenue across periods
        </span>
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gridTemplateRows: "auto",
          gap: 12,
        }}
      >
        {CARDS.map((c) => (
          <div key={c.title} style={{ gridRow: "span 2", gridColumn: "span 2" }}>
            <AgencyDonutCard
              title={c.title}
              subtitle={c.subtitle}
              slices={c.slices}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DRevenue() {
  return (
    <Layout>
      <FilterProvider>
        <RevenueInner />
      </FilterProvider>
    </Layout>
  );
}

function RevenueInner() {
  const [expandedCats, setExpandedCats] = useState([]);
  const toggleCat = (id) =>
    setExpandedCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

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
          Revenue
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: PBI.textMuted }}>
          {THIS_YEAR} vs {LAST_YEAR} ·
        </p>
      </div>
            <FilterBar style={{ marginBottom: 14 }} />

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KpiCard
          label="Total Revenue"
          value={fmt(totalN)}
          trend={pct(totalN, totalNM1)}
        />
        <KpiCard
          label={`Revenue This Month — ${MONTHS_FULL[curIdx]} ${THIS_YEAR}`}
          value={fmt(thisMonN)}
          trend={pct(thisMonN, thisMonNM1)}
        />
        <KpiCard
          label={`Revenue Last Month — ${MONTHS_FULL[prevIdx]} ${THIS_YEAR}`}
          value={fmt(lastMonN)}
          trend={pct(lastMonN, lastMonNM1)}
        />
      </div>

      {/* Unified bar chart */}
      <RevenueBarChart />

      {/* Agency share donut row */}
      <AgencyDonutRow />
      {/* Breakdown table (includes FilterBar) */}
      <RevenueTable expandedCats={expandedCats} toggleCat={toggleCat} />

    </div>
  );
}

/*
 ┌────────────────────────────────────────────────────────────────────┐
 │  HOW TO WIRE YOUR DATAWAREHOUSE                                    │
 │                                                                    │
 │  1. Replace CATEGORIES with your useCategoryData() hook.          │
 │  2. Replace AGENCY_REVENUE with your useAgencyRevenue() hook.     │
 │     Each agency must expose:                                       │
 │       { id, label, color,                                         │
 │         months: Array<{ n: number, nMinus1: number }> }           │
 │     (index 0 = Jan, 11 = Dec)                                     │
 │  3. curIdx / prevIdx derive automatically from new Date().        │
 └────────────────────────────────────────────────────────────────────┘
*/
