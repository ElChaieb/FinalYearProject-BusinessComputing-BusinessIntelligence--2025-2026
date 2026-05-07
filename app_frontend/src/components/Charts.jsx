import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ComposedChart,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── Power BI design tokens ───────────────────────────────────────────────────
const PBI = {
  colors: [
    "#118DFF", // blue       (primary)
    "#E66C37", // orange
    "#12239E", // dark blue
    "#ECC846", // yellow
    "#00B5D0", // teal
    "#8764B8", // purple
    "#D13438", // red
    "#107C10", // green
  ],
  bg:          "#FFFFFF",
  cardBg:      "#FFFFFF",
  pageBg:      "#F3F2F1",
  border:      "#E1DFDD",
  textPrimary: "#252423",
  textMuted:   "#605E5C",
  gridLine:    "#E1DFDD",
  font:        "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
};

// ─── Shared card wrapper ──────────────────────────────────────────────────────
const cardStyle = {
  background: PBI.cardBg,
  border: `1px solid ${PBI.border}`,
  borderRadius: 4,
  padding: "20px 24px 16px",
  fontFamily: PBI.font,
  boxShadow: "0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)",
};

const titleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: PBI.textPrimary,
  marginBottom: 4,
  letterSpacing: 0.1,
};

const subtitleStyle = {
  fontSize: 11,
  color: PBI.textMuted,
  marginBottom: 16,
};

// ─── Shared axis / grid props ─────────────────────────────────────────────────
const axisProps = {
  tick:        { fontSize: 11, fill: PBI.textMuted, fontFamily: PBI.font },
  axisLine:    { stroke: PBI.border },
  tickLine:    false,
};

