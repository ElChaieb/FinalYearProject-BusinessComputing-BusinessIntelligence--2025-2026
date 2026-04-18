// hooks/useDashboard.js
//
// Drop-in data hooks for all three dashboards.
// Each hook mirrors the dummy-data shape so replacing is a one-liner:
//
//   Before:  const data = REVENUE_DATA;
//   After:   const { data, loading, error } = useGlobalRevenue(filter);

import { useState, useEffect, useCallback } from "react";

const BASE = "/api";   // adjust to your FastAPI base URL

// ─── shared fetch helper ────────────────────────────────────────
function buildUrl(path, params = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, v);
  });
  return url.toString();
}

function useFetch(path, params, deps = []) {
  const token = localStorage.getItem("token");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(path, params), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, ...deps]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, refetch: fetch_ };
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL DASHBOARD hooks
// ═══════════════════════════════════════════════════════════════

/** GET /dashboard/global/kpis */
export function useGlobalKpis(filter) {
  return useFetch("/dashboard/global/kpis", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/global/revenue — replaces REVENUE_DATA */
export function useGlobalRevenue(filter) {
  return useFetch("/dashboard/global/revenue", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/global/agencies — replaces AGENCY_DATA */
export function useGlobalAgencies(filter) {
  return useFetch("/dashboard/global/agencies", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/global/top-commercials — replaces TOP_COMMERCIALS */
export function useGlobalTopCommercials(filter, limit = 5) {
  return useFetch("/dashboard/global/top-commercials", {
    from: filter?.from, to: filter?.to, limit,
  }, [filter?.from, filter?.to, limit]);
}

/** GET /dashboard/global/funnel — replaces FUNNEL_DATA */
export function useGlobalFunnel(filter) {
  return useFetch("/dashboard/global/funnel", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/global/vehicles — replaces VEHICLE_DATA */
export function useGlobalVehicles(filter) {
  return useFetch("/dashboard/global/vehicles", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/global/channels — replaces CHANNEL_DATA */
export function useGlobalChannels(filter) {
  return useFetch("/dashboard/global/channels", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/global/targets — replaces TARGETS_DATA */
export function useGlobalTargets(filter) {
  return useFetch("/dashboard/global/targets", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

// ═══════════════════════════════════════════════════════════════
// AGENCY DASHBOARD hooks
// agency_id is read server-side from JWT — no need to pass it here
// ═══════════════════════════════════════════════════════════════

/** GET /dashboard/agency/kpis */
export function useAgencyKpis(filter) {
  return useFetch("/dashboard/agency/kpis", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/agency/team — replaces TEAM_DATA */
export function useAgencyTeam(filter) {
  return useFetch("/dashboard/agency/team", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/agency/revenue — replaces REVENUE_DATA in DashboardAgence */
export function useAgencyRevenue(filter) {
  return useFetch("/dashboard/agency/revenue", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/agency/targets */
export function useAgencyTargets(filter) {
  return useFetch("/dashboard/agency/targets", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

// ═══════════════════════════════════════════════════════════════
// COMMERCIAL DASHBOARD hooks
// user_id is read server-side from JWT
// ═══════════════════════════════════════════════════════════════

/** GET /dashboard/me/kpis — replaces THIS_MONTH + individual KPI values */
export function useMeKpis(filter) {
  return useFetch("/dashboard/me/kpis", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/me/quotes — replaces MONTHLY_DATA */
export function useMeQuotes(filter) {
  return useFetch("/dashboard/me/quotes", {
    from: filter?.from, to: filter?.to,
  }, [filter?.from, filter?.to]);
}

/** GET /dashboard/me/monthly-target?year=YYYY */
export function useMeMonthlyTarget(year) {
  return useFetch("/dashboard/me/monthly-target", { year },
    [year]);
}

/** GET /dashboard/me/recent-activity — replaces RECENT_QUOTES */
export function useMeRecentActivity(limit = 10) {
  return useFetch("/dashboard/me/recent-activity", { limit }, [limit]);
}
