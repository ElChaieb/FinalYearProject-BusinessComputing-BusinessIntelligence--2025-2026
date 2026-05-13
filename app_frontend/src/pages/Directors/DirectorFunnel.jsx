/**
 * DirectorFunnel.jsx — Conversion Rates Dashboard (Director / Global scope)
 *
 * Data sources:
 *   useGlobalFunnelMonthly   → MOCK_DATA replacement (table + bar charts + KPI cards)
 *   useGlobalFunnelByAgency  → 4 × 3 donut card rows
 */

import { useState, useMemo } from "react";
import {
  FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { useFilter } from "../../components/FilterContext"; // year filter
import { FilterProvider, FilterBar } from "../../components/FilterContext";
import Layout from "../../components/Layout";
import {
  useGlobalFunnelMonthly,
  useGlobalFunnelByAgency,
  buildFunnelData,
  buildFunnelByEntity,
} from "../../hooks/dashboardHooks";

const PBI = {
  colors: ["#118DFF","#E66C37","#12239E","#ECC846","#00B5D0","#8764B8","#D13438","#107C10"],
  pageBg:"#F3F2F1", border:"#E1DFDD", textPrimary:"#252423", textMuted:"#605E5C", gridLine:"#E1DFDD",
  font:"'Segoe UI', 'Segoe UI Web (West European)', sans-serif", green:"#107C10", red:"#D13438",
};
const card = { background:"#FFFFFF", border:`1px solid ${PBI.border}`, borderRadius:4, padding:"20px 24px 16px", fontFamily:PBI.font, boxShadow:"0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)" };
const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();
const CURRENT_MONTH_LABEL = MONTHS[now.getMonth()];
const PREVIOUS_MONTH_LABEL = MONTHS[now.getMonth() > 0 ? now.getMonth() - 1 : 11];

const fmtN = (n) => (n != null ? Number(n).toLocaleString() : "—");
const Spinner = () => <div style={{ padding:24, textAlign:"center", color:PBI.textMuted, fontFamily:PBI.font, fontSize:12 }}>Loading…</div>;
const Err = ({ msg }) => <div style={{ padding:24, textAlign:"center", color:PBI.red, fontFamily:PBI.font, fontSize:12 }}>{msg}</div>;

const PBITooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:`1px solid ${PBI.border}`, borderRadius:2, padding:"8px 12px", fontFamily:PBI.font, boxShadow:"0 2px 8px rgba(0,0,0,.12)", fontSize:12 }}>
      {label && <p style={{ margin:"0 0 6px", fontWeight:600, color:PBI.textPrimary }}>{label}</p>}
      {payload.map((e, i) => <p key={i} style={{ margin:"2px 0", color:e.color }}><span style={{ color:PBI.textMuted }}>{e.name}: </span><strong>{e.value?.toLocaleString()}</strong></p>)}
    </div>
  );
};

const KpiCard = ({ label, value, delta, positive, color }) => (
  <div style={{ ...card, padding:"16px 20px", borderLeft:`4px solid ${color || PBI.border}` }}>
    <p style={{ margin:"0 0 6px", fontSize:11, color:PBI.textMuted }}>{label}</p>
    <p style={{ margin:0, fontSize:26, fontWeight:600, color: color || PBI.textPrimary, lineHeight:1.2 }}>{value}</p>
    {delta != null && <p style={{ margin:"4px 0 0", fontSize:12, color: positive ? PBI.green : PBI.red }}>{positive ? "▲" : "▼"} {delta}</p>}
  </div>
);

