/**
 * CommercialRevenue.jsx — Revenue Dashboard (Commercial scope)
 *
 * Data sources:
 *   useMeRevenueKpis       → 4 KPI cards + win rate
 *   useMeRevenueMonthly    → bar chart
 *   useMeRevenueByCategory → category donut
 *   useMeRecentSales       → recent deals table
 */

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useFilter } from "../../components/FilterContext"; // year filter
import { FilterProvider, FilterBar } from "../../components/CommercialFilterContext";
import Layout from "../../components/Layout";
import {
  useMeRevenueKpis,
  useMeRevenueMonthly,
  useMeRevenueByCategory,
  useMeRecentSales,
  buildCategories,
} from "../../hooks/dashboardHooks";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const PBI = {
  colors: ["#118DFF","#E66C37","#12239E","#ECC846","#00B5D0","#8764B8","#D13438","#107C10"],
  pageBg: "#F3F2F1", border: "#E1DFDD", cardBg: "#FFFFFF",
  textPrimary: "#252423", textMuted: "#605E5C", gridLine: "#E1DFDD",
  font: "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
  green: "#107C10", red: "#D13438",
};
const card = {
  background: PBI.cardBg, border: `1px solid ${PBI.border}`, borderRadius: 4,
  padding: "20px 24px 16px", fontFamily: PBI.font,
  boxShadow: "0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)",
};

const THIS_YEAR = new Date().getFullYear();
const LAST_YEAR = THIS_YEAR - 1;
const COLOR_N   = "#118DFF";
const COLOR_NM1 = "#E66C37";
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now         = new Date();
const CUR_IDX     = now.getMonth();
const PREV_IDX    = CUR_IDX > 0 ? CUR_IDX - 1 : 11;

const fmt      = (n) => new Intl.NumberFormat("fr-TN", { style:"currency", currency:"TND", maximumFractionDigits:0 }).format(n ?? 0);
const fmtShort = (n) => { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M TND`; if (n >= 1e3) return `${(n/1e3).toFixed(0)}k TND`; return `${n ?? 0} TND`; };
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("fr-TN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const pct      = (curr, prev) => { if (!prev) return null; const d = ((curr-prev)/prev)*100; return { label:`${Math.abs(d).toFixed(1)}% vs ${LAST_YEAR}`, up:d>=0 }; };

const Spinner  = () => <div style={{ padding:24, textAlign:"center", color:PBI.textMuted, fontFamily:PBI.font, fontSize:12 }}>Loading…</div>;
const ErrMsg   = ({ msg }) => <div style={{ padding:24, textAlign:"center", color:PBI.red, fontFamily:PBI.font, fontSize:12 }}>{msg}</div>;

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, trend, accentColor, sub }) => (
  <div style={{ ...card, padding:"16px 20px", borderTop:`3px solid ${accentColor||PBI.border}` }}>
    <p style={{ margin:"0 0 6px", fontSize:11, color:PBI.textMuted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</p>
    <p style={{ margin:0, fontSize:24, fontWeight:700, color:accentColor||PBI.textPrimary, lineHeight:1.2 }}>{value}</p>
    {sub   && <p style={{ margin:"3px 0 0", fontSize:11, color:PBI.textMuted }}>{sub}</p>}
    {trend && <p style={{ margin:"6px 0 0", fontSize:12, color:trend.up?PBI.green:PBI.red }}>{trend.up?"▲":"▼"} {trend.label}</p>}
  </div>
);

// ─── Win-rate ring ─────────────────────────────────────────────────────────────
const WinRateCard = ({ won, lost }) => {
  const total   = (won ?? 0) + (lost ?? 0);
  const winPct  = total ? +((won / total) * 100).toFixed(1) : 0;
  const ringData = [
    { name:"Won",  value: won  ?? 0, color: PBI.green },
    { name:"Lost", value: lost ?? 0, color: PBI.red   },
  ];
  return (
    <div style={{ ...card, padding:"16px 20px", display:"flex", alignItems:"center", gap:20 }}>
      <div style={{ position:"relative", width:110, height:110, flexShrink:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ringData} cx="50%" cy="50%" innerRadius="56%" outerRadius="80%" dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
              {ringData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
            </Pie>
            <Tooltip formatter={(val, name) => [val.toLocaleString(), name]} contentStyle={{ fontFamily:PBI.font, fontSize:11, border:`1px solid ${PBI.border}`, borderRadius:2 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <span style={{ fontSize:18, fontWeight:700, color:winPct>=50?PBI.green:PBI.red, lineHeight:1.1 }}>{winPct}%</span>
          <span style={{ fontSize:8, color:PBI.textMuted, marginTop:2 }}>win rate</span>
        </div>
      </div>
      <div style={{ flex:1 }}>
        <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:600, color:PBI.textPrimary }}>Quote Win Rate — {THIS_YEAR}</p>
        {ringData.map((d, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:d.color, display:"inline-block" }} />
              <span style={{ fontSize:11, color:PBI.textMuted }}>{d.name}</span>
            </div>
            <div style={{ textAlign:"right" }}>
              <strong style={{ fontSize:13, color:d.color }}>{d.value.toLocaleString()}</strong>
              <span style={{ fontSize:10, color:PBI.textMuted, marginLeft:4 }}>({total ? ((d.value/total)*100).toFixed(1) : 0}%)</span>
            </div>
          </div>
        ))}
        <div style={{ height:4, borderRadius:2, background:"#F3F2F1", marginTop:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${winPct}%`, background:PBI.green, borderRadius:2, transition:"width .4s ease" }} />
        </div>
      </div>
    </div>
  );
};

