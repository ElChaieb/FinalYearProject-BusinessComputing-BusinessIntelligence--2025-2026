/**
 * AgencyTrends.jsx — Trends & Client Base (Agency Manager scope)
 *
 * Data sources:
 *   useAgencyTrendsByCategory     → KPI cards + donut + breakdown table
 *   useAgencyTrendsClientsByState → state ranking cards
 */

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { FilterProvider, FilterBar, useFilter } from "../../components/AgencyFilterContext_states";
import Layout from "../../components/Layout";
import { useAgencyTrendsByCategory, useAgencyTrendsClientsByState, buildCategories, buildStateOrders } from "../../hooks/dashboardHooks";

const PBI = { pageBg:"#F3F2F1", border:"#E1DFDD", cardBg:"#FFFFFF", textPrimary:"#252423", textMuted:"#605E5C", gridLine:"#E1DFDD", font:"'Segoe UI', 'Segoe UI Web (West European)', sans-serif", green:"#107C10", red:"#D13438" };
const card = { background:PBI.cardBg, border:`1px solid ${PBI.border}`, borderRadius:4, padding:"18px 20px", fontFamily:PBI.font, boxShadow:"0 1.6px 3.6px rgba(0,0,0,.08), 0 0.3px 0.9px rgba(0,0,0,.05)" };
const COLOR_N   = "#118DFF";
const COLOR_NM1 = "#E66C37";
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();
const CUR_MONTH_IDX  = now.getMonth();
const PREV_MONTH_IDX = CUR_MONTH_IDX > 0 ? CUR_MONTH_IDX - 1 : 11;

