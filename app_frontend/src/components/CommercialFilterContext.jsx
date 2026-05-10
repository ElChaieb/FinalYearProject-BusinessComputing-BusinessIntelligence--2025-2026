/**
 * CommercialFilterContext.jsx — Date filter (Commercial scope)
 *
 * The commercial scope has no agency/user dropdown — only a date range.
 * Mock data removed; filter state is the single source of truth for the year
 * passed down to the /me/* hooks.
 */

import { createContext, useContext, useState } from "react";

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo,   setDateTo]   = useState(null);

  const clearFilters = () => { setDateFrom(null); setDateTo(null); };

  return (
    <FilterContext.Provider value={{
      dateFrom, dateTo, setDateFrom, setDateTo, clearFilters,
      isFiltered: !!(dateFrom || dateTo),
      // Derived: the year to pass to hooks (use dateFrom year, or current year)
      selectedYear: dateFrom?.year ?? new Date().getFullYear(),
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used inside <FilterProvider>");
  return ctx;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  barBg:"#FFFFFF", barBorder:"1px solid #E1DFDD", radius:2,
  btnBorder:"1px solid #E1DFDD", btnBorderHov:"1px solid #C8C6C4", btnBorderAct:"1px solid #0078D4",
  listShadow:"0 4px 12px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)",
  itemHov:"#F3F2F1", itemSel:"#DEECF9", itemSelClr:"#0078D4",
  labelClr:"#A19F9D", valueClr:"#201F1E", mutedClr:"#A19F9D",
  dateBg:"#FFF4CE", dateClr:"#7A4F00", dateBdr:"#F5D57A",
  clearBtnBdr:"#E1DFDD", clearBtnClr:"#605E5C",
  font:"'Segoe UI', 'Segoe UI Web (West European)', system-ui, sans-serif",
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length:6 }, (_,i) => CURRENT_YEAR - 5 + i);

function DateRangePicker({ dateFrom, dateTo, setDateFrom, setDateTo }) {
  const [openPanel, setOpenPanel] = useState(null);
  const closeAll = () => setOpenPanel(null);
  const pickDate = (side, month, year) => {
    const val = { month, year };
    if (side === "from") { setDateFrom(val); if (dateTo && (year > dateTo.year || (year === dateTo.year && month > dateTo.month))) setDateTo(null); }
    else { setDateTo(val); if (dateFrom && (year < dateFrom.year || (year === dateFrom.year && month < dateFrom.month))) setDateFrom(null); }
    setOpenPanel(null);
  };
  const Panel = ({ side }) => {
    const current = side === "from" ? dateFrom : dateTo;
    return (
      <>
        <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={closeAll} />
        <div style={{ position:"absolute", top:"calc(100% + 3px)", left:0, width:200, background:S.barBg, border:"1px solid #E1DFDD", borderRadius:S.radius, zIndex:99, boxShadow:S.listShadow, padding:"10px 10px 8px", maxHeight:320, overflowY:"auto" }}>
          {YEAR_OPTIONS.map((yr) => (
            <div key={yr}>
              <div style={{ fontSize:10, fontWeight:700, color:S.labelClr, textTransform:"uppercase", letterSpacing:"0.06em", padding:"4px 2px 3px", fontFamily:S.font }}>{yr}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:2, marginBottom:6 }}>
                {MONTH_LABELS.map((m, mi) => {
                  const isSel = current?.year === yr && current?.month === mi;
                  return (
                    <div key={mi} onClick={() => pickDate(side, mi, yr)}
                      style={{ padding:"3px 0", textAlign:"center", borderRadius:2, fontSize:11, cursor:"pointer", fontFamily:S.font, background:isSel?S.itemSel:"transparent", color:isSel?S.itemSelClr:S.valueClr, fontWeight:isSel?600:400 }}
                      onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = S.itemHov; }}
                      onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                    >{m}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };
  const Btn = ({ side, label, value }) => {
    const isOpen = openPanel === side;
    return (
      <div style={{ position:"relative" }}>
        <button onClick={() => setOpenPanel(isOpen ? null : side)}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, padding:"5px 9px", minWidth:126, background:S.barBg, border:isOpen?S.btnBorderAct:S.btnBorder, borderRadius:S.radius, boxShadow:isOpen?"0 0 0 1px #0078D4":"none", cursor:"pointer", fontFamily:S.font, outline:"none", transition:"border-color .1s" }}
          onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.border = S.btnBorderHov; }}
          onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.border = isOpen ? S.btnBorderAct : S.btnBorder; }}
        >
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", lineHeight:1.3, color:S.labelClr }}>{label}</span>
            <span style={{ fontSize:12, lineHeight:1.4, color:value?S.valueClr:S.mutedClr }}>{value || "All time"}</span>
          </div>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, transform:isOpen?"rotate(180deg)":"none", transition:"transform .12s" }}>
            <path d="M1 3l4 4 4-4" stroke="#605E5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {isOpen && <Panel side={side} />}
      </div>
    );
  };
  const fmtDate = (d) => d ? MONTH_LABELS[d.month] + " " + d.year : null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <Btn side="from" label="From" value={fmtDate(dateFrom)} />
      <span style={{ fontSize:12, color:S.mutedClr, flexShrink:0 }}>–</span>
      <Btn side="to"   label="To"   value={fmtDate(dateTo)}   />
    </div>
  );
}

export function FilterBar({ style }) {
  const { dateFrom, dateTo, setDateFrom, setDateTo, clearFilters, isFiltered } = useFilter();
  const fmtDate = (d) => d ? `${MONTH_LABELS[d.month]} ${d.year}` : null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"9px 14px", background:S.barBg, border:S.barBorder, borderRadius:S.radius, fontFamily:S.font, ...style }}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, opacity:0.45 }}><path d="M1 2h14l-5 5v6l-4-2V7L1 2z" stroke="#605E5C" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>
      <span style={{ fontSize:10, fontWeight:700, color:S.labelClr, textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap", marginRight:4 }}>Filters</span>
      <div style={{ width:1, height:20, background:"#E1DFDD", margin:"0 2px" }} />
      <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />
      {isFiltered && (
        <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:2 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:S.radius, background:S.dateBg, color:S.dateClr, border:`1px solid ${S.dateBdr}`, fontSize:11, fontWeight:600 }}>
            {fmtDate(dateFrom) ?? "…"} – {fmtDate(dateTo) ?? "…"}
            <span onClick={() => { setDateFrom(null); setDateTo(null); }} style={{ cursor:"pointer", fontSize:10, opacity:0.55, lineHeight:1 }}>✕</span>
          </span>
          <button onClick={clearFilters}
            style={{ padding:"2px 8px", borderRadius:S.radius, fontSize:11, background:"transparent", border:`1px solid ${S.clearBtnBdr}`, color:S.clearBtnClr, cursor:"pointer", fontFamily:S.font }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor="#D13438"; e.currentTarget.style.color="#D13438"; e.currentTarget.style.background="#FDE7E9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor=S.clearBtnBdr; e.currentTarget.style.color=S.clearBtnClr; e.currentTarget.style.background="transparent"; }}
          >Clear all</button>
        </div>
      )}
    </div>
  );
}
