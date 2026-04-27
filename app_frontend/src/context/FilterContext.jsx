// context/FilterContext.jsx
// Global date filter — persists across page navigation and browser refresh.
//
// Usage anywhere in the app:
//   import { useFilter } from "../context/FilterContext"
//   const { filter, range, setRange } = useFilter()
//
//   filter → { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }  ← pass directly to API hooks
//   range  → { from: Date, to: Date }                   ← pass to DateRangePicker value
//   setRange(range) → call with DateRangePicker onChange

import { createContext, useContext, useState, useCallback } from "react";

const FilterContext = createContext(null);

const STORAGE_KEY = "dashboard_date_filter";

// ── Default: first of current month → today ────────────────────────────────────
function defaultRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from, to: today };
}

// ── Serialise/deserialise for localStorage ─────────────────────────────────────
function saveToStorage(range) {
  try {
    if (!range?.from || !range?.to) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        from: range.from.toISOString(),
        to:   range.to.toISOString(),
      })
    );
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { from, to } = JSON.parse(raw);
    const f = new Date(from);
    const t = new Date(to);
    if (isNaN(f) || isNaN(t)) return null;
    return { from: f, to: t };
  } catch (_) {
    return null;
  }
}

// ── Date → "YYYY-MM-DD" string ─────────────────────────────────────────────────
function toApiStr(d) {
  if (!d) return undefined;
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function FilterProvider({ children }) {
  const [range, setRangeState] = useState(() => loadFromStorage() ?? defaultRange());

  const setRange = useCallback((newRange) => {
    setRangeState(newRange ?? defaultRange());
    saveToStorage(newRange);
  }, []);

  // filter shape expected by all API hooks: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
  const filter = {
    from: toApiStr(range?.from),
    to:   toApiStr(range?.to),
  };

  return (
    <FilterContext.Provider value={{ filter, range, setRange }}>
      {children}
    </FilterContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used inside <FilterProvider>");
  return ctx;
}