const fmtN = (n) => (n??0).toLocaleString("fr-TN");
const pct  = (curr,prev,prevYear) => { if(!prev) return null; const d=((curr-prev)/prev)*100; return {label:`${Math.abs(d).toFixed(1)}% vs ${prevYear}`,up:d>=0}; };
const Spinner = () => <div style={{padding:24,textAlign:"center",color:PBI.textMuted,fontFamily:PBI.font,fontSize:12}}>Loading…</div>;
const Err = ({msg}) => <div style={{padding:24,textAlign:"center",color:PBI.red,fontFamily:PBI.font,fontSize:12}}>{msg}</div>;
const KpiCard = ({label,value,sub,trend,accentColor}) => (
  <div style={card}><p style={{margin:"0 0 6px",fontSize:11,color:PBI.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p><p style={{margin:0,fontSize:28,fontWeight:700,color:accentColor??PBI.textPrimary,lineHeight:1.1}}>{value}</p>{sub&&<p style={{margin:"3px 0 0",fontSize:12,color:PBI.textMuted}}>{sub}</p>}{trend&&<p style={{margin:"6px 0 0",fontSize:12,color:trend.up?PBI.green:PBI.red}}>{trend.up?"▲":"▼"} {trend.label}</p>}</div>
);
const DonutCard = ({year,catTotals,dataKey}) => {
  const donutData=catTotals.map((c)=>({name:c.label,value:dataKey==="n"?c.n:c.nM1,color:c.color}));
  const total=donutData.reduce((s,d)=>s+d.value,0);
  return (
    <div style={{...card,display:"flex",flexDirection:"column"}}>
      <p style={{margin:"0 0 2px",fontSize:11,color:PBI.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Sales Mix — Categories</p>
      <p style={{margin:"0 0 10px",fontSize:11,color:PBI.textMuted}}>{year}</p>
      <div style={{display:"flex",alignItems:"center",gap:14,flex:1}}>
        <div style={{position:"relative",width:120,height:120,flexShrink:0}}>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donutData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>{donutData.map((d,i)=><Cell key={i} fill={d.color} stroke="none"/>)}</Pie><Tooltip formatter={(val,name)=>[`${fmtN(val)} units`,name]} contentStyle={{fontFamily:PBI.font,fontSize:12,border:`1px solid ${PBI.border}`,borderRadius:2}}/></PieChart></ResponsiveContainer>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><span style={{fontSize:13,fontWeight:700,color:PBI.textPrimary,lineHeight:1.1}}>{fmtN(total)}</span><span style={{fontSize:9,color:PBI.textMuted,marginTop:2}}>units</span></div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,minWidth:0,flex:1}}>
          {donutData.map((d,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:2,flexShrink:0,background:d.color,display:"inline-block"}}/><span style={{fontSize:10,color:PBI.textMuted,whiteSpace:"nowrap",flex:1}}>{d.name}</span><strong style={{fontSize:10,color:PBI.textPrimary,paddingLeft:4}}>{total?((d.value/total)*100).toFixed(1):0}%</strong></div>)}
        </div>
      </div>
    </div>
  );
};
const ModelsBarCard = ({categories,yearN}) => {
  const MAX_MODELS=Math.max(...categories.map((c)=>c.models.length),0);
  const SLOT_OPACITIES=[1,0.68,0.42];
  const modelBarData=categories.map((cat)=>{const entry={name:cat.label,_color:cat.color};for(let i=0;i<MAX_MODELS;i++){entry[`slot_${i}`]=cat.models[i]?cat.models[i].months.reduce((s,m)=>s+(m.n??0),0):0;entry[`slot_${i}_lbl`]=cat.models[i]?.model??null;}return entry;});
  return (
    <div style={{...card,display:"flex",flexDirection:"column"}}>
      <p style={{margin:"0 0 2px",fontSize:11,color:PBI.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Sold Models per Category</p>
      <p style={{margin:"0 0 10px",fontSize:11,color:PBI.textMuted}}>{yearN} · stacked by model</p>
      <ResponsiveContainer width="100%" height={200}><BarChart data={modelBarData} barCategoryGap="30%" margin={{top:4,right:8,left:-12,bottom:0}}><CartesianGrid stroke={PBI.gridLine} strokeDasharray="0" vertical={false}/><XAxis dataKey="name" tick={{fontSize:10,fill:PBI.textMuted,fontFamily:PBI.font}} axisLine={{stroke:PBI.border}} tickLine={false}/><YAxis tick={{fontSize:10,fill:PBI.textMuted,fontFamily:PBI.font}} axisLine={{stroke:PBI.border}} tickLine={false}/><Tooltip cursor={{fill:"rgba(17,141,255,.06)"}} contentStyle={{fontFamily:PBI.font,fontSize:12,border:`1px solid ${PBI.border}`,borderRadius:2}}/>{Array.from({length:MAX_MODELS},(_,si)=><Bar key={si} dataKey={`slot_${si}`} stackId="a" maxBarSize={40} radius={si===MAX_MODELS-1?[2,2,0,0]:[0,0,0,0]}>{modelBarData.map((entry,di)=><Cell key={di} fill={entry._color} fillOpacity={SLOT_OPACITIES[si]??0.3}/>)}</Bar>)}</BarChart></ResponsiveContainer>
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:8}}>{categories.map((cat)=><div key={cat.id} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:8,height:8,borderRadius:2,background:cat.color,display:"inline-block"}}/><span style={{fontSize:10,color:PBI.textMuted}}>{cat.label}</span></div>)}</div>
    </div>
  );
};
const StateRankCard = ({title,subtitle,accentColor,states}) => (
  <div style={card}><p style={{margin:"0 0 2px",fontSize:12,fontWeight:600,color:PBI.textPrimary}}>{title}</p><p style={{margin:"0 0 14px",fontSize:11,color:PBI.textMuted}}>{subtitle}</p>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {states.map((s,i)=>{const bp=states[0]?.orders>0?(s.orders/states[0].orders)*100:0;return(<div key={s.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}><span style={{fontSize:12,color:PBI.textPrimary,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,fontWeight:700,color:"#fff",background:accentColor,borderRadius:2,width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>{s.label}</span><strong style={{fontSize:13,color:accentColor}}>{fmtN(s.orders)}</strong></div><div style={{height:5,borderRadius:3,background:"#F3F2F1",overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,width:`${bp}%`,background:accentColor,opacity:0.85}}/></div></div>);})}
    </div>
  </div>
);
const TrendsTable = ({categories,expandedCats,toggleCat,yearN,yearNm1}) => {
  const allModels=categories.flatMap((c)=>c.models);
  const monthlyTotals=MONTHS.map((_,i)=>({abbr:MONTHS[i],n:allModels.reduce((s,m)=>s+(m.months[i]?.n??0),0),nMinus1:allModels.reduce((s,m)=>s+(m.months[i]?.nMinus1??0),0)}));
  const totalN=monthlyTotals.reduce((s,m)=>s+m.n,0),totalNM1=monthlyTotals.reduce((s,m)=>s+m.nMinus1,0);
  const thBase={padding:"7px 10px",fontSize:11,fontWeight:600,color:PBI.textMuted,background:"#F3F2F1",borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,whiteSpace:"nowrap",textAlign:"center"};
  const tdNum=(isTotal,isNM1,override={})=>({padding:"5px 10px",fontSize:12,textAlign:"right",borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,whiteSpace:"nowrap",background:isTotal?"#F3F2F1":"#fff",fontWeight:isTotal?600:400,color:isNM1?PBI.textMuted:PBI.textPrimary,...override});
  return (
    <div style={{...card,padding:"20px 24px",overflowX:"auto"}}>
      <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:PBI.textPrimary}}>Sales Breakdown by Category &amp; Model</p>
      <p style={{margin:"0 0 16px",fontSize:11,color:PBI.textMuted}}>Units sold · click to expand · {yearN} vs {yearNm1}</p>
      <table style={{borderCollapse:"collapse",fontFamily:PBI.font,fontSize:12,minWidth:"100%"}}>
        <thead>
          <tr><th style={{...thBase,textAlign:"left",minWidth:170,position:"sticky",left:0,zIndex:3}}>Category / Model</th>{MONTHS.map((m)=><th key={m} colSpan={2} style={{...thBase,textAlign:"center",borderLeft:`1px solid ${PBI.border}`}}>{m}</th>)}<th colSpan={2} style={{...thBase,textAlign:"center",borderLeft:`2px solid ${PBI.border}`,background:"#EDEBE9",color:PBI.textPrimary}}>Total</th></tr>
          <tr><th style={{...thBase,textAlign:"left",position:"sticky",left:0,zIndex:3}}/>{MONTHS.map((m)=>(<><th key={`${m}-nm1`} style={{...thBase,color:COLOR_NM1,borderLeft:`1px solid ${PBI.border}`,minWidth:72}}>{yearNm1}</th><th key={`${m}-n`} style={{...thBase,color:COLOR_N,minWidth:72}}>{yearN}</th></>))}<th style={{...thBase,color:COLOR_NM1,borderLeft:`2px solid ${PBI.border}`,background:"#EDEBE9",minWidth:80}}>{yearNm1}</th><th style={{...thBase,color:COLOR_N,background:"#EDEBE9",minWidth:80}}>{yearN}</th></tr>
        </thead>
        <tbody>
          {categories.map((cat)=>{
            const isOpen=expandedCats.includes(cat.id);
            const catMonths=MONTHS.map((_,mi)=>({n:cat.models.reduce((s,m)=>s+(m.months[mi]?.n??0),0),nMinus1:cat.models.reduce((s,m)=>s+(m.months[mi]?.nMinus1??0),0)}));
            const ctN=catMonths.reduce((s,m)=>s+m.n,0),ctNM1=catMonths.reduce((s,m)=>s+m.nMinus1,0),catPct=pct(ctN,ctNM1,yearNm1);
            return(<>
              <tr key={cat.id} onClick={()=>toggleCat(cat.id)} style={{cursor:"pointer",background:"#F7F6F5"}} onMouseEnter={(e)=>(e.currentTarget.style.background="#EDEBE9")} onMouseLeave={(e)=>(e.currentTarget.style.background="#F7F6F5")}>
                <td style={{padding:"6px 10px",fontSize:12,fontWeight:700,color:PBI.textPrimary,whiteSpace:"nowrap",borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,background:"inherit",position:"sticky",left:0,zIndex:2}}><span style={{display:"inline-block",width:9,height:9,borderRadius:2,background:cat.color,marginRight:7,verticalAlign:"middle"}}/><span style={{marginRight:6,fontSize:10,color:PBI.textMuted}}>{isOpen?"▼":"▶"}</span>{cat.label}{catPct&&<span style={{marginLeft:8,fontSize:10,fontWeight:500,color:catPct.up?PBI.green:PBI.red}}>{catPct.up?"▲":"▼"} {catPct.label}</span>}</td>
                {catMonths.map((cm,mi)=>(<><td key={`cat-${cat.id}-${mi}-nm1`} style={tdNum(false,true,{borderLeft:`1px solid ${PBI.border}`,fontWeight:600,background:"#F7F6F5"})}>{fmtN(cm.nMinus1)}</td><td key={`cat-${cat.id}-${mi}-n`} style={tdNum(false,false,{fontWeight:600,background:"#F7F6F5"})}>{fmtN(cm.n)}</td></>))}
                <td style={tdNum(true,true,{borderLeft:`2px solid ${PBI.border}`,fontWeight:700,background:"#EDEBE9"})}>{fmtN(ctNM1)}</td><td style={tdNum(true,false,{fontWeight:700,background:"#EDEBE9"})}>{fmtN(ctN)}</td>
              </tr>
              {isOpen&&cat.models.map((mod,ri)=>{const mN=mod.months.reduce((s,m)=>s+(m.n??0),0),mNM1=mod.months.reduce((s,m)=>s+(m.nMinus1??0),0),rowBg=ri%2===0?"#fff":"#FAFAF9";return(
                <tr key={`${cat.id}-${mod.model}`} style={{background:rowBg}} onMouseEnter={(e)=>(e.currentTarget.style.background="#F3F2F1")} onMouseLeave={(e)=>(e.currentTarget.style.background=rowBg)}>
                  <td style={{padding:"5px 10px 5px 28px",fontSize:12,color:PBI.textMuted,whiteSpace:"nowrap",borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,background:"inherit",position:"sticky",left:0,zIndex:2}}>{mod.model}</td>
                  {mod.months.map((mm,mi)=>(<><td key={`mod-${mod.model}-${mi}-nm1`} style={tdNum(false,true,{borderLeft:`1px solid ${PBI.border}`})}>{fmtN(mm.nMinus1)}</td><td key={`mod-${mod.model}-${mi}-n`} style={tdNum(false,false)}>{fmtN(mm.n)}</td></>))}
                  <td style={tdNum(true,true,{borderLeft:`2px solid ${PBI.border}`})}>{fmtN(mNM1)}</td><td style={tdNum(true,false)}>{fmtN(mN)}</td>
                </tr>
              );})}
            </>);
          })}
          <tr style={{background:"#DEECF9"}}><td style={{padding:"6px 10px",fontSize:12,fontWeight:700,color:PBI.textPrimary,borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,position:"sticky",left:0,background:"#DEECF9",zIndex:2}}>Grand Total</td>{monthlyTotals.map((mt,mi)=>(<><td key={`gt-${mi}-nm1`} style={tdNum(false,true,{borderLeft:`1px solid ${PBI.border}`,fontWeight:700,background:"#DEECF9"})}>{fmtN(mt.nMinus1)}</td><td key={`gt-${mi}-n`} style={tdNum(false,false,{fontWeight:700,background:"#DEECF9"})}>{fmtN(mt.n)}</td></>))}<td style={{padding:"6px 10px",fontSize:12,fontWeight:700,textAlign:"right",whiteSpace:"nowrap",borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,borderLeft:`2px solid ${PBI.border}`,color:COLOR_NM1,background:"#C7E0F4"}}>{fmtN(totalNM1)}</td><td style={{padding:"6px 10px",fontSize:12,fontWeight:700,textAlign:"right",whiteSpace:"nowrap",borderBottom:`1px solid ${PBI.border}`,borderRight:`1px solid ${PBI.border}`,color:COLOR_N,background:"#C7E0F4"}}>{fmtN(totalN)}</td></tr>
        </tbody>
      </table>
    </div>
  );
};

