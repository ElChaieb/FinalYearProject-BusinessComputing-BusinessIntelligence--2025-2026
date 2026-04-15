# Backend/app/routers/dashboard.py
#
# Replaces the async SQLAlchemy stub with real psycopg2 queries against the DWH.
# URL structure, response shapes, and param names are unchanged — hooks work as-is.
#
#   /dashboard/global/*  → DashboardGlobal  (DG, DC, Administrateur BI)
#   /dashboard/agency/*  → DashboardAgence  (Responsable d'Agence)
#   /dashboard/me/*      → DashboardCommercial (Commercial)
#
# Agency scoping for /agency/* and /me/*:
#   agency_id  — looked up from dim_user via user.email
#   dwh_user_id — looked up from dim_user via user.email

import os
import psycopg2
import psycopg2.extras
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from dotenv import load_dotenv

from app.auth import get_current_user

load_dotenv()

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ── DWH connection ────────────────────────────────────────────

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


# ── Shared helpers ────────────────────────────────────────────

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


def _get_dwh_user(email: str) -> dict:
    """Returns {user_id, agency_id} from dim_user by email. Empty dict if not found."""
    return _one(
        "SELECT user_id, agency_id FROM dim_user WHERE email = %s LIMIT 1",
        (email,)
    )


# ═══════════════════════════════════════════════════════════════
# GLOBAL  /dashboard/global/*
# ═══════════════════════════════════════════════════════════════

