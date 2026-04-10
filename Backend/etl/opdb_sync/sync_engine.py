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
        dbname=os.getenv("DWH_NAME",       "warehouse_db"),
        user=os.getenv("DWH_USER",         "admin"),
        password=os.getenv("DWH_PASSWORD", "admin"),
    )


# ── Helper ────────────────────────────────────────────────────

def _get_max_id(dwh_cur, table: str, id_col: str) -> int:
    """Returns max(id_col) in the DWH table, or 0 if empty."""
    dwh_cur.execute(f"SELECT COALESCE(MAX({id_col}), 0) FROM {table}")
    return dwh_cur.fetchone()[0]


# ── Per-table sync functions ──────────────────────────────────

def _sync_users(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : users(user_id, crm_user_id, last_name, first_name, email, role, is_active)
    DWH    : dim_user(user_id SERIAL, crm_user_id, last_name, first_name, email, role,
                      agency_id, agency_name, region)
    Key    : crm_user_id  (UNIQUE in both)
    Note   : agency_id / agency_name / region are not in Op DB — set to NULL/Undetermined
    """
    # Get crm_user_ids already in DWH
    dwh_cur.execute("SELECT crm_user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    existing_crm_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT user_id, crm_user_id, last_name, first_name, email, role
        FROM users
        ORDER BY user_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.crm_user_id not in existing_crm_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.crm_user_id,
            r.last_name  or "Undetermined",
            r.first_name or "Undetermined",
            r.email      or None,
            r.role       or "Commercial",
            1,          # agency_id — not available in Op DB
            "Akouda",  # agency_name
            "Sousse",  # region
        )
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO dim_user
          (crm_user_id, last_name, first_name, email, role,
           agency_id, agency_name, region)
        VALUES %s
        ON CONFLICT (crm_user_id) DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_vehicles(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : vehicles(ar_ref, ar_design, brand, model, category, base_price, available)
    DWH    : dim_vehicle(vehicle_id SERIAL, ar_ref, brand, model, category, base_price)
    Key    : ar_ref (UNIQUE in both)
    """
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
        (
            r.ar_ref,
            r.brand      or "Undetermined",
            r.model      or "Undetermined",
            r.category   or "Undetermined",
            float(r.base_price or 0),
        )
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO dim_vehicle (ar_ref, brand, model, category, base_price)
        VALUES %s
        ON CONFLICT (ar_ref) DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": dwh_cur.rowcount, "skipped": len(rows) - dwh_cur.rowcount}


def _sync_clients(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : clients(client_id, full_name, email, city, created_at)
    DWH    : dim_client(client_id SERIAL, full_name, email, city, source)
    Key    : (full_name, email) — mirrors the DWH dedup logic
    Note   : Op DB clients have no 'source' field — use 'main_agency'
    """
    dwh_cur.execute("SELECT full_name, email FROM dim_client")
    existing_keys = {(r[0], r[1]) for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT client_id, full_name, email, city
        FROM clients
        ORDER BY client_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [
        r for r in rows
        if (r.full_name, r.email) not in existing_keys
    ]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    values = [
        (
            r.full_name or "Undetermined",
            r.email     or None,
            r.city      or "Undetermined",
            "Akouda",
        )
        for r in new_rows
    ]
    execute_values(dwh_cur, """
        INSERT INTO dim_client (full_name, email, city, source)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_opportunities(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : opportunities(oppo_id, channel, user_id, client_id, created_date,
                           city, address, deleted, user_email, client_email,
                           client_reference, source, client_company)
    DWH    : fact_opportunities(oppo_id, date_id, user_id, agency_id, client_id,
                                channel, city, deleted, source)

    Mapping:
      - date_id   : looked up from dim_date using created_date
      - user_id   : looked up from dim_user using crm_user_id
      - agency_id : 1
      - client_id : looked up from dim_client using full_name + email
    """
    dwh_cur.execute("SELECT oppo_id FROM fact_opportunities")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT o.oppo_id, o.channel, o.user_id AS crm_user_id,
               o.client_id AS opdb_client_id, o.created_date,
               o.city, o.deleted, o.source,
               c.full_name AS client_name, c.email AS client_email
        FROM opportunities o
        LEFT JOIN clients c ON c.client_id = o.client_id
        ORDER BY o.oppo_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    # Build lookup caches from DWH for this batch
    # dim_user: crm_user_id → dwh user_id (SERIAL)
    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}

    # dim_client: (full_name, email) → dwh client_id (SERIAL)
    dwh_cur.execute("SELECT full_name, email, client_id FROM dim_client")
    client_map = {(r[0], r[1]): r[2] for r in dwh_cur.fetchall()}

    # dim_date: date (as date string) → date_id
    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}

    values = []
    for r in new_rows:
        dwh_user_id   = user_map.get(r.crm_user_id)
        dwh_client_id = client_map.get((r.client_name, r.client_email))
        date_key      = str(r.created_date.date()) if r.created_date else None
        date_id       = date_map.get(date_key)

        values.append((
            r.oppo_id,
            date_id,
            dwh_user_id,
            1,                          # agency_id — not in Op DB
            dwh_client_id,
            r.channel  or "Undetermined",
            r.city     or "Undetermined",
            bool(r.deleted),
            r.source   or "main_agency",
        ))

    execute_values(dwh_cur, """
        INSERT INTO fact_opportunities
          (oppo_id, date_id, user_id, agency_id, client_id,
           channel, city, deleted, source)
        VALUES %s
        ON CONFLICT (oppo_id) DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_quotes(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : quotes(quote_id, quote_id_crm, oppo_id, ar_ref, ar_design,
                    brand, model, created_date, created_by, user_id, source)
    DWH    : fact_quotes(quote_id SERIAL, quote_id_crm, date_id, user_id,
                         agency_id, vehicle_id, oppo_id, converted_to_sale, source)

    Mapping:
      - date_id          : from dim_date via created_date
      - user_id          : from dim_user via crm_user_id (uses quotes.user_id)
      - vehicle_id       : from dim_vehicle via ar_ref
      - converted_to_sale: check if a sale exists for this oppo_id in Op DB
      - agency_id        : 1
    """
    dwh_cur.execute("SELECT quote_id_crm FROM fact_quotes WHERE quote_id_crm IS NOT NULL")
    existing_crm_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT q.quote_id_crm, q.oppo_id, q.ar_ref,
               q.created_date, q.user_id AS crm_user_id, q.source
        FROM quotes q
        ORDER BY q.quote_id_crm
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.quote_id_crm not in existing_crm_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    # Lookup caches
    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}

    dwh_cur.execute("SELECT ar_ref, vehicle_id FROM dim_vehicle")
    vehicle_map = {r[0]: r[1] for r in dwh_cur.fetchall()}

    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}

    # Oppos that have a confirmed sale in Op DB
    opdb_cur.execute("SELECT DISTINCT oppo_id FROM sales")
    sold_oppo_ids = {r.oppo_id for r in opdb_cur.fetchall()}

    values = []
    for r in new_rows:
        dwh_user_id   = user_map.get(r.crm_user_id)
        dwh_vehicle_id = vehicle_map.get(r.ar_ref)
        date_key      = str(r.created_date.date()) if r.created_date else None
        date_id       = date_map.get(date_key)
        converted     = r.oppo_id in sold_oppo_ids

        values.append((
            r.quote_id_crm,
            date_id,
            dwh_user_id,
            1,             # agency_id
            dwh_vehicle_id,
            r.oppo_id,
            converted,
            r.source or "main_agency",
        ))

    execute_values(dwh_cur, """
        INSERT INTO fact_quotes
          (quote_id_crm, date_id, user_id, agency_id,
           vehicle_id, oppo_id, converted_to_sale, source)
        VALUES %s
        ON CONFLICT (quote_id_crm) DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_sales(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : sales(sale_id, quote_id, oppo_id, user_id, ar_ref,
                   sale_date, final_price, status)
    DWH    : fact_sales(sale_id SERIAL, date_id, user_id, agency_id,
                        vehicle_id, oppo_id, amount, quotes_before_sale, source)

    Mapping:
      - date_id          : from dim_date via sale_date
      - user_id          : from dim_user via crm_user_id
      - vehicle_id       : from dim_vehicle via ar_ref
      - amount           : final_price
      - quotes_before_sale: COUNT of quotes for the same oppo_id in Op DB
      - agency_id        : 1
    Key    : oppo_id (one sale per opportunity)
    """
    dwh_cur.execute("SELECT oppo_id FROM fact_sales WHERE source = 'main_agency'")
    existing_oppo_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT s.sale_id, s.oppo_id, s.user_id AS crm_user_id,
               s.ar_ref, s.sale_date, s.final_price
        FROM sales s
        ORDER BY s.sale_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_oppo_ids]
    if not new_rows:
        return {"inserted": 0, "skipped": len(rows)}

    # Lookup caches
    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}

    dwh_cur.execute("SELECT ar_ref, vehicle_id FROM dim_vehicle")
    vehicle_map = {r[0]: r[1] for r in dwh_cur.fetchall()}

    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}

    # quotes_before_sale: count quotes per oppo in Op DB
    opdb_cur.execute("""
        SELECT oppo_id, COUNT(*) AS cnt
        FROM quotes
        GROUP BY oppo_id
    """)
    quotes_count_map = {r.oppo_id: r.cnt for r in opdb_cur.fetchall()}

    values = []
    for r in new_rows:
        dwh_user_id    = user_map.get(r.crm_user_id)
        dwh_vehicle_id = vehicle_map.get(r.ar_ref)
        date_key       = str(r.sale_date) if r.sale_date else None
        date_id        = date_map.get(date_key)
        quotes_before  = quotes_count_map.get(r.oppo_id, 0)

        values.append((
            date_id,
            dwh_user_id,
            1,                          # agency_id
            dwh_vehicle_id,
            r.oppo_id,
            float(r.final_price or 0),
            quotes_before,
            "Akouda",
        ))

    execute_values(dwh_cur, """
        INSERT INTO fact_sales
          (date_id, user_id, agency_id, vehicle_id,
           oppo_id, amount, quotes_before_sale, source)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


def _sync_targets(opdb_cur, dwh_cur) -> dict:
    """
    Op DB  : targets(target_id, user_id, month, year, sales_target, quotes_target)
    DWH    : fact_targets(target_id SERIAL, date_id, user_id, agency_id,
                          month, year, sales_target, quotes_target)

    Key    : (user_id, year, month) — matches UNIQUE constraint in Op DB
    Note   : date_id → look up dim_date for the 1st of that month/year
             agency_id → 1 (not in Op DB)
    """
    dwh_cur.execute("""
        SELECT user_id, year, month FROM fact_targets
    """)
    existing_keys = {(r[0], r[1], r[2]) for r in dwh_cur.fetchall()}

    opdb_cur.execute("""
        SELECT t.target_id, t.user_id AS crm_user_id,
               t.month, t.year, t.sales_target, t.quotes_target
        FROM targets t
        ORDER BY t.year, t.month, t.user_id
    """)
    rows = opdb_cur.fetchall()

    # Build lookup caches
    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}

    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}

    values = []
    for r in rows:
        dwh_user_id = user_map.get(r.crm_user_id)
        if dwh_user_id is None:
            continue
        if (dwh_user_id, r.year, r.month) in existing_keys:
            continue

        # Use 1st day of the month as the date_id anchor
        date_key = f"{r.year}-{str(r.month).zfill(2)}-01"
        date_id  = date_map.get(date_key)

        values.append((
            date_id,
            dwh_user_id,
            1,                      # agency_id
            r.month,
            r.year,
            int(r.sales_target  or 0),
            int(r.quotes_target or 0),
        ))

    if not values:
        return {"inserted": 0, "skipped": len(rows)}

    execute_values(dwh_cur, """
        INSERT INTO fact_targets
          (date_id, user_id, agency_id, month, year,
           sales_target, quotes_target)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}


# ── Main entry point ──────────────────────────────────────────

def sync_opdb_to_dwh() -> dict:
    """
    Main sync function. Called by:
      - APScheduler (every 30 min, via scheduler.py)
      - POST /admin/opdb/sync  (manual trigger)

    Returns a dict with per-table inserted/skipped counts and a timestamp.
    """
    result = {
        "synced_at":      datetime.utcnow().isoformat() + "Z",
        "tables":         {},
        "total_inserted": 0,
        "total_skipped":  0,
        "error":          None,
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
                result["tables"][table_name] = {"inserted": 0, "skipped": 0, "error": str(e)}

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