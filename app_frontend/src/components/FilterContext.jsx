/**
 * FilterContext.jsx — Unified Agency → Commercial filter
 *
 * Exports:
 *   <FilterProvider>   — wrap your app/route subtree
 *   <FilterBar />      — drop anywhere to render the filter UI
 *   useFilter()        — hook to read/set filters in any component
 *
 * useFilter() returns:
 *   {
 *     agencies:           Agency[],
 *     selectedAgency:     Agency | null,
 *     selectedCommercial: Commercial | null,
 *     dateFrom:           { month: number, year: number } | null,  // month 0-indexed
 *     dateTo:             { month: number, year: number } | null,
 *     setAgency:          (id: string | null) => void,
 *     setCommercial:      (id: string | null) => void,
 *     setDateFrom:        (d: { month: number, year: number } | null) => void,
 *     setDateTo:          (d: { month: number, year: number } | null) => void,
 *     clearFilters:       () => void,
 *     isFiltered:         boolean,
 *   }
 *
 * Data contract — replace AGENCY_DATA with your DWH hook:
 *   type Agency = {
 *     id:          string,
 *     label:       string,
 *     commercials: { id: string, label: string }[]
 *   }
 *
 * Filtering pattern in any chart / table:
 *   const { selectedAgency, selectedCommercial } = useFilter();
 *   const rows = rawData.filter(r => {
 *     if (selectedCommercial) return r.commercialId === selectedCommercial.id;
 *     if (selectedAgency)     return r.agencyId     === selectedAgency.id;
 *     return true;
 *   });
 */

import { createContext, useContext, useState } from "react";

