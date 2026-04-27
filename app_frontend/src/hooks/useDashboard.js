// hooks/useDashboard.js
//
// All API hooks for the new dashboard design.
// useFetch is a shared helper — JWT token from localStorage, date params forwarded.
//
// Global  → /dashboard/global/*    (DG, DC, Admin)
// Agency  → /dashboard/agency/*    (Responsable d'Agence — scoped server-side)
// Me      → /dashboard/me/*        (Commercial — scoped server-side)

import { useState, useEffect, useCallback } from "react";

const BASE = "/api";

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
  const [loading, setLoading] = useState(!!path); // false immediately when path is null
  const [error,   setError]   = useState(null);

  const fetch_ = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
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

// Helper — converts a { from, to } date filter object to query params
function dateParams(filter) {
  return { from: filter?.from, to: filter?.to };
}


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL — Section 1 (Revenue)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dashboard/global/section1/kpis
 *  → { total_revenue, avg_sale_value, highest_sale_value, lowest_sale_value, sales_count }
 */
export function useGlobalSection1Kpis(filter) {
  return useFetch("/dashboard/global/section1/kpis", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section1/revenue-by-month
 *  → [{ date, <AgencyName>: revenue, ... }]  — pivoted, one object per month
 */
export function useGlobalRevenueByMonth(filter) {
  return useFetch("/dashboard/global/section1/revenue-by-month", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section1/agency-summary
 *  → [{ agency, total, totalFmt, change, changeType, stroke }]
 */
export function useGlobalAgencySummary(filter) {
  return useFetch("/dashboard/global/section1/agency-summary", dateParams(filter),
    [filter?.from, filter?.to]);
}


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL — Section 2 (Conversion Funnel)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dashboard/global/section2/kpis
 *  → { total_opportunities, total_quotes, total_sales }
 */
export function useGlobalSection2Kpis(filter) {
  return useFetch("/dashboard/global/section2/kpis", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section2/funnel-by-month
 *  → [{ date, Opportunities, Quotes, Sales }]
 */
export function useGlobalFunnelByMonth(filter) {
  return useFetch("/dashboard/global/section2/funnel-by-month", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section2/agency-funnel
 *  → [{ agency, opportunities, quotes, sales, convOQ, convQS }]
 */
export function useGlobalAgencyFunnel(filter) {
  return useFetch("/dashboard/global/section2/agency-funnel", dateParams(filter),
    [filter?.from, filter?.to]);
}


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL — Section 3 (Vehicle Trends)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dashboard/global/section3/kpis
 *  → { most_sold_category, most_sold_count, least_sold_category, least_sold_count, avg_category_sales }
 */
export function useGlobalSection3Kpis(filter) {
  return useFetch("/dashboard/global/section3/kpis", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section3/categories
 *  → [{ category, sales }]
 */
export function useGlobalCategories(filter) {
  return useFetch("/dashboard/global/section3/categories", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section3/brands
 *  → [{ brand, sales }]
 */
export function useGlobalBrands(filter) {
  return useFetch("/dashboard/global/section3/brands", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section3/agency-vehicles
 *  → [{ agency, totalSales, topCategory, topBrand }]
 */
export function useGlobalAgencyVehicles(filter) {
  return useFetch("/dashboard/global/section3/agency-vehicles", dateParams(filter),
    [filter?.from, filter?.to]);
}


// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL — Section 4 (Customer Segmentation)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dashboard/global/section4/kpis
 *  → { highest_state, highest_count, lowest_state, lowest_count, total_clients }
 */
export function useGlobalSection4Kpis(filter) {
  return useFetch("/dashboard/global/section4/kpis", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section4/clients-by-state
 *  → [{ city, clients, newClients }]
 */
export function useGlobalClientsByState(filter) {
  return useFetch("/dashboard/global/section4/clients-by-state", dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/global/section4/agency-clients
 *  → [{ agency, totalClients, newClients, repeatRate }]
 */
export function useGlobalAgencyClients(filter) {
  return useFetch("/dashboard/global/section4/agency-clients", dateParams(filter),
    [filter?.from, filter?.to]);
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENCY — scoped to logged-in agency manager
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dashboard/agency/kpis
 *  → { sales, revenue, opportunities, quotes, convOQ, convQS }
 *  Pass agencyName to drill into a specific agency from the global view.
 */
export function useAgencyKpis(filter, agencyName = null) {
  return useFetch("/dashboard/agency/kpis", { ...dateParams(filter), agency: agencyName || undefined },
    [filter?.from, filter?.to, agencyName]);
}

/** GET /dashboard/agency/revenue-by-month
 *  → [{ date, Revenue }]
 */
export function useAgencyRevenueByMonth(filter, agencyName = null) {
  return useFetch("/dashboard/agency/revenue-by-month", { ...dateParams(filter), agency: agencyName || undefined },
    [filter?.from, filter?.to, agencyName]);
}

/** GET /dashboard/agency/commercials
 *  → [{ id, name, email, sales, revenue, revenueFmt, quotes, convRate, change, changeType }]
 */
export function useAgencyCommercials(filter, agencyName = null) {
  return useFetch("/dashboard/agency/commercials", { ...dateParams(filter), agency: agencyName || undefined },
    [filter?.from, filter?.to, agencyName]);
}

/** GET /dashboard/agency/commercial/:id/kpis */
export function useAgencyCommercialKpis(commercialId, filter) {
  return useFetch(
    commercialId ? `/dashboard/agency/commercial/${commercialId}/kpis` : null,
    dateParams(filter),
    [commercialId, filter?.from, filter?.to],
  );
}

/** GET /dashboard/agency/commercial/:id/revenue-by-month */
export function useAgencyCommercialRevenue(commercialId, filter) {
  return useFetch(
    commercialId ? `/dashboard/agency/commercial/${commercialId}/revenue-by-month` : null,
    dateParams(filter),
    [commercialId, filter?.from, filter?.to],
  );
}

/** GET /dashboard/agency/commercial/:id/top-vehicles */
export function useAgencyCommercialVehicles(commercialId, filter) {
  return useFetch(
    commercialId ? `/dashboard/agency/commercial/${commercialId}/top-vehicles` : null,
    dateParams(filter),
    [commercialId, filter?.from, filter?.to],
  );
}

/** GET /dashboard/agency/commercial/:id/recent-sales */
export function useAgencyCommercialRecentSales(commercialId, filter, limit = 10) {
  return useFetch(
    commercialId ? `/dashboard/agency/commercial/${commercialId}/recent-sales` : null,
    { ...dateParams(filter), limit },
    [commercialId, filter?.from, filter?.to, limit],
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// COMMERCIAL (me) — scoped to logged-in commercial
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dashboard/me/kpis
 *  → { sales, revenue, opportunities, quotes, convOQ, convQS }
 *  Pass filter=null to disable (used by CommercialPanel in agency mode).
 */
export function useMeKpis(filter) {
  return useFetch(filter ? "/dashboard/me/kpis" : null, dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/me/revenue-by-month
 *  → [{ date, Revenue }]
 */
export function useMeRevenueByMonth(filter) {
  return useFetch(filter ? "/dashboard/me/revenue-by-month" : null, dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/me/top-vehicles
 *  → [{ vehicle, sales }]
 */
export function useMeTopVehicles(filter) {
  return useFetch(filter ? "/dashboard/me/top-vehicles" : null, dateParams(filter),
    [filter?.from, filter?.to]);
}

/** GET /dashboard/me/recent-sales
 *  → [{ date, vehicle, client, amount, amountFmt }]
 */
export function useMeRecentSales(filter, limit = 10) {
  return useFetch(filter ? "/dashboard/me/recent-sales" : null, { ...dateParams(filter), limit },
    [filter?.from, filter?.to, limit]);
}