@router.get("/global/kpis")
def global_kpis(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    r = _one("""
        SELECT
            COALESCE(SUM(fs.amount), 0)                                        AS total_revenue,
            COUNT(DISTINCT fs.sale_id)                                         AS total_sales,
            COUNT(DISTINCT fq.quote_id)                                        AS total_quotes,
            COUNT(DISTINCT fo.oppo_id)                                         AS total_opportunities,
            ROUND(
                COUNT(DISTINCT fs.sale_id)::numeric /
                NULLIF(COUNT(DISTINCT fo.oppo_id), 0) * 100, 1
            )                                                                  AS conversion_rate,
            COALESCE(AVG(fs.quotes_before_sale), 0)                            AS avg_quotes_per_sale
        FROM fact_opportunities fo
        JOIN dim_date dd ON dd.date_id = fo.date_id
        LEFT JOIN fact_quotes fq ON fq.oppo_id = fo.oppo_id
        LEFT JOIN fact_sales  fs ON fs.oppo_id = fo.oppo_id
        WHERE fo.deleted = FALSE
          AND dd.date BETWEEN %s AND %s
    """, (dr["from_date"], dr["to_date"]))

    return {
        "total_revenue":       float(r.get("total_revenue") or 0),
        "total_sales":         int(r.get("total_sales") or 0),
        "total_quotes":        int(r.get("total_quotes") or 0),
        "total_opportunities": int(r.get("total_opportunities") or 0),
        "conversion_rate":     float(r.get("conversion_rate") or 0),
        "avg_quotes_per_sale": float(r.get("avg_quotes_per_sale") or 0),
    }


@router.get("/global/revenue")
def global_revenue(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    rows = _query("""
        SELECT
            TO_CHAR(dd.date, 'Mon')          AS month,
            dd.year,
            dd.month                          AS month_num,
            COALESCE(SUM(fs.amount), 0)       AS revenue,
            COALESCE(SUM(ft.sales_target), 0) AS target
        FROM dim_date dd
        LEFT JOIN fact_sales   fs ON fs.date_id = dd.date_id
        LEFT JOIN fact_targets ft ON ft.date_id = dd.date_id
        WHERE dd.date BETWEEN %s AND %s
        GROUP BY dd.year, dd.month, TO_CHAR(dd.date, 'Mon')
        ORDER BY dd.year, dd.month
    """, (dr["from_date"], dr["to_date"]))

    return [{"month": r["month"], "revenue": float(r["revenue"]), "target": float(r["target"])}
            for r in rows]


@router.get("/global/agencies")
def global_agencies(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    rows = _query("""
        SELECT
            da.name                                AS agency,
            COALESCE(SUM(fs.amount), 0)            AS revenue,
            COUNT(DISTINCT fs.sale_id)             AS sales,
            COUNT(DISTINCT fq.quote_id)            AS quotes
        FROM dim_agency da
        LEFT JOIN fact_sales fs ON fs.agency_id = da.agency_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_quotes fq ON fq.agency_id = da.agency_id
            AND fq.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        GROUP BY da.agency_id, da.name
        ORDER BY revenue DESC
    """, (dr["from_date"], dr["to_date"], dr["from_date"], dr["to_date"]))

    return [{"agency": r["agency"], "revenue": float(r["revenue"]),
             "sales": int(r["sales"]), "quotes": int(r["quotes"])}
            for r in rows]


@router.get("/global/top-commercials")
def global_top_commercials(
    limit: int = Query(5, ge=1, le=20),
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    rows = _query("""
        SELECT
            RANK() OVER (ORDER BY COUNT(DISTINCT fs.sale_id) DESC)   AS rank,
            du.first_name || ' ' || du.last_name                     AS name,
            COALESCE(du.agency_name, da.name, '')                    AS agency,
            COUNT(DISTINCT fs.sale_id)                               AS sales,
            COALESCE(SUM(fs.amount), 0)                              AS revenue,
            ROUND(
                COUNT(DISTINCT fs.sale_id)::numeric /
                NULLIF(COUNT(DISTINCT fq.quote_id), 0) * 100, 0
            ) || '%%'                                                AS rate
        FROM dim_user du
        LEFT JOIN dim_agency da  ON da.agency_id = du.agency_id
        LEFT JOIN fact_sales  fs ON fs.user_id   = du.user_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_quotes fq ON fq.user_id   = du.user_id
            AND fq.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        WHERE du.role = 'Commercial'
        GROUP BY du.user_id, du.first_name, du.last_name, du.agency_name, da.name
        ORDER BY sales DESC
        LIMIT %s
    """, (dr["from_date"], dr["to_date"], dr["from_date"], dr["to_date"], limit))

    return [{"rank": int(r["rank"]), "name": r["name"], "agency": r["agency"],
             "sales": int(r["sales"]), "revenue": float(r["revenue"]), "rate": r["rate"] or "0%"}
            for r in rows]


@router.get("/global/funnel")
def global_funnel(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    date_ids_sql = "SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s"
    p = (dr["from_date"], dr["to_date"])

    oppos  = _one(f"SELECT COUNT(*) AS c FROM fact_opportunities WHERE deleted=FALSE AND date_id IN ({date_ids_sql})", p)
    quotes = _one(f"SELECT COUNT(*) AS c FROM fact_quotes         WHERE date_id IN ({date_ids_sql})", p)
    sales  = _one(f"SELECT COUNT(*) AS c FROM fact_sales          WHERE date_id IN ({date_ids_sql})", p)

    return [
        {"name": "Opportunities", "value": int(oppos.get("c") or 0)},
        {"name": "Quotes",        "value": int(quotes.get("c") or 0)},
        {"name": "Sales",         "value": int(sales.get("c") or 0)},
    ]


@router.get("/global/vehicles")
def global_vehicles(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    rows = _query("""
        SELECT
            dv.model,
            COUNT(DISTINCT fq.quote_id) AS quotes,
            COUNT(DISTINCT fs.sale_id)  AS sales
        FROM dim_vehicle dv
        LEFT JOIN fact_quotes fq ON fq.vehicle_id = dv.vehicle_id
            AND fq.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_sales  fs ON fs.vehicle_id = dv.vehicle_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        GROUP BY dv.vehicle_id, dv.model
        ORDER BY quotes DESC
        LIMIT 10
    """, (dr["from_date"], dr["to_date"], dr["from_date"], dr["to_date"]))

    return [{"model": r["model"], "quotes": int(r["quotes"]), "sales": int(r["sales"])}
            for r in rows]


@router.get("/global/channels")
def global_channels(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    rows = _query("""
        SELECT
            COALESCE(fo.channel, 'Unknown') AS name,
            ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 0) AS value
        FROM fact_opportunities fo
        JOIN dim_date dd ON dd.date_id = fo.date_id
        WHERE fo.deleted = FALSE
          AND dd.date BETWEEN %s AND %s
        GROUP BY fo.channel
        ORDER BY value DESC
    """, (dr["from_date"], dr["to_date"]))

    return [{"name": r["name"], "value": int(r["value"] or 0)} for r in rows]


@router.get("/global/targets")
def global_targets(
    dr=Depends(date_range_params),
    _user=Depends(get_current_user),
):
    rows = _query("""
        SELECT
            da.name                          AS agency,
            COUNT(DISTINCT fs.sale_id)       AS actual,
            COALESCE(SUM(ft.sales_target),0) AS target
        FROM dim_agency da
        LEFT JOIN fact_targets ft ON ft.agency_id = da.agency_id
            AND ft.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_sales   fs ON fs.agency_id = da.agency_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        GROUP BY da.agency_id, da.name
        ORDER BY da.name
    """, (dr["from_date"], dr["to_date"], dr["from_date"], dr["to_date"]))

    return [{"agency": r["agency"], "actual": int(r["actual"]), "target": int(r["target"])}
            for r in rows]


# ═══════════════════════════════════════════════════════════════
# AGENCY  /dashboard/agency/*
# ═══════════════════════════════════════════════════════════════

def _get_agency_id(user) -> int | None:
    dwh = _get_dwh_user(user.email)
    return dwh.get("agency_id")


@router.get("/agency/kpis")
def agency_kpis(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    agency_id = _get_agency_id(user)
    r = _one("""
        SELECT
            COALESCE(SUM(fs.amount), 0)            AS revenue,
            COUNT(DISTINCT fs.sale_id)             AS sales,
            COUNT(DISTINCT fq.quote_id)            AS quotes,
            COUNT(DISTINCT fo.oppo_id)             AS opportunities,
            ROUND(
                COUNT(DISTINCT fs.sale_id)::numeric /
                NULLIF(COUNT(DISTINCT fo.oppo_id), 0) * 100, 1
            )                                      AS conversion_rate,
            COALESCE(SUM(ft.sales_target), 0)      AS target_sales
        FROM dim_agency da
        LEFT JOIN fact_opportunities fo ON fo.agency_id = da.agency_id
            AND fo.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
            AND fo.deleted = FALSE
        LEFT JOIN fact_quotes  fq ON fq.agency_id = da.agency_id
            AND fq.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_sales   fs ON fs.agency_id = da.agency_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_targets ft ON ft.agency_id = da.agency_id
            AND ft.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        WHERE da.agency_id = %s
    """, (dr["from_date"], dr["to_date"]) * 4 + (agency_id,))

    target_sales = int(r.get("target_sales") or 0)
    sales        = int(r.get("sales") or 0)
    return {
        "revenue":         float(r.get("revenue") or 0),
        "sales":           sales,
        "quotes":          int(r.get("quotes") or 0),
        "conversion_rate": float(r.get("conversion_rate") or 0),
        "target_sales":    target_sales,
        "target_pct":      round(sales / target_sales * 100, 1) if target_sales else 0,
    }


@router.get("/agency/team")
def agency_team(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    agency_id = _get_agency_id(user)
    rows = _query("""
        SELECT
            RANK() OVER (ORDER BY COUNT(DISTINCT fs.sale_id) DESC) AS rank,
            du.first_name || ' ' || du.last_name                   AS name,
            COUNT(DISTINCT fs.sale_id)                             AS sales,
            COUNT(DISTINCT fq.quote_id)                            AS quotes,
            ROUND(
                COUNT(DISTINCT fs.sale_id)::numeric /
                NULLIF(COUNT(DISTINCT fq.quote_id), 0) * 100, 0
            ) || '%%'                                              AS rate,
            COALESCE(SUM(ft.sales_target), 0)                      AS target
        FROM dim_user du
        LEFT JOIN fact_sales   fs ON fs.user_id = du.user_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_quotes  fq ON fq.user_id = du.user_id
            AND fq.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_targets ft ON ft.user_id = du.user_id
            AND ft.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        WHERE du.agency_id = %s
        GROUP BY du.user_id, du.first_name, du.last_name
        ORDER BY sales DESC
    """, (dr["from_date"], dr["to_date"]) * 3 + (agency_id,))

    return [{"rank": int(r["rank"]), "name": r["name"], "sales": int(r["sales"]),
             "quotes": int(r["quotes"]), "rate": r["rate"] or "0%", "target": int(r["target"])}
            for r in rows]


@router.get("/agency/revenue")
def agency_revenue(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    agency_id = _get_agency_id(user)
    rows = _query("""
        SELECT
            TO_CHAR(dd.date, 'Mon')      AS month,
            COALESCE(SUM(fs.amount), 0)  AS revenue,
            0                            AS target
        FROM dim_date dd
        LEFT JOIN fact_sales fs ON fs.date_id = dd.date_id AND fs.agency_id = %s
        WHERE dd.date BETWEEN %s AND %s
        GROUP BY dd.year, dd.month, TO_CHAR(dd.date, 'Mon')
        ORDER BY dd.year, dd.month
    """, (agency_id, dr["from_date"], dr["to_date"]))

    return [{"month": r["month"], "revenue": float(r["revenue"]), "target": 0} for r in rows]


@router.get("/agency/targets")
def agency_targets(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    agency_id = _get_agency_id(user)
    rows = _query("""
        SELECT
            du.first_name || ' ' || du.last_name  AS agency,
            COUNT(DISTINCT fs.sale_id)             AS actual,
            COALESCE(SUM(ft.sales_target), 0)      AS target
        FROM dim_user du
        LEFT JOIN fact_sales   fs ON fs.user_id = du.user_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_targets ft ON ft.user_id = du.user_id
            AND ft.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        WHERE du.agency_id = %s
        GROUP BY du.user_id, du.first_name, du.last_name
        ORDER BY du.last_name
    """, (dr["from_date"], dr["to_date"]) * 2 + (agency_id,))

    return [{"agency": r["agency"], "actual": int(r["actual"]), "target": int(r["target"])}
            for r in rows]


# ═══════════════════════════════════════════════════════════════
# COMMERCIAL  /dashboard/me/*
# ═══════════════════════════════════════════════════════════════

def _get_dwh_uid(user) -> int | None:
    dwh = _get_dwh_user(user.email)
    return dwh.get("user_id")


@router.get("/me/kpis")
def me_kpis(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    uid = _get_dwh_uid(user)
    r = _one("""
        SELECT
            COUNT(DISTINCT fs.sale_id)                             AS sales_this_month,
            COUNT(DISTINCT fq.quote_id)                            AS quotes_this_month,
            COALESCE(SUM(ft.sales_target), 0)                      AS target_this_month,
            COALESCE(SUM(fs.amount), 0)                            AS revenue_this_month,
            ROUND(
                COUNT(DISTINCT fs.sale_id)::numeric /
                NULLIF(COUNT(DISTINCT fq.quote_id), 0) * 100, 1
            )                                                      AS conversion_rate
        FROM dim_user du
        LEFT JOIN fact_sales   fs ON fs.user_id = du.user_id
            AND fs.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_quotes  fq ON fq.user_id = du.user_id
            AND fq.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        LEFT JOIN fact_targets ft ON ft.user_id = du.user_id
            AND ft.date_id IN (SELECT date_id FROM dim_date WHERE date BETWEEN %s AND %s)
        WHERE du.user_id = %s
    """, (dr["from_date"], dr["to_date"]) * 3 + (uid,))

    sales  = int(r.get("sales_this_month") or 0)
    target = int(r.get("target_this_month") or 0)
    return {
        "sales_this_month":   sales,
        "quotes_this_month":  int(r.get("quotes_this_month") or 0),
        "target_this_month":  target,
        "target_pct":         round(sales / target * 100, 1) if target else 0,
        "conversion_rate":    float(r.get("conversion_rate") or 0),
        "revenue_this_month": float(r.get("revenue_this_month") or 0),
    }


@router.get("/me/quotes")
def me_quotes(
    dr=Depends(date_range_params),
    user=Depends(get_current_user),
):
    uid = _get_dwh_uid(user)
    rows = _query("""
        SELECT
            TO_CHAR(dd.date, 'Mon')             AS month,
            COUNT(DISTINCT fq.quote_id)         AS quotes,
            COUNT(DISTINCT fs.sale_id)          AS sales,
            COALESCE(SUM(ft.sales_target), 0)   AS target
        FROM dim_date dd
        LEFT JOIN fact_quotes  fq ON fq.date_id = dd.date_id AND fq.user_id = %s
        LEFT JOIN fact_sales   fs ON fs.date_id = dd.date_id AND fs.user_id = %s
        LEFT JOIN fact_targets ft ON ft.date_id = dd.date_id AND ft.user_id = %s
        WHERE dd.date BETWEEN %s AND %s
        GROUP BY dd.year, dd.month, TO_CHAR(dd.date, 'Mon')
        ORDER BY dd.year, dd.month
    """, (uid, uid, uid, dr["from_date"], dr["to_date"]))

    return [{"month": r["month"], "quotes": int(r["quotes"]),
             "sales": int(r["sales"]), "target": int(r["target"])}
            for r in rows]


@router.get("/me/monthly-target")
def me_monthly_target(
    year: int = Query(...),
    user=Depends(get_current_user),
):
    uid = _get_dwh_uid(user)
    rows = _query("""
        SELECT
            TO_CHAR(TO_DATE(ft.month::text, 'MM'), 'Mon') AS agency,
            COUNT(DISTINCT fs.sale_id)                     AS actual,
            ft.sales_target                                AS target
        FROM fact_targets ft
        LEFT JOIN fact_sales fs ON fs.user_id = ft.user_id
            AND EXTRACT(MONTH FROM (SELECT date FROM dim_date WHERE date_id = fs.date_id)) = ft.month
            AND EXTRACT(YEAR  FROM (SELECT date FROM dim_date WHERE date_id = fs.date_id)) = ft.year
        WHERE ft.user_id = %s AND ft.year = %s
        GROUP BY ft.month, ft.sales_target
        ORDER BY ft.month
    """, (uid, year))

    return [{"agency": r["agency"], "actual": int(r["actual"]), "target": int(r["target"])}
            for r in rows]


@router.get("/me/recent-activity")
def me_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    user=Depends(get_current_user),
):
    uid = _get_dwh_uid(user)
    rows = _query("""
        SELECT
            fq.quote_id_crm                              AS id,
            COALESCE(dc.full_name, 'Unknown')            AS client,
            COALESCE(dv.model, 'Unknown')                AS model,
            dd.date::text                                AS date,
            CASE
                WHEN fq.converted_to_sale = TRUE THEN 'Converted'
                WHEN fo.deleted = TRUE           THEN 'Lost'
                ELSE                                  'Pending'
            END                                          AS status
        FROM fact_quotes fq
        JOIN dim_date          dd ON dd.date_id    = fq.date_id
        LEFT JOIN dim_vehicle  dv ON dv.vehicle_id = fq.vehicle_id
        LEFT JOIN fact_opportunities fo ON fo.oppo_id   = fq.oppo_id
        LEFT JOIN dim_client   dc ON dc.client_id  = fo.client_id
        WHERE fq.user_id = %s
        ORDER BY dd.date DESC
        LIMIT %s
    """, (uid, limit))

    return [{"id": r["id"], "client": r["client"], "model": r["model"],
             "date": r["date"], "status": r["status"]}
            for r in rows]
