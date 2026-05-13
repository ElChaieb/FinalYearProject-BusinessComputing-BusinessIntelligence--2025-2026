/**
 * DirectorRevenue.jsx — Revenue Dashboard (Director / Global scope)
 *
 * Data sources (all cached per session):
 *   useGlobalRevenueMonthly   → KPI cards + bar chart
 *   useGlobalRevenueByCategory → breakdown table
 *   useGlobalRevenueByAgency   → 4 agency donut cards
 *
 * Year defaults to current year; n-1 is always current year − 1.
 */

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useFilter } from "../../components/FilterContext"; // year filter
import { FilterProvider, FilterBar } from "../../components/FilterContext";
import Layout from "../../components/Layout";
import {
  useGlobalRevenueMonthly,
  useGlobalRevenueByCategory,
  useGlobalRevenueByAgency,
  buildCategories,
  buildEntityRevenue,
  paletteColor,
} from "../../hooks/dashboardHooks";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PBI = {
  colors: ["#118DFF","#E66C37","#12239E","#ECC846","#00B5D0","#8764B8","#D13438","#107C10"],
  pageBg: "#F3F2F1", border: "#E1DFDD", cardBg: "#FFFFFF",
  textPrimary: "#252423", textMuted: "#605E5C", gridLine: "#E1DFDD",
  font: "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
  green: "#107C10", red: "#D13438",
};
const card = { background: PBI.cardBg, border: `1px solid ${PBI.border}`, borderRadius: 4, padding: "20px 24px 16px", fontFamily: PBI.font, boxShadow: "0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)" };

