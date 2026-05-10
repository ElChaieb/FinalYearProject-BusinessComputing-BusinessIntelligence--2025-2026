/**
 * dashboardApi.js
 *
 * Thin wrapper around the axios instance that adds a session-scoped
 * in-memory cache.  Cache key = full URL (path + query string).
 * Data fetched once per browser session is never re-fetched unless
 * the caller passes  { force: true }.
 */

import api from "./axios";

// ── In-memory store: Map<cacheKey, Promise<data>> ─────────────────────────────
// We store the Promise itself so that concurrent calls for the same key
// coalesce onto a single in-flight request.
const _cache = new Map();

/**
 * Build a stable cache key from a path and a params object.
 * Params are sorted so {year:2025, month:5} and {month:5, year:2025}
 * produce the same key.
 */
function _key(path, params = {}) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return sorted ? `${path}?${sorted}` : path;
}

/**
 * Fetch data with caching.
 *
 * @param {string}  path    - e.g. "/dashboard/global/revenue/monthly"
 * @param {object}  params  - query params, e.g. { year: 2025 }
 * @param {boolean} force   - bypass cache and re-fetch
 * @returns {Promise<any>}  - the parsed response data
 */
export async function fetchDashboard(path, params = {}, force = false) {
  const key = _key(path, params);

  if (!force && _cache.has(key)) {
    return _cache.get(key);
  }

  const promise = api
    .get(path, { params })
    .then((res) => res.data)
    .catch((err) => {
      _cache.delete(key);
      throw err;
    });

  _cache.set(key, promise);
  return promise;
}

/** Manually invalidate one cache entry (e.g. after a filter change that
 *  produces a fundamentally different query scope). */
export function invalidate(path, params = {}) {
  _cache.delete(_key(path, params));
}

/** Wipe the entire cache (e.g. on logout). */
export function clearCache() {
  _cache.clear();
}