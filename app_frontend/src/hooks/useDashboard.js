/**
 * useDashboard.js
 *
 * Generic hook that wraps fetchDashboard with React state management.
 * Every domain-specific hook (useRevenue, useFunnel, …) is built on top
 * of this one.
 *
 * Usage:
 *   const { data, loading, error } = useDashboard(
 *     "/dashboard/global/revenue/monthly",
 *     { year: 2025 }
 *   );
 *
 * The hook re-fetches whenever `path` or any `params` value changes.
 * Between navigations the cached promise is returned instantly (no spinner).
 */

import { useState, useEffect, useRef } from "react";
import { fetchDashboard } from "../api/dashboardApi";

export function useDashboard(path, params = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Stable serialisation of params so the effect only fires when values change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paramsKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v != null)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  );

  // Track whether this effect instance is still current
  const abortedRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;
    setLoading(true);
    setError(null);

    fetchDashboard(path, JSON.parse(paramsKey))
      .then((result) => {
        if (!abortedRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!abortedRef.current) {
          setError(err?.response?.data?.detail ?? err.message ?? "Error");
          setLoading(false);
        }
      });

    return () => {
      abortedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey]);

  return { data, loading, error };
}