const COLOR_N   = "#118DFF";
const COLOR_NM1 = "#E66C37";
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmt = (n) => new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtShort = (n) => { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M TND`; if (n >= 1e3) return `${(n/1e3).toFixed(0)}k TND`; return `${n} TND`; };
const pct = (curr, prev, prevYear) => { if (!prev) return null; const d = ((curr - prev) / prev) * 100; return { label: `${Math.abs(d).toFixed(1)}% vs ${prevYear}`, up: d >= 0 }; };

// ─── Loading / Error placeholders ─────────────────────────────────────────────
const Spinner = () => <div style={{ padding: 24, textAlign: "center", color: PBI.textMuted, fontFamily: PBI.font, fontSize: 12 }}>Loading…</div>;
const Err = ({ msg }) => <div style={{ padding: 24, textAlign: "center", color: PBI.red, fontFamily: PBI.font, fontSize: 12 }}>{msg}</div>;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, trend }) => (
  <div style={{ ...card, padding: "16px 20px" }}>
    <p style={{ margin: "0 0 6px", fontSize: 11, color: PBI.textMuted }}>{label}</p>
    <p style={{ margin: 0, fontSize: 26, fontWeight: 600, color: PBI.textPrimary, lineHeight: 1.2 }}>{value}</p>
    {trend && <p style={{ margin: "4px 0 0", fontSize: 12, color: trend.up ? PBI.green : PBI.red }}>{trend.up ? "▲" : "▼"} {trend.label}</p>}
  </div>
);

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:`1px solid ${PBI.border}`, borderRadius:2, padding:"10px 14px", fontFamily:PBI.font, boxShadow:"0 4px 16px rgba(0,0,0,.18)", fontSize:12, pointerEvents:"none" }}>
      {label && <p style={{ margin:"0 0 6px", fontWeight:600, color:PBI.textPrimary }}>{label}</p>}
      {payload.map((e, i) => (
        <p key={i} style={{ margin:"2px 0", color:e.fill }}>
          <span style={{ color:PBI.textMuted }}>{e.name}: </span><strong>{fmt(e.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Bar chart ────────────────────────────────────────────────────────────────
const RevenueBarChart = ({ monthlyTotals, yearN, yearNm1 }) => {
  const data = monthlyTotals.map((m) => ({ month: m.abbr, [yearNm1]: m.nMinus1, [yearN]: m.n }));
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:PBI.textPrimary }}>Monthly Revenue — {yearN} vs {yearNm1}</p>
      <p style={{ margin:"0 0 12px", fontSize:11, color:PBI.textMuted }}>All categories combined · year-over-year by month</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="30%" barGap={3} margin={{ top:4, right:8, left:8, bottom:0 }}>
          <CartesianGrid stroke={PBI.gridLine} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize:11, fill:PBI.textMuted, fontFamily:PBI.font }} axisLine={{ stroke:PBI.border }} tickLine={false} />
          <YAxis tick={{ fontSize:11, fill:PBI.textMuted, fontFamily:PBI.font }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <Tooltip content={<PBITooltip />} cursor={{ fill:"rgba(17,141,255,.06)" }} />
          <Legend wrapperStyle={{ fontSize:11, fontFamily:PBI.font, paddingTop:8 }} formatter={(val) => <span style={{ color:PBI.textMuted }}>{val}</span>} />
          <Bar dataKey={yearNm1} name={String(yearNm1)} fill={COLOR_NM1} radius={[2,2,0,0]} maxBarSize={28} />
          <Bar dataKey={yearN} name={String(yearN)} fill={COLOR_N}   radius={[2,2,0,0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Agency donut card ────────────────────────────────────────────────────────
const AgencyDonutCard = ({ title, subtitle, slices }) => {
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ ...card, padding:"16px 20px" }}>
      <p style={{ margin:"0 0 2px", fontSize:12, fontWeight:600, color:PBI.textPrimary }}>{title}</p>
      <p style={{ margin:"0 0 12px", fontSize:10, color:PBI.textMuted }}>{subtitle}</p>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ position:"relative", width:120, height:120, flexShrink:0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} cx="50%" cy="50%" innerRadius="54%" outerRadius="78%" dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                {slices.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip formatter={(val, name) => [fmtShort(val), name]} contentStyle={{ fontFamily:PBI.font, fontSize:11, border:`1px solid ${PBI.border}`, borderRadius:2 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <span style={{ fontSize:13, fontWeight:700, color:PBI.textPrimary, lineHeight:1.1 }}>{fmtShort(total)}</span>
            <span style={{ fontSize:8, color:PBI.textMuted, marginTop:2 }}>total</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, minWidth:0, flex:1 }}>
          {slices.map((d, i) => {
            const share = total ? ((d.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:1, flexShrink:0, background:d.color, display:"inline-block" }} />
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:4 }}>
                    <span style={{ fontSize:10, color:PBI.textMuted, whiteSpace:"nowrap" }}>{d.name}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:PBI.textPrimary, whiteSpace:"nowrap" }}>{share}%</span>
                  </div>
                  <div style={{ height:3, background:"#F3F2F1", borderRadius:2, marginTop:2 }}>
                    <div style={{ height:"100%", borderRadius:2, width:`${share}%`, background:d.color, transition:"width .3s ease" }} />
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

// ─── Breakdown table (same as original, but data is prop-driven) ──────────────
const RevenueTable = ({ categories, expandedCats, toggleCat, yearN, yearNm1 }) => {
  const allModels = categories.flatMap((c) => c.models);
  const monthlyTotals = MONTHS.map((abbr, i) => ({
    abbr,
    n:       allModels.reduce((s, m) => s + (m.months[i]?.n       ?? 0), 0),
    nMinus1: allModels.reduce((s, m) => s + (m.months[i]?.nMinus1 ?? 0), 0),
  }));
  const totalN   = monthlyTotals.reduce((s, m) => s + m.n,       0);
  const totalNM1 = monthlyTotals.reduce((s, m) => s + m.nMinus1, 0);

  const thBase = { padding:"7px 10px", fontSize:11, fontWeight:600, color:PBI.textMuted, background:"#F3F2F1", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, whiteSpace:"nowrap", textAlign:"center" };
  const tdNum  = (isTotal, isNM1, override = {}) => ({ padding:"5px 10px", fontSize:12, textAlign:"right", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, whiteSpace:"nowrap", background: isTotal ? "#F3F2F1" : "#fff", fontWeight: isTotal ? 600 : 400, color: isNM1 ? PBI.textMuted : PBI.textPrimary, ...override });

  return (
    <div style={{ padding:"20px 0px" }}>
      <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:PBI.textPrimary }}>Revenue Breakdown by Category &amp; Model</p>
      <p style={{ margin:"0 0 12px", fontSize:11, color:PBI.textMuted }}>Click a category to expand · {yearN} vs {yearNm1} per month</p>
      <div style={{ ...card, overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", fontFamily:PBI.font, fontSize:12, minWidth:"100%" }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign:"left", minWidth:160, position:"sticky", left:0, zIndex:3 }}>Category / Model</th>
              {MONTHS.map((m) => <th key={m} colSpan={2} style={{ ...thBase, textAlign:"center", borderLeft:`1px solid ${PBI.border}` }}>{m}</th>)}
              <th colSpan={2} style={{ ...thBase, textAlign:"center", borderLeft:`2px solid ${PBI.border}`, background:"#EDEBE9", color:PBI.textPrimary }}>Total</th>
            </tr>
            <tr>
              <th style={{ ...thBase, textAlign:"left", position:"sticky", left:0, zIndex:3 }} />
              {MONTHS.map((m) => (
                <>
                  <th key={`${m}-nm1`} style={{ ...thBase, color:COLOR_NM1, borderLeft:`1px solid ${PBI.border}`, minWidth:88 }}>{yearNm1}</th>
                  <th key={`${m}-n`}   style={{ ...thBase, color:COLOR_N,   minWidth:88 }}>{yearN}</th>
                </>
              ))}
              <th style={{ ...thBase, color:COLOR_NM1, borderLeft:`2px solid ${PBI.border}`, background:"#EDEBE9", minWidth:88 }}>{yearNm1}</th>
              <th style={{ ...thBase, color:COLOR_N,   background:"#EDEBE9", minWidth:88 }}>{yearN}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const isOpen = expandedCats.includes(cat.id);
              const catMonths = MONTHS.map((_, mi) => ({ n: cat.models.reduce((s, m) => s + (m.months[mi]?.n ?? 0), 0), nMinus1: cat.models.reduce((s, m) => s + (m.months[mi]?.nMinus1 ?? 0), 0) }));
              const catTotalN   = catMonths.reduce((s, m) => s + m.n,       0);
              const catTotalNM1 = catMonths.reduce((s, m) => s + m.nMinus1, 0);
              return (
                <>
                  <tr key={cat.id} onClick={() => toggleCat(cat.id)} style={{ cursor:"pointer", background:"#F7F6F5" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#EDEBE9")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F7F6F5")}>
                    <td style={{ padding:"6px 10px", fontSize:12, fontWeight:700, color:PBI.textPrimary, whiteSpace:"nowrap", verticalAlign:"middle", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, background:"inherit", position:"sticky", left:0, zIndex:2 }}>
                      <span style={{ display:"inline-block", width:9, height:9, borderRadius:2, background:cat.color, marginRight:7, verticalAlign:"middle" }} />
                      <span style={{ marginRight:6, fontSize:10, color:PBI.textMuted }}>{isOpen ? "▼" : "▶"}</span>
                      {cat.label}
                    </td>
                    {catMonths.map((cm, mi) => (
                      <>
                        <td key={`cat-${cat.id}-${mi}-nm1`} style={tdNum(false, true, { borderLeft:`1px solid ${PBI.border}`, fontWeight:600, background:"#F7F6F5" })}>{fmt(cm.nMinus1)}</td>
                        <td key={`cat-${cat.id}-${mi}-n`}   style={tdNum(false, false, { fontWeight:600, background:"#F7F6F5" })}>{fmt(cm.n)}</td>
                      </>
                    ))}
                    <td style={tdNum(true, true,  { borderLeft:`2px solid ${PBI.border}`, fontWeight:700, background:"#EDEBE9" })}>{fmt(catTotalNM1)}</td>
                    <td style={tdNum(true, false, { fontWeight:700, background:"#EDEBE9" })}>{fmt(catTotalN)}</td>
                  </tr>
                  {isOpen && cat.models.map((mod, ri) => {
                    const modTotalN   = mod.months.reduce((s, m) => s + (m.n       ?? 0), 0);
                    const modTotalNM1 = mod.months.reduce((s, m) => s + (m.nMinus1 ?? 0), 0);
                    const rowBg = ri % 2 === 0 ? "#fff" : "#FAFAF9";
                    return (
                      <tr key={`${cat.id}-${mod.model}`} style={{ background:rowBg }} onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F2F1")} onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}>
                        <td style={{ padding:"5px 10px 5px 28px", fontSize:12, color:PBI.textMuted, whiteSpace:"nowrap", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, background:"inherit", position:"sticky", left:0, zIndex:2 }}>{mod.model}</td>
                        {mod.months.map((mm, mi) => (
                          <>
                            <td key={`mod-${mod.model}-${mi}-nm1`} style={tdNum(false, true,  { borderLeft:`1px solid ${PBI.border}` })}>{fmt(mm.nMinus1)}</td>
                            <td key={`mod-${mod.model}-${mi}-n`}   style={tdNum(false, false)}>{fmt(mm.n)}</td>
                          </>
                        ))}
                        <td style={tdNum(true, true,  { borderLeft:`2px solid ${PBI.border}` })}>{fmt(modTotalNM1)}</td>
                        <td style={tdNum(true, false)}>{fmt(modTotalN)}</td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
            {/* Grand total */}
            <tr style={{ background:"#DEECF9" }}>
              <td style={{ padding:"6px 10px", fontSize:12, fontWeight:700, color:PBI.textPrimary, borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, position:"sticky", left:0, background:"#DEECF9", zIndex:2 }}>Grand Total</td>
              {monthlyTotals.map((mt, mi) => (
                <>
                  <td key={`gt-${mi}-nm1`} style={tdNum(false, true,  { borderLeft:`1px solid ${PBI.border}`, fontWeight:700, background:"#DEECF9" })}>{fmt(mt.nMinus1)}</td>
                  <td key={`gt-${mi}-n`}   style={tdNum(false, false, { fontWeight:700, background:"#DEECF9" })}>{fmt(mt.n)}</td>
                </>
              ))}
              <td style={{ padding:"6px 10px", fontSize:12, fontWeight:700, textAlign:"right", whiteSpace:"nowrap", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, borderLeft:`2px solid ${PBI.border}`, color:COLOR_NM1, background:"#C7E0F4" }}>{fmt(totalNM1)}</td>
              <td style={{ padding:"6px 10px", fontSize:12, fontWeight:700, textAlign:"right", whiteSpace:"nowrap", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, color:COLOR_N, background:"#C7E0F4" }}>{fmt(totalN)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Page inner ───────────────────────────────────────────────────────────────
function RevenueInner() {
  const [expandedCats, setExpandedCats] = useState([]);
  const toggleCat = (id) => setExpandedCats((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const { selectedYear, selectedAgency, selectedCommercial } = useFilter();
  const yearN   = selectedYear;
  const yearNm1 = selectedYear - 1;

  const agencyName   = selectedAgency?.id ?? null;
  const commercialId = selectedCommercial?.id ? Number(selectedCommercial.id) : null;

  const { data: monthlyData,   loading: l1, error: e1 } = useGlobalRevenueMonthly(selectedYear, agencyName, commercialId);
  const { data: categoryData,  loading: l2, error: e2 } = useGlobalRevenueByCategory(selectedYear, agencyName, commercialId);
  const { data: agencyRevData, loading: l3, error: e3 } = useGlobalRevenueByAgency(selectedYear);

  const monthlyTotals = useMemo(() => {
    const rows = monthlyData?.rows ?? [];
    return MONTHS.map((abbr, i) => {
      const row = rows.find((r) => r.month === i + 1) ?? {};
      return { abbr, full: MONTHS_FULL[i], n: Number(row.n ?? 0), nMinus1: Number(row.n_minus1 ?? 0) };
    });
  }, [monthlyData]);

  const categories   = useMemo(() => buildCategories(categoryData?.rows ?? []), [categoryData]);
  const agencyRevenue = useMemo(() => buildEntityRevenue(agencyRevData?.rows ?? [], "agency_name"), [agencyRevData]);

  const now     = new Date();
  const curIdx  = now.getMonth();
  const prevIdx = curIdx > 0 ? curIdx - 1 : 11;

  const totalN      = monthlyTotals.reduce((s, m) => s + m.n,       0);
  const totalNM1    = monthlyTotals.reduce((s, m) => s + m.nMinus1, 0);
  const thisMonN    = monthlyTotals[curIdx]?.n       ?? 0;
  const thisMonNM1  = monthlyTotals[curIdx]?.nMinus1 ?? 0;
  const lastMonN    = monthlyTotals[prevIdx]?.n       ?? 0;
  const lastMonNM1  = monthlyTotals[prevIdx]?.nMinus1 ?? 0;

  // Agency donut slices
  const makeAgencySlices = (valueKey) =>
    agencyRevenue.map((a) => ({ name: a.label, color: a.color, value: valueKey(a) }));

  const DONUT_CARDS = [
    { title: "Agency Share — Current Month",  subtitle: `${MONTHS_FULL[curIdx]} ${yearN}`,    slices: makeAgencySlices((a) => a.months[curIdx]?.n       ?? 0) },
    { title: `Agency Share — Year ${yearN}`, subtitle: "Full year to date",                   slices: makeAgencySlices((a) => a.months.reduce((s, m) => s + m.n,       0)) },
    { title: "Agency Share — Last Month",     subtitle: `${MONTHS_FULL[prevIdx]} ${yearN}`,   slices: makeAgencySlices((a) => a.months[prevIdx]?.n      ?? 0) },
    { title: `Agency Share — Year ${yearNm1}`, subtitle: "Full previous year",                  slices: makeAgencySlices((a) => a.months.reduce((s, m) => s + m.nMinus1, 0)) },
  ];

  if (l1 || l2 || l3) return <Spinner />;
  if (e1 || e2 || e3) return <Err msg={e1 ?? e2 ?? e3} />;

  return (
    <div style={{ background:PBI.pageBg, minHeight:"100vh", padding:"20px 24px", fontFamily:PBI.font }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:600, color:PBI.textPrimary }}>Revenue</h1>
        <p style={{ margin:"2px 0 0", fontSize:12, color:PBI.textMuted }}>{yearN} vs {yearNm1}</p>
      </div>
      <FilterBar style={{ marginBottom:14 }} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        <KpiCard label="Total Revenue"                                           value={fmt(totalN)}    trend={pct(totalN, totalNM1, yearNm1)} />
        <KpiCard label={`Revenue This Month — ${MONTHS_FULL[curIdx]} ${yearN}`} value={fmt(thisMonN)}  trend={pct(thisMonN, thisMonNM1, yearNm1)} />
        <KpiCard label={`Revenue Last Month — ${MONTHS_FULL[prevIdx]} ${yearN}`} value={fmt(lastMonN)} trend={pct(lastMonN, lastMonNM1, yearNm1)} />
      </div>
      <RevenueBarChart monthlyTotals={monthlyTotals} yearN={yearN} yearNm1={yearNm1} />
      {/* Agency donut row */}
      <div style={{ marginTop:16 }}>
        <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:600, color:PBI.textPrimary, fontFamily:PBI.font }}>
          Revenue by Agency <span style={{ fontSize:11, fontWeight:400, color:PBI.textMuted, marginLeft:8 }}>Share of total revenue across periods</span>
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {DONUT_CARDS.map((c) => <AgencyDonutCard key={c.title} {...c} />)}
        </div>
      </div>
      <RevenueTable categories={categories} expandedCats={expandedCats} toggleCat={toggleCat} yearN={yearN} yearNm1={yearNm1} />
    </div>
  );
}

export default function DRevenue() {
  return <Layout><FilterProvider><RevenueInner /></FilterProvider></Layout>;
}
