# Backend/etl/opdb_sync/sync_engine.py
# ============================================================
# Reads NEW rows from MS SQL Server Operational DB and inserts
# them into the PostgreSQL Data Warehouse.
# Idempotency: per table, we track the max ID already in the
# DWH and only fetch rows with a higher ID from the Op DB.
# ============================================================

import os
import pyodbc
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


# ── Connection helpers ───────────────────────────────────────

def get_opdb_connection() -> pyodbc.Connection:
    server   = os.getenv("OPDB_SERVER",   "localhost")
    port     = os.getenv("OPDB_PORT",     "1433")
    database = os.getenv("OPDB_NAME",     "OperationalDB")
    user     = os.getenv("OPDB_USER")
    password = os.getenv("OPDB_PASSWORD")
    driver   = os.getenv("OPDB_DRIVER",   "ODBC Driver 17 for SQL Server")

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},{port};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)


def get_dwh_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=os.getenv("DWH_HOST",     "localhost"),
        port=int(os.getenv("DWH_PORT", "5432")),
        dbname=os.getenv("DWH_NAME",   "warehouse_db"),
        user=os.getenv("DWH_USER",     "admin"),
        password=os.getenv("DWH_PASSWORD", "admin"),
    )


# ── Helpers ──────────────────────────────────────────────────

def _get_max_id(dwh_cur, table: str, id_col: str) -> int:
    """Returns max(id_col) in the DWH table, or 0 if empty."""
    dwh_cur.execute(f"SELECT COALESCE(MAX({id_col}), 0) FROM {table}")
    return dwh_cur.fetchone()[0]


# ── Per-table sync functions ──────────────────────────────────

