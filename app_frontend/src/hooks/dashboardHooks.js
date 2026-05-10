/**
 * dashboardHooks.js
 *
 * Domain hooks consumed by the 7 dashboard pages.
 * Every hook accepts a `year` parameter (defaults to current year).
 * Data is cached per (endpoint + year) so revisiting a page with the
 * same filter is instant.
 *
 * Returned `data` shapes mirror the backend endpoint responses exactly.
 * See dashboard.py for field-level documentation.
 */

import { useDashboard } from "./useDashboard";

const THIS_YEAR = new Date().getFullYear();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick a colour for each agency / commercial by index */
const PALETTE = [
  "#118DFF", "#E66C37", "#12239E", "#ECC846",
  "#00B5D0", "#8764B8", "#D13438", "#107C10",
  "#00B294", "#F2C80F", "#5F6B6D", "#8AD4EB",
];

export function paletteColor(idx) {
  return PALETTE[idx % PALETTE.length];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DIRECTOR (global) hooks
// ═══════════════════════════════════════════════════════════════════════════════

/** Monthly revenue totals + n-1 for all agencies combined */
export function useGlobalRevenueMonthly(year = THIS_YEAR) {
  return useDashboard("/dashboard/global/revenue/monthly", { year });
}

/** Category × model × month revenue breakdown */
export function useGlobalRevenueByCategory(year = THIS_YEAR) {
  return useDashboard("/dashboard/global/revenue/by-category", { year });
}

/** Per-agency monthly revenue (for donut cards) */
export function useGlobalRevenueByAgency(year = THIS_YEAR) {
  return useDashboard("/dashboard/global/revenue/by-agency", { year });
}

/** Monthly funnel rows (oppo / quote / sale won & lost) */
export function useGlobalFunnelMonthly(year = THIS_YEAR) {
  return useDashboard("/dashboard/global/funnel/monthly", { year });
}

/** Per-agency yearly funnel totals (donut cards) */
export function useGlobalFunnelByAgency(year = THIS_YEAR) {
  return useDashboard("/dashboard/global/funnel/by-agency", { year });
}

/** Category × model × month units sold */
export function useGlobalTrendsByCategory(year = THIS_YEAR) {
  return useDashboard("/dashboard/global/trends/by-category", { year });
}

/** Units sold per Tunisian governorate for a given month */
export function useGlobalTrendsClientsByState(year = THIS_YEAR, month = new Date().getMonth() + 1) {
  return useDashboard("/dashboard/global/trends/clients-by-state", { year, month });
}

/** Filter options (categories, agencies, years) */
export function useGlobalFilters() {
  return useDashboard("/dashboard/global/filters");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AGENCY (agency-scoped) hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useAgencyRevenueMonthly(year = THIS_YEAR) {
  return useDashboard("/dashboard/agency/revenue/monthly", { year });
}

export function useAgencyRevenueByCategory(year = THIS_YEAR) {
  return useDashboard("/dashboard/agency/revenue/by-category", { year });
}

export function useAgencyRevenueByCommercial(year = THIS_YEAR) {
  return useDashboard("/dashboard/agency/revenue/by-commercial", { year });
}

export function useAgencyFunnelMonthly(year = THIS_YEAR) {
  return useDashboard("/dashboard/agency/funnel/monthly", { year });
}

export function useAgencyFunnelByCommercial(year = THIS_YEAR) {
  return useDashboard("/dashboard/agency/funnel/by-commercial", { year });
}

export function useAgencyTrendsByCategory(year = THIS_YEAR) {
  return useDashboard("/dashboard/agency/trends/by-category", { year });
}

export function useAgencyTrendsClientsByState(year = THIS_YEAR, month = new Date().getMonth() + 1) {
  return useDashboard("/dashboard/agency/trends/clients-by-state", { year, month });
}

export function useAgencyFilters() {
  return useDashboard("/dashboard/agency/filters");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMERCIAL (me-scoped) hooks
// ═══════════════════════════════════════════════════════════════════════════════

export function useMeRevenueMonthly(year = THIS_YEAR) {
  return useDashboard("/dashboard/me/revenue/monthly", { year });
}

export function useMeRevenueByCategory(year = THIS_YEAR) {
  return useDashboard("/dashboard/me/revenue/by-category", { year });
}

export function useMeRevenueKpis(year = THIS_YEAR) {
  return useDashboard("/dashboard/me/revenue/kpis", { year });
}

export function useMeRecentSales(limit = 10) {
  return useDashboard("/dashboard/me/revenue/recent-sales", { limit });
}

export function useMeFilters() {
  return useDashboard("/dashboard/me/filters");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA TRANSFORM HELPERS
//  These convert flat API rows into the nested shape the dashboard
//  components already expect (category → models → months[]).
// ═══════════════════════════════════════════════════════════════════════════════

const MONTHS_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Transform /revenue/by-category or /trends/by-category rows into
 * the CATEGORIES array shape used by all dashboard components.
 *
 * @param {Array}   rows      - API rows: { category, model, month, n, n_minus1 }
 * @param {boolean} isRevenue - true → monetary values; false → unit counts
 * @returns {Array} categories shaped like CATEGORIES mock
 */
export function buildCategories(rows = [], isRevenue = true) {
  if (!rows.length) return [];

  // Assign stable colours per category
  const catOrder = [];
  const catMap = {};

  for (const row of rows) {
    if (!catMap[row.category]) {
      const colorIdx = catOrder.length;
      catOrder.push(row.category);
      catMap[row.category] = {
        id:     row.category.toLowerCase().replace(/\s+/g, "_"),
        label:  row.category,
        color:  paletteColor(colorIdx),
        models: {},
      };
    }
    const cat = catMap[row.category];
    if (!cat.models[row.model]) {
      cat.models[row.model] = {
        model:  row.model,
        months: Array.from({ length: 12 }, () => ({ n: 0, nMinus1: 0 })),
      };
    }
    // month from API is 1-indexed
    const mi = (row.month ?? 1) - 1;
    cat.models[row.model].months[mi].n       += Number(row.n       ?? 0);
    cat.models[row.model].months[mi].nMinus1 += Number(row.n_minus1 ?? 0);
  }

  return catOrder.map((catName) => ({
    ...catMap[catName],
    models: Object.values(catMap[catName].models),
  }));
}

/**
 * Transform /revenue/by-agency or /agency/revenue/by-commercial rows into
 * the AGENCY_REVENUE / COMMERCIALS array shape.
 *
 * @param {Array}  rows     - { agency_name|full_name, month, n, n_minus1 }
 * @param {string} nameKey  - field name for the entity label
 * @param {string} idKey    - field name for the entity id (optional)
 */
export function buildEntityRevenue(rows = [], nameKey = "agency_name", idKey = null) {
  if (!rows.length) return [];

  const order = [];
  const map   = {};

  for (const row of rows) {
    const name = row[nameKey];
    if (!name) continue;
    if (!map[name]) {
      order.push(name);
      map[name] = {
        id:     idKey ? row[idKey] : name.toLowerCase().replace(/\s+/g, "_"),
        label:  name,
        color:  paletteColor(order.length - 1),
        months: Array.from({ length: 12 }, () => ({ n: 0, nMinus1: 0 })),
      };
    }
    const mi = (row.month ?? 1) - 1;
    map[name].months[mi].n       += Number(row.n       ?? 0);
    map[name].months[mi].nMinus1 += Number(row.n_minus1 ?? 0);
  }

  return order.map((name) => map[name]);
}

/**
 * Transform /funnel/monthly rows (already in the right shape from the backend)
 * into the MOCK_DATA array shape used by DirectorFunnel / AgencyFunnel.
 *
 * Backend already returns { period, oppo_won, oppo_lost, quote_won,
 * quote_lost, sale_won, sale_lost } — we just camelCase and return.
 */
export function buildFunnelData(rows = []) {
  return rows.map((r) => ({
    period:    r.period,
    oppoWon:   Number(r.oppo_won   ?? 0),
    oppoLost:  Number(r.oppo_lost  ?? 0),
    quoteWon:  Number(r.quote_won  ?? 0),
    quoteLost: Number(r.quote_lost ?? 0),
    saleWon:   Number(r.sale_won   ?? 0),
    saleLost:  Number(r.sale_lost  ?? 0),
  }));
}

/**
 * Transform /funnel/by-agency or /funnel/by-commercial rows into
 * the AGENCIES / COMMERCIALS shape for donut cards.
 *
 * Input rows: { user_id?, full_name, oppo_won, oppo_lost, quote_won, quote_lost }
 * Output: { name, oppoWon, oppoLost, quoteWon, quoteLost }  × { year_n, year_nm1 }
 */
export function buildFunnelByEntity(apiResult = {}) {
  const map = (arr = []) =>
    arr.map((r) => ({
      name:      r.full_name ?? r.agency_name ?? "",
      oppoWon:   Number(r.oppo_won   ?? 0),
      oppoLost:  Number(r.oppo_lost  ?? 0),
      quoteWon:  Number(r.quote_won  ?? 0),
      quoteLost: Number(r.quote_lost ?? 0),
    }));
  return {
    yearN:   map(apiResult.year_n   ?? []),
    yearNm1: map(apiResult.year_nm1 ?? []),
  };
}

/**
 * Transform /trends/clients-by-state rows into the STATE_ORDERS shape.
 *
 * The Trends pages only need the data for the selected month, but we keep
 * the shape compatible with the existing StateRankCard component.
 *
 * Input: [{ city, n, n_minus1 }]  (single month)
 * Output: [{ id, label, orders: n, ordersNm1: n_minus1 }]
 */
export function buildStateOrders(rows = [], yearKey = "n") {
  return rows
    .filter((r) => r.city)
    .map((r, i) => ({
      id:        `state_${r.city.toLowerCase().replace(/\s+/g, "_")}`,
      label:     r.city,
      orders:    Number(r[yearKey] ?? 0),
      ordersNm1: Number(r.n_minus1 ?? 0),
    }));
}
