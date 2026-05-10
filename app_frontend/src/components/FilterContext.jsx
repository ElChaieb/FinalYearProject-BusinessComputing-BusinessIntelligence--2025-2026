/**
 * FilterContext.jsx — Unified Agency → Commercial filter (Director scope)
 *
 * Identical public API to the original, but:
 *  - Agency + commercial lists are fetched from /dashboard/global/filters
 *  - Mock AGENCY_DATA constant removed
 *  - Everything else (DateRangePicker, Dropdown, FilterBar UI) is unchanged
 */

import { createContext, useContext, useState, useEffect } from "react";
import { fetchDashboard } from "../api/dashboardApi";

// ─── Context ──────────────────────────────────────────────────────────────────
const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [agencies,             setAgencies]             = useState([]);
  const [selectedAgencyId,     setSelectedAgencyId]     = useState(null);
  const [selectedCommercialId, setSelectedCommercialId] = useState(null);
  const [dateFrom,             setDateFrom]             = useState(null);
  const [dateTo,               setDateTo]               = useState(null);

  // Load agencies + their commercials from the API once
  useEffect(() => {
    fetchDashboard("/dashboard/global/filters")
      .then((result) => {
        // Build agency objects with a flat commercials list
        // The global/filters endpoint returns { agencies: string[], categories, years }
        // We also need per-agency commercial lists — fetched per-agency lazily or
        // via the agency endpoint.  For now we expose agencies as flat list;
        // the commercial dropdown is disabled until an agency is selected,
        // then we load that agency's commercials on demand.
        const agencyList = (result.agencies ?? []).map((name) => ({
          id:          name,
          label:       name,
          commercials: [], // populated on-demand below
        }));
        setAgencies(agencyList);
      })
      .catch(() => {/* silently degrade to empty list */});
  }, []);

  // Load commercials for the selected agency when it changes
  useEffect(() => {
    if (!selectedAgencyId) return;

    // We reuse the agency/filters endpoint scoped to the selected agency by
    // temporarily fetching it with an impersonation-style cache key.
    // Since the backend scopes by user.agency_name we can't call it directly
    // from a director context — instead we call the global revenue by-agency
    // endpoint and extract the unique user names.
    fetchDashboard("/dashboard/global/revenue/by-agency", { year: new Date().getFullYear() })
      .then((result) => {
        // Extract commercials that belong to the selected agency from rows
        const comms = (result.rows ?? [])
          .filter((r) => r.agency_name === selectedAgencyId)
          .reduce((acc, r) => {
            if (r.full_name && !acc.find((c) => c.id === r.user_id)) {
              acc.push({ id: String(r.user_id ?? r.full_name), label: r.full_name });
            }
            return acc;
          }, []);

        setAgencies((prev) =>
          prev.map((a) =>
            a.id === selectedAgencyId ? { ...a, commercials: comms } : a
          )
        );
      })
      .catch(() => {});
  }, [selectedAgencyId]);

  const selectedAgency     = agencies.find((a) => a.id === selectedAgencyId) ?? null;
  const selectedCommercial = selectedAgency?.commercials.find((c) => c.id === selectedCommercialId) ?? null;

  const setAgency = (id) => {
    setSelectedAgencyId(id);
    setSelectedCommercialId(null);
  };

  const setCommercial = (id) => {
    if (!selectedAgencyId) return;
    setSelectedCommercialId(id);
  };

  const clearFilters = () => {
    setSelectedAgencyId(null);
    setSelectedCommercialId(null);
    setDateFrom(null);
    setDateTo(null);
  };

  return (
    <FilterContext.Provider value={{
      agencies,
      selectedAgency,
      selectedCommercial,
      dateFrom,
      dateTo,
      setAgency,
      setCommercial,
      setDateFrom,
      setDateTo,
      clearFilters,
      isFiltered: !!(selectedAgencyId || dateFrom || dateTo),
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const S = {
  barBg:       "#FFFFFF",
  barBorder:   "1px solid #E1DFDD",
  radius:      2,
  btnBorder:   "1px solid #E1DFDD",
  btnBorderHov:"1px solid #C8C6C4",
  btnBorderAct:"1px solid #0078D4",
  btnBgDis:    "#FAF9F8",
  listShadow:  "0 4px 12px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)",
  itemHov:     "#F3F2F1",
  itemSel:     "#DEECF9",
  itemSelClr:  "#0078D4",
  itemSelBdr:  "#0078D4",
  clearHov:    "#FDE7E9",
  clearHovClr: "#D13438",
  labelClr:    "#A19F9D",
  valueClr:    "#201F1E",
  mutedClr:    "#A19F9D",
  disabledClr: "#C8C6C4",
  agencyBg:    "#DEECF9",
  agencyClr:   "#004E8C",
  agencyBdr:   "#B3D6F0",
  commBg:      "#EDE8F4",
  commClr:     "#3C3489",
  commBdr:     "#C9C0E0",
  dateBg:      "#FFF4CE",
  dateClr:     "#7A4F00",
  dateBdr:     "#F5D57A",
  clearBtnBdr: "#E1DFDD",
  clearBtnClr: "#605E5C",
  font:        "'Segoe UI', 'Segoe UI Web (West European)', system-ui, sans-serif",
};

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({ sublabel, value, placeholder, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const toggle = () => { if (!disabled) setOpen((o) => !o); };
  const close  = () => setOpen(false);
  return (
    <div style={{ position: "relative", minWidth: 172 }}>
      <button
        onClick={toggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, width: "100%", padding: "5px 9px",
          background: disabled ? S.btnBgDis : S.barBg,
          border: open ? S.btnBorderAct : S.btnBorder,
          borderRadius: S.radius,
          boxShadow: open ? "0 0 0 1px #0078D4" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: S.font, outline: "none", transition: "border-color .1s",
        }}
        onMouseEnter={(e) => { if (!disabled && !open) e.currentTarget.style.border = S.btnBorderHov; }}
        onMouseLeave={(e) => { if (!disabled && !open) e.currentTarget.style.border = S.btnBorder; }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.3, color: disabled ? S.disabledClr : S.labelClr }}>{sublabel}</span>
          <span style={{ fontSize: 12, lineHeight: 1.4, color: disabled ? S.disabledClr : selected ? S.valueClr : S.mutedClr }}>
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }}>
          <path d="M1 3l4 4 4-4" stroke={disabled ? S.disabledClr : "#605E5C"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={close} />
          <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, minWidth: "100%", maxHeight: 200, overflowY: "auto", background: S.barBg, border: "1px solid #E1DFDD", borderRadius: S.radius, zIndex: 99, boxShadow: S.listShadow }}>
            {value && (
              <div onClick={() => { onChange(null); close(); }}
                style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#605E5C", display: "flex", alignItems: "center", gap: 5, borderBottom: "1px solid #EDEBE9", fontFamily: S.font }}
                onMouseEnter={(e) => { e.currentTarget.style.background = S.clearHov; e.currentTarget.style.color = S.clearHovClr; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#605E5C"; }}
              ><span style={{ fontSize: 10 }}>✕</span> Clear selection</div>
            )}
            {options.map((opt) => (
              <div key={opt.id} onClick={() => { onChange(opt.id); close(); }}
                style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: S.font, background: opt.id === value ? S.itemSel : "", color: opt.id === value ? S.itemSelClr : S.valueClr, fontWeight: opt.id === value ? 600 : 400, borderLeft: opt.id === value ? `2px solid ${S.itemSelBdr}` : "2px solid transparent" }}
                onMouseEnter={(e) => { if (opt.id !== value) e.currentTarget.style.background = S.itemHov; }}
                onMouseLeave={(e) => { if (opt.id !== value) e.currentTarget.style.background = ""; }}
              >{opt.label}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 5 + i);

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
                      style={{ padding:"3px 0", textAlign:"center", borderRadius:2, fontSize:11, cursor:"pointer", fontFamily:S.font, background: isSel ? S.itemSel : "transparent", color: isSel ? S.itemSelClr : S.valueClr, fontWeight: isSel ? 600 : 400 }}
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
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, padding:"5px 9px", minWidth:126, background:S.barBg, border: isOpen ? S.btnBorderAct : S.btnBorder, borderRadius:S.radius, boxShadow: isOpen ? "0 0 0 1px #0078D4" : "none", cursor:"pointer", fontFamily:S.font, outline:"none", transition:"border-color .1s" }}
          onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.border = S.btnBorderHov; }}
          onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.border = isOpen ? S.btnBorderAct : S.btnBorder; }}
        >
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", lineHeight:1.3, color:S.labelClr }}>{label}</span>
            <span style={{ fontSize:12, lineHeight:1.4, color: value ? S.valueClr : S.mutedClr }}>{value || "All time"}</span>
          </div>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0, transform: isOpen ? "rotate(180deg)" : "none", transition:"transform .12s" }}>
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
      <span style={{ fontSize:12, color:S.mutedClr, flexShrink:0 }}>{"–"}</span>
      <Btn side="to"   label="To"   value={fmtDate(dateTo)}   />
    </div>
  );
}

