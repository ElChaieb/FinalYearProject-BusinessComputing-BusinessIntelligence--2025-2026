// hooks/useDateFilter.js
// Shared date range filter state for all dashboards.

import { useState } from "react";

const PRESETS = [
  { label: "This Month",    value: "month"   },
  { label: "Last 3 Months", value: "3months" },
  { label: "This Year",     value: "year"    },
  { label: "Custom",        value: "custom"  },
];

function getPresetDates(preset) {
  const now   = new Date();
  const today = now.toISOString().split("T")[0];

  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString().split("T")[0], to: today };
  }
  if (preset === "3months") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    return { from: start.toISOString().split("T")[0], to: today };
  }
  if (preset === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }
  return null;
}

export function useDateFilter() {
  const [preset, setPreset]     = useState("year");
  const [customFrom, setFrom]   = useState("");
  const [customTo,   setTo]     = useState("");

  const dates = preset === "custom"
    ? { from: customFrom, to: customTo }
    : getPresetDates(preset);

  return {
    preset, setPreset,
    customFrom, setFrom,
    customTo,   setTo,
    dates,       // { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
    PRESETS,
  };
}
