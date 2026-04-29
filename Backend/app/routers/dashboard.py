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

GLOBAL_ROLES = {"Directeur Général", "Directeur Commercial", "Administrateur BI"}


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


# ── Shared helpers ─────────────────────────────────────────────────────────────

def date_range_params(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date:   Optional[date] = Query(None, alias="to"),
):
    if not from_date:
        today = date.today()
        from_date = date(today.year, today.month, 1)
    if not to_date:
        to_date = date.today()
    return {"from_date": from_date, "to_date": to_date}


def _get_dwh_user_id(email: str) -> int:
    """Resolve dim_user.user_id by email. Raises 404 if not found."""
    row = _one("SELECT user_id FROM dim_user WHERE email = %s LIMIT 1", (email,))
    if not row:
        raise HTTPException(status_code=404, detail="User not found in DWH")
    return row["user_id"]


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL  /dashboard/global/*
# Access: Directeur Général, Directeur Commercial, Administrateur BI
# ═══════════════════════════════════════════════════════════════════════════════

# ── Section 1 — Revenue KPI cards ─────────────────────────────────────────────

@router.get("/global/section1/kpis")
def global_section1_kpis(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Returns:
      total_revenue, avg_sale_value, highest_sale_value, lowest_sale_value,
      sales_count — all from fact_sales in the date range.
    """
    r = _one("""
        SELECT
            COALESCE(SUM(fs.final_price),  0)   AS total_revenue,
            COALESCE(AVG(fs.final_price),  0)   AS avg_sale_value,
            COALESCE(MAX(fs.final_price),  0)   AS highest_sale_value,
            COALESCE(MIN(fs.final_price),  0)   AS lowest_sale_value,
            COUNT(*)                             AS sales_count
        FROM fact_sales fs
        WHERE fs.sale_date BETWEEN %s AND %s
    """, (dr["from_date"], dr["to_date"]))

    return {
        "total_revenue":      float(r.get("total_revenue")      or 0),
        "avg_sale_value":     float(r.get("avg_sale_value")      or 0),
        "highest_sale_value": float(r.get("highest_sale_value")  or 0),
        "lowest_sale_value":  float(r.get("lowest_sale_value")   or 0),
        "sales_count":        int(r.get("sales_count")           or 0),
    }


@router.get("/global/section1/revenue-by-month")
def global_revenue_by_month(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Multi-agency monthly revenue line chart.
    Returns list of { date: 'Jan 25', <agency_name>: revenue, ... }
    One object per (year, month), columns are distinct agency names.
    """
    rows = _query("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', fs.sale_date), 'Mon YY') AS date,
            EXTRACT(YEAR  FROM fs.sale_date)::int                AS year,
            EXTRACT(MONTH FROM fs.sale_date)::int                AS month,
            fs.agency_name,
            COALESCE(SUM(fs.final_price), 0)                     AS revenue
        FROM fact_sales fs
        WHERE fs.sale_date BETWEEN %s AND %s
          AND fs.agency_name IS NOT NULL
        GROUP BY DATE_TRUNC('month', fs.sale_date),
                 EXTRACT(YEAR  FROM fs.sale_date),
                 EXTRACT(MONTH FROM fs.sale_date),
                 fs.agency_name
        ORDER BY year, month
    """, (dr["from_date"], dr["to_date"]))

    # Pivot: { date -> { agency -> revenue } }
    pivot: dict = {}
    for r in rows:
        key = r["date"]
        if key not in pivot:
            pivot[key] = {"date": key, "_year": r["year"], "_month": r["month"]}
        pivot[key][r["agency_name"]] = float(r["revenue"])

    return sorted(pivot.values(), key=lambda x: (x["_year"], x["_month"]))


@router.get("/global/section1/agency-summary")
def global_agency_revenue_summary(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    One row per agency: total revenue + % change vs previous equal-length period.
    Returns list of { agency, total, totalFmt, change, changeType }
    """
    period_days = (dr["to_date"] - dr["from_date"]).days + 1
    from datetime import timedelta
    prev_from = dr["from_date"] - timedelta(days=period_days)
    prev_to   = dr["from_date"] - timedelta(days=1)

    # One query covers both periods using conditional aggregation — half the round-trips.
    combined = _query("""
        SELECT
            agency_name,
            COALESCE(SUM(CASE WHEN sale_date BETWEEN %s AND %s THEN final_price END), 0) AS current_revenue,
            COALESCE(SUM(CASE WHEN sale_date BETWEEN %s AND %s THEN final_price END), 0) AS prev_revenue
        FROM fact_sales
        WHERE sale_date BETWEEN %s AND %s
          AND agency_name IS NOT NULL
        GROUP BY agency_name
        ORDER BY current_revenue DESC
    """, (
        dr["from_date"], dr["to_date"],
        prev_from, prev_to,
        prev_from, dr["to_date"],   # full span covers both periods in one scan
    ))

    # Reshape to match the original variable names the loop below expects
    current  = [{"agency_name": r["agency_name"], "revenue": r["current_revenue"]} for r in combined]
    prev_map = {r["agency_name"]: float(r["prev_revenue"]) for r in combined}

    STROKES = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899",
               "#10b981", "#ef4444", "#a78bfa", "#f97316", "#14b8a6"]

    result = []
    for i, r in enumerate(current):
        total   = float(r["revenue"])
        prev_v  = prev_map.get(r["agency_name"], 0)
        if prev_v > 0:
            pct  = round((total - prev_v) / prev_v * 100, 1)
            change      = f"+{pct}%" if pct >= 0 else f"{pct}%"
            change_type = "positive" if pct >= 0 else "negative"
        else:
            change      = "—"
            change_type = "positive"
        result.append({
            "agency":      r["agency_name"],
            "total":       total,
            "totalFmt":    f"{round(total/1000)}K TND" if total < 1_000_000 else f"{round(total/1_000_000, 2)}M TND",
            "change":      change,
            "changeType":  change_type,
            "stroke":      STROKES[i % len(STROKES)],
        })
    return result


# ── Section 2 — Conversion Funnel ─────────────────────────────────────────────

@router.get("/global/section2/kpis")
def global_section2_kpis(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """Total opportunities, quotes, sales in period."""
    r = _one("""
        SELECT
            (SELECT COUNT(*) FROM fact_opportunities
             WHERE created_date BETWEEN %s AND %s) AS total_opportunities,
            (SELECT COUNT(*) FROM fact_quotes
             WHERE created_date BETWEEN %s AND %s) AS total_quotes,
            (SELECT COUNT(*) FROM fact_sales
             WHERE sale_date BETWEEN %s AND %s)    AS total_sales
    """, (dr["from_date"], dr["to_date"]) * 3)

    return {
        "total_opportunities": int(r.get("total_opportunities") or 0),
        "total_quotes":        int(r.get("total_quotes")        or 0),
        "total_sales":         int(r.get("total_sales")         or 0),
    }


@router.get("/global/section2/funnel-by-month")
def global_funnel_by_month(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Monthly stacked bar: Opportunities, Quotes, Sales per month.
    Returns list of { date, Opportunities, Quotes, Sales }
    """
    rows = _query("""
        WITH months AS (
            SELECT DISTINCT
                DATE_TRUNC('month', d)::date AS month_start
            FROM generate_series(%s::date, %s::date, '1 month'::interval) d
        ),
        oppos AS (
            SELECT DATE_TRUNC('month', created_date)::date AS m,
                   COUNT(*) AS cnt
            FROM fact_opportunities
            WHERE created_date BETWEEN %s AND %s
            GROUP BY 1
        ),
        quotes AS (
            SELECT DATE_TRUNC('month', created_date)::date AS m,
                   COUNT(*) AS cnt
            FROM fact_quotes
            WHERE created_date BETWEEN %s AND %s
            GROUP BY 1
        ),
        sales AS (
            SELECT DATE_TRUNC('month', sale_date)::date AS m,
                   COUNT(*) AS cnt
            FROM fact_sales
            WHERE sale_date BETWEEN %s AND %s
            GROUP BY 1
        )
        SELECT
            TO_CHAR(mo.month_start, 'Mon YY')     AS date,
            EXTRACT(YEAR  FROM mo.month_start)::int AS year,
            EXTRACT(MONTH FROM mo.month_start)::int AS month,
            COALESCE(o.cnt, 0)                     AS "Opportunities",
            COALESCE(q.cnt, 0)                     AS "Quotes",
            COALESCE(s.cnt, 0)                     AS "Sales"
        FROM months mo
        LEFT JOIN oppos  o ON o.m = mo.month_start
        LEFT JOIN quotes q ON q.m = mo.month_start
        LEFT JOIN sales  s ON s.m = mo.month_start
        ORDER BY mo.month_start
    """, (
        dr["from_date"], dr["to_date"],
        dr["from_date"], dr["to_date"],
        dr["from_date"], dr["to_date"],
        dr["from_date"], dr["to_date"],
    ))

    return [{
        "date":          r["date"],
        "Opportunities": int(r["Opportunities"]),
        "Quotes":        int(r["Quotes"]),
        "Sales":         int(r["Sales"]),
    } for r in rows]


@router.get("/global/section2/agency-funnel")
def global_agency_funnel(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Per-agency funnel totals + conversion rates.
    Returns list of { agency, opportunities, quotes, sales, convOQ, convQS }
    """
    rows = _query("""
        WITH oppos AS (
            SELECT agency_name, COUNT(*) AS cnt
            FROM fact_opportunities
            WHERE created_date BETWEEN %s AND %s
            GROUP BY agency_name
        ),
        quotes AS (
            SELECT agency_name, COUNT(*) AS cnt
            FROM fact_quotes
            WHERE created_date BETWEEN %s AND %s
            GROUP BY agency_name
        ),
        sales AS (
            SELECT agency_name, COUNT(*) AS cnt
            FROM fact_sales
            WHERE sale_date BETWEEN %s AND %s
            GROUP BY agency_name
        ),
        agencies AS (
            SELECT agency_name FROM oppos
            UNION
            SELECT agency_name FROM quotes
            UNION
            SELECT agency_name FROM sales
        )
        SELECT
            ag.agency_name                         AS agency,
            COALESCE(o.cnt, 0)                     AS opportunities,
            COALESCE(q.cnt, 0)                     AS quotes,
            COALESCE(s.cnt, 0)                     AS sales
        FROM agencies ag
        LEFT JOIN oppos  o ON o.agency_name = ag.agency_name
        LEFT JOIN quotes q ON q.agency_name = ag.agency_name
        LEFT JOIN sales  s ON s.agency_name = ag.agency_name
        WHERE ag.agency_name IS NOT NULL
        ORDER BY sales DESC
    """, (
        dr["from_date"], dr["to_date"],
        dr["from_date"], dr["to_date"],
        dr["from_date"], dr["to_date"],
    ))

    result = []
    for r in rows:
        oppos  = int(r["opportunities"])
        quotes = int(r["quotes"])
        sales  = int(r["sales"])
        conv_oq = f"{round(quotes / oppos * 100, 1)}%" if oppos  else "0%"
        conv_qs = f"{round(sales  / quotes * 100, 1)}%" if quotes else "0%"
        result.append({
            "agency":        r["agency"],
            "opportunities": oppos,
            "quotes":        quotes,
            "sales":         sales,
            "convOQ":        conv_oq,
            "convQS":        conv_qs,
        })
    return result


# ── Section 3 — Vehicle Trends ─────────────────────────────────────────────────

@router.get("/global/section3/kpis")
def global_section3_kpis(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Most sold category, least sold category, avg category sales.
    """
    rows = _query("""
        SELECT
            dv.category,
            COUNT(*)  AS sales_count
        FROM fact_sales fs
        JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
        WHERE fs.sale_date BETWEEN %s AND %s
          AND dv.category IS NOT NULL
        GROUP BY dv.category
        ORDER BY sales_count DESC
    """, (dr["from_date"], dr["to_date"]))

    if not rows:
        return {
            "most_sold_category":  None,
            "most_sold_count":     0,
            "least_sold_category": None,
            "least_sold_count":    0,
            "avg_category_sales":  0,
        }

    counts = [int(r["sales_count"]) for r in rows]
    avg    = round(sum(counts) / len(counts), 1)

    return {
        "most_sold_category":  rows[0]["category"],
        "most_sold_count":     counts[0],
        "least_sold_category": rows[-1]["category"],
        "least_sold_count":    counts[-1],
        "avg_category_sales":  avg,
    }


@router.get("/global/section3/categories")
def global_categories(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """Sales count per vehicle category (for donut chart)."""
    rows = _query("""
        SELECT dv.category, COUNT(*) AS sales
        FROM fact_sales fs
        JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
        WHERE fs.sale_date BETWEEN %s AND %s
          AND dv.category IS NOT NULL
        GROUP BY dv.category
        ORDER BY sales DESC
    """, (dr["from_date"], dr["to_date"]))

    return [{"category": r["category"], "sales": int(r["sales"])} for r in rows]


@router.get("/global/section3/brands")
def global_brands(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """Top brands by sales count (for mini bar chart)."""
    rows = _query("""
        SELECT dv.brand, COUNT(*) AS sales
        FROM fact_sales fs
        JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
        WHERE fs.sale_date BETWEEN %s AND %s
          AND dv.brand IS NOT NULL
        GROUP BY dv.brand
        ORDER BY sales DESC
        LIMIT 10
    """, (dr["from_date"], dr["to_date"]))

    return [{"brand": r["brand"], "sales": int(r["sales"])} for r in rows]


@router.get("/global/section3/agency-vehicles")
def global_agency_vehicles(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Per-agency: total units sold, top category, top brand.
    Used for agency comparison bar + summary badges.
    """
    rows = _query("""
        WITH base AS (
            SELECT
                fs.agency_name,
                dv.category,
                dv.brand,
                COUNT(*) AS cnt
            FROM fact_sales fs
            JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
            WHERE fs.sale_date BETWEEN %s AND %s
              AND fs.agency_name IS NOT NULL
            GROUP BY fs.agency_name, dv.category, dv.brand
        ),
        ranked AS (
            SELECT
                agency_name,
                category,
                brand,
                cnt,
                SUM(cnt)  OVER (PARTITION BY agency_name)                    AS total_sales,
                ROW_NUMBER() OVER (PARTITION BY agency_name ORDER BY cnt DESC) AS rn
            FROM base
        )
        SELECT
            agency_name  AS agency,
            total_sales,
            category     AS top_category,
            brand        AS top_brand
        FROM ranked
        WHERE rn = 1
        ORDER BY total_sales DESC
    """, (dr["from_date"], dr["to_date"]))

    return [{
        "agency":       r["agency"],
        "totalSales":   int(r["total_sales"]),
        "topCategory":  r["top_category"],
        "topBrand":     r["top_brand"],
    } for r in rows]


# ── Section 4 — Customer Segmentation ─────────────────────────────────────────

@router.get("/global/section4/kpis")
def global_section4_kpis(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Highest client base state, least client base state, total distinct clients
    — restricted to Tunisia's 24 governorates, counted from fact_sales.
    """
    states_placeholder = ",".join(["%s"] * len(TUNISIA_STATES))

    rows = _query(f"""
        SELECT
            dc.city,
            COUNT(DISTINCT fs.client_id) AS client_count
        FROM fact_sales fs
        JOIN dim_client dc ON dc.client_id = fs.client_id
        WHERE fs.sale_date BETWEEN %s AND %s
          AND dc.city IN ({states_placeholder})
        GROUP BY dc.city
        ORDER BY client_count DESC
    """, (dr["from_date"], dr["to_date"], *TUNISIA_STATES))

    if not rows:
        return {
            "highest_state": None, "highest_count": 0,
            "lowest_state":  None, "lowest_count":  0,
            "total_clients": 0,
        }

    counts = [int(r["client_count"]) for r in rows]
    return {
        "highest_state": rows[0]["city"],
        "highest_count": counts[0],
        "lowest_state":  rows[-1]["city"],
        "lowest_count":  counts[-1],
        "total_clients": sum(counts),
    }


@router.get("/global/section4/clients-by-state")
def global_clients_by_state(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Client counts per Tunisian governorate.
    - clients    = distinct clients with any sale in the period
    - newClients = clients whose first-ever sale in the entire DWH falls in this period
    """
    states_placeholder = ",".join(["%s"] * len(TUNISIA_STATES))

    rows = _query(f"""
        WITH period_clients AS (
            SELECT DISTINCT fs.client_id, dc.city
            FROM fact_sales fs
            JOIN dim_client dc ON dc.client_id = fs.client_id
            WHERE fs.sale_date BETWEEN %s AND %s
              AND dc.city IN ({states_placeholder})
        ),
        first_sale AS (
            -- Only compute first-sale date for clients who appear in the period,
            -- not the entire fact_sales table.
            SELECT fs.client_id, MIN(fs.sale_date) AS first_date
            FROM fact_sales fs
            WHERE fs.client_id IN (SELECT client_id FROM period_clients)
            GROUP BY fs.client_id
        )
        SELECT
            pc.city,
            COUNT(DISTINCT pc.client_id)                                          AS clients,
            COUNT(DISTINCT CASE
                WHEN fst.first_date BETWEEN %s AND %s THEN pc.client_id
            END)                                                                  AS new_clients
        FROM period_clients pc
        JOIN first_sale fst ON fst.client_id = pc.client_id
        GROUP BY pc.city
        ORDER BY clients DESC
    """, (
        dr["from_date"], dr["to_date"],
        *TUNISIA_STATES,
        dr["from_date"], dr["to_date"],
    ))

    return [{
        "city":       r["city"],
        "clients":    int(r["clients"]),
        "newClients": int(r["new_clients"]),
    } for r in rows]


@router.get("/global/section4/agency-clients")
def global_agency_clients(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    """
    Per-agency client stats: totalClients, newClients, repeatRate.
    Clients scoped to Tunisia's 24 governorates.
    Repeat client = bought in this period AND had a previous sale before the period.
    """
    states_placeholder = ",".join(["%s"] * len(TUNISIA_STATES))

    rows = _query(f"""
        WITH period_clients AS (
            SELECT DISTINCT fs.client_id, fs.agency_name
            FROM fact_sales fs
            JOIN dim_client dc ON dc.client_id = fs.client_id
            WHERE fs.sale_date BETWEEN %s AND %s
              AND dc.city IN ({states_placeholder})
              AND fs.agency_name IS NOT NULL
        ),
        first_sale AS (
            -- Scoped to only clients who appear in the period — avoids full table scan.
            SELECT fs.client_id, MIN(fs.sale_date) AS first_date
            FROM fact_sales fs
            WHERE fs.client_id IN (SELECT client_id FROM period_clients)
            GROUP BY fs.client_id
        )
        SELECT
            pc.agency_name                                                   AS agency,
            COUNT(DISTINCT pc.client_id)                                     AS total_clients,
            COUNT(DISTINCT CASE
                WHEN fst.first_date BETWEEN %s AND %s THEN pc.client_id
            END)                                                             AS new_clients,
            COUNT(DISTINCT CASE
                WHEN fst.first_date < %s THEN pc.client_id
            END)                                                             AS repeat_clients
        FROM period_clients pc
        JOIN first_sale fst ON fst.client_id = pc.client_id
        GROUP BY pc.agency_name
        ORDER BY total_clients DESC
    """, (
        dr["from_date"], dr["to_date"],
        *TUNISIA_STATES,
        dr["from_date"], dr["to_date"],
        dr["from_date"],
    ))

    result = []
    for r in rows:
        total   = int(r["total_clients"])
        repeat  = int(r["repeat_clients"])
        rate    = f"{round(repeat / total * 100, 1)}%" if total else "0%"
        result.append({
            "agency":       r["agency"],
            "totalClients": total,
            "newClients":   int(r["new_clients"]),
            "repeatRate":   rate,
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# AGENCY  /dashboard/agency/*
# Access: Responsable d'Agence — scoped to user.agency_name
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/agency/kpis")
def agency_kpis(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
    agency_override: Optional[str] = Query(None, alias="agency"),
):
    """
    Agency-level KPIs: total sales, revenue, opp→quote rate, quote→sale rate.
    Global roles (DG, DC, Admin) may pass ?agency=<name> to drill into any agency.
    Agency managers are always scoped to their own agency.
    """

    agency = (
        agency_override
        if agency_override and user.role in GLOBAL_ROLES
        else user.agency_name
    )
    r = _one("""
        WITH o AS (
            SELECT COUNT(*) AS cnt
            FROM fact_opportunities
            WHERE agency_name = %s AND created_date BETWEEN %s AND %s
        ),
        q AS (
            SELECT COUNT(*) AS cnt
            FROM fact_quotes
            WHERE agency_name = %s AND created_date BETWEEN %s AND %s
        ),
        s AS (
            SELECT COUNT(*) AS cnt, COALESCE(SUM(final_price), 0) AS rev
            FROM fact_sales
            WHERE agency_name = %s AND sale_date BETWEEN %s AND %s
        )
        SELECT o.cnt AS opportunities, q.cnt AS quotes, s.cnt AS sales, s.rev AS revenue
        FROM o, q, s
    """, (
        agency, dr["from_date"], dr["to_date"],
        agency, dr["from_date"], dr["to_date"],
        agency, dr["from_date"], dr["to_date"],
    ))

    oppos  = int(r.get("opportunities") or 0)
    quotes = int(r.get("quotes")        or 0)
    sales  = int(r.get("sales")         or 0)

    return {
        "sales":    sales,
        "revenue":  float(r.get("revenue") or 0),
        "opportunities": oppos,
        "quotes":   quotes,
        "convOQ":   f"{round(quotes / oppos  * 100, 1)}%" if oppos  else "0%",
        "convQS":   f"{round(sales  / quotes * 100, 1)}%" if quotes else "0%",
    }


@router.get("/agency/revenue-by-month")
def agency_revenue_by_month(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
    agency_override: Optional[str] = Query(None, alias="agency"),
):
    """Monthly revenue area chart for this agency."""

    agency = (
        agency_override
        if agency_override and user.role in GLOBAL_ROLES
        else user.agency_name
    )
    rows = _query("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', sale_date), 'Mon YY') AS date,
            EXTRACT(YEAR  FROM sale_date)::int                AS year,
            EXTRACT(MONTH FROM sale_date)::int                AS month,
            COALESCE(SUM(final_price), 0)                     AS revenue
        FROM fact_sales
        WHERE agency_name = %s
          AND sale_date BETWEEN %s AND %s
        GROUP BY DATE_TRUNC('month', sale_date),
                 EXTRACT(YEAR FROM sale_date),
                 EXTRACT(MONTH FROM sale_date)
        ORDER BY year, month
    """, (agency, dr["from_date"], dr["to_date"]))

    return [{"date": r["date"], "Revenue": float(r["revenue"])} for r in rows]


@router.get("/agency/commercials")
def agency_commercials(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
    agency_override: Optional[str] = Query(None, alias="agency"),
):
    """
    All commercials in this agency with their KPIs.
    Used for the commercial performance table + drill-down.
    """

    agency = (
        agency_override
        if agency_override and user.role in GLOBAL_ROLES
        else user.agency_name
    )
    from datetime import timedelta
    period_days = (dr["to_date"] - dr["from_date"]).days + 1
    prev_from = dr["from_date"] - timedelta(days=period_days)
    prev_to   = dr["from_date"] - timedelta(days=1)

    rows = _query("""
        SELECT
            du.user_id,
            du.first_name || ' ' || du.last_name  AS name,
            du.email,
            COUNT(DISTINCT CASE WHEN fs.sale_date BETWEEN %s AND %s THEN fs.sale_id END)       AS sales,
            COALESCE(SUM(CASE WHEN fs.sale_date BETWEEN %s AND %s THEN fs.final_price END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN fs.sale_date BETWEEN %s AND %s THEN fs.final_price END), 0) AS prev_revenue,
            COUNT(DISTINCT fq.quote_id)            AS quotes
        FROM dim_user du
        LEFT JOIN fact_sales fs
            ON fs.user_id = du.user_id
            AND fs.sale_date BETWEEN %s AND %s
        LEFT JOIN fact_quotes fq
            ON fq.user_id = du.user_id
            AND fq.created_date BETWEEN %s AND %s
        WHERE du.agency_name = %s
          AND du.role = 'Commercial'
        GROUP BY du.user_id, du.first_name, du.last_name, du.email
        ORDER BY sales DESC
    """, (
        dr["from_date"], dr["to_date"],          # sales COUNT filter
        dr["from_date"], dr["to_date"],          # revenue SUM filter
        prev_from, prev_to,                      # prev_revenue SUM filter
        prev_from, dr["to_date"],                # full span for the JOIN
        dr["from_date"], dr["to_date"],          # quotes date filter
        agency,
    ))

    result = []
    for r in rows:
        sales  = int(r["sales"])
        quotes = int(r["quotes"])
        rev    = float(r["revenue"])
        prev_v = float(r["prev_revenue"])

        if prev_v > 0:
            pct = round((rev - prev_v) / prev_v * 100, 1)
            change      = f"+{pct}%" if pct >= 0 else f"{pct}%"
            change_type = "positive" if pct >= 0 else "negative"
        else:
            change      = "—"
            change_type = "positive"

        conv_rate = f"{round(sales / quotes * 100, 1)}%" if quotes else "0%"

        result.append({
            "id":          r["user_id"],
            "name":        r["name"],
            "email":       r["email"],
            "sales":       sales,
            "revenue":     rev,
            "revenueFmt":  f"{round(rev/1000)}K TND" if rev < 1_000_000 else f"{round(rev/1_000_000, 2)}M TND",
            "quotes":      quotes,
            "convRate":    conv_rate,
            "change":      change,
            "changeType":  change_type,
        })
    return result



def _verify_commercial_access(commercial_id: int, user) -> None:
    """Raise 403 if user cannot access this commercial's data.
    Global roles (DG, DC, Admin) can drill into any commercial.
    Agency managers are restricted to their own agency's team.
    """
    if user.role in GLOBAL_ROLES:
        # Just verify the commercial exists
        check = _one(
            "SELECT user_id FROM dim_user WHERE user_id = %s AND role = 'Commercial'",
            (commercial_id,),
        )
    else:
        check = _one("""
            SELECT user_id FROM dim_user
            WHERE user_id = %s AND agency_name = %s AND role = 'Commercial'
        """, (commercial_id, user.agency_name))
    if not check:
        raise HTTPException(status_code=403, detail="Commercial not accessible")


@router.get("/agency/commercial/{commercial_id}/kpis")
def agency_commercial_kpis(
    commercial_id: int,
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    """KPIs for a single commercial — agency manager or global role can drill in."""
    _verify_commercial_access(commercial_id, user)
    return _commercial_kpis_for(commercial_id, dr)


@router.get("/agency/commercial/{commercial_id}/revenue-by-month")
def agency_commercial_revenue(
    commercial_id: int,
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    _verify_commercial_access(commercial_id, user)
    return _commercial_revenue_for(commercial_id, dr)


@router.get("/agency/commercial/{commercial_id}/top-vehicles")
def agency_commercial_vehicles(
    commercial_id: int,
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    _verify_commercial_access(commercial_id, user)
    return _commercial_top_vehicles_for(commercial_id, dr)


@router.get("/agency/commercial/{commercial_id}/recent-sales")
def agency_commercial_recent_sales(
    commercial_id: int,
    limit: int = Query(10, ge=1, le=50),
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    _verify_commercial_access(commercial_id, user)
    return _commercial_recent_sales_for(commercial_id, dr, limit)


# ═══════════════════════════════════════════════════════════════════════════════
# COMMERCIAL  /dashboard/me/*
# Access: Commercial — scoped to logged-in user via dim_user email lookup
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/me/kpis")
def me_kpis(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    uid = _get_dwh_user_id(user.email)
    return _commercial_kpis_for(uid, dr)


@router.get("/me/revenue-by-month")
def me_revenue_by_month(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    uid = _get_dwh_user_id(user.email)
    return _commercial_revenue_for(uid, dr)


@router.get("/me/top-vehicles")
def me_top_vehicles(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    uid = _get_dwh_user_id(user.email)
    return _commercial_top_vehicles_for(uid, dr)


@router.get("/me/recent-sales")
def me_recent_sales(
    limit: int = Query(10, ge=1, le=50),
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    uid = _get_dwh_user_id(user.email)
    return _commercial_recent_sales_for(uid, dr, limit)


# ═══════════════════════════════════════════════════════════════════════════════
# Shared commercial helpers (used by both /agency/commercial/* and /me/*)
# ═══════════════════════════════════════════════════════════════════════════════

def _commercial_kpis_for(uid: int, dr: dict) -> dict:
    r = _one("""
        WITH o AS (
            SELECT COUNT(*) AS cnt
            FROM fact_opportunities
            WHERE user_id = %s AND created_date BETWEEN %s AND %s
        ),
        q AS (
            SELECT COUNT(*) AS cnt
            FROM fact_quotes
            WHERE user_id = %s AND created_date BETWEEN %s AND %s
        ),
        s AS (
            SELECT COUNT(*) AS cnt, COALESCE(SUM(final_price), 0) AS rev
            FROM fact_sales
            WHERE user_id = %s AND sale_date BETWEEN %s AND %s
        )
        SELECT o.cnt AS opportunities, q.cnt AS quotes, s.cnt AS sales, s.rev AS revenue
        FROM o, q, s
    """, (
        uid, dr["from_date"], dr["to_date"],
        uid, dr["from_date"], dr["to_date"],
        uid, dr["from_date"], dr["to_date"],
    ))

    oppos  = int(r.get("opportunities") or 0)
    quotes = int(r.get("quotes")        or 0)
    sales  = int(r.get("sales")         or 0)
    rev    = float(r.get("revenue")     or 0)

    return {
        "sales":         sales,
        "revenue":       rev,
        "opportunities": oppos,
        "quotes":        quotes,
        "convOQ":        f"{round(quotes / oppos  * 100, 1)}%" if oppos  else "0%",
        "convQS":        f"{round(sales  / quotes * 100, 1)}%" if quotes else "0%",
    }


def _commercial_revenue_for(uid: int, dr: dict) -> list:
    rows = _query("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', sale_date), 'Mon YY') AS date,
            EXTRACT(YEAR  FROM sale_date)::int                AS year,
            EXTRACT(MONTH FROM sale_date)::int                AS month,
            COALESCE(SUM(final_price), 0)                     AS revenue
        FROM fact_sales
        WHERE user_id = %s AND sale_date BETWEEN %s AND %s
        GROUP BY DATE_TRUNC('month', sale_date),
                 EXTRACT(YEAR FROM sale_date),
                 EXTRACT(MONTH FROM sale_date)
        ORDER BY year, month
    """, (uid, dr["from_date"], dr["to_date"]))

    return [{"date": r["date"], "Revenue": float(r["revenue"])} for r in rows]


def _commercial_top_vehicles_for(uid: int, dr: dict) -> list:
    rows = _query("""
        SELECT
            COALESCE(dv.model, dv.ar_design, fs.ar_ref) AS vehicle,
            COUNT(*) AS sales
        FROM fact_sales fs
        LEFT JOIN dim_vehicle dv ON dv.ar_ref = fs.ar_ref
        WHERE fs.user_id = %s AND fs.sale_date BETWEEN %s AND %s
        GROUP BY 1
        ORDER BY sales DESC
        LIMIT 8
    """, (uid, dr["from_date"], dr["to_date"]))

    return [{"vehicle": r["vehicle"], "sales": int(r["sales"])} for r in rows]


def _commercial_recent_sales_for(uid: int, dr: dict, limit: int = 10) -> list:
    rows = _query("""
        SELECT
            fs.sale_date::text        AS date,
            COALESCE(dv.model, dv.ar_design, fs.ar_ref) AS vehicle,
            COALESCE(dc.full_name, 'Unknown')            AS client,
            fs.final_price                               AS amount
        FROM fact_sales fs
        LEFT JOIN dim_vehicle dv ON dv.ar_ref    = fs.ar_ref
        LEFT JOIN dim_client  dc ON dc.client_id = fs.client_id
        WHERE fs.user_id = %s AND fs.sale_date BETWEEN %s AND %s
        ORDER BY fs.sale_date DESC
        LIMIT %s
    """, (uid, dr["from_date"], dr["to_date"], limit))

    return [{
        "date":    r["date"],
        "vehicle": r["vehicle"],
        "client":  r["client"],
        "amount":  float(r["amount"] or 0),
        "amountFmt": f"{round(float(r['amount'] or 0)/1000, 1)}K TND",
    } for r in rows]
