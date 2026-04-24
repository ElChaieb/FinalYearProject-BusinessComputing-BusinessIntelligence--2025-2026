// src/components/DateRangePicker.jsx
// Drop-in replacement for Tremor's DateRangePicker with presets.
// No external dependencies — plain JSX + Tailwind v4.
//
// Usage:
//   import { DateRangePicker } from "./DateRangePicker"
//   const [range, setRange] = useState(undefined)
//   <DateRangePicker value={range} onChange={setRange} />
//
// range shape: { from: Date, to: Date } | undefined

import { useState, useRef, useEffect } from "react"

// ── Presets ───────────────────────────────────────────────────
export const DEFAULT_PRESETS = [
  {
    label: "Today",
    dateRange: { from: new Date(), to: new Date() },
  },
  {
    label: "Last 7 days",
    dateRange: {
      from: new Date(new Date().setDate(new Date().getDate() - 7)),
      to: new Date(),
    },
  },
  {
    label: "Last 30 days",
    dateRange: {
      from: new Date(new Date().setDate(new Date().getDate() - 30)),
      to: new Date(),
    },
  },
  {
    label: "Last 3 months",
    dateRange: {
      from: new Date(new Date().setMonth(new Date().getMonth() - 3)),
      to: new Date(),
    },
  },
  {
    label: "Last 6 months",
    dateRange: {
      from: new Date(new Date().setMonth(new Date().getMonth() - 6)),
      to: new Date(),
    },
  },
  {
    label: "Month to date",
    dateRange: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    },
  },
  {
    label: "Year to date",
    dateRange: {
      from: new Date(new Date().getFullYear(), 0, 1),
      to: new Date(),
    },
  },
]

// ── Helpers ───────────────────────────────────────────────────
const fmt = (date) =>
  date?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

const toInputVal = (date) =>
  date ? date.toISOString().split("T")[0] : ""

const isSameDay = (a, b) =>
  a && b &&
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear()

const matchesPreset = (range, preset) =>
  range &&
  isSameDay(range.from, preset.dateRange.from) &&
  isSameDay(range.to,   preset.dateRange.to)

// ── Calendar ──────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"]

function Calendar({ month, year, onMonthChange, range, hovered, onHover, onSelect }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const isStart   = (d) => d && range?.from && isSameDay(d, range.from)
  const isEnd     = (d) => d && range?.to   && isSameDay(d, range.to)
  const isInRange = (d) => {
    if (!d || !range?.from) return false
    const end = range.to || hovered
    if (!end) return false
    const lo = range.from < end ? range.from : end
    const hi = range.from < end ? end : range.from
    return d > lo && d < hi
  }

  const prev = () => {
    if (month === 0) onMonthChange(11, year - 1)
    else onMonthChange(month - 1, year)
  }
  const next = () => {
    if (month === 11) onMonthChange(0, year + 1)
    else onMonthChange(month + 1, year)
  }

  return (
    <div className="p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prev}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={next}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />
          const start   = isStart(d)
          const end     = isEnd(d)
          const inRange = isInRange(d)
          const today   = isSameDay(d, new Date())

          return (
            <div
              key={d.toISOString()}
              className={[
                "relative flex items-center justify-center h-8 cursor-pointer text-sm transition-colors",
                inRange
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                  : "",
                start || end
                  ? "bg-blue-600 text-white rounded-full z-10"
                  : "text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full",
              ].join(" ")}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(d)}
            >
              {today && !start && !end && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
              {d.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className = "",
  placeholder = "Select date range",
}) {
  const [open, setOpen]       = useState(false)
  const [hovered, setHovered] = useState(null)
  const [picking, setPicking] = useState(null) // first date picked, waiting for second
  const [month, setMonth]     = useState(new Date().getMonth())
  const [year, setYear]       = useState(new Date().getFullYear())

  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSelect = (d) => {
    if (!picking) {
      setPicking(d)
      onChange({ from: d, to: undefined })
    } else {
      const from = picking < d ? picking : d
      const to   = picking < d ? d : picking
      onChange({ from, to })
      setPicking(null)
      setOpen(false)
    }
  }

  const handlePreset = (preset) => {
    onChange(preset.dateRange)
    setPicking(null)
    setOpen(false)
  }

  const label = value?.from
    ? value.to
      ? `${fmt(value.from)} – ${fmt(value.to)}`
      : fmt(value.from)
    : placeholder

  const activePreset = presets.findIndex((p) => matchesPreset(value, p))

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors shadow-xs"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 text-gray-400 dark:text-gray-500">
          <rect x="1" y="3" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 6h13" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5 1v2M10 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className={`flex-1 text-left truncate ${!value?.from ? "text-gray-400 dark:text-gray-500" : ""}`}>
          {label}
        </span>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 text-gray-400">
          <path d="M3 5l4.5 4.5L12 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 flex rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-xl overflow-hidden">

          {/* Presets sidebar */}
          <div className="flex flex-col gap-0.5 p-2 border-r border-gray-100 dark:border-gray-800 min-w-[140px]">
            {presets.map((p, i) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className={[
                  "text-left text-sm px-3 py-1.5 rounded-md transition-colors w-full",
                  i === activePreset
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div>
            <Calendar
              month={month}
              year={year}
              onMonthChange={(m, y) => { setMonth(m); setYear(y) }}
              range={picking ? { from: picking, to: undefined } : value}
              hovered={hovered}
              onHover={setHovered}
              onSelect={handleSelect}
            />

            {/* Footer */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {picking
                  ? "Select end date"
                  : value?.from && value?.to
                    ? `${fmt(value.from)} – ${fmt(value.to)}`
                    : "Select start date"}
              </span>
              {value && (
                <button
                  onClick={() => { onChange(undefined); setPicking(null) }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
