# Backend/app/routers/dashboard.py
#
# All endpoints for the new dashboard design.
# DWH schema v4 — no dim_agency, no fact_targets, dates are plain DATE columns.
#
# Route groups:
#   /dashboard/global/*   → DG, DC, Administrateur BI  (full cross-agency access)
#   /dashboard/agency/*   → Responsable d'Agence       (scoped to user.agency_name)
#   /dashboard/me/*       → Commercial                 (scoped to user email → dim_user)
#
# Agency / user resolution:
#   - agency_name comes directly from the app-db user object (user.agency_name)
#   - dwh user_id is looked up from dim_user by email
#
# "Clients" = people who appear in fact_sales (bought something)
# "New clients" = clients whose first-ever sale falls within the requested period

import os
import psycopg2
import psycopg2.extras
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from dotenv import load_dotenv

from app.auth import get_current_user

load_dotenv()

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Tunisia's 24 governorates (used for Section 4 client-by-state queries)
TUNISIA_STATES = [
    "Tunis", "Ariana", "Ben Arous", "Manouba",
    "Nabeul", "Zaghouan", "Bizerte", "Béja",
    "Jendouba", "Kef", "Siliana", "Sousse",
    "Monastir", "Mahdia", "Sfax", "Kairouan",
    "Kasserine", "Sidi Bouzid", "Gabes", "Medenine",
    "Tataouine", "Gafsa", "Tozeur", "Kebili",
]

GLOBAL_ROLES = {"General Director", "Commercial Director", "Administrateur BI"}


# ── DWH connection ─────────────────────────────────────────────────────────────

def _dwh():
    return psycopg2.connect(
        host=os.getenv("DWH_HOST",     "localhost"),
        port=int(os.getenv("DWH_PORT", "5432")),
        dbname=os.getenv("DWH_NAME",   "warehouse_db"),
        user=os.getenv("DWH_USER",     "admin"),
        password=os.getenv("DWH_PASSWORD", "admin"),
    )


def _query(sql: str, params: tuple = ()) -> list[dict]:
    conn = _dwh()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _one(sql: str, params: tuple = ()) -> dict:
    rows = _query(sql, params)
    return rows[0] if rows else {}


# ── Auth helpers ───────────────────────────────────────────────────────────────

def _require_global(user):
    if user.role not in GLOBAL_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _get_dwh_user_id(email: str) -> Optional[int]:
    row = _one("SELECT user_id FROM dim_user WHERE email = %s", (email,))
    return row.get("user_id")


# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 — REVENUE
#  Shared shape used by Director, Agency, and Commercial revenue dashboards.
#
#  Revenue endpoints return:
#    • /revenue/monthly  → monthly n vs n-1 totals (bar chart + KPI cards)
#    • /revenue/by-category → category × model × month matrix (breakdown table)
#    • /revenue/by-agency   → per-agency monthly totals (donut row) [global only]
#    • /revenue/by-commercial → per-user monthly totals (donut row) [agency + global]
# ═══════════════════════════════════════════════════════════════════════════════

# ── Shared revenue SQL helpers ─────────────────────────────────────────────────

_REV_WHERE_GLOBAL = ""
_REV_WHERE_AGENCY = "AND fs.agency_name = %s"
_REV_WHERE_USER   = "AND fs.user_id = %s"

def _monthly_revenue(year_n: int, extra_where: str = "", params: tuple = ()):
    """
    Returns 12 rows: month 1-12, revenue for year_n and year_n-1.
    """
    sql = f"""
        SELECT
            EXTRACT(MONTH FROM fs.sale_date)::INT AS month,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s
                     THEN fs.final_price ELSE 0 END)  AS n,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s - 1
                     THEN fs.final_price ELSE 0 END)  AS n_minus1
        FROM fact_sales fs
        WHERE EXTRACT(YEAR FROM fs.sale_date) IN (%s, %s - 1)
          {extra_where}
        GROUP BY month
        ORDER BY month
    """
    return _query(sql, (year_n, year_n, year_n, year_n) + params)


