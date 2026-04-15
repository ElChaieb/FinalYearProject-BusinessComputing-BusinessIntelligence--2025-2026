# Backend/etl/opdb_sync/sync_engine.py
import os
import pyodbc
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MAIN_AGENCY_ID = 1
MAIN_AGENCY_NAME = "Akouda"
MAIN_AGENCY_REGION = "Sousse"

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

# ── Per-table sync functions ──────────────────────────────────

def _sync_users(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT crm_user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    existing_crm_ids = {r[0] for r in dwh_cur.fetchall()}

    opdb_cur.execute("SELECT user_id, crm_user_id, last_name, first_name, email, role FROM users ORDER BY user_id")
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.crm_user_id not in existing_crm_ids]
    if not new_rows: return {"inserted": 0, "skipped": len(rows)}

    values = [(r.crm_user_id, r.last_name or "Undetermined", r.first_name or "Undetermined", r.email or None, r.role or "Commercial", MAIN_AGENCY_ID, MAIN_AGENCY_NAME, MAIN_AGENCY_REGION) for r in new_rows]
    execute_values(dwh_cur, "INSERT INTO dim_user (crm_user_id, last_name, first_name, email, role, agency_id, agency_name, region) VALUES %s ON CONFLICT (crm_user_id) DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def _sync_vehicles(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT ar_ref FROM dim_vehicle")
    existing_refs = {r[0] for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT ar_ref, brand, model, category, base_price FROM vehicles ORDER BY ar_ref")
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.ar_ref not in existing_refs]
    if not new_rows: return {"inserted": 0, "skipped": len(rows)}
    values = [(r.ar_ref, r.brand or "Undetermined", r.model or "Undetermined", r.category or "Undetermined", float(r.base_price or 0)) for r in new_rows]
    execute_values(dwh_cur, "INSERT INTO dim_vehicle (ar_ref, brand, model, category, base_price) VALUES %s ON CONFLICT (ar_ref) DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def _sync_clients(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT full_name, email FROM dim_client")
    existing_keys = {(r[0], r[1]) for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT client_id, full_name, email, city FROM clients ORDER BY client_id")
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if (r.full_name, r.email) not in existing_keys]
    if not new_rows: return {"inserted": 0, "skipped": len(rows)}
    values = [(r.full_name or "Undetermined", r.email or None, r.city or "Undetermined", MAIN_AGENCY_NAME) for r in new_rows]
    execute_values(dwh_cur, "INSERT INTO dim_client (full_name, email, city, source) VALUES %s ON CONFLICT DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def _sync_opportunities(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT oppo_id FROM fact_opportunities")
    existing_ids = {r[0] for r in dwh_cur.fetchall()}

    # NEW: Fetch opportunities that have a quote to force deleted=False
    opdb_cur.execute("SELECT DISTINCT oppo_id FROM quotes WHERE oppo_id IS NOT NULL")
    quoted_oppo_ids = {r[0] for r in opdb_cur.fetchall()}

    opdb_cur.execute("""
        SELECT o.oppo_id, o.channel, u.crm_user_id, o.created_date, o.city, o.deleted, o.source,
               c.full_name AS client_name, c.email AS client_email
        FROM opportunities o
        LEFT JOIN users u ON u.user_id = o.user_id
        LEFT JOIN clients c ON c.client_id = o.client_id
        ORDER BY o.oppo_id
    """)
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_ids]
    if not new_rows: return {"inserted": 0, "skipped": len(rows)}

    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT full_name, email, client_id FROM dim_client")
    client_map = {(r[0], r[1]): r[2] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}

    values = []
    for r in new_rows:
        is_deleted = False if r.oppo_id in quoted_oppo_ids else bool(r.deleted)
        date_key = str(r.created_date.date()) if r.created_date else None
        values.append((r.oppo_id, date_map.get(date_key), user_map.get(r.crm_user_id), MAIN_AGENCY_ID, client_map.get((r.client_name, r.client_email)), r.channel or "Undetermined", r.city or "Undetermined", is_deleted, r.source or MAIN_AGENCY_NAME))

    execute_values(dwh_cur, "INSERT INTO fact_opportunities (oppo_id, date_id, user_id, agency_id, client_id, channel, city, deleted, source) VALUES %s ON CONFLICT (oppo_id) DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def _sync_quotes(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT quote_id_crm FROM fact_quotes WHERE quote_id_crm IS NOT NULL")
    existing_crm_ids = {r[0] for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT q.quote_id_crm, q.oppo_id, q.ar_ref, q.created_date, u.crm_user_id, q.source FROM quotes q LEFT JOIN users u ON u.user_id = q.user_id ORDER BY q.quote_id_crm")
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.quote_id_crm not in existing_crm_ids]
    if not new_rows: return {"inserted": 0, "skipped": len(rows)}

    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT ar_ref, vehicle_id FROM dim_vehicle")
    vehicle_map = {r[0]: r[1] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT DISTINCT oppo_id FROM sales")
    sold_oppo_ids = {r.oppo_id for r in opdb_cur.fetchall()}

    values = []
    for r in new_rows:
        date_key = str(r.created_date.date()) if r.created_date else None
        values.append((r.quote_id_crm, date_map.get(date_key), user_map.get(r.crm_user_id), MAIN_AGENCY_ID, vehicle_map.get(r.ar_ref), r.oppo_id, r.oppo_id in sold_oppo_ids, r.source or MAIN_AGENCY_NAME))

    execute_values(dwh_cur, "INSERT INTO fact_quotes (quote_id_crm, date_id, user_id, agency_id, vehicle_id, oppo_id, converted_to_sale, source) VALUES %s ON CONFLICT (quote_id_crm) DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def _sync_sales(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT oppo_id FROM fact_sales WHERE source = 'Akouda'")
    existing_oppo_ids = {r[0] for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT s.sale_id, s.oppo_id, u.crm_user_id, s.ar_ref, s.sale_date, s.final_price FROM sales s LEFT JOIN users u ON u.user_id = s.user_id ORDER BY s.sale_id")
    rows = opdb_cur.fetchall()
    new_rows = [r for r in rows if r.oppo_id not in existing_oppo_ids]
    if not new_rows: return {"inserted": 0, "skipped": len(rows)}

    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    user_map = {r[0]: r[1] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT ar_ref, vehicle_id FROM dim_vehicle")
    vehicle_map = {r[0]: r[1] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT oppo_id, COUNT(*) AS cnt FROM quotes GROUP BY oppo_id")
    q_map = {r.oppo_id: r.cnt for r in opdb_cur.fetchall()}

    values = [(date_map.get(str(r.sale_date)), user_map.get(r.crm_user_id), MAIN_AGENCY_ID, vehicle_map.get(r.ar_ref), r.oppo_id, float(r.final_price or 0), q_map.get(r.oppo_id, 0), MAIN_AGENCY_NAME) for r in new_rows]
    execute_values(dwh_cur, "INSERT INTO fact_sales (date_id, user_id, agency_id, vehicle_id, oppo_id, amount, quotes_before_sale, source) VALUES %s ON CONFLICT DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def _sync_targets(opdb_cur, dwh_cur) -> dict:
    dwh_cur.execute("SELECT user_id, year, month FROM fact_targets")
    existing = {(r[0], r[1], r[2]) for r in dwh_cur.fetchall()}
    opdb_cur.execute("SELECT user_id, month, year, sales_target, quotes_target FROM targets")
    rows = opdb_cur.fetchall()
    dwh_cur.execute("SELECT crm_user_id, user_id FROM dim_user WHERE crm_user_id IS NOT NULL")
    u_map = {r[0]: r[1] for r in dwh_cur.fetchall()}
    dwh_cur.execute("SELECT date, date_id FROM dim_date")
    date_map = {str(r[0]): r[1] for r in dwh_cur.fetchall()}

    values = []
    for r in rows:
        d_id = u_map.get(r.user_id) # Using the user_id from targets (mapped to crm_user_id in Op DB)
        date_key = f"{r.year}-{str(r.month).zfill(2)}-01"
        if d_id and (d_id, r.year, r.month) not in existing:
            values.append((date_map.get(date_key), d_id, MAIN_AGENCY_ID, r.month, r.year, int(r.sales_target or 0), int(r.quotes_target or 0)))
    if not values: return {"inserted": 0, "skipped": len(rows)}
    execute_values(dwh_cur, "INSERT INTO fact_targets (date_id, user_id, agency_id, month, year, sales_target, quotes_target) VALUES %s ON CONFLICT DO NOTHING", values)
    inserted = dwh_cur.rowcount
    return {"inserted": inserted, "skipped": len(rows) - inserted}

def sync_opdb_to_dwh() -> dict:
    result = {"synced_at": datetime.utcnow().isoformat() + "Z", "tables": {}, "total_inserted": 0, "total_skipped": 0, "error": None}
    try:
        opdb_conn = get_opdb_connection(); dwh_conn = get_dwh_connection()
        opdb_cur = opdb_conn.cursor(); dwh_cur = dwh_conn.cursor()
        dwh_cur.execute("INSERT INTO dim_agency (agency_id, name, city, region) VALUES (%s, %s, %s, %s) ON CONFLICT (agency_id) DO NOTHING", (MAIN_AGENCY_ID, MAIN_AGENCY_NAME, MAIN_AGENCY_NAME, MAIN_AGENCY_REGION))
        steps = [("users", _sync_users), ("vehicles", _sync_vehicles), ("clients", _sync_clients), ("opportunities", _sync_opportunities), ("quotes", _sync_quotes), ("sales", _sync_sales), ("targets", _sync_targets)]
        for name, fn in steps:
            counts = fn(opdb_cur, dwh_cur)
            result["tables"][name] = counts
            result["total_inserted"] += counts["inserted"]
            result["total_skipped"] += counts["skipped"]
        dwh_conn.commit()
    except Exception as e:
        result["error"] = str(e)
        if 'dwh_conn' in locals(): dwh_conn.rollback()
    finally:
        if 'opdb_conn' in locals(): opdb_conn.close()
        if 'dwh_conn' in locals(): dwh_conn.close()
    return result