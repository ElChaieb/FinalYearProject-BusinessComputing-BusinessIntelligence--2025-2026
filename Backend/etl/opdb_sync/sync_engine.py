# Backend/etl/opdb_sync/sync_engine.py
import os
import pyodbc
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ── Connection helpers ────────────────────────────────────────

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
        host=os.getenv("DWH_HOST",         "localhost"),
        port=int(os.getenv("DWH_PORT",     "5432")),
        dbname=os.getenv("DWH_NAME",       "warehouse_v2"),
        user=os.getenv("DWH_USER",         "admin"),
        password=os.getenv("DWH_PASSWORD", "admin"),
    )

# ── Helpers ───────────────────────────────────────────────────

def _to_date(dt):
    """Extract a plain date from a SQL Server DATETIME, or return None."""
    if dt is None:
        return None
    return dt.date() if hasattr(dt, "date") else dt

def _to_bool(bit_val) -> bool:
    """Convert a SQL Server BIT (0/1) to a Python bool."""
    return bool(bit_val)

# ── Per-table sync functions ──────────────────────────────────

def _sync_users(opdb_cur, dwh_cur) -> dict:
    """
    OpDB:  users (user_id, last_name, first_name, email, role, agency_name)
    DWH:   dim_user (user_id, last_name, first_name, email, role, agency_name)
    Key:   user_id  (direct — no crm_user_id indirection)
    """
    dwh_cur.execute("SELECT user_id FROM dim_user")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT user_id, last_name, first_name, email, role, agency_name
        FROM   users
        ORDER BY user_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.user_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.user_id,
            r.last_name  or "Undetermined",
            r.first_name or "Undetermined",
            r.email      or None,
            r.role       or "Commercial",
            r.agency_name or None,
        )
        for r in new_rows
    ]
    execute_values(
        dwh_cur,
        """
        INSERT INTO dim_user (user_id, last_name, first_name, email, role, agency_name)
        VALUES %s
        ON CONFLICT (user_id) DO NOTHING
        """,
        values,
    )
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_vehicles(opdb_cur, dwh_cur) -> dict:
    """
    OpDB:  vehicles (ar_ref, ar_design, brand, model, category, base_price)
    DWH:   dim_vehicle (ar_ref, ar_design, brand, model, category, base_price)
    Key:   ar_ref  (direct PK — no vehicle_id surrogate)
    """
    dwh_cur.execute("SELECT ar_ref FROM dim_vehicle")
    existing_refs = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT ar_ref, ar_design, brand, model, category, base_price
        FROM   vehicles
        ORDER BY ar_ref
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.ar_ref not in existing_refs]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.ar_ref,
            r.ar_design  or None,
            r.brand      or "Undetermined",
            r.model      or "Undetermined",
            r.category   or "Undetermined",
            float(r.base_price or 0),
        )
        for r in new_rows
    ]
    execute_values(
        dwh_cur,
        """
        INSERT INTO dim_vehicle (ar_ref, ar_design, brand, model, category, base_price)
        VALUES %s
        ON CONFLICT (ar_ref) DO NOTHING
        """,
        values,
    )
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_clients(opdb_cur, dwh_cur) -> dict:
    """
    OpDB:  clients (client_id, full_name, city, email)
    DWH:   dim_client (client_id SERIAL, full_name, email, city)
    Key:   client_id  (override SERIAL — fact tables reference the same IDs)

    We insert with an explicit client_id so that FK references in
    fact_opportunities / fact_quotes / fact_sales remain consistent.
    The sequence is refreshed at the end to avoid future conflicts.
    """
    dwh_cur.execute("SELECT client_id FROM dim_client")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT client_id, full_name, email, city
        FROM   clients
        ORDER BY client_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.client_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.client_id,
            r.full_name or "Undetermined",
            r.email     or None,
            r.city      or None,
        )
        for r in new_rows
    ]
    execute_values(
        dwh_cur,
        """
        INSERT INTO dim_client (client_id, full_name, email, city)
        VALUES %s
        ON CONFLICT (client_id) DO NOTHING
        """,
        values,
    )
    inserted = dwh_cur.rowcount

    # Keep the SERIAL sequence ahead of the highest inserted ID
    dwh_cur.execute(
        "SELECT setval('dim_client_client_id_seq', "
        "(SELECT COALESCE(MAX(client_id), 1) FROM dim_client))"
    )

    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_opportunities(opdb_cur, dwh_cur) -> dict:
    """
    OpDB:  opportunities (oppo_id, user_id, client_id, agency_name,
                          created_date, client_reference, deleted BIT)
    DWH:   fact_opportunities (oppo_id, user_id, client_id, agency_name,
                               created_date DATE, client_reference, deleted BOOLEAN)

    deleted override: if an opportunity has at least one quote in OpDB,
    force deleted=False regardless of the stored flag.
    """
    dwh_cur.execute("SELECT oppo_id FROM fact_opportunities")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    # Opportunities that have at least one quote → treat as won (deleted=False)
    opdb_cur.execute(
        "SELECT DISTINCT oppo_id FROM quotes WHERE oppo_id IS NOT NULL"
    )
    quoted_oppo_ids = {r[0] for r in opdb_cur.fetchall()}

    opdb_cur.execute("""
        SELECT oppo_id, user_id, client_id, agency_name,
               created_date, client_reference, deleted
        FROM   opportunities
        ORDER BY oppo_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.oppo_id,
            r.user_id,
            r.client_id,
            r.agency_name       or None,
            _to_date(r.created_date),
            r.client_reference  or None,
            False if r.oppo_id in quoted_oppo_ids else _to_bool(r.deleted),
        )
        for r in new_rows
    ]
    execute_values(
        dwh_cur,
        """
        INSERT INTO fact_opportunities
            (oppo_id, user_id, client_id, agency_name,
             created_date, client_reference, deleted)
        VALUES %s
        ON CONFLICT (oppo_id) DO NOTHING
        """,
        values,
    )
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_quotes(opdb_cur, dwh_cur) -> dict:
    """
    OpDB:  quotes (quote_id, oppo_id, ar_ref, user_id, client_id,
                   agency_name, price, created_date, deleted BIT)
    DWH:   fact_quotes (quote_id, oppo_id, ar_ref, user_id, client_id,
                        agency_name, price, created_date DATE, deleted BOOLEAN)
    Key:   quote_id  (direct — no quote_id_crm indirection)
    """
    dwh_cur.execute("SELECT quote_id FROM fact_quotes")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT quote_id, oppo_id, ar_ref, user_id, client_id,
               agency_name, price, created_date, deleted
        FROM   quotes
        ORDER BY quote_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.quote_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.quote_id,
            r.oppo_id,
            r.ar_ref        or None,
            r.user_id,
            r.client_id,
            r.agency_name   or None,
            float(r.price)  if r.price is not None else None,
            _to_date(r.created_date),
            _to_bool(r.deleted),
        )
        for r in new_rows
    ]
    execute_values(
        dwh_cur,
        """
        INSERT INTO fact_quotes
            (quote_id, oppo_id, ar_ref, user_id, client_id,
             agency_name, price, created_date, deleted)
        VALUES %s
        ON CONFLICT (quote_id) DO NOTHING
        """,
        values,
    )
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_sales(opdb_cur, dwh_cur) -> dict:
    """
    OpDB:  sales (sale_id, quote_id, oppo_id, user_id, client_id,
                  ar_ref, agency_name, sale_date, quantity, final_price)
    DWH:   fact_sales (sale_id SERIAL, quote_id UNIQUE, oppo_id, user_id, client_id,
                       ar_ref, agency_name, sale_date DATE, quantity, final_price)
    Key:   sale_id  (explicit override of SERIAL — sequence refreshed after insert)
    """
    dwh_cur.execute("SELECT sale_id FROM fact_sales")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT sale_id, quote_id, oppo_id, user_id, client_id,
               ar_ref, agency_name, sale_date, quantity, final_price
        FROM   sales
        ORDER BY sale_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.sale_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.sale_id,
            r.quote_id,
            r.oppo_id,
            r.user_id,
            r.client_id,
            r.ar_ref            or None,
            r.agency_name       or None,
            _to_date(r.sale_date),
            r.quantity          or 1,
            float(r.final_price) if r.final_price is not None else None,
        )
        for r in new_rows
    ]
    execute_values(
        dwh_cur,
        """
        INSERT INTO fact_sales
            (sale_id, quote_id, oppo_id, user_id, client_id,
             ar_ref, agency_name, sale_date, quantity, final_price)
        VALUES %s
        ON CONFLICT (sale_id) DO NOTHING
        """,
        values,
    )
    inserted = dwh_cur.rowcount

    # Keep the SERIAL sequence ahead of the highest synced sale_id
    # to avoid conflicts on any future auto-generated inserts
    dwh_cur.execute(
        "SELECT setval('fact_sales_sale_id_seq', "
        "(SELECT COALESCE(MAX(sale_id), 1) FROM fact_sales))"
    )

    return {"inserted": inserted, "skipped": len(rows) - inserted}


# ── Orchestrator ──────────────────────────────────────────────

def sync_opdb_to_dwh() -> dict:
    result = {
        "synced_at":      datetime.utcnow().isoformat() + "Z",
        "tables":         {},
        "total_inserted": 0,
        "total_skipped":  0,
        "error":          None,
    }
    opdb_conn = dwh_conn = None
    try:
        opdb_conn = get_opdb_connection()
        dwh_conn  = get_dwh_connection()
        opdb_cur  = opdb_conn.cursor()
        dwh_cur   = dwh_conn.cursor()

        # Dimensions first (facts depend on them)
        steps = [
            ("users",         _sync_users),
            ("vehicles",      _sync_vehicles),
            ("clients",       _sync_clients),
            ("opportunities", _sync_opportunities),
            ("quotes",        _sync_quotes),
            ("sales",         _sync_sales),
        ]
        for name, fn in steps:
            counts = fn(opdb_cur, dwh_cur)
            result["tables"][name]   = counts
            result["total_inserted"] += counts["inserted"]
            result["total_skipped"]  += counts["skipped"]

        dwh_conn.commit()

    except Exception as e:
        result["error"] = str(e)
        if dwh_conn:
            dwh_conn.rollback()
    finally:
        if opdb_conn:
            opdb_conn.close()
        if dwh_conn:
            dwh_conn.close()

    return result