def _category_model_revenue(year_n: int, extra_where: str = "", params: tuple = ()):
    """
    Returns rows: category, model, month, n, n_minus1.
    Frontend pivots this into the breakdown table.
    """
    sql = f"""
        SELECT
            dv.category,
            dv.model,
            EXTRACT(MONTH FROM fs.sale_date)::INT AS month,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s
                     THEN fs.final_price ELSE 0 END) AS n,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s - 1
                     THEN fs.final_price ELSE 0 END) AS n_minus1
        FROM fact_sales fs
        JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
        WHERE EXTRACT(YEAR FROM fs.sale_date) IN (%s, %s - 1)
          {extra_where}
        GROUP BY dv.category, dv.model, month
        ORDER BY dv.category, dv.model, month
    """
    return _query(sql, (year_n, year_n, year_n, year_n) + params)


# ── /dashboard/global/revenue/* ───────────────────────────────────────────────

@router.get("/global/revenue/monthly")
def global_revenue_monthly(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    _require_global(user)
    year = year or date.today().year
    rows = _monthly_revenue(year)
    return {"year_n": year, "rows": rows}


@router.get("/global/revenue/by-category")
def global_revenue_by_category(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    _require_global(user)
    year = year or date.today().year
    rows = _category_model_revenue(year)
    return {"year_n": year, "rows": rows}


@router.get("/global/revenue/by-agency")
def global_revenue_by_agency(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    """Per-agency monthly revenue — used by the 4 donut cards in DirectorRevenue."""
    _require_global(user)
    year = year or date.today().year
    sql = """
        SELECT
            fs.agency_name,
            EXTRACT(MONTH FROM fs.sale_date)::INT AS month,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s
                     THEN fs.final_price ELSE 0 END) AS n,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s - 1
                     THEN fs.final_price ELSE 0 END) AS n_minus1
        FROM fact_sales fs
        WHERE EXTRACT(YEAR FROM fs.sale_date) IN (%s, %s - 1)
        GROUP BY fs.agency_name, month
        ORDER BY fs.agency_name, month
    """
    rows = _query(sql, (year, year, year, year))
    return {"year_n": year, "rows": rows}


# ── /dashboard/agency/revenue/* ───────────────────────────────────────────────

@router.get("/agency/revenue/monthly")
def agency_revenue_monthly(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    year = year or date.today().year
    rows = _monthly_revenue(year, _REV_WHERE_AGENCY, (user.agency_name,))
    return {"year_n": year, "agency": user.agency_name, "rows": rows}


@router.get("/agency/revenue/by-category")
def agency_revenue_by_category(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    year = year or date.today().year
    rows = _category_model_revenue(year, _REV_WHERE_AGENCY, (user.agency_name,))
    return {"year_n": year, "agency": user.agency_name, "rows": rows}


@router.get("/agency/revenue/by-commercial")
def agency_revenue_by_commercial(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    """Per-commercial monthly revenue — used by the 4 donut cards in AgencyRevenue."""
    year = year or date.today().year
    sql = """
        SELECT
            du.user_id,
            du.first_name || ' ' || du.last_name AS full_name,
            EXTRACT(MONTH FROM fs.sale_date)::INT AS month,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s
                     THEN fs.final_price ELSE 0 END) AS n,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s - 1
                     THEN fs.final_price ELSE 0 END) AS n_minus1
        FROM fact_sales fs
        JOIN dim_user du ON du.user_id = fs.user_id
        WHERE EXTRACT(YEAR FROM fs.sale_date) IN (%s, %s - 1)
          AND fs.agency_name = %s
        GROUP BY du.user_id, full_name, month
        ORDER BY full_name, month
    """
    rows = _query(sql, (year, year, year, year, user.agency_name))
    return {"year_n": year, "agency": user.agency_name, "rows": rows}


# ── /dashboard/me/revenue/* ───────────────────────────────────────────────────

@router.get("/me/revenue/monthly")
def me_revenue_monthly(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    year = year or date.today().year
    uid = _get_dwh_user_id(user.email)
    if not uid:
        raise HTTPException(status_code=404, detail="User not found in DWH")
    rows = _monthly_revenue(year, _REV_WHERE_USER, (uid,))
    return {"year_n": year, "rows": rows}


@router.get("/me/revenue/by-category")
def me_revenue_by_category(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    year = year or date.today().year
    uid = _get_dwh_user_id(user.email)
    if not uid:
        raise HTTPException(status_code=404, detail="User not found in DWH")
    rows = _category_model_revenue(year, _REV_WHERE_USER, (uid,))
    return {"year_n": year, "rows": rows}


@router.get("/me/revenue/kpis")
def me_revenue_kpis(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    """
    Returns the scalar KPIs for CommercialRevenue:
      total, thisMonth, lastMonth (all for year_n and year_n-1).
    Also returns deals count + win rate for the same scope.
    """
    year = year or date.today().year
    today = date.today()
    cur_month = today.month
    prev_month = cur_month - 1 if cur_month > 1 else 12

    uid = _get_dwh_user_id(user.email)
    if not uid:
        raise HTTPException(status_code=404, detail="User not found in DWH")

    rev = _one("""
        SELECT
            SUM(CASE WHEN EXTRACT(YEAR FROM sale_date) = %s
                     THEN final_price ELSE 0 END)                        AS total_n,
            SUM(CASE WHEN EXTRACT(YEAR FROM sale_date) = %s - 1
                     THEN final_price ELSE 0 END)                        AS total_nm1,
            SUM(CASE WHEN EXTRACT(YEAR FROM sale_date) = %s
                          AND EXTRACT(MONTH FROM sale_date) = %s
                     THEN final_price ELSE 0 END)                        AS this_month_n,
            SUM(CASE WHEN EXTRACT(YEAR FROM sale_date) = %s - 1
                          AND EXTRACT(MONTH FROM sale_date) = %s
                     THEN final_price ELSE 0 END)                        AS this_month_nm1,
            SUM(CASE WHEN EXTRACT(YEAR FROM sale_date) = %s
                          AND EXTRACT(MONTH FROM sale_date) = %s
                     THEN final_price ELSE 0 END)                        AS last_month_n
        FROM fact_sales
        WHERE user_id = %s
    """, (year, year, year, cur_month, year, cur_month, year, prev_month, uid))

    deals = _one("""
        SELECT
            COUNT(*)                                                      AS total,
            COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM sale_date) = %s - 1) AS total_nm1,
            COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM sale_date) = %s
                                   AND EXTRACT(MONTH FROM sale_date) = %s) AS this_month
        FROM fact_sales
        WHERE user_id = %s
    """, (year, year, cur_month, uid))

    # Quotes won vs lost to derive win rate
    quote_counts = _one("""
        SELECT
            COUNT(*) FILTER (WHERE deleted IS NOT TRUE)  AS won,
            COUNT(*) FILTER (WHERE deleted IS TRUE)      AS lost
        FROM fact_quotes
        WHERE user_id = %s
          AND EXTRACT(YEAR FROM created_date) = %s
    """, (uid, year))

    return {
        "year_n": year,
        "revenue": rev,
        "deals": deals,
        "quotes_won": quote_counts.get("won", 0),
        "quotes_lost": quote_counts.get("lost", 0),
    }


@router.get("/me/revenue/recent-sales")
def me_recent_sales(
    limit: int = Query(default=10, le=50),
    user=Depends(get_current_user),
):
    """Recent sales rows for the CommercialRevenue 'Recent Deals' table."""
    uid = _get_dwh_user_id(user.email)
    if not uid:
        raise HTTPException(status_code=404, detail="User not found in DWH")
    rows = _query("""
        SELECT
            fs.sale_id,
            dc.full_name   AS client,
            dv.model       AS product,
            dv.category,
            fs.final_price AS value,
            fs.sale_date   AS date
        FROM fact_sales fs
        JOIN dim_client  dc ON dc.client_id = fs.client_id
        JOIN dim_vehicle dv ON dv.ar_ref    = fs.ar_ref
        WHERE fs.user_id = %s
        ORDER BY fs.sale_date DESC
        LIMIT %s
    """, (uid, limit))
    return {"rows": rows}


# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 — FUNNEL  (Opportunities → Quotes → Sales)
#
#  All funnel endpoints return rows in the shape expected by the frontend:
#    { period, oppo_won, oppo_lost, quote_won, quote_lost, sale_won, sale_lost }
#
#  Periods emitted: Jan n-1 … Dec n-1, Jan n … Dec n, Year n-1, Year n.
#  "Won" opportunity  = NOT deleted.
#  "Lost" opportunity = deleted.
#  "Won" quote        = quote that has a matching sale in fact_sales.
#  "Lost" quote       = deleted quote (no matching sale).
#  "Won" sale         = every row in fact_sales (sales are always won).
# ═══════════════════════════════════════════════════════════════════════════════

def _funnel_rows(year_n: int, extra_where: str = "", params: tuple = ()):
    """
    Returns one dict per (year, month) + two yearly summary dicts,
    shaped to match the frontend MOCK_DATA format.

    extra_where must use unaliased column names: agency_name, user_id.
    Callers should NOT prefix with fo./fq./fs.
    """
    # Normalise: strip any table-alias prefixes callers might pass
    def _clean(w):
        return (w.replace('fo.', '')
                 .replace('fq.', '')
                 .replace('fs.', ''))

    clean_where = _clean(extra_where)

    # Opportunities
    oppo_sql = f"""
        SELECT
            EXTRACT(YEAR  FROM created_date)::INT AS yr,
            EXTRACT(MONTH FROM created_date)::INT AS mo,
            COUNT(*) FILTER (WHERE deleted IS NOT TRUE) AS won,
            COUNT(*) FILTER (WHERE deleted IS TRUE)     AS lost
        FROM fact_opportunities
        WHERE EXTRACT(YEAR FROM created_date) IN (%s, %s - 1)
          {clean_where}
        GROUP BY yr, mo
    """
    oppo_rows = _query(oppo_sql, (year_n, year_n) + params)
    oppo = {(r["yr"], r["mo"]): r for r in oppo_rows}

    # Quotes
    quote_sql = f"""
        SELECT
            EXTRACT(YEAR  FROM created_date)::INT AS yr,
            EXTRACT(MONTH FROM created_date)::INT AS mo,
            COUNT(*) FILTER (WHERE deleted IS NOT TRUE) AS won,
            COUNT(*) FILTER (WHERE deleted IS TRUE)     AS lost
        FROM fact_quotes
        WHERE EXTRACT(YEAR FROM created_date) IN (%s, %s - 1)
          {clean_where}
        GROUP BY yr, mo
    """
    quote_rows = _query(quote_sql, (year_n, year_n) + params)
    quotes = {(r["yr"], r["mo"]): r for r in quote_rows}

    # Sales (always won — no deleted column)
    sale_sql = f"""
        SELECT
            EXTRACT(YEAR  FROM sale_date)::INT AS yr,
            EXTRACT(MONTH FROM sale_date)::INT AS mo,
            COUNT(*) AS won
        FROM fact_sales
        WHERE EXTRACT(YEAR FROM sale_date) IN (%s, %s - 1)
          {clean_where}
        GROUP BY yr, mo
    """
    sale_rows = _query(sale_sql, (year_n, year_n) + params)
    sales = {(r["yr"], r["mo"]): r for r in sale_rows}

    MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"]

    result = []
    for yr in (year_n - 1, year_n):
        suffix = "" if yr == year_n else " n-1"
        for mo in range(1, 13):
            label = MONTH_ABBR[mo - 1] + (" n-1" if yr == year_n - 1 else "")
            o = oppo.get((yr, mo), {})
            q = quotes.get((yr, mo), {})
            s = sales.get((yr, mo), {})
            result.append({
                "period":    label,
                "oppo_won":  o.get("won", 0),
                "oppo_lost": o.get("lost", 0),
                "quote_won": q.get("won", 0),
                "quote_lost":q.get("lost", 0),
                "sale_won":  s.get("won", 0),
                "sale_lost": 0,
            })

    # Yearly totals
    for yr, label in ((year_n - 1, "Year n-1"), (year_n, "Year n")):
        o = {"won": 0, "lost": 0}
        q = {"won": 0, "lost": 0}
        s = {"won": 0}
        for mo in range(1, 13):
            ov = oppo.get((yr, mo), {})
            qv = quotes.get((yr, mo), {})
            sv = sales.get((yr, mo), {})
            o["won"]  += ov.get("won",  0)
            o["lost"] += ov.get("lost", 0)
            q["won"]  += qv.get("won",  0)
            q["lost"] += qv.get("lost", 0)
            s["won"]  += sv.get("won",  0)
        result.append({
            "period":    label,
            "oppo_won":  o["won"],
            "oppo_lost": o["lost"],
            "quote_won": q["won"],
            "quote_lost":q["lost"],
            "sale_won":  s["won"],
            "sale_lost": 0,
        })

    return result


def _funnel_by_user(year_n: int, extra_where: str = "", params: tuple = ()):
    """
    Per-user yearly totals for the donut cards (Opportunities / Quotes by user).
    Returns two lists: current year and previous year.
    """
    # Prefix unaliased column names with the correct table alias per query
    def _prefix(w, alias):
        return (w.replace("agency_name", f"{alias}.agency_name")
                 .replace("user_id",     f"{alias}.user_id")
                 .replace(f"{alias}.{alias}.", f"{alias}."))  # prevent double-prefix

    fo_where = _prefix(extra_where, "fo")
    fq_where = _prefix(extra_where, "fq")

    sql_tmpl = f"""
        SELECT
            du.user_id,
            du.first_name || ' ' || du.last_name AS full_name,
            COUNT(*) FILTER (WHERE fo.deleted IS NOT TRUE) AS oppo_won,
            COUNT(*) FILTER (WHERE fo.deleted IS TRUE)     AS oppo_lost
        FROM fact_opportunities fo
        JOIN dim_user du ON du.user_id = fo.user_id
        WHERE EXTRACT(YEAR FROM fo.created_date) = %s
          {fo_where}
        GROUP BY du.user_id, full_name
        ORDER BY full_name
    """

    def _quotes_by_user(yr):
        q_sql = f"""
            SELECT
                du.user_id,
                du.first_name || ' ' || du.last_name AS full_name,
                COUNT(*) FILTER (WHERE fq.deleted IS NOT TRUE) AS quote_won,
                COUNT(*) FILTER (WHERE fq.deleted IS TRUE)     AS quote_lost
            FROM fact_quotes fq
            JOIN dim_user du ON du.user_id = fq.user_id
            WHERE EXTRACT(YEAR FROM fq.created_date) = %s
              {fq_where}
            GROUP BY du.user_id, full_name
            ORDER BY full_name
        """
        return {r["user_id"]: r for r in _query(q_sql, (yr,) + params)}

    def _build(yr):
        oppo = {r["user_id"]: r for r in _query(sql_tmpl, (yr,) + params)}
        quotes = _quotes_by_user(yr)
        all_ids = set(oppo) | set(quotes)
        out = []
        for uid in all_ids:
            o = oppo.get(uid, {})
            q = quotes.get(uid, {})
            out.append({
                "user_id":    uid,
                "full_name":  o.get("full_name") or q.get("full_name", ""),
                "oppo_won":   o.get("oppo_won",   0),
                "oppo_lost":  o.get("oppo_lost",  0),
                "quote_won":  q.get("quote_won",  0),
                "quote_lost": q.get("quote_lost", 0),
            })
        return sorted(out, key=lambda x: x["full_name"])

    return {"year_n": _build(year_n), "year_nm1": _build(year_n - 1)}


# ── /dashboard/global/funnel/* ────────────────────────────────────────────────

@router.get("/global/funnel/monthly")
def global_funnel_monthly(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    _require_global(user)
    year = year or date.today().year
    rows = _funnel_rows(year)
    return {"year_n": year, "rows": rows}


@router.get("/global/funnel/by-agency")
def global_funnel_by_agency(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    """Per-agency yearly funnel totals — donut cards in DirectorFunnel."""
    _require_global(user)
    year = year or date.today().year
    return _funnel_by_user(year,
        extra_where="AND agency_name IS NOT NULL",
        params=())


@router.get("/agency/funnel/monthly")
def agency_funnel_monthly(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    year = year or date.today().year
    rows = _funnel_rows(year,
        extra_where="AND agency_name = %s",
        params=(user.agency_name,))
    return {"year_n": year, "agency": user.agency_name, "rows": rows}


@router.get("/agency/funnel/by-commercial")
def agency_funnel_by_commercial(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    """Per-commercial yearly funnel totals — donut cards in AgencyFunnel."""
    year = year or date.today().year
    return _funnel_by_user(year,
        extra_where="AND agency_name = %s",
        params=(user.agency_name,))


# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 — TRENDS  (Sales units by category / model / month)
#
#  Mirrors the same category × model × month structure as revenue, but the
#  value is `quantity` (units sold) not `final_price`.
# ═══════════════════════════════════════════════════════════════════════════════

def _category_model_units(year_n: int, extra_where: str = "", params: tuple = ()):
    sql = f"""
        SELECT
            dv.category,
            dv.model,
            EXTRACT(MONTH FROM fs.sale_date)::INT AS month,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s
                     THEN fs.quantity ELSE 0 END) AS n,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s - 1
                     THEN fs.quantity ELSE 0 END) AS n_minus1
        FROM fact_sales fs
        JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
        WHERE EXTRACT(YEAR FROM fs.sale_date) IN (%s, %s - 1)
          {extra_where}
        GROUP BY dv.category, dv.model, month
        ORDER BY dv.category, dv.model, month
    """
    return _query(sql, (year_n, year_n, year_n, year_n) + params)


def _client_by_state(year_n: int, month: int, extra_where: str = "", params: tuple = ()):
    """
    Units sold grouped by client city (used as 'state') for a given month.
    Returns rows for year_n and year_n-1.
    """
    sql = f"""
        SELECT
            dc.city,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s
                     THEN fs.quantity ELSE 0 END) AS n,
            SUM(CASE WHEN EXTRACT(YEAR FROM fs.sale_date) = %s - 1
                     THEN fs.quantity ELSE 0 END) AS n_minus1
        FROM fact_sales fs
        JOIN dim_client dc ON dc.client_id = fs.client_id
        WHERE EXTRACT(MONTH FROM fs.sale_date) = %s
          AND EXTRACT(YEAR  FROM fs.sale_date) IN (%s, %s - 1)
          AND dc.city = ANY(%s)
          {extra_where}
        GROUP BY dc.city
        ORDER BY dc.city
    """
    return _query(sql, (year_n, year_n, month, year_n, year_n,
                        TUNISIA_STATES) + params)


@router.get("/global/trends/by-category")
def global_trends_by_category(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    _require_global(user)
    year = year or date.today().year
    rows = _category_model_units(year)
    return {"year_n": year, "rows": rows}


@router.get("/global/trends/clients-by-state")
def global_trends_clients_by_state(
    year: int = Query(default=None),
    month: int = Query(default=None),
    user=Depends(get_current_user),
):
    """
    Returns units sold per Tunisian governorate for the requested month
    (current and previous year). Used by the State Rankings section.
    """
    _require_global(user)
    today = date.today()
    year  = year  or today.year
    month = month or today.month
    rows  = _client_by_state(year, month)
    return {"year_n": year, "month": month, "rows": rows}


@router.get("/agency/trends/by-category")
def agency_trends_by_category(
    year: int = Query(default=None),
    user=Depends(get_current_user),
):
    year = year or date.today().year
    rows = _category_model_units(year,
        extra_where="AND fs.agency_name = %s",
        params=(user.agency_name,))
    return {"year_n": year, "agency": user.agency_name, "rows": rows}


@router.get("/agency/trends/clients-by-state")
def agency_trends_clients_by_state(
    year: int = Query(default=None),
    month: int = Query(default=None),
    user=Depends(get_current_user),
):
    today = date.today()
    year  = year  or today.year
    month = month or today.month
    rows  = _client_by_state(year, month,
        extra_where="AND fs.agency_name = %s",
        params=(user.agency_name,))
    return {"year_n": year, "month": month, "agency": user.agency_name, "rows": rows}


# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 — FILTER OPTIONS
#
#  FilterContext / AgencyFilterContext / CommercialFilterContext all need
#  lists of selectable values (categories, models, years).
#  These endpoints return the distinct values present in the DWH.
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/global/filters")
def global_filters(user=Depends(get_current_user)):
    _require_global(user)
    categories = _query(
        "SELECT DISTINCT category FROM dim_vehicle WHERE category IS NOT NULL ORDER BY category"
    )
    agencies = _query(
        "SELECT DISTINCT agency_name FROM fact_sales WHERE agency_name IS NOT NULL ORDER BY agency_name"
    )
    years = _query(
        "SELECT DISTINCT EXTRACT(YEAR FROM sale_date)::INT AS yr FROM fact_sales ORDER BY yr DESC"
    )
    return {
        "categories": [r["category"] for r in categories],
        "agencies":   [r["agency_name"] for r in agencies],
        "years":      [r["yr"] for r in years],
    }


@router.get("/agency/filters")
def agency_filters(user=Depends(get_current_user)):
    categories = _query(
        """SELECT DISTINCT dv.category
           FROM fact_sales fs
           JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
           WHERE fs.agency_name = %s AND dv.category IS NOT NULL
           ORDER BY dv.category""",
        (user.agency_name,)
    )
    commercials = _query(
        """SELECT DISTINCT du.user_id, du.first_name || ' ' || du.last_name AS full_name
           FROM fact_sales fs
           JOIN dim_user du ON du.user_id = fs.user_id
           WHERE fs.agency_name = %s
           ORDER BY full_name""",
        (user.agency_name,)
    )
    years = _query(
        """SELECT DISTINCT EXTRACT(YEAR FROM sale_date)::INT AS yr
           FROM fact_sales WHERE agency_name = %s ORDER BY yr DESC""",
        (user.agency_name,)
    )
    return {
        "categories":  [r["category"] for r in categories],
        "commercials": [{"id": r["user_id"], "name": r["full_name"]} for r in commercials],
        "years":       [r["yr"] for r in years],
    }


@router.get("/me/filters")
def me_filters(user=Depends(get_current_user)):
    uid = _get_dwh_user_id(user.email)
    if not uid:
        raise HTTPException(status_code=404, detail="User not found in DWH")
    categories = _query(
        """SELECT DISTINCT dv.category
           FROM fact_sales fs
           JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
           WHERE fs.user_id = %s AND dv.category IS NOT NULL
           ORDER BY dv.category""",
        (uid,)
    )
    years = _query(
        """SELECT DISTINCT EXTRACT(YEAR FROM sale_date)::INT AS yr
           FROM fact_sales WHERE user_id = %s ORDER BY yr DESC""",
        (uid,)
    )
    return {
        "categories": [r["category"] for r in categories],
        "years":      [r["yr"] for r in years],
    }