// ─── Monthly bar chart ─────────────────────────────────────────────────────────
const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:`1px solid ${PBI.border}`, borderRadius:2, padding:"10px 14px", fontFamily:PBI.font, boxShadow:"0 4px 16px rgba(0,0,0,.18)", fontSize:12, pointerEvents:"none" }}>
      {label && <p style={{ margin:"0 0 6px", fontWeight:600, color:PBI.textPrimary }}>{label}</p>}
      {payload.map((e, i) => <p key={i} style={{ margin:"2px 0", color:e.fill }}><span style={{ color:PBI.textMuted }}>{e.name}: </span><strong>{fmt(e.value)}</strong></p>)}
    </div>
  );
};

const RevenueBarChart = ({ monthlyTotals }) => {
  const data = monthlyTotals.map((m) => ({ month:m.abbr, [LAST_YEAR]:m.nMinus1, [THIS_YEAR]:m.n }));
  return (
    <div style={{ ...card, marginBottom:16 }}>
      <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:PBI.textPrimary }}>Monthly Revenue — {THIS_YEAR} vs {LAST_YEAR}</p>
      <p style={{ margin:"0 0 12px", fontSize:11, color:PBI.textMuted }}>Your personal sales · year-over-year by month</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="30%" barGap={3} margin={{ top:4, right:8, left:8, bottom:0 }}>
          <CartesianGrid stroke={PBI.gridLine} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize:11, fill:PBI.textMuted, fontFamily:PBI.font }} axisLine={{ stroke:PBI.border }} tickLine={false} />
          <YAxis tick={{ fontSize:11, fill:PBI.textMuted, fontFamily:PBI.font }} axisLine={false} tickLine={false} tickFormatter={(v) => v>=1000?`${(v/1000).toFixed(0)}k`:v} />
          <Tooltip content={<PBITooltip />} cursor={{ fill:"rgba(17,141,255,.06)" }} />
          <Legend wrapperStyle={{ fontSize:11, fontFamily:PBI.font, paddingTop:8 }} formatter={(val) => <span style={{ color:PBI.textMuted }}>{val}</span>} />
          <Bar dataKey={LAST_YEAR} name={String(LAST_YEAR)} fill={COLOR_NM1} radius={[2,2,0,0]} maxBarSize={28} />
          <Bar dataKey={THIS_YEAR} name={String(THIS_YEAR)} fill={COLOR_N}   radius={[2,2,0,0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Category donut ────────────────────────────────────────────────────────────
const CategoryDonut = ({ categories }) => {
  const donutData = categories.map((c) => ({
    name:  c.label,
    value: c.models.flatMap((m) => m.months).reduce((s, mo) => s + (mo.n ?? 0), 0),
    color: c.color,
  }));
  const total = donutData.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ ...card, padding:"16px 20px" }}>
      <p style={{ margin:"0 0 2px", fontSize:12, fontWeight:600, color:PBI.textPrimary }}>Revenue by Category</p>
      <p style={{ margin:"0 0 12px", fontSize:10, color:PBI.textMuted }}>{THIS_YEAR} · all categories</p>
      <div style={{ display:"flex", alignItems:"center", gap:20 }}>
        <div style={{ position:"relative", width:130, height:130, flexShrink:0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip formatter={(val, name) => [fmtShort(val), name]} contentStyle={{ fontFamily:PBI.font, fontSize:11, border:`1px solid ${PBI.border}`, borderRadius:2 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <span style={{ fontSize:13, fontWeight:700, color:PBI.textPrimary, lineHeight:1.1 }}>{fmtShort(total)}</span>
            <span style={{ fontSize:8, color:PBI.textMuted, marginTop:2 }}>total</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minWidth:0 }}>
          {donutData.map((d, i) => {
            const share = total ? ((d.value/total)*100).toFixed(1) : 0;
            return (
              <div key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:d.color, display:"inline-block", flexShrink:0 }} />
                    <span style={{ fontSize:11, color:PBI.textMuted }}>{d.name}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:PBI.textPrimary }}>{fmtShort(d.value)}</span>
                    <span style={{ fontSize:10, color:PBI.textMuted }}>{share}%</span>
                  </div>
                </div>
                <div style={{ height:3, background:"#F3F2F1", borderRadius:2 }}>
                  <div style={{ height:"100%", borderRadius:2, width:`${share}%`, background:d.color, transition:"width .3s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Recent sales table ────────────────────────────────────────────────────────
const STATUS_COLORS = { Completed:"#107C10", Pending:"#E66C37", Cancelled:"#D13438" };

const RecentSalesTable = ({ rows }) => {
  const thStyle = { padding:"9px 14px", fontSize:11, fontWeight:600, color:PBI.textMuted, background:"#F3F2F1", borderBottom:`1px solid ${PBI.border}`, whiteSpace:"nowrap", textAlign:"left", fontFamily:PBI.font };
  const tdStyle = (right) => ({ padding:"9px 14px", fontSize:12, color:PBI.textPrimary, borderBottom:`1px solid ${PBI.border}`, whiteSpace:"nowrap", textAlign:right?"right":"left", fontFamily:PBI.font });
  return (
    <div style={{ ...card, padding:0, overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${PBI.border}` }}>
        <p style={{ margin:0, fontSize:13, fontWeight:600, color:PBI.textPrimary }}>Recent Deals</p>
        <p style={{ margin:"2px 0 0", fontSize:11, color:PBI.textMuted }}>Your latest closed sales</p>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", fontFamily:PBI.font }}>
          <thead>
            <tr>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign:"right" }}>Value</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ ...tdStyle(), textAlign:"center", color:PBI.textMuted, padding:"24px 14px" }}>No recent sales found.</td></tr>
            )}
            {rows.map((row, i) => {
              const rowBg = i % 2 === 0 ? "#fff" : "#FAFAF9";
              return (
                <tr key={row.sale_id ?? i} style={{ background:rowBg }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F2F1")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                >
                  <td style={tdStyle()}>{row.client ?? "—"}</td>
                  <td style={tdStyle()}>{row.product ?? "—"}</td>
                  <td style={tdStyle()}>
                    <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:2, fontSize:11, fontWeight:600, background:"#DEECF9", color:"#004E8C" }}>
                      {row.category ?? "—"}
                    </span>
                  </td>
                  <td style={tdStyle(true)}><strong style={{ color:COLOR_N }}>{fmt(row.value)}</strong></td>
                  <td style={{ ...tdStyle(), color:PBI.textMuted }}>{fmtDate(row.date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Page inner ────────────────────────────────────────────────────────────────
function CommercialRevenueInner() {
  const { selectedYear } = useFilter();

  const { data:kpiData,     loading:l1, error:e1 } = useMeRevenueKpis(selectedYear);
  const { data:monthlyData, loading:l2, error:e2 } = useMeRevenueMonthly(selectedYear);
  const { data:catData,     loading:l3, error:e3 } = useMeRevenueByCategory(selectedYear);
  const { data:salesData,   loading:l4, error:e4 } = useMeRecentSales(10);

  const monthlyTotals = useMemo(() => {
    const rows = monthlyData?.rows ?? [];
    return MONTHS.map((abbr, i) => {
      const row = rows.find((r) => r.month === i + 1) ?? {};
      return { abbr, full:MONTHS_FULL[i], n:Number(row.n ?? 0), nMinus1:Number(row.n_minus1 ?? 0) };
    });
  }, [monthlyData]);

  const categories = useMemo(() => buildCategories(catData?.rows ?? []), [catData]);

  const rev      = kpiData?.revenue   ?? {};
  const deals    = kpiData?.deals     ?? {};
  const wonQ     = kpiData?.quotes_won  ?? 0;
  const lostQ    = kpiData?.quotes_lost ?? 0;
  const recentRows = salesData?.rows ?? [];

  const kpis = [
    { label:"Total Revenue",          value:fmt(rev.total_n),      trend:pct(rev.total_n, rev.total_nm1),       accentColor:COLOR_N },
    { label:`Revenue — ${MONTHS_FULL[CUR_IDX]}`, value:fmt(rev.this_month_n), trend:pct(rev.this_month_n, rev.this_month_nm1), accentColor:"#12239E" },
    { label:`Revenue — ${MONTHS_FULL[PREV_IDX]}`, value:fmt(rev.last_month_n), sub:`vs ${fmt(rev.this_month_nm1 ?? 0)} in ${LAST_YEAR}`, accentColor:"#E66C37" },
    { label:"Deals Closed",           value:(deals.total ?? 0).toLocaleString(), sub:`${(deals.this_month ?? 0)} this month · ${(deals.total_nm1 ?? 0)} in ${LAST_YEAR}`, accentColor:PBI.colors[7] },
  ];

  if (l1 || l2 || l3 || l4) return <Spinner />;
  if (e1 || e2 || e3 || e4) return <ErrMsg msg={e1 ?? e2 ?? e3 ?? e4} />;

  return (
    <div style={{ background:PBI.pageBg, minHeight:"100vh", padding:"20px 24px", fontFamily:PBI.font }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:600, color:PBI.textPrimary }}>My Revenue</h1>
        <p style={{ margin:"2px 0 0", fontSize:12, color:PBI.textMuted }}>{THIS_YEAR} vs {LAST_YEAR}</p>
      </div>
      <FilterBar style={{ marginBottom:14 }} />

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Bar chart */}
      <RevenueBarChart monthlyTotals={monthlyTotals} />

      {/* Donut + win rate */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <CategoryDonut categories={categories} />
        <WinRateCard won={wonQ} lost={lostQ} />
      </div>

      {/* Recent sales */}
      <RecentSalesTable rows={recentRows} />
    </div>
  );
}

export default function CommercialRevenue() {
  return <Layout><FilterProvider><CommercialRevenueInner /></FilterProvider></Layout>;
}
