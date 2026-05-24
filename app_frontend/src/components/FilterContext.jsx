/**
 * FilterContext.jsx — Unified Agency → Commercial filter (Director scope)
 *
 * Filter: Year · Agency → Commercial
 * Exposes selectedYear (defaults to current year) so pages can pass it to hooks.
 */

import { createContext, useContext, useState, useEffect } from "react";
import { fetchDashboard } from "../api/dashboardApi";

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - 5 + i);

const FilterContext = createContext(null);

// Provider exposing director/global filters (agency → commercial, year)
export function FilterProvider({ children }) {
  const [agencies, setAgencies] = useState([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState(null);
  const [selectedCommercialId, setSelectedCommercialId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(THIS_YEAR);

  useEffect(() => {
    fetchDashboard("/dashboard/global/filters")
      .then((result) => {
        const agencyList = (result.agencies ?? []).map((name) => ({
          id: name,
          label: name,
          commercials: [],
        }));
        setAgencies(agencyList);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAgencyId) return;
    fetchDashboard("/dashboard/global/filters/commercials", {
      agency_name: selectedAgencyId,
    })
      .then((result) => {
        const comms = (result.commercials ?? []).map((c) => ({
          id: String(c.id),
          label: c.name,
        }));
        setAgencies((prev) =>
          prev.map((a) =>
            a.id === selectedAgencyId ? { ...a, commercials: comms } : a,
          ),
        );
      })
      .catch(() => {});
  }, [selectedAgencyId]); // year doesn't affect which commercials belong to an agency

  const selectedAgency =
    agencies.find((a) => a.id === selectedAgencyId) ?? null;
  const selectedCommercial =
    selectedAgency?.commercials.find((c) => c.id === selectedCommercialId) ??
    null;

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
    setSelectedYear(THIS_YEAR);
  };

  return (
    <FilterContext.Provider
      value={{
        agencies,
        selectedAgency,
        selectedCommercial,
        selectedYear,
        setSelectedYear,
        setAgency,
        setCommercial,
        clearFilters,
        isFiltered: !!(selectedAgencyId || selectedYear !== THIS_YEAR),
      }}
    >
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
  barBg: "#FFFFFF",
  barBorder: "1px solid #E1DFDD",
  radius: 2,
  btnBorder: "1px solid #E1DFDD",
  btnBorderHov: "1px solid #C8C6C4",
  btnBorderAct: "1px solid #0078D4",
  btnBgDis: "#FAF9F8",
  listShadow: "0 4px 12px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)",
  itemHov: "#F3F2F1",
  itemSel: "#DEECF9",
  itemSelClr: "#0078D4",
  itemSelBdr: "#0078D4",
  clearHov: "#FDE7E9",
  clearHovClr: "#D13438",
  labelClr: "#A19F9D",
  valueClr: "#201F1E",
  mutedClr: "#A19F9D",
  disabledClr: "#C8C6C4",
  agencyBg: "#DEECF9",
  agencyClr: "#004E8C",
  agencyBdr: "#B3D6F0",
  commBg: "#EDE8F4",
  commClr: "#3C3489",
  commBdr: "#C9C0E0",
  yearBg: "#E8F8E8",
  yearClr: "#0A5C0A",
  yearBdr: "#9FD49F",
  clearBtnBdr: "#E1DFDD",
  clearBtnClr: "#605E5C",
  font: "'Segoe UI', 'Segoe UI Web (West European)', system-ui, sans-serif",
};

// ─── YearPicker ───────────────────────────────────────────────────────────────
function YearPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", minWidth: 120 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          padding: "5px 9px",
          background: S.barBg,
          border: open ? S.btnBorderAct : S.btnBorder,
          borderRadius: S.radius,
          boxShadow: open ? "0 0 0 1px #0078D4" : "none",
          cursor: "pointer",
          fontFamily: S.font,
          outline: "none",
          transition: "border-color .1s",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.border = S.btnBorderHov;
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.border = S.btnBorder;
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 1.3,
              color: S.labelClr,
            }}
          >
            Year
          </span>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              color: S.valueClr,
              fontWeight: 600,
            }}
          >
            {value} vs {value - 1}
          </span>
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .12s",
          }}
        >
          <path
            d="M1 3l4 4 4-4"
            stroke="#605E5C"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 3px)",
              left: 0,
              minWidth: "100%",
              background: S.barBg,
              border: "1px solid #E1DFDD",
              borderRadius: S.radius,
              zIndex: 99,
              boxShadow: S.listShadow,
              overflow: "hidden",
            }}
          >
            {YEAR_OPTIONS.slice()
              .reverse()
              .map((yr) => (
                <div
                  key={yr}
                  onClick={() => {
                    onChange(yr);
                    setOpen(false);
                  }}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: S.font,
                    background: yr === value ? S.itemSel : "",
                    color: yr === value ? S.itemSelClr : S.valueClr,
                    fontWeight: yr === value ? 600 : 400,
                    borderLeft:
                      yr === value
                        ? `2px solid ${S.itemSelBdr}`
                        : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (yr !== value)
                      e.currentTarget.style.background = S.itemHov;
                  }}
                  onMouseLeave={(e) => {
                    if (yr !== value) e.currentTarget.style.background = "";
                  }}
                >
                  {yr}{" "}
                  <span style={{ fontSize: 10, color: S.mutedClr }}>
                    vs {yr - 1}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({
  sublabel,
  value,
  placeholder,
  options,
  onChange,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <div style={{ position: "relative", minWidth: 172 }}>
      <button
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          padding: "5px 9px",
          background: disabled ? S.btnBgDis : S.barBg,
          border: open ? S.btnBorderAct : S.btnBorder,
          borderRadius: S.radius,
          boxShadow: open ? "0 0 0 1px #0078D4" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: S.font,
          outline: "none",
          transition: "border-color .1s",
        }}
        onMouseEnter={(e) => {
          if (!disabled && !open) e.currentTarget.style.border = S.btnBorderHov;
        }}
        onMouseLeave={(e) => {
          if (!disabled && !open) e.currentTarget.style.border = S.btnBorder;
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 1.3,
              color: disabled ? S.disabledClr : S.labelClr,
            }}
          >
            {sublabel}
          </span>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              color: disabled
                ? S.disabledClr
                : selected
                  ? S.valueClr
                  : S.mutedClr,
            }}
          >
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .12s",
          }}
        >
          <path
            d="M1 3l4 4 4-4"
            stroke={disabled ? S.disabledClr : "#605E5C"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 3px)",
              left: 0,
              minWidth: "100%",
              maxHeight: 200,
              overflowY: "auto",
              background: S.barBg,
              border: "1px solid #E1DFDD",
              borderRadius: S.radius,
              zIndex: 99,
              boxShadow: S.listShadow,
            }}
          >
            {value && (
              <div
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                style={{
                  padding: "7px 12px",
                  fontSize: 11,
                  cursor: "pointer",
                  color: "#605E5C",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  borderBottom: "1px solid #EDEBE9",
                  fontFamily: S.font,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = S.clearHov;
                  e.currentTarget.style.color = S.clearHovClr;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#605E5C";
                }}
              >
                <span style={{ fontSize: 10 }}>✕</span> Clear selection
              </div>
            )}
            {options.map((opt) => (
              <div
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  padding: "7px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: S.font,
                  background: opt.id === value ? S.itemSel : "",
                  color: opt.id === value ? S.itemSelClr : S.valueClr,
                  fontWeight: opt.id === value ? 600 : 400,
                  borderLeft:
                    opt.id === value
                      ? `2px solid ${S.itemSelBdr}`
                      : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (opt.id !== value)
                    e.currentTarget.style.background = S.itemHov;
                }}
                onMouseLeave={(e) => {
                  if (opt.id !== value) e.currentTarget.style.background = "";
                }}
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

export function FilterBar({ style }) {
  const {
    agencies,
    selectedAgency,
    selectedCommercial,
    selectedYear,
    setSelectedYear,
    setAgency,
    setCommercial,
    clearFilters,
    isFiltered,
  } = useFilter();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "9px 14px",
        background: S.barBg,
        border: S.barBorder,
        borderRadius: S.radius,
        fontFamily: S.font,
        ...style,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        style={{ flexShrink: 0, opacity: 0.45 }}
      >
        <path
          d="M1 2h14l-5 5v6l-4-2V7L1 2z"
          stroke="#605E5C"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: S.labelClr,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
          marginRight: 4,
        }}
      >
        Filters
      </span>
      <div
        style={{ width: 1, height: 20, background: "#E1DFDD", margin: "0 2px" }}
      />
      <YearPicker value={selectedYear} onChange={setSelectedYear} />
      <div
        style={{ width: 1, height: 20, background: "#E1DFDD", margin: "0 2px" }}
      />
      <Dropdown
        sublabel="Agency"
        placeholder="All agencies"
        options={agencies.map((a) => ({ id: a.id, label: a.label }))}
        value={selectedAgency?.id ?? null}
        onChange={setAgency}
      />
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        style={{
          flexShrink: 0,
          opacity: selectedAgency ? 1 : 0.2,
          transition: "opacity .15s",
        }}
      >
        <path
          d="M2 7h10M8 3l4 4-4 4"
          stroke="#0078D4"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Dropdown
        sublabel="Commercial"
        placeholder={selectedAgency ? "All commercials" : "Select agency first"}
        options={(selectedAgency?.commercials ?? []).map((c) => ({
          id: c.id,
          label: c.label,
        }))}
        value={selectedCommercial?.id ?? null}
        onChange={setCommercial}
        disabled={!selectedAgency}
      />
      {isFiltered && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexWrap: "wrap",
            marginLeft: 2,
          }}
        >
          {selectedYear !== THIS_YEAR && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: S.radius,
                background: S.yearBg,
                color: S.yearClr,
                border: `1px solid ${S.yearBdr}`,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {selectedYear} vs {selectedYear - 1}
              <span
                onClick={() => setSelectedYear(THIS_YEAR)}
                style={{
                  cursor: "pointer",
                  fontSize: 10,
                  opacity: 0.55,
                  lineHeight: 1,
                }}
              >
                ✕
              </span>
            </span>
          )}
          {selectedAgency && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: S.radius,
                background: S.agencyBg,
                color: S.agencyClr,
                border: `1px solid ${S.agencyBdr}`,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {selectedAgency.label}
              <span
                onClick={() => setAgency(null)}
                style={{
                  cursor: "pointer",
                  fontSize: 10,
                  opacity: 0.55,
                  lineHeight: 1,
                }}
              >
                ✕
              </span>
            </span>
          )}
          {selectedCommercial && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: S.radius,
                background: S.commBg,
                color: S.commClr,
                border: `1px solid ${S.commBdr}`,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {selectedCommercial.label}
              <span
                onClick={() => setCommercial(null)}
                style={{
                  cursor: "pointer",
                  fontSize: 10,
                  opacity: 0.55,
                  lineHeight: 1,
                }}
              >
                ✕
              </span>
            </span>
          )}
          <button
            onClick={clearFilters}
            style={{
              padding: "2px 8px",
              borderRadius: S.radius,
              fontSize: 11,
              background: "transparent",
              border: `1px solid ${S.clearBtnBdr}`,
              color: S.clearBtnClr,
              cursor: "pointer",
              fontFamily: S.font,
              transition: "all .1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#D13438";
              e.currentTarget.style.color = "#D13438";
              e.currentTarget.style.background = "#FDE7E9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = S.clearBtnBdr;
              e.currentTarget.style.color = S.clearBtnClr;
              e.currentTarget.style.background = "transparent";
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