const ConvTable = ({ data, yearN, yearNm1 }) => {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Build a lookup: period string -> row object
  const byPeriod = Object.fromEntries(data.map((d) => [d.period, d]));

  // Enrich a single period object with computed rates
  const enrich = (d = {}) => ({
    ...d,
    oqRate: (d.oppoWon || d.oppoLost) ? +((d.oppoWon / (d.oppoWon + d.oppoLost)) * 100).toFixed(1) : null,
    qsRate: (d.quoteWon || d.quoteLost) ? +((d.quoteWon / (d.quoteWon + d.quoteLost)) * 100).toFixed(1) : null,
  });

  // Yearly totals
  const totN   = enrich(byPeriod["Year n"]   ?? {});
  const totNm1 = enrich(byPeriod["Year n-1"] ?? {});

  const ROWS = [
    { group:"Opportunities", label:"Won",              keyN:"oppoWon",  keyNm1:"oppoWon",  type:"num" },
    { group:null,            label:"Lost",             keyN:"oppoLost", keyNm1:"oppoLost", type:"num" },
    { group:null,            label:"Oppos → Quotes %", keyN:"oqRate",   keyNm1:"oqRate",   type:"rate", color:PBI.colors[0] },
    { group:"Quotes",        label:"Won",              keyN:"quoteWon",  keyNm1:"quoteWon",  type:"num" },
    { group:null,            label:"Lost",             keyN:"quoteLost", keyNm1:"quoteLost", type:"num" },
    { group:null,            label:"Quotes → Sales %", keyN:"qsRate",   keyNm1:"qsRate",   type:"rate", color:PBI.colors[1] },
  ];

  const thBase = { padding:"7px 10px", fontSize:11, fontWeight:600, color:PBI.textMuted, background:"#F3F2F1", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, whiteSpace:"nowrap", textAlign:"center" };
  const tdNum  = (isTotal, isNm1, extra = {}) => ({ padding:"5px 10px", fontSize:12, textAlign:"right", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, whiteSpace:"nowrap", background: isTotal ? "#F3F2F1" : "#fff", fontWeight: isTotal ? 600 : 400, color: isNm1 ? PBI.textMuted : PBI.textPrimary, ...extra });
  const tdRate = (color, isTotal) => ({ padding:"5px 10px", fontSize:12, fontWeight:700, color, textAlign:"center", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, whiteSpace:"nowrap", background: isTotal ? (color === PBI.colors[0] ? "#D6EAFF" : "#FFE8DC") : (color === PBI.colors[0] ? "#F0F6FF" : "#FFF5F0") });

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ borderCollapse:"collapse", fontFamily:PBI.font, fontSize:12, minWidth:"100%" }}>
        <thead>
          {/* Row 1: Stage | Metric | Jan … Dec | Total */}
          <tr>
            <th style={{ ...thBase, textAlign:"left", minWidth:120, position:"sticky", left:0, zIndex:3 }}>Stage</th>
            <th style={{ ...thBase, textAlign:"left", minWidth:150, position:"sticky", left:120, zIndex:3 }}>Metric</th>
            {MONTHS.map((m) => (
              <th key={m} colSpan={2} style={{ ...thBase, textAlign:"center", borderLeft:`1px solid ${PBI.border}` }}>{m}</th>
            ))}
            <th colSpan={2} style={{ ...thBase, textAlign:"center", borderLeft:`2px solid ${PBI.border}`, background:"#EDEBE9", color:PBI.textPrimary }}>Total</th>
          </tr>
          {/* Row 2: sub-columns year n / year n-1 */}
          <tr>
            <th style={{ ...thBase, textAlign:"left", position:"sticky", left:0, zIndex:3 }} />
            <th style={{ ...thBase, textAlign:"left", position:"sticky", left:120, zIndex:3 }} />
            {MONTHS.map((m) => (
              <>
                <th key={`${m}-nm1`} style={{ ...thBase, color:"#E66C37", borderLeft:`1px solid ${PBI.border}`, minWidth:72 }}>{yearNm1}</th>
                <th key={`${m}-n`}   style={{ ...thBase, color:"#118DFF", minWidth:72 }}>{yearN}</th>
              </>
            ))}
            <th style={{ ...thBase, color:"#E66C37", borderLeft:`2px solid ${PBI.border}`, background:"#EDEBE9", minWidth:80 }}>{yearNm1}</th>
            <th style={{ ...thBase, color:"#118DFF", background:"#EDEBE9", minWidth:80 }}>{yearN}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, ri) => {
            const isFirstInGroup = row.group != null;
            const groupSpan = (row.group === "Opportunities" || row.group === "Quotes") ? 3 : 0;
            const groupColor = row.group === "Opportunities" ? PBI.colors[2] : PBI.colors[4];
            const rowBg = ri % 2 === 0 ? "#fff" : "#FAFAF9";

            return (
              <tr key={ri} style={{ background: rowBg }}>
                {isFirstInGroup && (
                  <td rowSpan={groupSpan} style={{ padding:"5px 10px", fontSize:12, fontWeight:700, color:groupColor, background:"#F7F6F5", verticalAlign:"middle", textAlign:"left", borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, position:"sticky", left:0, zIndex:2 }}>
                    {row.group}
                  </td>
                )}
                <td style={{ padding:"5px 10px", fontSize:12, color: row.type === "rate" ? row.color : PBI.textPrimary, fontStyle: row.type === "rate" ? "italic" : "normal", paddingLeft: !isFirstInGroup && row.type !== "rate" ? 22 : 10, borderBottom:`1px solid ${PBI.border}`, borderRight:`1px solid ${PBI.border}`, background:"#fff", whiteSpace:"nowrap", position:"sticky", left:120, zIndex:2 }}>
                  {row.label}
                </td>
                {MONTHS.map((m) => {
                  const colN   = enrich(byPeriod[m]          ?? {});
                  const colNm1 = enrich(byPeriod[`${m} n-1`] ?? {});
                  const vN   = colN[row.keyN];
                  const vNm1 = colNm1[row.keyNm1];
                  return row.type === "rate" ? (
                    <>
                      <td key={`${m}-nm1`} style={{ ...tdRate(row.color, false), borderLeft:`1px solid ${PBI.border}` }}>{vNm1 != null ? vNm1 + "%" : "—"}</td>
                      <td key={`${m}-n`}   style={tdRate(row.color, false)}>{vN != null ? vN + "%" : "—"}</td>
                    </>
                  ) : (
                    <>
                      <td key={`${m}-nm1`} style={tdNum(false, true,  { borderLeft:`1px solid ${PBI.border}` })}>{fmtN(vNm1)}</td>
                      <td key={`${m}-n`}   style={tdNum(false, false)}>{fmtN(vN)}</td>
                    </>
                  );
                })}
                {/* Yearly totals */}
                {row.type === "rate" ? (
                  <>
                    <td style={{ ...tdRate(row.color, true), borderLeft:`2px solid ${PBI.border}` }}>{totNm1[row.keyNm1] != null ? totNm1[row.keyNm1] + "%" : "—"}</td>
                    <td style={tdRate(row.color, true)}>{totN[row.keyN] != null ? totN[row.keyN] + "%" : "—"}</td>
                  </>
                ) : (
                  <>
                    <td style={tdNum(true, true,  { borderLeft:`2px solid ${PBI.border}` })}>{fmtN(totNm1[row.keyNm1])}</td>
                    <td style={tdNum(true, false)}>{fmtN(totN[row.keyN])}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const DonutRing = ({ data, total }) => (
  <div style={{ position:"relative", width:90, height:90, flexShrink:0 }}>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius="52%" outerRadius="76%" dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
          {data.map((_, i) => <Cell key={i} fill={PBI.colors[i % PBI.colors.length]} stroke="none" />)}
        </Pie>
        <Tooltip formatter={(val, name) => [`${val.toLocaleString()} (${total ? ((val/total)*100).toFixed(1) : 0}%)`, name]} contentStyle={{ fontFamily:PBI.font, fontSize:10, border:`1px solid ${PBI.border}`, borderRadius:2 }} />
      </PieChart>
    </ResponsiveContainer>
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
      <span style={{ fontSize:11, fontWeight:700, color:PBI.textPrimary, lineHeight:1.1 }}>{total.toLocaleString()}</span>
      <span style={{ fontSize:8, color:PBI.textMuted, marginTop:1 }}>total</span>
    </div>
  </div>
);

const DonutCard = ({ title, agencies, valueKey }) => {
  const donutData = agencies.map((a) => ({ name: a.name, value: a[valueKey] || 0 }));
  const total = donutData.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ ...card, padding:"14px 16px" }}>
      <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:600, color:PBI.textPrimary }}>{title}</p>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <DonutRing data={donutData} total={total} />
        <div style={{ display:"flex", flexDirection:"column", gap:5, minWidth:0, flex:1 }}>
          {donutData.map((d, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontFamily:PBI.font }}>
              <span style={{ width:8, height:8, borderRadius:1, flexShrink:0, background:PBI.colors[i%PBI.colors.length], display:"inline-block" }} />
              <span style={{ fontSize:10, color:PBI.textMuted, whiteSpace:"nowrap" }}>{d.name}:</span>
              <strong style={{ fontSize:11, color:PBI.textPrimary }}>{d.value.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function FunnelPageInner() {
  const { selectedYear } = useFilter();
  const YEAR_N   = selectedYear;
  const YEAR_NM1 = selectedYear - 1;

  const { data: funnelMonthly, loading: l1, error: e1 } = useGlobalFunnelMonthly(selectedYear);
  const { data: funnelAgency,  loading: l2, error: e2 } = useGlobalFunnelByAgency(selectedYear);

  const data = useMemo(() => buildFunnelData(funnelMonthly?.rows ?? []), [funnelMonthly]);
  const { yearN: agenciesN, yearNm1: agenciesNm1 } = useMemo(() => buildFunnelByEntity(funnelAgency ?? {}), [funnelAgency]);

  const yearN    = data.find((d) => d.period === "Year n")    ?? {};
  const yearPrev = data.find((d) => d.period === "Year n-1")  ?? {};

  const funnelData = [
    { name:"Opportunities", value:(yearN.oppoWon||0)+(yearN.oppoLost||0), fill:PBI.colors[0] },
    { name:"Quotes",        value:(yearN.quoteWon||0)+(yearN.quoteLost||0), fill:PBI.colors[2] },
    { name:"Sales",     value: yearN.saleWon||0,                      fill:PBI.colors[7] },
  ];
  const oqRateN = (yearN.oppoWon || yearN.oppoLost) ? ((yearN.oppoWon / (yearN.oppoWon + yearN.oppoLost)) * 100).toFixed(1) : "—";
  const qsRateN = (yearN.quoteWon || yearN.quoteLost) ? ((yearN.quoteWon / (yearN.quoteWon + yearN.quoteLost)) * 100).toFixed(1) : "—";

  const oppoCompareData  = MONTHS.map((m) => { const p = data.find((d) => d.period === `${m} n-1`)||{}; const c = data.find((d) => d.period === m)||{}; return { month:m, "n-1":p.oppoWon||0, n:c.oppoWon||0 }; });
  const quoteCompareData = MONTHS.map((m) => { const p = data.find((d) => d.period === `${m} n-1`)||{}; const c = data.find((d) => d.period === m)||{}; return { month:m, "n-1":p.quoteWon||0, n:c.quoteWon||0 }; });

  if (l1 || l2) return <Spinner />;
  if (e1 || e2) return <Err msg={e1 ?? e2} />;

  const DONUT_ROWS = [
    { rowLabel:"Opportunities", yearLabel:`Year ${YEAR_NM1}`, agencies: agenciesNm1.map((a) => ({ ...a, oppoTotal:a.oppoWon+a.oppoLost, quoteTotal:a.quoteWon+a.quoteLost })), cards:[{title:"Total Opportunities",valueKey:"oppoTotal"},{title:"Won Opportunities",valueKey:"oppoWon"},{title:"Lost Opportunities",valueKey:"oppoLost"}] },
    { rowLabel:"Opportunities", yearLabel:`Year ${YEAR_N}`, agencies: agenciesN.map((a)   => ({ ...a, oppoTotal:a.oppoWon+a.oppoLost, quoteTotal:a.quoteWon+a.quoteLost })), cards:[{title:"Total Opportunities",valueKey:"oppoTotal"},{title:"Won Opportunities",valueKey:"oppoWon"},{title:"Lost Opportunities",valueKey:"oppoLost"}] },
    { rowLabel:"Quotes",        yearLabel:`Year ${YEAR_NM1}`, agencies: agenciesNm1.map((a) => ({ ...a, oppoTotal:a.oppoWon+a.oppoLost, quoteTotal:a.quoteWon+a.quoteLost })), cards:[{title:"Total Quotes",valueKey:"quoteTotal"},{title:"Won Quotes",valueKey:"quoteWon"},{title:"Lost Quotes",valueKey:"quoteLost"}] },
    { rowLabel:"Quotes",        yearLabel:`Year ${YEAR_N}`, agencies: agenciesN.map((a)   => ({ ...a, oppoTotal:a.oppoWon+a.oppoLost, quoteTotal:a.quoteWon+a.quoteLost })), cards:[{title:"Total Quotes",valueKey:"quoteTotal"},{title:"Won Quotes",valueKey:"quoteWon"},{title:"Lost Quotes",valueKey:"quoteLost"}] },
  ];

  return (
    <div style={{ background:PBI.pageBg, minHeight:"100vh", padding:"20px 24px", fontFamily:PBI.font }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:600, color:PBI.textPrimary }}>Conversion Rates</h1>
        <p style={{ margin:"2px 0 0", fontSize:12, color:PBI.textMuted }}>Opportunities → Quotes → Sales · {CURRENT_MONTH_LABEL} vs {PREVIOUS_MONTH_LABEL}</p>
      </div>
      <FilterBar style={{ marginBottom:16 }} />

      {/* Funnel + KPI grid */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 3fr", gap:12, marginBottom:16 }}>
        <div style={card}>
          <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:PBI.textPrimary }}>{`Funnel (${YEAR_N})`}</p>
          <p style={{ margin:"0 0 8px", fontSize:11, color:PBI.textMuted }}>Oppos → Quotes → Sales</p>
          <div style={{ maxWidth:420, margin:"0 auto", overflow:"visible" }}>
            <ResponsiveContainer width="100%" height={340}>
              <FunnelChart><Tooltip content={<PBITooltip />} /><Funnel dataKey="value" data={funnelData} isAnimationActive lastShapeType="rectangle"><LabelList position="right" fill={PBI.textPrimary} style={{ fontSize:11, fontFamily:PBI.font }} formatter={(v) => v.toLocaleString()} /></Funnel></FunnelChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:"flex", justifyContent:"space-around", marginTop:8 }}>
            {[{label:"Oppos→Quotes",rate:oqRateN,color:PBI.colors[0]},{label:"Quotes→Sales",rate:qsRateN,color:PBI.colors[7]}].map(({label,rate,color}) => (
              <div key={label} style={{ textAlign:"center" }}><p style={{ margin:0, fontSize:20, fontWeight:700, color }}>{rate}%</p><p style={{ margin:"2px 0 0", fontSize:10, color:PBI.textMuted }}>{label}</p></div>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gridTemplateRows:"repeat(4,1fr)", gap:12 }}>
          <KpiCard label="Opportunities Won"       value={fmtN(yearN.oppoWon)}    delta={null} positive={true}  color={PBI.colors[7]} />
          <KpiCard label="Opportunities Lost"      value={fmtN(yearN.oppoLost)}   delta={null} positive={false} color={PBI.colors[6]} />
          <KpiCard label="Oppos Conv. Rate"        value={yearN.oppoWon && yearN.oppoLost ? +((yearN.oppoWon/(yearN.oppoWon+yearN.oppoLost))*100).toFixed(1)+"%" : "—"} delta={null} positive={true} color={PBI.colors[0]} />
          <KpiCard label={`Opportunities Won (${YEAR_NM1})`}  value={fmtN(yearPrev.oppoWon)}  delta={null} positive={true}  />
          <KpiCard label={`Opportunities Lost (${YEAR_NM1})`} value={fmtN(yearPrev.oppoLost)} delta={null} positive={false} />
          <KpiCard label={`Oppos Conv. Rate (${YEAR_NM1})`}   value={yearPrev.oppoWon && yearPrev.oppoLost ? +((yearPrev.oppoWon/(yearPrev.oppoWon+yearPrev.oppoLost))*100).toFixed(1)+"%" : "—"} delta={null} positive={true} />
          <KpiCard label="Quotes Won"       value={fmtN(yearN.quoteWon)}    delta={null} positive={true}  color={PBI.colors[7]} />
          <KpiCard label="Quotes Lost"      value={fmtN(yearN.quoteLost)}   delta={null} positive={false} color={PBI.colors[6]} />
          <KpiCard label="Quotes Conv. Rate" value={yearN.quoteWon && yearN.quoteLost ? +((yearN.quoteWon/(yearN.quoteWon+yearN.quoteLost))*100).toFixed(1)+"%" : "—"} delta={null} positive={true} color={PBI.colors[0]} />
          <KpiCard label={`Quotes Won (${YEAR_NM1})`}  value={fmtN(yearPrev.quoteWon)}  delta={null} positive={true}  />
          <KpiCard label={`Quotes Lost (${YEAR_NM1})`} value={fmtN(yearPrev.quoteLost)} delta={null} positive={false} />
          <KpiCard label={`Quotes Conv. Rate (${YEAR_NM1})`} value={yearPrev.quoteWon && yearPrev.quoteLost ? +((yearPrev.quoteWon/(yearPrev.quoteWon+yearPrev.quoteLost))*100).toFixed(1)+"%" : "—"} delta={null} positive={true} />
        </div>
      </div>

      {/* Bar charts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {[{title:"Opportunities Won · n-1 vs n",data:oppoCompareData},{title:"Quotes Won · n-1 vs n",data:quoteCompareData}].map(({title,data:chartData}) => (
          <div key={title} style={card}>
            <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:PBI.textPrimary }}>{title}</p>
            <p style={{ margin:"0 0 8px", fontSize:11, color:PBI.textMuted }}>By month</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="30%" barGap={3} margin={{ top:4, right:8, left:-12, bottom:0 }}>
                <CartesianGrid stroke={PBI.gridLine} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:PBI.textMuted, fontFamily:PBI.font }} axisLine={{ stroke:PBI.border }} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:PBI.textMuted, fontFamily:PBI.font }} axisLine={{ stroke:PBI.border }} tickLine={false} />
                <Tooltip content={<PBITooltip />} cursor={{ fill:"rgba(17,141,255,.06)" }} />
                <Legend wrapperStyle={{ fontSize:11, fontFamily:PBI.font }} />
                <Bar dataKey="n-1" name={String(YEAR_NM1)} fill={PBI.colors[3]} radius={[2,2,0,0]} maxBarSize={32} />
                <Bar dataKey="n"   name={String(YEAR_N)}   fill={PBI.colors[0]} radius={[2,2,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Conversion table */}
      <div style={{ ...card, padding:"20px 24px" }}>
        <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600, color:PBI.textPrimary }}>Conversion Rate Detail</p>
        <p style={{ margin:"0 0 12px", fontSize:11, color:PBI.textMuted }}>Metrics as rows · Periods as columns · Rates auto-calculated</p>
        <ConvTable data={data} yearN={YEAR_N} yearNm1={YEAR_NM1} />
      </div>

      {/* Donut rows */}
      {DONUT_ROWS.map(({ rowLabel, yearLabel, agencies, cards }, idx) => (
        <div key={idx} style={{ marginTop:16 }}>
          <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:600, color:PBI.textPrimary, fontFamily:PBI.font }}>
            {rowLabel} — Share by Agency <span style={{ fontSize:11, fontWeight:400, color:PBI.textMuted, marginLeft:8 }}>{yearLabel}</span>
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {cards.map((c) => <DonutCard key={c.title} title={c.title} valueKey={c.valueKey} agencies={agencies} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DFunnel() {
  return <Layout><FilterProvider><FunnelPageInner /></FilterProvider></Layout>;
}