function TrendsPage() {
  const [expandedCats,setExpandedCats]=useState([]);
  const toggleCat=(id)=>setExpandedCats((prev)=>prev.includes(id)?prev.filter((x)=>x!==id):[...prev,id]);
  const { selectedYear } = useFilter();
  const yearN   = selectedYear;
  const yearNm1 = selectedYear - 1;

  const {data:catData,   loading:l1,error:e1}=useAgencyTrendsByCategory(selectedYear);
  const {data:stateCur,  loading:l2}           =useAgencyTrendsClientsByState(selectedYear,CUR_MONTH_IDX+1);
  const {data:statePrev, loading:l3}           =useAgencyTrendsClientsByState(selectedYear,PREV_MONTH_IDX+1);
  const categories=useMemo(()=>buildCategories(catData?.rows??[],false),[catData]);
  const catTotals =useMemo(()=>categories.map((cat)=>({id:cat.id,label:cat.label,color:cat.color,n:cat.models.flatMap((m)=>m.months).reduce((s,mo)=>s+(mo.n??0),0),nM1:cat.models.flatMap((m)=>m.months).reduce((s,mo)=>s+(mo.nMinus1??0),0)})),[categories]);
  const allModels =useMemo(()=>categories.flatMap((c)=>c.models),[categories]);
  const totalN    =useMemo(()=>allModels.reduce((s,m)=>s+m.months.reduce((ss,mm)=>ss+(mm.n??0),0),0),[allModels]);
  const totalNM1  =useMemo(()=>allModels.reduce((s,m)=>s+m.months.reduce((ss,mm)=>ss+(mm.nMinus1??0),0),0),[allModels]);
  const highest   =catTotals.length?catTotals.reduce((a,b)=>a.n>=b.n?a:b):null;
  const lowest    =catTotals.length?catTotals.reduce((a,b)=>a.n<=b.n?a:b):null;
  const statesCur =useMemo(()=>buildStateOrders(stateCur?.rows??[],"n"),[stateCur]);
  const statesPrev=useMemo(()=>buildStateOrders(statePrev?.rows??[],"n"),[statePrev]);
  const top5Cur   =[...statesCur].sort((a,b)=>b.orders-a.orders).slice(0,5);
  const top5Prev  =[...statesPrev].sort((a,b)=>b.orders-a.orders).slice(0,5);
  if(l1) return <Spinner/>;
  if(e1) return <Err msg={e1}/>;
  return (
    <div style={{background:PBI.pageBg,minHeight:"100vh",padding:"20px 24px",fontFamily:PBI.font}}>
      <div style={{marginBottom:20}}><h1 style={{margin:0,fontSize:20,fontWeight:600,color:PBI.textPrimary}}>Trends &amp; Client Base</h1><p style={{margin:"2px 0 0",fontSize:12,color:PBI.textMuted}}>Sales Trends · {yearN} vs {yearNm1}</p></div>
      <FilterBar style={{marginBottom:12}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:16,alignItems:"stretch"}}>
        <KpiCard label="Total Sales" value={fmtN(totalN)} sub={`${fmtN(totalNM1)} in ${yearNm1}`} trend={pct(totalN,totalNM1,yearNm1)}/>
        <KpiCard label="Total Categories" value={String(categories.length)} sub={`${categories.reduce((s,c)=>s+c.models.length,0)} models tracked`}/>
        {highest&&<div style={card}><p style={{margin:"0 0 6px",fontSize:11,color:PBI.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Highest Selling Category</p><div style={{display:"flex",alignItems:"center",gap:7,margin:"8px 0 5px"}}><span style={{display:"inline-block",width:11,height:11,borderRadius:2,background:highest.color,flexShrink:0}}/><p style={{margin:0,fontSize:18,fontWeight:700,color:PBI.textPrimary}}>{highest.label}</p></div><p style={{margin:"2px 0 0",fontSize:22,fontWeight:700,color:PBI.green,lineHeight:1.1}}>{fmtN(highest.n)}<span style={{fontSize:11,fontWeight:400,color:PBI.textMuted,marginLeft:4}}>units</span></p>{pct(highest.n,highest.nM1,yearNm1)&&(()=>{const t=pct(highest.n,highest.nM1,yearNm1);return<p style={{margin:"6px 0 0",fontSize:12,color:t.up?PBI.green:PBI.red}}>{t.up?"▲":"▼"} {t.label}</p>;})()}</div>}
        {lowest&&<div style={card}><p style={{margin:"0 0 6px",fontSize:11,color:PBI.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>Lowest Selling Category</p><div style={{display:"flex",alignItems:"center",gap:7,margin:"8px 0 5px"}}><span style={{display:"inline-block",width:11,height:11,borderRadius:2,background:lowest.color,flexShrink:0}}/><p style={{margin:0,fontSize:18,fontWeight:700,color:PBI.textPrimary}}>{lowest.label}</p></div><p style={{margin:"2px 0 0",fontSize:22,fontWeight:700,color:PBI.red,lineHeight:1.1}}>{fmtN(lowest.n)}<span style={{fontSize:11,fontWeight:400,color:PBI.textMuted,marginLeft:4}}>units</span></p>{pct(lowest.n,lowest.nM1,yearNm1)&&(()=>{const t=pct(lowest.n,lowest.nM1,yearNm1);return<p style={{margin:"6px 0 0",fontSize:12,color:t.up?PBI.green:PBI.red}}>{t.up?"▲":"▼"} {t.label}</p>;})()}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.2fr",gap:12,marginBottom:16,alignItems:"stretch"}}>
        <DonutCard year={yearN} catTotals={catTotals} dataKey="n"/>
        <DonutCard year={yearNm1} catTotals={catTotals} dataKey="nM1"/>
        <ModelsBarCard categories={categories} yearN={yearN}/>
      </div>
      <TrendsTable categories={categories} expandedCats={expandedCats} toggleCat={toggleCat} yearN={yearN} yearNm1={yearNm1}/>
    </div>
  );
}

export default function ATrends() {
  return <Layout><FilterProvider><TrendsPage/></FilterProvider></Layout>;
}