def _sync_users(opdb_cur, dwh_cur) -> dict:
    max_id = _get_max_id(dwh_cur, "dim_user", "user_id")

    opdb_cur.execute("""
        SELECT id, crm_user_id, full_name, role, agency_id, active
        FROM users
        WHERE id > ?
        ORDER BY id
    """, (max_id,))
    rows = opdb_cur.fetchall()
    if not rows:
        return {"inserted": 0, "skipped": 0}

    values = [
        (r.id, r.crm_user_id or str(r.id), r.full_name or "Undetermined",
         r.role or "Undetermined", r.agency_id)
        for r in rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO dim_user (user_id, crm_user_id, full_name, role, agency_id)
        VALUES %s
        ON CONFLICT (crm_user_id) DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_vehicles(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT ar_ref FROM dim_vehicle")
    existing_refs = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT ar_ref, brand, model, category, base_price
        FROM vehicles
        ORDER BY ar_ref
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.ar_ref not in existing_refs]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (r.ar_ref, r.brand or "Undetermined", r.model or "Undetermined",
         r.category or "Undetermined", float(r.base_price or 0))
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO dim_vehicle (ar_ref, brand, model, category, base_price)
        VALUES %s
        ON CONFLICT (ar_ref) DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_clients(opdb_cur, dwh_cur) -> dict:
    max_id = _get_max_id(dwh_cur, "dim_client", "client_id")

    opdb_cur.execute("""
        SELECT id, full_name, email, city, source
        FROM clients
        WHERE id > ?
        ORDER BY id
    """, (max_id,))
    rows = opdb_cur.fetchall()
    if not rows:
        return {"inserted": 0, "skipped": 0}

    values = [
        (r.id, r.full_name or "Undetermined", r.email or None,
         r.city or "Undetermined", r.source or "Undetermined")
        for r in rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO dim_client (client_id, full_name, email, city, source)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_opportunities(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT oppo_id FROM fact_opportunities")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT o.oppo_id, o.date_id, o.user_id, o.agency_id,
               o.client_id, o.channel, o.city, o.deleted
        FROM opportunities o
        ORDER BY o.oppo_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (r.oppo_id, r.date_id, r.user_id, r.agency_id,
         r.client_id, r.channel or "Undetermined",
         r.city or "Undetermined", bool(r.deleted), "opdb")
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO fact_opportunities
          (oppo_id, date_id, user_id, agency_id, client_id,
           channel, city, deleted, source)
        VALUES %s
        ON CONFLICT (oppo_id) DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_quotes(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT quote_id_crm FROM fact_quotes WHERE quote_id_crm IS NOT NULL")
    existing_crm_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT q.quote_id_crm, q.date_id, q.user_id, q.agency_id,
               q.vehicle_id, q.oppo_id, q.converted_to_sale
        FROM quotes q
        ORDER BY q.quote_id_crm
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.quote_id_crm not in existing_crm_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (r.quote_id_crm, r.date_id, r.user_id, r.agency_id,
         r.vehicle_id, r.oppo_id, bool(r.converted_to_sale), "opdb")
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO fact_quotes
          (quote_id_crm, date_id, user_id, agency_id,
           vehicle_id, oppo_id, converted_to_sale, source)
        VALUES %s
        ON CONFLICT (quote_id_crm) DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_sales(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT oppo_id FROM fact_sales WHERE source = 'opdb'")
    existing_oppo_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT s.oppo_id, s.date_id, s.user_id, s.agency_id,
               s.vehicle_id, s.amount, s.quotes_before_sale
        FROM sales s
        ORDER BY s.oppo_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_oppo_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (r.oppo_id, r.date_id, r.user_id, r.agency_id,
         r.vehicle_id, float(r.amount or 0),
         int(r.quotes_before_sale or 0), "opdb")
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO fact_sales
          (oppo_id, date_id, user_id, agency_id,
           vehicle_id, amount, quotes_before_sale, source)
        VALUES %s
        ON CONFLICT (oppo_id) DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_targets(opdb_cur, dwh_cur) -> dict:
    """Targets: sync by (user_id, month, year) composite key."""
    dwh_cur.execute("""
        SELECT user_id, month, year FROM fact_targets
        WHERE source = 'opdb'
    """)
    existing_keys = {(r[0], r[1], r[2]) for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT t.date_id, t.user_id, t.agency_id,
               t.month, t.year, t.sales_target, t.quotes_target
        FROM targets t
        ORDER BY t.year, t.month, t.user_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if (r.user_id, r.month, r.year) not in existing_keys]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (r.date_id, r.user_id, r.agency_id, r.month, r.year,
         int(r.sales_target or 0), int(r.quotes_target or 0), "opdb")
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO fact_targets
          (date_id, user_id, agency_id, month, year,
           sales_target, quotes_target, source)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, values)
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


# ── Main entry point ──────────────────────────────────────────

def sync_opdb_to_dwh() -> dict:
    """
    Main sync function. Called by:
      - APScheduler (every 30 min)
      - POST /admin/opdb/sync  (manual trigger)

    Returns a dict with per-table inserted/skipped counts
    and a timestamp.
    """
    result = {
        "synced_at": datetime.utcnow().isoformat() + "Z",
        "tables": {},
        "total_inserted": 0,
        "total_skipped": 0,
        "error": None,
    }

    try:
        opdb_conn = get_opdb_connection()
        dwh_conn  = get_dwh_connection()
        opdb_cur  = opdb_conn.cursor()
        dwh_cur   = dwh_conn.cursor()

        sync_steps = [
            ("users",         _sync_users),
            ("vehicles",      _sync_vehicles),
            ("clients",       _sync_clients),
            ("opportunities", _sync_opportunities),
            ("quotes",        _sync_quotes),
            ("sales",         _sync_sales),
            ("targets",       _sync_targets),
        ]

        for table_name, fn in sync_steps:
            try:
                counts = fn(opdb_cur, dwh_cur)
                result["tables"][table_name] = counts
                result["total_inserted"] += counts["inserted"]
                result["total_skipped"]  += counts["skipped"]
            except Exception as e:
                result["tables"][table_name] = {"error": str(e)}

        dwh_conn.commit()

    except Exception as e:
        result["error"] = str(e)
        try:
            dwh_conn.rollback()
        except Exception:
            pass
    finally:
        try:
            opdb_cur.close(); opdb_conn.close()
        except Exception:
            pass
        try:
            dwh_cur.close(); dwh_conn.close()
        except Exception:
            pass

    return result