export function FilterBar({ style }) {
  const { agencies, selectedAgency, selectedCommercial, dateFrom, dateTo, setDateFrom, setDateTo, setAgency, setCommercial, clearFilters, isFiltered } = useFilter();
  const fmtDate = (d) => d ? `${MONTH_LABELS[d.month]} ${d.year}` : null;
  const hasDate = !!(dateFrom || dateTo);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"9px 14px", background:S.barBg, border:S.barBorder, borderRadius:S.radius, fontFamily:S.font, ...style }}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, opacity:0.45 }}><path d="M1 2h14l-5 5v6l-4-2V7L1 2z" stroke="#605E5C" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>
      <span style={{ fontSize:10, fontWeight:700, color:S.labelClr, textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap", marginRight:4 }}>Filters</span>
      <div style={{ width:1, height:20, background:"#E1DFDD", margin:"0 2px" }} />
      <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />
      <div style={{ width:1, height:20, background:"#E1DFDD", margin:"0 2px" }} />
      <Dropdown sublabel="Agency" placeholder="All agencies" options={agencies.map((a) => ({ id: a.id, label: a.label }))} value={selectedAgency?.id ?? null} onChange={setAgency} />
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, opacity: selectedAgency ? 1 : 0.2, transition:"opacity .15s" }}><path d="M2 7h10M8 3l4 4-4 4" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <Dropdown sublabel="Commercial" placeholder={selectedAgency ? "All commercials" : "Select agency first"} options={(selectedAgency?.commercials ?? []).map((c) => ({ id: c.id, label: c.label }))} value={selectedCommercial?.id ?? null} onChange={setCommercial} disabled={!selectedAgency} />
      {isFiltered && (
        <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginLeft:2 }}>
          {hasDate && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:S.radius, background:S.dateBg, color:S.dateClr, border:`1px solid ${S.dateBdr}`, fontSize:11, fontWeight:600 }}>
              {fmtDate(dateFrom) ?? "…"} – {fmtDate(dateTo) ?? "…"}
              <span onClick={() => { setDateFrom(null); setDateTo(null); }} style={{ cursor:"pointer", fontSize:10, opacity:0.55, lineHeight:1 }}>✕</span>
            </span>
          )}
          {selectedAgency && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:S.radius, background:S.agencyBg, color:S.agencyClr, border:`1px solid ${S.agencyBdr}`, fontSize:11, fontWeight:600 }}>
              {selectedAgency.label}<span onClick={() => setAgency(null)} style={{ cursor:"pointer", fontSize:10, opacity:0.55, lineHeight:1 }}>✕</span>
            </span>
          )}
          {selectedCommercial && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:S.radius, background:S.commBg, color:S.commClr, border:`1px solid ${S.commBdr}`, fontSize:11, fontWeight:600 }}>
              {selectedCommercial.label}<span onClick={() => setCommercial(null)} style={{ cursor:"pointer", fontSize:10, opacity:0.55, lineHeight:1 }}>✕</span>
            </span>
          )}
          <button onClick={clearFilters}
            style={{ padding:"2px 8px", borderRadius:S.radius, fontSize:11, background:"transparent", border:`1px solid ${S.clearBtnBdr}`, color:S.clearBtnClr, cursor:"pointer", fontFamily:S.font, transition:"all .1s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor="#D13438"; e.currentTarget.style.color="#D13438"; e.currentTarget.style.background="#FDE7E9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor=S.clearBtnBdr; e.currentTarget.style.color=S.clearBtnClr; e.currentTarget.style.background="transparent"; }}
          >Clear all</button>
        </div>
      )}
    </div>
  );
}