// ─── Mock data — replace with DWH fetch ──────────────────────────────────────
const AGENCY_DATA = [
  {
    id: "agency_tunis", label: "Tunis",
    commercials: [
      { id: "c1", label: "Anis Mejri" },
      { id: "c2", label: "Sarra Haddad" },
      { id: "c3", label: "Karim Belhaj" },
    ],
  },
  {
    id: "agency_sfax", label: "Sfax",
    commercials: [
      { id: "c4", label: "Nour Trabelsi" },
      { id: "c5", label: "Yassine Ayari" },
    ],
  },
  {
    id: "agency_sousse", label: "Sousse",
    commercials: [
      { id: "c6", label: "Imen Khalil" },
      { id: "c7", label: "Mehdi Farhat" },
      { id: "c8", label: "Donia Saidi" },
    ],
  },
  {
    id: "agency_nabeul", label: "Nabeul",
    commercials: [
      { id: "c9",  label: "Rami Bouazizi" },
      { id: "c10", label: "Sirine Ben Ali" },
    ],
  },
  {
    id: "agency_bizerte", label: "Bizerte",
    commercials: [
      { id: "c11", label: "Tarek Mansour" },
    ],
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────
const FilterContext = createContext(null);

export function FilterProvider({ children, agencies = AGENCY_DATA }) {
  const [selectedAgencyId,     setSelectedAgencyId]     = useState(null);
  const [selectedCommercialId, setSelectedCommercialId] = useState(null);
  const [dateFrom,             setDateFrom]             = useState(null); // { month: 0-11, year }
  const [dateTo,               setDateTo]               = useState(null); // { month: 0-11, year }

  const selectedAgency     = agencies.find(a => a.id === selectedAgencyId) ?? null;
  const selectedCommercial = selectedAgency?.commercials.find(c => c.id === selectedCommercialId) ?? null;

  const setAgency = (id) => {
    setSelectedAgencyId(id);
    setSelectedCommercialId(null); // always reset commercial when agency changes
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
  // layout
  barBg:       "#FFFFFF",
  barBorder:   "1px solid #E1DFDD",
  radius:      2,
  // dropdown button
  btnBorder:   "1px solid #E1DFDD",
  btnBorderHov:"1px solid #C8C6C4",
  btnBorderAct:"1px solid #0078D4",
  btnBgDis:    "#FAF9F8",
  // list
  listShadow:  "0 4px 12px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)",
  itemHov:     "#F3F2F1",
  itemSel:     "#DEECF9",
  itemSelClr:  "#0078D4",
  itemSelBdr:  "#0078D4",
  clearHov:    "#FDE7E9",
  clearHovClr: "#D13438",
  // text
  labelClr:    "#A19F9D",
  valueClr:    "#201F1E",
  mutedClr:    "#A19F9D",
  disabledClr: "#C8C6C4",
  // pills
  agencyBg:    "#DEECF9",
  agencyClr:   "#004E8C",
  agencyBdr:   "#B3D6F0",
  commBg:      "#EDE8F4",
  commClr:     "#3C3489",
  commBdr:     "#C9C0E0",
  // pills — date range (amber)
  dateBg:      "#FFF4CE",
  dateClr:     "#7A4F00",
  dateBdr:     "#F5D57A",
  // clear button
  clearBtnBdr: "#E1DFDD",
  clearBtnClr: "#605E5C",
  font:        "'Segoe UI', 'Segoe UI Web (West European)', system-ui, sans-serif",
};

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({ sublabel, value, placeholder, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);

  const toggle = () => { if (!disabled) setOpen(o => !o); };
  const close  = () => setOpen(false);

  return (
    <div style={{ position: "relative", minWidth: 172 }}>
      {/* Button */}
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
          fontFamily: S.font, outline: "none",
          transition: "border-color .1s",
        }}
        onMouseEnter={e => { if (!disabled && !open) e.currentTarget.style.border = S.btnBorderHov; }}
        onMouseLeave={e => { if (!disabled && !open) e.currentTarget.style.border = S.btnBorder; }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase", lineHeight: 1.3,
            color: disabled ? S.disabledClr : S.labelClr,
          }}>
            {sublabel}
          </span>
          <span style={{
            fontSize: 12, lineHeight: 1.4,
            color: disabled ? S.disabledClr : selected ? S.valueClr : S.mutedClr,
          }}>
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }}
        >
          <path d="M1 3l4 4 4-4" stroke={disabled ? S.disabledClr : "#605E5C"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* List */}
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={close} />
          <div style={{
            position: "absolute", top: "calc(100% + 3px)", left: 0,
            minWidth: "100%", maxHeight: 200, overflowY: "auto",
            background: S.barBg, border: "1px solid #E1DFDD",
            borderRadius: S.radius, zIndex: 99,
            boxShadow: S.listShadow,
          }}>
            {/* Clear option */}
            {value && (
              <div
                onClick={() => { onChange(null); close(); }}
                style={{
                  padding: "7px 12px", fontSize: 11, cursor: "pointer",
                  color: "#605E5C", display: "flex", alignItems: "center", gap: 5,
                  borderBottom: "1px solid #EDEBE9", fontFamily: S.font,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = S.clearHov; e.currentTarget.style.color = S.clearHovClr; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#605E5C"; }}
              >
                <span style={{ fontSize: 10 }}>✕</span> Clear selection
              </div>
            )}
            {options.map((opt) => (
              <div
                key={opt.id}
                onClick={() => { onChange(opt.id); close(); }}
                style={{
                  padding: "7px 12px", fontSize: 12, cursor: "pointer",
                  fontFamily: S.font,
                  background: opt.id === value ? S.itemSel : "",
                  color:      opt.id === value ? S.itemSelClr : S.valueClr,
                  fontWeight: opt.id === value ? 600 : 400,
                  borderLeft: opt.id === value ? `2px solid ${S.itemSelBdr}` : "2px solid transparent",
                }}
                onMouseEnter={e => { if (opt.id !== value) e.currentTarget.style.background = S.itemHov; }}
                onMouseLeave={e => { if (opt.id !== value) e.currentTarget.style.background = ""; }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ─── Month/Year constants ─────────────────────────────────────────────────────
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 5 + i);

// ─── DateRangePicker ──────────────────────────────────────────────────────────
// Two linked "Month / Year" buttons (From, To) styled to match Dropdown.
function DateRangePicker({ dateFrom, dateTo, setDateFrom, setDateTo }) {
  const [openPanel, setOpenPanel] = useState(null); // "from" | "to" | null

  const closeAll = () => setOpenPanel(null);

  const pickDate = (side, month, year) => {
    const val = { month, year };
    if (side === "from") {
      setDateFrom(val);
      if (dateTo && (year > dateTo.year || (year === dateTo.year && month > dateTo.month)))
        setDateTo(null);
    } else {
      setDateTo(val);
      if (dateFrom && (year < dateFrom.year || (year === dateFrom.year && month < dateFrom.month)))
        setDateFrom(null);
    }
    setOpenPanel(null);
  };

  const Panel = ({ side }) => {
    const current = side === "from" ? dateFrom : dateTo;
    return (
      <>
        <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={closeAll} />
        <div style={{
          position:"absolute", top:"calc(100% + 3px)", left:0,
          width:200, background:S.barBg, border:"1px solid #E1DFDD",
          borderRadius:S.radius, zIndex:99, boxShadow:S.listShadow,
          padding:"10px 10px 8px", maxHeight:320, overflowY:"auto",
        }}>
          {YEAR_OPTIONS.map(yr => (
            <div key={yr}>
              <div style={{
                fontSize:10, fontWeight:700, color:S.labelClr, textTransform:"uppercase",
                letterSpacing:"0.06em", padding:"4px 2px 3px", fontFamily:S.font,
              }}>{yr}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:2, marginBottom:6 }}>
                {MONTH_LABELS.map((m, mi) => {
                  const isSel = current?.year === yr && current?.month === mi;
                  return (
                    <div key={mi} onClick={() => pickDate(side, mi, yr)} style={{
                      padding:"3px 0", textAlign:"center", borderRadius:2,
                      fontSize:11, cursor:"pointer", fontFamily:S.font,
                      background: isSel ? S.itemSel : "transparent",
                      color:      isSel ? S.itemSelClr : S.valueClr,
                      fontWeight: isSel ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = S.itemHov; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
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
        <button onClick={() => setOpenPanel(isOpen ? null : side)} style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          gap:8, padding:"5px 9px", minWidth:126,
          background:S.barBg,
          border: isOpen ? S.btnBorderAct : S.btnBorder,
          borderRadius:S.radius,
          boxShadow: isOpen ? "0 0 0 1px #0078D4" : "none",
          cursor:"pointer", fontFamily:S.font, outline:"none",
          transition:"border-color .1s",
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.border = S.btnBorderHov; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.border = isOpen ? S.btnBorderAct : S.btnBorder; }}
        >
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", lineHeight:1.3, color:S.labelClr }}>{label}</span>
            <span style={{ fontSize:12, lineHeight:1.4, color: value ? S.valueClr : S.mutedClr }}>
              {value || "All time"}
            </span>
          </div>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ flexShrink:0, transform: isOpen ? "rotate(180deg)" : "none", transition:"transform .12s" }}>
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
      <span style={{ fontSize:12, color:S.mutedClr, flexShrink:0 }}>{"\u2013"}</span>
      <Btn side="to"   label="To"   value={fmtDate(dateTo)}   />
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
export function FilterBar({ style }) {
  const {
    agencies, selectedAgency, selectedCommercial,
    dateFrom, dateTo, setDateFrom, setDateTo,
    setAgency, setCommercial, clearFilters, isFiltered,
  } = useFilter();

  const fmtDate = (d) => d ? `${MONTH_LABELS[d.month]} ${d.year}` : null;
  const hasDate = !!(dateFrom || dateTo);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      padding: "9px 14px",
      background: S.barBg,
      border: S.barBorder,
      borderRadius: S.radius,
      fontFamily: S.font,
      ...style,
    }}>
      {/* Funnel icon */}
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
        <path d="M1 2h14l-5 5v6l-4-2V7L1 2z" stroke="#605E5C" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      </svg>

      {/* Label */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: S.labelClr,
        textTransform: "uppercase", letterSpacing: "0.08em",
        whiteSpace: "nowrap", marginRight: 4,
      }}>
        Filters
      </span>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: "#E1DFDD", margin: "0 2px" }} />

      {/* Date range */}
      <DateRangePicker
        dateFrom={dateFrom} dateTo={dateTo}
        setDateFrom={setDateFrom} setDateTo={setDateTo}
      />

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: "#E1DFDD", margin: "0 2px" }} />

      {/* Agency */}
      <Dropdown
        sublabel="Agency"
        placeholder="All agencies"
        options={agencies.map(a => ({ id: a.id, label: a.label }))}
        value={selectedAgency?.id ?? null}
        onChange={setAgency}
      />

      {/* Connector arrow */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
        style={{ flexShrink: 0, opacity: selectedAgency ? 1 : 0.2, transition: "opacity .15s" }}>
        <path d="M2 7h10M8 3l4 4-4 4" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>

      {/* Commercial */}
      <Dropdown
        sublabel="Commercial"
        placeholder={selectedAgency ? "All commercials" : "Select agency first"}
        options={(selectedAgency?.commercials ?? []).map(c => ({ id: c.id, label: c.label }))}
        value={selectedCommercial?.id ?? null}
        onChange={setCommercial}
        disabled={!selectedAgency}
      />

      {/* Pills */}
      {isFiltered && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginLeft: 2 }}>

          {/* Date range pill */}
          {hasDate && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: S.radius,
              background: S.dateBg, color: S.dateClr,
              border: `1px solid ${S.dateBdr}`,
              fontSize: 11, fontWeight: 600,
            }}>
              {fmtDate(dateFrom) ?? "…"} – {fmtDate(dateTo) ?? "…"}
              <span onClick={() => { setDateFrom(null); setDateTo(null); }}
                style={{ cursor: "pointer", fontSize: 10, opacity: 0.55, lineHeight: 1 }}>✕</span>
            </span>
          )}

          {selectedAgency && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: S.radius,
              background: S.agencyBg, color: S.agencyClr,
              border: `1px solid ${S.agencyBdr}`,
              fontSize: 11, fontWeight: 600,
            }}>
              {selectedAgency.label}
              <span
                onClick={() => setAgency(null)}
                style={{ cursor: "pointer", fontSize: 10, opacity: 0.55, lineHeight: 1 }}
              >✕</span>
            </span>
          )}
          {selectedCommercial && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: S.radius,
              background: S.commBg, color: S.commClr,
              border: `1px solid ${S.commBdr}`,
              fontSize: 11, fontWeight: 600,
            }}>
              {selectedCommercial.label}
              <span
                onClick={() => setCommercial(null)}
                style={{ cursor: "pointer", fontSize: 10, opacity: 0.55, lineHeight: 1 }}
              >✕</span>
            </span>
          )}
          <button
            onClick={clearFilters}
            style={{
              padding: "2px 8px", borderRadius: S.radius, fontSize: 11,
              background: "transparent", border: `1px solid ${S.clearBtnBdr}`,
              color: S.clearBtnClr, cursor: "pointer", fontFamily: S.font,
              transition: "all .1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#D13438"; e.currentTarget.style.color = "#D13438"; e.currentTarget.style.background = "#FDE7E9"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = S.clearBtnBdr; e.currentTarget.style.color = S.clearBtnClr; e.currentTarget.style.background = "transparent"; }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
