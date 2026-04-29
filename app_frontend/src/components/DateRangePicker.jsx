// components/DateRangePicker.jsx
// Full rewrite — dual calendar, sales-relevant presets, dark-mode safe, right-aligned popover.
//
// Usage:
//   import { DateRangePicker, DEFAULT_PRESETS } from "./DateRangePicker"
//   const [range, setRange] = useState(undefined)
//   <DateRangePicker value={range} onChange={setRange} />
//
// range shape: { from: Date, to: Date } | undefined

import { useState, useRef, useEffect } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");

const fmtShort = (d) =>
  d
    ? `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
    : null;

const isSameDay = (a, b) =>
  a && b &&
  a.getDate()     === b.getDate()     &&
  a.getMonth()    === b.getMonth()    &&
  a.getFullYear() === b.getFullYear();

const startOfMonth = (y, m) => new Date(y, m, 1);
const endOfMonth   = (y, m) => new Date(y, m + 1, 0);

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function matchesPreset(range, preset) {
  if (!range?.from || !range?.to) return false;
  return (
    isSameDay(range.from, preset.dateRange.from) &&
    isSameDay(range.to,   preset.dateRange.to)
  );
}

// ── Presets ────────────────────────────────────────────────────────────────────

function buildPresets() {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();
  const today = new Date(y, m, now.getDate());

  const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
  const prevQStart = new Date(qStart);
  prevQStart.setMonth(prevQStart.getMonth() - 3);
  const prevQEnd = new Date(qStart);
  prevQEnd.setDate(prevQEnd.getDate() - 1);

  const prevMStart = new Date(y, m - 1, 1);
  const prevMEnd   = new Date(y, m, 0);

  return [
    {
      label: "This Month",
      dateRange: { from: new Date(y, m, 1), to: today },
    },
    {
      label: "Last Month",
      dateRange: { from: prevMStart, to: prevMEnd },
    },
    {
      label: "This Quarter",
      dateRange: { from: qStart, to: today },
    },
    {
      label: "Last Quarter",
      dateRange: { from: prevQStart, to: prevQEnd },
    },
    {
      label: "This Year",
      dateRange: { from: new Date(y, 0, 1), to: today },
    },
    {
      label: "Last Year",
      dateRange: { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) },
    },
    {
      label: "Last 3 Months",
      dateRange: { from: addMonths(today, -3), to: today },
    },
    {
      label: "Last 6 Months",
      dateRange: { from: addMonths(today, -6), to: today },
    },
  ];
}

export const DEFAULT_PRESETS = buildPresets();

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── Colours (dark-shell safe — inline only, no Tailwind dark:) ─────────────────

const C = {
  bg:           "#ffffff",
  bgPopover:    "#ffffff",
  bgHover:      "#f3f2f1",
  bgRangeStrip: "#deecf9",
  bgPresetActive:"#deecf9",
  border:       "#edebe9",
  borderStrong: "#d2d0ce",
  accent:       "#0078d4",
  accentHover:  "#106ebe",
  textPrimary:  "#201f1e",
  textSecondary:"#605e5c",
  textMuted:    "#a19f9d",
  textAccent:   "#0078d4",
  today:        "#c19c00",
};

// ── Calendar (single month) ────────────────────────────────────────────────────

function Calendar({ month, year, onMonthChange, range, hovered, onHover, onSelect, disableNavPrev }) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const isStart = (d) => d && range?.from && isSameDay(d, range.from);
  const isEnd   = (d) => d && range?.to   && isSameDay(d, range.to);

  const isInRange = (d) => {
    if (!d || !range?.from) return false;
    const end = range.to || hovered;
    if (!end) return false;
    const lo = range.from <= end ? range.from : end;
    const hi = range.from <= end ? end : range.from;
    return d > lo && d < hi;
  };

  const isRangeStart = (d) => {
    // for strip — is the day to the right of it in range?
    if (!d || !range?.from) return false;
    const end = range.to || hovered;
    if (!end) return false;
    return isSameDay(d, range.from < end ? range.from : end);
  };

  const isRangeEnd = (d) => {
    if (!d || !range?.from) return false;
    const end = range.to || hovered;
    if (!end) return false;
    return isSameDay(d, range.from < end ? end : range.from);
  };

  const prev = () => month === 0  ? onMonthChange(11, year - 1) : onMonthChange(month - 1, year);
  const next = () => month === 11 ? onMonthChange(0,  year + 1) : onMonthChange(month + 1, year);

  return (
    <div style={{ padding: "16px 14px", userSelect: "none", minWidth: 224 }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={prev}
          disabled={disableNavPrev}
          style={{
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6, border: "none", background: "transparent", cursor: disableNavPrev ? "default" : "pointer",
            color: disableNavPrev ? C.textMuted : C.textSecondary,
          }}
          onMouseEnter={e => { if (!disableNavPrev) e.currentTarget.style.background = C.bgHover; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>
          {MONTHS[month]} {year}
        </span>

        <button
          onClick={next}
          style={{
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6, border: "none", background: "transparent", cursor: "pointer",
            color: C.textSecondary,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.bgHover; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: C.textMuted, padding: "2px 0", letterSpacing: "0.04em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;

          const start   = isStart(d);
          const end     = isEnd(d);
          const inRange = isInRange(d);
          const rStart  = isRangeStart(d);
          const rEnd    = isRangeEnd(d);
          const isToday = isSameDay(d, new Date());
          const isSelected = start || end;

          // range strip: full-width background connecting selected days
          const showStripRight = rStart && !isSameDay(range?.from, range?.to || hovered);
          const showStripLeft  = rEnd   && !isSameDay(range?.from, range?.to || hovered);
          const colIndex = (firstDay + d.getDate() - 1) % 7;
          const isLastCol  = colIndex === 6;
          const isFirstCol = colIndex === 0;

          return (
            <div
              key={d.toISOString()}
              style={{ position: "relative", height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(d)}
            >
              {/* Range strip background */}
              {(inRange || showStripRight || showStripLeft) && (
                <div style={{
                  position: "absolute",
                  top: 4, bottom: 4,
                  left:  (showStripRight && !isFirstCol) || inRange ? 0 : "50%",
                  right: (showStripLeft  && !isLastCol)  || inRange ? 0 : "50%",
                  background: C.bgRangeStrip,
                  zIndex: 0,
                }} />
              )}

              {/* Day circle */}
              <div style={{
                position: "relative", zIndex: 1,
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isSelected ? 600 : isToday ? 500 : 400,
                background: isSelected ? C.accent : "transparent",
                color: isSelected ? "#fff" : inRange ? C.textAccent : C.textPrimary,
                transition: "background 0.1s",
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.bgHover; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {isToday && !isSelected && (
                  <span style={{
                    position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)",
                    width: 3, height: 3, borderRadius: "50%", background: C.today,
                  }} />
                )}
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  placeholder = "Select date range",
}) {
  const today = new Date();

  const [open,    setOpen]    = useState(false);
  const [hovered, setHovered] = useState(null);
  const [picking, setPicking] = useState(null); // first selected date, awaiting second
  const [leftMonth,  setLeftMonth]  = useState(today.getMonth() === 0 ? 11 : today.getMonth() - 1);
  const [leftYear,   setLeftYear]   = useState(today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear());
  const [rightMonth, setRightMonth] = useState(today.getMonth());
  const [rightYear,  setRightYear]  = useState(today.getFullYear());

  const ref = useRef(null);

  // Keep right always one ahead of left
  function setLeft(m, y) {
    setLeftMonth(m);
    setLeftYear(y);
    // advance right if it would be behind or equal
    const rightDate = new Date(rightYear, rightMonth, 1);
    const newLeft   = new Date(y, m, 1);
    if (rightDate <= newLeft) {
      const next = addMonths(newLeft, 1);
      setRightMonth(next.getMonth());
      setRightYear(next.getFullYear());
    }
  }

  function setRight(m, y) {
    setRightMonth(m);
    setRightYear(y);
    const leftDate = new Date(leftYear, leftMonth, 1);
    const newRight = new Date(y, m, 1);
    if (leftDate >= newRight) {
      const prev = addMonths(newRight, -1);
      setLeftMonth(prev.getMonth());
      setLeftYear(prev.getFullYear());
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setPicking(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync calendars to selected range when opening
  function handleOpen() {
    if (!open && value?.from) {
      const from = value.from;
      const to   = value.to || from;
      setLeftMonth(from.getMonth());
      setLeftYear(from.getFullYear());
      // right = to's month, but ensure it's after left
      const rightD = isSameDay(from, to)
        ? addMonths(from, 1)
        : to;
      setRightMonth(rightD.getMonth());
      setRightYear(rightD.getFullYear());
    }
    setOpen((o) => !o);
  }

  // Typed input state — DD/MM/YYYY strings shown in the footer inputs
  const toInputStr = (d) =>
    d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";

  const [fromInput, setFromInput] = useState(() => toInputStr(value?.from));
  const [toInput,   setToInput]   = useState(() => toInputStr(value?.to));
  const [fromErr,   setFromErr]   = useState(false);
  const [toErr,     setToErr]     = useState(false);

  // Keep inputs in sync when value changes externally (presets, calendar clicks)
  useEffect(() => { setFromInput(toInputStr(value?.from)); }, [value?.from]);
  useEffect(() => { setToInput(toInputStr(value?.to));     }, [value?.to]);

  // Parse DD/MM/YYYY → Date | null
  function parseInput(str) {
    const clean = str.replace(/[^\d/]/g, "");
    const parts = clean.split("/");
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(Number);
    if (!dd || !mm || !yyyy || yyyy < 1900 || yyyy > 2100) return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (isNaN(d) || d.getDate() !== dd || d.getMonth() !== mm - 1) return null;
    return d;
  }

  // Auto-insert slashes as user types (e.g. "01" → "01/")
  function formatTyping(raw, prev) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = "";
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) out += "/";
      out += digits[i];
    }
    return out;
  }

  function handleFromInput(raw) {
    const val = formatTyping(raw);
    setFromInput(val);
    const d = parseInput(val);
    if (d) {
      setFromErr(false);
      const to = value?.to && d <= value.to ? value.to : undefined;
      onChange({ from: d, to });
      // Navigate left calendar to that month
      setLeftMonth(d.getMonth());
      setLeftYear(d.getFullYear());
      const rightD = to ? to : addMonths(d, 1);
      setRightMonth(rightD.getMonth());
      setRightYear(rightD.getFullYear());
    } else {
      setFromErr(val.length === 10); // only flag error on complete input
    }
  }

  function handleToInput(raw) {
    const val = formatTyping(raw);
    setToInput(val);
    const d = parseInput(val);
    if (d) {
      setToErr(false);
      const from = value?.from && value.from <= d ? value.from : undefined;
      onChange({ from: from ?? d, to: d });
      // Navigate right calendar to that month
      setRightMonth(d.getMonth());
      setRightYear(d.getFullYear());
      if (from) { setLeftMonth(from.getMonth()); setLeftYear(from.getFullYear()); }
    } else {
      setToErr(val.length === 10);
    }
  }

  const handleSelect = (d) => {
    if (!picking) {
      setPicking(d);
      onChange({ from: d, to: undefined });
    } else {
      const from = picking <= d ? picking : d;
      const to   = picking <= d ? d : picking;
      onChange({ from, to });
      setPicking(null);
      setOpen(false);
    }
  };

  const handlePreset = (preset) => {
    onChange(preset.dateRange);
    setPicking(null);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(undefined);
    setPicking(null);
    setFromInput("");
    setToInput("");
    setFromErr(false);
    setToErr(false);
  };

  // Display label
  const activeRange = picking ? { from: picking, to: hovered || undefined } : value;
  const label = value?.from
    ? value.to
      ? `${fmtShort(value.from)}  –  ${fmtShort(value.to)}`
      : fmtShort(value.from)
    : placeholder;

  const activePresetIdx = presets.findIndex((p) => matchesPreset(value, p));

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block", width: "100%" }}>
      {/* Trigger */}
      <button
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "7px 12px",
          background: open ? "#f3f2f1" : C.bg,
          border: `1px solid ${open ? C.accent + "60" : C.border}`,
          borderRadius: 8, cursor: "pointer",
          fontSize: 12, color: value?.from ? C.textPrimary : C.textSecondary,
          transition: "all 0.15s", textAlign: "left",
        }}
      >
        {/* Calendar icon */}
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: C.textSecondary }}>
          <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 6h12" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>

        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>

        {/* Clear × */}
        {value && (
          <span
            onClick={handleClear}
            style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}
            onMouseEnter={e => e.currentTarget.style.color = C.textPrimary}
            onMouseLeave={e => e.currentTarget.style.color = C.textSecondary}
          >×</span>
        )}

        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: C.textMuted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: "absolute", zIndex: 9999,
          top: "calc(100% + 6px)", right: 0,
          display: "flex",
          background: C.bgPopover,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
          minWidth: 560,
        }}>

          {/* ── Presets sidebar ─────────────────────────────────── */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 2,
            padding: "14px 10px",
            borderRight: `1px solid ${C.border}`,
            minWidth: 140,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px 8px" }}>
              Presets
            </div>
            {presets.map((p, i) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                style={{
                  textAlign: "left", fontSize: 12, padding: "6px 10px",
                  borderRadius: 6, border: "none", cursor: "pointer",
                  fontWeight: i === activePresetIdx ? 500 : 400,
                  background: i === activePresetIdx ? C.bgPresetActive : "transparent",
                  color: i === activePresetIdx ? C.textAccent : C.textSecondary,
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { if (i !== activePresetIdx) { e.currentTarget.style.background = C.bgHover; e.currentTarget.style.color = C.textPrimary; }}}
                onMouseLeave={e => { if (i !== activePresetIdx) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSecondary; }}}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ── Dual calendars ──────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
              {/* Left calendar */}
              <div style={{ borderRight: `1px solid ${C.border}` }}>
                <Calendar
                  month={leftMonth}
                  year={leftYear}
                  onMonthChange={setLeft}
                  range={activeRange}
                  hovered={hovered}
                  onHover={setHovered}
                  onSelect={handleSelect}
                  disableNavPrev={false}
                />
              </div>

              {/* Right calendar — prev nav disabled when it would go behind left */}
              <div>
                <Calendar
                  month={rightMonth}
                  year={rightYear}
                  onMonthChange={setRight}
                  range={activeRange}
                  hovered={hovered}
                  onHover={setHovered}
                  onSelect={handleSelect}
                  disableNavPrev={
                    new Date(rightYear, rightMonth, 1) <=
                    addMonths(new Date(leftYear, leftMonth, 1), 1)
                  }
                />
              </div>
            </div>

            {/* Footer — typed inputs + actions */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px",
              borderTop: `1px solid ${C.border}`,
            }}>
              {/* From input */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 9, fontWeight: 600, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                  From
                </label>
                <input
                  type="text"
                  value={fromInput}
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  onChange={e => handleFromInput(e.target.value)}
                  style={{
                    width: 96, padding: "5px 8px",
                    background: "#fff",
                    border: `1px solid ${fromErr ? "#ef4444" : fromInput && !fromErr ? C.accent + "80" : C.borderStrong}`,
                    borderRadius: 6, fontSize: 12,
                    color: fromErr ? "#ef4444" : C.textPrimary,
                    outline: "none", fontFamily: "inherit",
                    letterSpacing: "0.02em",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = fromErr ? "#ef4444" : C.accent; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = fromErr ? "#ef4444" : fromInput && !fromErr ? C.accent + "80" : C.borderStrong; }}
                />
              </div>

              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 14, color: C.textMuted }}>
                <path d="M2 7h10M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>

              {/* To input */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 9, fontWeight: 600, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                  To
                </label>
                <input
                  type="text"
                  value={toInput}
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  onChange={e => handleToInput(e.target.value)}
                  style={{
                    width: 96, padding: "5px 8px",
                    background: "#fff",
                    border: `1px solid ${toErr ? "#ef4444" : toInput && !toErr ? C.accent + "80" : C.borderStrong}`,
                    borderRadius: 6, fontSize: 12,
                    color: toErr ? "#ef4444" : C.textPrimary,
                    outline: "none", fontFamily: "inherit",
                    letterSpacing: "0.02em",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = toErr ? "#ef4444" : C.accent; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = toErr ? "#ef4444" : toInput && !toErr ? C.accent + "80" : C.borderStrong; }}
                />
              </div>

              {/* Hint */}
              {picking && (
                <span style={{ fontSize: 10, color: C.textAccent, marginTop: 14, marginLeft: 2 }}>
                  Pick end date
                </span>
              )}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Clear */}
              {value && (
                <button
                  onClick={handleClear}
                  style={{
                    fontSize: 11, padding: "5px 10px", marginTop: 14,
                    background: "transparent",
                    border: `1px solid ${C.borderStrong}`,
                    borderRadius: 6, cursor: "pointer",
                    color: C.textSecondary, fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.textPrimary; e.currentTarget.style.borderColor = C.textSecondary; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textSecondary; e.currentTarget.style.borderColor = C.borderStrong; }}
                >
                  Clear
                </button>
              )}

              {/* Done */}
              <button
                onClick={() => { setOpen(false); setPicking(null); }}
                style={{
                  fontSize: 11, padding: "5px 14px", marginTop: 14,
                  background: C.accent, border: "none",
                  borderRadius: 6, cursor: "pointer",
                  color: "#fff", fontWeight: 500, fontFamily: "inherit",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.accentHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.accent; }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
