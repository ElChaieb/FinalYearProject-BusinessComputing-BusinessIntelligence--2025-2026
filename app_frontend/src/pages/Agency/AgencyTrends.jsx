/**
 * TrendClientBase.jsx — Trends & Client Base Dashboard Page
 *
 * Layout:
 *   Row 1 (4 KPI cards):
 *     Total Sales | Total Categories | Highest Selling Category | Lowest Selling Category
 *
 *   Row 2 (3 chart cards):
 *     Donut: Sales Mix n | Donut: Sales Mix n-1 | Stacked bar: Models per Category
 *
 *   Bottom:
 *     Breakdown table — Categories × Models (Jan n-1 | Jan n | … | Total n-1 | Total n)
 */

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  FilterProvider,
  FilterBar,
  useFilter,
} from "../../components/AgencyFilterContext_states";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PBI = {
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
  padding: "18px 20px",
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

// ─── Mock data — replace with DWH fetch ──────────────────────────────────────
const CATEGORIES = [
  {
    id: "electric",
    label: "Electric",
    color: "#00B294",
    models: [
      {
        model: "Model A",
        months: MONTHS.map((_, i) => ({ n: 42 + i * 2, nMinus1: 35 + i * 2 })),
      },
      {
        model: "Model B",
        months: MONTHS.map((_, i) => ({ n: 28 + i * 1, nMinus1: 22 + i * 1 })),
      },
      {
        model: "Model C",
        months: MONTHS.map((_, i) => ({ n: 19 + i * 1, nMinus1: 15 + i * 1 })),
      },
    ],
  },
  {
    id: "suv",
    label: "SUV",
    color: "#118DFF",
    models: [
      {
        model: "Model D",
        months: MONTHS.map((_, i) => ({ n: 55 + i * 3, nMinus1: 44 + i * 2 })),
      },
      {
        model: "Model E",
        months: MONTHS.map((_, i) => ({ n: 48 + i * 2, nMinus1: 39 + i * 2 })),
      },
      {
        model: "Model F",
        months: MONTHS.map((_, i) => ({ n: 31 + i * 1, nMinus1: 25 + i * 1 })),
      },
    ],
  },
  {
    id: "suv_compact",
    label: "SUV Compact",
    color: "#8764B8",
    models: [
      {
        model: "Model G",
        months: MONTHS.map((_, i) => ({ n: 38 + i * 2, nMinus1: 30 + i * 2 })),
      },
      {
        model: "Model H",
        months: MONTHS.map((_, i) => ({ n: 24 + i * 1, nMinus1: 19 + i * 1 })),
      },
    ],
  },
  {
    id: "sedan",
    label: "Sedan",
    color: "#E66C37",
    models: [
      {
        model: "Model I",
        months: MONTHS.map((_, i) => ({ n: 33 + i * 1, nMinus1: 27 + i * 1 })),
      },
      {
        model: "Model J",
        months: MONTHS.map((_, i) => ({ n: 21 + i * 1, nMinus1: 17 + i * 1 })),
      },
    ],
  },
  {
    id: "coupe",
    label: "Coupe",
    color: "#D13438",
    models: [
      {
        model: "Model K",
        months: MONTHS.map((_, i) => ({ n: 16 + i * 1, nMinus1: 12 + i * 1 })),
      },
    ],
  },
];

// ─── Derived totals ───────────────────────────────────────────────────────────
const allModels = CATEGORIES.flatMap((c) => c.models);
const MONTHLY_TOTALS = MONTHS.map((abbr, i) => ({
  abbr,
  full: MONTHS_FULL[i],
  n: allModels.reduce((s, m) => s + m.months[i].n, 0),
  nMinus1: allModels.reduce((s, m) => s + m.months[i].nMinus1, 0),
}));

const totalN = MONTHLY_TOTALS.reduce((s, m) => s + m.n, 0);
const totalNM1 = MONTHLY_TOTALS.reduce((s, m) => s + m.nMinus1, 0);

const CAT_TOTALS = CATEGORIES.map((cat) => ({
  id: cat.id,
  label: cat.label,
  color: cat.color,
  n: cat.models.flatMap((m) => m.months).reduce((s, mo) => s + mo.n, 0),
  nM1: cat.models.flatMap((m) => m.months).reduce((s, mo) => s + mo.nMinus1, 0),
}));

const highest = CAT_TOTALS.reduce((a, b) => (a.n >= b.n ? a : b));
const lowest = CAT_TOTALS.reduce((a, b) => (a.n <= b.n ? a : b));

// ─── Models-per-category stacked bar data ─────────────────────────────────────
const MAX_MODELS = Math.max(...CATEGORIES.map((c) => c.models.length));
const modelBarData = CATEGORIES.map((cat) => {
  const entry = { name: cat.label, _color: cat.color };
  for (let i = 0; i < MAX_MODELS; i++) {
    entry[`slot_${i}`] = cat.models[i]
      ? cat.models[i].months.reduce((s, m) => s + m.n, 0)
      : 0;
    entry[`slot_${i}_lbl`] = cat.models[i]?.model ?? null;
  }
  return entry;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtN = (n) => n.toLocaleString("fr-TN");

const pct = (curr, prev) => {
  if (!prev) return null;
  const d = ((curr - prev) / prev) * 100;
  return { label: `${Math.abs(d).toFixed(1)}% vs ${LAST_YEAR}`, up: d >= 0 };
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, trend, accentColor }) => (
  <div style={{ ...card }}>
    <p
      style={{
        margin: "0 0 6px",
        fontSize: 11,
        color: PBI.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </p>
    <p
      style={{
        margin: 0,
        fontSize: 28,
        fontWeight: 700,
        color: accentColor ?? PBI.textPrimary,
        lineHeight: 1.1,
      }}
    >
      {value}
    </p>
    {sub && (
      <p style={{ margin: "3px 0 0", fontSize: 12, color: PBI.textMuted }}>
        {sub}
      </p>
    )}
    {trend && (
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 12,
          color: trend.up ? PBI.green : PBI.red,
        }}
      >
        {trend.up ? "▲" : "▼"} {trend.label}
      </p>
    )}
  </div>
);

// ─── Donut Card ───────────────────────────────────────────────────────────────
const DonutCard = ({ year, dataKey }) => {
  const donutData = CAT_TOTALS.map((c) => ({
    name: c.label,
    value: dataKey === "n" ? c.n : c.nM1,
    color: c.color,
  }));
  const total = donutData.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${PBI.border}`,
          borderRadius: 2,
          padding: "8px 12px",
          fontFamily: PBI.font,
          fontSize: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        }}
      >
        <p
          style={{ margin: "0 0 2px", fontWeight: 600, color: d.payload.color }}
        >
          {d.name}
        </p>
        <p style={{ margin: 0, color: PBI.textPrimary }}>
          {fmtN(d.value)} units
          <span style={{ color: PBI.textMuted, marginLeft: 6 }}>
            ({total ? ((d.value / total) * 100).toFixed(1) : 0}%)
          </span>
        </p>
      </div>
    );
  };

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column" }}>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 11,
          color: PBI.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Sales Mix — Categories
      </p>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: PBI.textMuted }}>
        {year}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
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
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {donutData.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label */}
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
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: PBI.textPrimary,
                lineHeight: 1.1,
              }}
            >
              {fmtN(total)}
            </span>
            <span style={{ fontSize: 9, color: PBI.textMuted, marginTop: 2 }}>
              units
            </span>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            minWidth: 0,
            flex: 1,
          }}
        >
          {donutData.map((d, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: d.color,
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: PBI.textMuted,
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {d.name}
              </span>
              <strong
                style={{ fontSize: 10, color: PBI.textPrimary, paddingLeft: 4 }}
              >
                {((d.value / total) * 100).toFixed(1)}%
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Models per Category Stacked Bar ─────────────────────────────────────────
const SLOT_OPACITIES = [1, 0.68, 0.42];

const ModelsBarCard = () => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const cat = CATEGORIES.find((c) => c.label === label);
    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${PBI.border}`,
          borderRadius: 2,
          padding: "8px 12px",
          fontFamily: PBI.font,
          fontSize: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        }}
      >
        <p
          style={{ margin: "0 0 6px", fontWeight: 600, color: PBI.textPrimary }}
        >
          {label}
        </p>
        {payload
          .filter((p) => p.value > 0)
          .map((p, i) => {
            const slotIdx = parseInt(p.dataKey.split("_")[1]);
            const entry = modelBarData.find((d) => d.name === label);
            const modelName = entry?.[`slot_${slotIdx}_lbl`];
            return (
              <p key={i} style={{ margin: "2px 0", color: cat?.color }}>
                <span style={{ color: PBI.textMuted }}>{modelName}: </span>
                <strong>{fmtN(p.value)}</strong>
              </p>
            );
          })}
      </div>
    );
  };

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column" }}>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 11,
          color: PBI.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Sold Models per Category
      </p>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: PBI.textMuted }}>
        {THIS_YEAR} · stacked by model
      </p>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={modelBarData}
          barCategoryGap="30%"
          margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            stroke={PBI.gridLine}
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: PBI.textMuted, fontFamily: PBI.font }}
            axisLine={{ stroke: PBI.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: PBI.textMuted, fontFamily: PBI.font }}
            axisLine={{ stroke: PBI.border }}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(17,141,255,.06)" }}
          />
          {Array.from({ length: MAX_MODELS }, (_, slotIdx) => (
            <Bar
              key={slotIdx}
              dataKey={`slot_${slotIdx}`}
              stackId="a"
              maxBarSize={40}
              radius={slotIdx === MAX_MODELS - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            >
              {modelBarData.map((entry, di) => (
                <Cell
                  key={di}
                  fill={entry._color}
                  fillOpacity={SLOT_OPACITIES[slotIdx] ?? 0.3}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Category legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: cat.color,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 10, color: PBI.textMuted }}>
              {cat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── State data ──────────────────────────────────────────────────────────────
const STATES_DATA = [
  { id: "state_ariana", label: "Ariana" },
  { id: "state_beja", label: "Béja" },
  { id: "state_ben_arous", label: "Ben Arous" },
  { id: "state_bizerte", label: "Bizerte" },
  { id: "state_gabes", label: "Gabès" },
  { id: "state_gafsa", label: "Gafsa" },
  { id: "state_jendouba", label: "Jendouba" },
  { id: "state_kairouan", label: "Kairouan" },
  { id: "state_kasserine", label: "Kasserine" },
  { id: "state_kebili", label: "Kébili" },
  { id: "state_kef", label: "Le Kef" },
  { id: "state_mahdia", label: "Mahdia" },
  { id: "state_manouba", label: "Manouba" },
  { id: "state_medenine", label: "Médenine" },
  { id: "state_monastir", label: "Monastir" },
  { id: "state_nabeul", label: "Nabeul" },
  { id: "state_sfax", label: "Sfax" },
  { id: "state_sidi_bouzid", label: "Sidi Bouzid" },
  { id: "state_siliana", label: "Siliana" },
  { id: "state_sousse", label: "Sousse" },
  { id: "state_tataouine", label: "Tataouine" },
  { id: "state_tozeur", label: "Tozeur" },
  { id: "state_tunis", label: "Tunis" },
  { id: "state_zaghouan", label: "Zaghouan" },
];

const STATE_ORDERS = STATES_DATA.map((s, si) => ({
  ...s,
  months: MONTHS.map((_, mi) => ({
    n: 20 + ((si * 7 + mi * 3) % 80),
    nMinus1: 15 + ((si * 5 + mi * 2) % 70),
  })),
}));

const CURRENT_MONTH_IDX = 4; // May — update to match real current month
const LAST_MONTH_IDX = 3; // April
const CURRENT_MONTH_LABEL = MONTHS_FULL[CURRENT_MONTH_IDX];
const LAST_MONTH_LABEL = MONTHS_FULL[LAST_MONTH_IDX];

// ─── State Ranking Cards (top/bottom 5) ───────────────────────────────────────
const RANK_COLORS = ["#118DFF", "#00B294", "#8764B8", "#ECC846", "#E66C37"];

const StateRankCard = ({ title, subtitle, accentColor, states }) => (
  <div style={{ ...card }}>
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
    <p style={{ margin: "0 0 14px", fontSize: 11, color: PBI.textMuted }}>
      {subtitle}
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {states.map((s, i) => {
        const barPct =
          states[0].orders > 0 ? (s.orders / states[0].orders) * 100 : 0;
        return (
          <div key={s.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: PBI.textPrimary,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    background: accentColor,
                    borderRadius: 2,
                    width: 16,
                    height: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {s.label}
              </span>
              <strong style={{ fontSize: 13, color: accentColor }}>
                {fmtN(s.orders)}
              </strong>
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: "#F3F2F1",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  width: `${barPct}%`,
                  background: accentColor,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Breakdown Table ──────────────────────────────────────────────────────────
const TrendsTable = ({ expandedCats, toggleCat }) => {
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
    <div style={{ ...card, padding: "20px 24px", overflowX: "auto" }}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 13,
          fontWeight: 600,
          color: PBI.textPrimary,
        }}
      >
        Sales Breakdown by Category &amp; Model
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 11, color: PBI.textMuted }}>
        Units sold · click a category to expand its models · {THIS_YEAR} vs{" "}
        {LAST_YEAR} per month
      </p>

      <table
        style={{
          borderCollapse: "collapse",
          fontFamily: PBI.font,
          fontSize: 12,
          minWidth: "100%",
        }}
      >
        <thead>
          {/* Row 1 — month groups */}
          <tr>
            <th
              style={{
                ...thBase,
                textAlign: "left",
                minWidth: 170,
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
                    minWidth: 72,
                  }}
                >
                  {LAST_YEAR}
                </th>
                <th
                  key={`${m}-n`}
                  style={{ ...thBase, color: COLOR_N, minWidth: 72 }}
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
                minWidth: 80,
              }}
            >
              {LAST_YEAR}
            </th>
            <th
              style={{
                ...thBase,
                color: COLOR_N,
                background: "#EDEBE9",
                minWidth: 80,
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
              nMinus1: cat.models.reduce((s, m) => s + m.months[mi].nMinus1, 0),
            }));
            const catTotalN = catMonths.reduce((s, m) => s + m.n, 0);
            const catTotalNM1 = catMonths.reduce((s, m) => s + m.nMinus1, 0);
            const catPct = pct(catTotalN, catTotalNM1);

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
                    {catPct && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 500,
                          color: catPct.up ? PBI.green : PBI.red,
                        }}
                      >
                        {catPct.up ? "▲" : "▼"} {catPct.label}
                      </span>
                    )}
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
                        {fmtN(cm.nMinus1)}
                      </td>
                      <td
                        key={`cat-${cat.id}-${mi}-n`}
                        style={tdNum(false, false, {
                          fontWeight: 600,
                          background: "#F7F6F5",
                        })}
                      >
                        {fmtN(cm.n)}
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
                    {fmtN(catTotalNM1)}
                  </td>
                  <td
                    style={tdNum(true, false, {
                      fontWeight: 700,
                      background: "#EDEBE9",
                    })}
                  >
                    {fmtN(catTotalN)}
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
                              {fmtN(mm.nMinus1)}
                            </td>
                            <td
                              key={`mod-${mod.model}-${mi}-n`}
                              style={tdNum(false, false)}
                            >
                              {fmtN(mm.n)}
                            </td>
                          </>
                        ))}
                        <td
                          style={tdNum(true, true, {
                            borderLeft: `2px solid ${PBI.border}`,
                          })}
                        >
                          {fmtN(modTotalNM1)}
                        </td>
                        <td style={tdNum(true, false)}>{fmtN(modTotalN)}</td>
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
                  {fmtN(mt.nMinus1)}
                </td>
                <td
                  key={`gt-${mi}-n`}
                  style={tdNum(false, false, {
                    fontWeight: 700,
                    background: "#DEECF9",
                  })}
                >
                  {fmtN(mt.n)}
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
              {fmtN(totalNM1)}
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
              {fmtN(totalN)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ─── Page (inner, needs FilterProvider) ──────────────────────────────────────
function TrendsPage() {
  const [expandedCats, setExpandedCats] = useState([]);
  const toggleCat = (id) =>
    setExpandedCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const totalTrend = pct(totalN, totalNM1);
  const highestTrend = pct(highest.n, highest.nM1);
  const lowestTrend = pct(lowest.n, lowest.nM1);

  // State rankings
  const byCurrentDesc = [...STATE_ORDERS].sort(
    (a, b) => b.months[CURRENT_MONTH_IDX].n - a.months[CURRENT_MONTH_IDX].n,
  );
  const byLastDesc = [...STATE_ORDERS].sort(
    (a, b) => b.months[LAST_MONTH_IDX].n - a.months[LAST_MONTH_IDX].n,
  );

  const top5Current = byCurrentDesc
    .slice(0, 5)
    .map((s) => ({ ...s, orders: s.months[CURRENT_MONTH_IDX].n }));
  const top5Last = byLastDesc
    .slice(0, 5)
    .map((s) => ({ ...s, orders: s.months[LAST_MONTH_IDX].n }));
  const bottom5Current = byCurrentDesc
    .slice(-5)
    .reverse()
    .map((s) => ({ ...s, orders: s.months[CURRENT_MONTH_IDX].n }));
  const bottom5Last = byLastDesc
    .slice(-5)
    .reverse()
    .map((s) => ({ ...s, orders: s.months[LAST_MONTH_IDX].n }));

  return (
    <div
      style={{
        background: PBI.pageBg,
        minHeight: "100vh",
        padding: "20px 24px",
        fontFamily: PBI.font,
      }}
    >
      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: PBI.textPrimary,
          }}
        >
          Trends &amp; Client Base
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: PBI.textMuted }}>
          Sales Trends · {THIS_YEAR} vs {LAST_YEAR}
        </p>
      </div>

      <FilterBar style={{ marginBottom: 12 }} />


      {/* ── Row 1: 4 KPI cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
          alignItems: "stretch",
        }}
      >
        <KpiCard
          label="Total Sales"
          value={fmtN(totalN)}
          sub={`${fmtN(totalNM1)} in ${LAST_YEAR}`}
          trend={totalTrend}
        />
        <KpiCard
          label="Total Categories"
          value={String(CATEGORIES.length)}
          sub={`${CATEGORIES.reduce((s, c) => s + c.models.length, 0)} models tracked`}
        />
        {/* Highest selling category */}
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 11,
              color: PBI.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Highest Selling Category
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              margin: "8px 0 5px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 11,
                height: 11,
                borderRadius: 2,
                background: highest.color,
                flexShrink: 0,
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: PBI.textPrimary,
              }}
            >
              {highest.label}
            </p>
          </div>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 22,
              fontWeight: 700,
              color: PBI.green,
              lineHeight: 1.1,
            }}
          >
            {fmtN(highest.n)}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: PBI.textMuted,
                marginLeft: 4,
              }}
            >
              units
            </span>
          </p>
          {highestTrend && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: highestTrend.up ? PBI.green : PBI.red,
              }}
            >
              {highestTrend.up ? "▲" : "▼"} {highestTrend.label}
            </p>
          )}
        </div>
        {/* Lowest selling category */}
        <div style={{ ...card }}>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 11,
              color: PBI.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Lowest Selling Category
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              margin: "8px 0 5px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 11,
                height: 11,
                borderRadius: 2,
                background: lowest.color,
                flexShrink: 0,
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: PBI.textPrimary,
              }}
            >
              {lowest.label}
            </p>
          </div>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 22,
              fontWeight: 700,
              color: PBI.red,
              lineHeight: 1.1,
            }}
          >
            {fmtN(lowest.n)}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: PBI.textMuted,
                marginLeft: 4,
              }}
            >
              units
            </span>
          </p>
          {lowestTrend && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: lowestTrend.up ? PBI.green : PBI.red,
              }}
            >
              {lowestTrend.up ? "▲" : "▼"} {lowestTrend.label}
            </p>
          )}
        </div>
      </div>

      {/* ── Row 2: Donut n | Donut n-1 | Models bar ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1.2fr",
          gap: 12,
          marginBottom: 16,
          alignItems: "stretch",
        }}
      >
        <DonutCard year={THIS_YEAR} dataKey="n" />
        <DonutCard year={LAST_YEAR} dataKey="nM1" />
        <ModelsBarCard />
      </div>

      {/* ── Breakdown table ── */}
      <TrendsTable expandedCats={expandedCats} toggleCat={toggleCat} />
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function ATrends() {
  return (
    <FilterProvider>
      <TrendsPage />
    </FilterProvider>
  );
}