const gridProps = {
  stroke:          PBI.gridLine,
  strokeDasharray: "0",         // Power BI uses solid hairlines, not dashes
  vertical:        false,
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${PBI.border}`,
        borderRadius: 2,
        padding: "8px 12px",
        fontFamily: PBI.font,
        boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        fontSize: 12,
      }}
    >
      {label && (
        <p style={{ margin: "0 0 6px", fontWeight: 600, color: PBI.textPrimary }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: "2px 0", color: entry.color }}>
          <span style={{ color: PBI.textMuted }}>{entry.name}: </span>
          <strong>{entry.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Custom legend ────────────────────────────────────────────────────────────
const PBILegend = ({ payload }) => (
  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
    {payload.map((entry, i) => (
      <span
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color: PBI.textMuted,
          fontFamily: PBI.font,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 1,
            background: entry.color,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {entry.value}
      </span>
    ))}
  </div>
);

// ─── Custom pie label ─────────────────────────────────────────────────────────
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const r  = outerRadius + 22;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text
      x={x}
      y={y}
      fill={PBI.textMuted}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: 11, fontFamily: PBI.font }}
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  1. BarChart
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Power BI–styled bar chart.
 *
 * @param {string}   title      - Card heading
 * @param {string}   [subtitle] - Optional card subheading
 * @param {Array}    data       - Array of data objects
 * @param {string}   xKey       - Key for the X axis (category)
 * @param {string[]} yKeys      - Keys for the bars (one bar per key)
 * @param {number}   [height]   - Chart height in px (default 260)
 */
export function PBIBarChart({ title, subtitle, data, xKey, yKeys, height = 260 }) {
  return (
    <div style={cardStyle}>
      {title    && <p style={titleStyle}>{title}</p>}
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap="35%" barGap={3}
          margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<PBITooltip />} cursor={{ fill: "rgba(17,141,255,.06)" }} />
          <Legend content={<PBILegend />} />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={PBI.colors[i % PBI.colors.length]}
              radius={[2, 2, 0, 0]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. LineChart
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Power BI–styled line chart.
 *
 * @param {string}   title
 * @param {string}   [subtitle]
 * @param {Array}    data
 * @param {string}   xKey
 * @param {string[]} yKeys
 * @param {number}   [height]
 */
export function PBILineChart({ title, subtitle, data, xKey, yKeys, height = 260 }) {
  return (
    <div style={cardStyle}>
      {title    && <p style={titleStyle}>{title}</p>}
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<PBITooltip />} />
          <Legend content={<PBILegend />} />
          {yKeys.map((key, i) => (
            <Line key={key} type="linear" dataKey={key}
              stroke={PBI.colors[i % PBI.colors.length]}
              strokeWidth={2.5}
              dot={{ r: 3, fill: PBI.colors[i % PBI.colors.length], strokeWidth: 0 }}
              activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. AreaChart
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Power BI–styled area chart.
 *
 * @param {string}   title
 * @param {string}   [subtitle]
 * @param {Array}    data
 * @param {string}   xKey
 * @param {string[]} yKeys
 * @param {boolean}  [stacked]  - Stack areas (default false)
 * @param {number}   [height]
 */
export function PBIAreaChart({ title, subtitle, data, xKey, yKeys, stacked = false, height = 260 }) {
  return (
    <div style={cardStyle}>
      {title    && <p style={titleStyle}>{title}</p>}
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {yKeys.map((key, i) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PBI.colors[i % PBI.colors.length]} stopOpacity={0.18} />
                <stop offset="95%" stopColor={PBI.colors[i % PBI.colors.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<PBITooltip />} />
          <Legend content={<PBILegend />} />
          {yKeys.map((key, i) => (
            <Area key={key} type="linear" dataKey={key}
              stroke={PBI.colors[i % PBI.colors.length]}
              strokeWidth={2.5}
              fill={`url(#grad-${key})`}
              stackId={stacked ? "stack" : undefined}
              dot={{ r: 3, fill: PBI.colors[i % PBI.colors.length], strokeWidth: 0 }}
              activeDot={{ r: 5 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. PieChart / Donut
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Power BI–styled donut/pie chart.
 *
 * @param {string}  title
 * @param {string}  [subtitle]
 * @param {Array}   data       - Array of { name, value }
 * @param {boolean} [donut]    - Render as donut (default true)
 * @param {number}  [height]
 */
export function PBIPieChart({ title, subtitle, data, donut = true, height = 280 }) {
  const inner = donut ? "52%" : "0%";
  return (
    <div style={cardStyle}>
      {title    && <p style={titleStyle}>{title}</p>}
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius="68%"
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderPieLabel}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PBI.colors[i % PBI.colors.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<PBITooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* manual legend below the chart */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
        {data.map((entry, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, color: PBI.textMuted, fontFamily: PBI.font }}>
            <span style={{ width: 10, height: 10, borderRadius: 1,
              background: PBI.colors[i % PBI.colors.length], display: "inline-block" }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. ComposedChart  (Bar + Line)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Power BI–styled composed chart (bars + overlay lines).
 *
 * @param {string}   title
 * @param {string}   [subtitle]
 * @param {Array}    data
 * @param {string}   xKey
 * @param {string[]} barKeys    - Keys rendered as bars
 * @param {string[]} lineKeys   - Keys rendered as lines on top
 * @param {number}   [height]
 */
export function PBIComposedChart({ title, subtitle, data, xKey, barKeys, lineKeys, height = 280 }) {
  const allKeys   = [...barKeys, ...lineKeys];
  const lineStart = barKeys.length;              // color offset for lines
  return (
    <div style={cardStyle}>
      {title    && <p style={titleStyle}>{title}</p>}
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} barCategoryGap="35%"
          margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<PBITooltip />} cursor={{ fill: "rgba(17,141,255,.06)" }} />
          <Legend content={<PBILegend />} />
          {barKeys.map((key, i) => (
            <Bar key={key} dataKey={key}
              fill={PBI.colors[i % PBI.colors.length]}
              radius={[2, 2, 0, 0]} maxBarSize={48} />
          ))}
          {lineKeys.map((key, i) => (
            <Line key={key} type="linear" dataKey={key}
              stroke={PBI.colors[(lineStart + i) % PBI.colors.length]}
              strokeWidth={2.5}
              dot={{ r: 3, fill: PBI.colors[(lineStart + i) % PBI.colors.length], strokeWidth: 0 }}
              activeDot={{ r: 5 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. KPI card  (bonus — like Power BI's card visual)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Power BI–styled KPI card.
 *
 * @param {string} label
 * @param {string|number} value
 * @param {string} [trend]   - e.g. "+12.4%" shown in green/red
 * @param {string} [trendDir] - "up" | "down" (controls color)
 */
export function PBICard({ label, value, trend, trendDir = "up" }) {
  const trendColor = trendDir === "up" ? "#107C10" : "#D13438";
  return (
    <div style={{ ...cardStyle, padding: "16px 20px" }}>
      <p style={{ ...subtitleStyle, marginBottom: 6 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 600,
        color: PBI.textPrimary, fontFamily: PBI.font, lineHeight: 1.2 }}>
        {value}
      </p>
      {trend && (
        <p style={{ margin: "4px 0 0", fontSize: 12,
          color: trendColor, fontFamily: PBI.font }}>
          {trend}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Export palette for reuse elsewhere
// ─────────────────────────────────────────────────────────────────────────────
export { PBI };
