# generate_fake_sales_opdb.py
# ============================================================
# Standalone script — generates fake sales and targets
# directly into the SQL Server Operational DB.
#
# Run ONCE after run_opdb_etl.py has loaded all agency data.
#
# Steps:
#   1. fill_missing_data()  — replace NULLs with "Undetermined"
#   2. generate_sales()     — 15% of quotes become sales
#   3. generate_targets()   — monthly targets per commercial
#
# Usage:
#   python generate_fake_sales_opdb.py
#
# pip install pandas pyodbc python-dotenv
# ============================================================

import os
import sys
import random
import pandas as pd
import pyodbc
from datetime import timedelta
from dotenv import load_dotenv

# ── Load .env from same folder as this script ─────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ============================================================
# CONFIG
# ============================================================
CONVERSION_RATE = 0.15   # 15% of quotes become sales
MIN_DELAY_DAYS  = 3      # min days between quote date and sale date
MAX_DELAY_DAYS  = 45
DISCOUNT_MIN    = 0.00
DISCOUNT_MAX    = 0.10   # up to 10% discount on base_price
TARGET_STRETCH  = (1.10, 1.30)  # targets = actual × 10–30% above

OPDB_SERVER   = os.getenv("OPDB_SERVER",  "localhost")
OPDB_PORT     = os.getenv("OPDB_PORT",    "1433")
OPDB_NAME     = os.getenv("OPDB_NAME",    "OperationalDB")
OPDB_USER     = os.getenv("OPDB_USER")
OPDB_PASSWORD = os.getenv("OPDB_PASSWORD")
OPDB_DRIVER   = os.getenv("OPDB_DRIVER",  "ODBC Driver 17 for SQL Server")


# ============================================================
# DB
# ============================================================
def get_conn() -> pyodbc.Connection:
    conn_str = (
        f"DRIVER={{{OPDB_DRIVER}}};"
        f"SERVER={OPDB_SERVER},{OPDB_PORT};"
        f"DATABASE={OPDB_NAME};"
        f"UID={OPDB_USER};"
        f"PWD={OPDB_PASSWORD};"
        "TrustServerCertificate=yes;"
    )
    try:
        return pyodbc.connect(conn_str)
    except pyodbc.Error as e:
        print(f"❌ Could not connect to SQL Server: {e}")
        sys.exit(1)



# ============================================================
# STEP 1 — Fill missing / NULL values
# ============================================================
def fill_missing_data():
    conn = get_conn()
    conn.autocommit = False
    cur  = conn.cursor()

    print("=" * 55)
    print("STEP 1 — Filling missing data")
    print("=" * 55)

    # ── clients ───────────────────────────────────────────────
    cur.execute("""
        UPDATE clients SET email = 'Undetermined'
        WHERE email IS NULL OR LTRIM(RTRIM(email)) = ''
    """)
    print(f"  ✅ clients.email          — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE clients SET city = 'Undetermined'
        WHERE city IS NULL OR LTRIM(RTRIM(city)) = ''
    """)
    print(f"  ✅ clients.city           — {cur.rowcount} rows → 'Undetermined'")

    # ── opportunities ─────────────────────────────────────────
    cur.execute("""
        UPDATE opportunities SET channel = 'Undetermined'
        WHERE channel IS NULL OR LTRIM(RTRIM(channel)) = ''
    """)
    print(f"  ✅ opportunities.channel  — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE opportunities SET city = 'Undetermined'
        WHERE city IS NULL OR LTRIM(RTRIM(city)) = ''
    """)
    print(f"  ✅ opportunities.city     — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE opportunities SET client_email = 'Undetermined'
        WHERE client_email IS NULL OR LTRIM(RTRIM(client_email)) = ''
    """)
    print(f"  ✅ opportunities.client_email — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE opportunities SET user_email = 'Undetermined'
        WHERE user_email IS NULL OR LTRIM(RTRIM(user_email)) = ''
    """)
    print(f"  ✅ opportunities.user_email   — {cur.rowcount} rows → 'Undetermined'")

    # ── quotes ────────────────────────────────────────────────
    cur.execute("""
        UPDATE quotes SET ar_design = 'Undetermined'
        WHERE ar_design IS NULL OR LTRIM(RTRIM(ar_design)) = ''
    """)
    print(f"  ✅ quotes.ar_design       — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE quotes SET brand = 'Undetermined'
        WHERE brand IS NULL OR LTRIM(RTRIM(brand)) = ''
    """)
    print(f"  ✅ quotes.brand           — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE quotes SET model = 'Undetermined'
        WHERE model IS NULL OR LTRIM(RTRIM(model)) = ''
    """)
    print(f"  ✅ quotes.model           — {cur.rowcount} rows → 'Undetermined'")

    # ── vehicles ──────────────────────────────────────────────
    # Already filled by parse_vehicles, but catch any edge cases
    cur.execute("""
        UPDATE vehicles SET category = 'Undetermined'
        WHERE category IS NULL OR LTRIM(RTRIM(category)) = ''
    """)
    print(f"  ✅ vehicles.category      — {cur.rowcount} rows → 'Undetermined'")

    cur.execute("""
        UPDATE vehicles SET base_price = 90000
        WHERE base_price IS NULL
    """)
    print(f"  ✅ vehicles.base_price    — {cur.rowcount} rows → 90000 (default)")

    # ── users ─────────────────────────────────────────────────
    cur.execute("""
        UPDATE users SET email = 'Undetermined'
        WHERE email IS NULL OR LTRIM(RTRIM(email)) = ''
    """)
    print(f"  ✅ users.email            — {cur.rowcount} rows → 'Undetermined'")

    conn.commit()
    cur.close()
    conn.close()
    print()


# ============================================================
# STEP 2 — Generate fake sales
# ============================================================
def generate_sales():
    conn = get_conn()
    conn.autocommit = False
    cur  = conn.cursor()

    print("=" * 55)
    print("STEP 2 — Generating fake sales")
    print("=" * 55)

    # Load all quotes with vehicle base_price and oppo_id
    cur.execute("""
        SELECT
            q.quote_id,
            q.quote_id_crm,
            q.oppo_id,
            q.ar_ref,
            q.user_id,
            q.created_date,
            v.base_price
        FROM quotes q
        LEFT JOIN vehicles v ON q.ar_ref = v.ar_ref
        WHERE q.quote_id NOT IN (SELECT quote_id FROM sales WHERE quote_id IS NOT NULL)
    """)

    cols = ["quote_id", "quote_id_crm", "oppo_id", "ar_ref",
            "user_id", "created_date", "base_price"]
    quotes_df = pd.DataFrame.from_records(cur.fetchall(), columns=cols)
    print(f"  Found {len(quotes_df)} quotes not yet converted")

    if quotes_df.empty:
        print("  ⚠️  No unconverted quotes found — skipping.")
        cur.close()
        conn.close()
        return

    # Each quote_id_crm is unique — iterate directly
    print(f"  Processing {len(quotes_df)} unique quotes")

    sales_inserted = 0

    for _, quote in quotes_df.iterrows():
        if random.random() > CONVERSION_RATE:
            continue

        # Sale date = quote date + random delay
        try:
            quote_date = pd.Timestamp(quote["created_date"]).date()
        except Exception:
            continue
        sale_date = quote_date + timedelta(
            days=random.randint(MIN_DELAY_DAYS, MAX_DELAY_DAYS)
        )

        # Final price
        base_price  = float(quote["base_price"]) if pd.notna(quote["base_price"]) else 90000
        final_price = round(base_price * (1 - random.uniform(DISCOUNT_MIN, DISCOUNT_MAX)), 2)

        # FK values
        quote_id = int(quote["quote_id"])           if pd.notna(quote["quote_id"])  else None
        user_id  = int(quote["user_id"])            if pd.notna(quote["user_id"])   else None
        ar_ref   = str(quote["ar_ref"]).strip()     if pd.notna(quote["ar_ref"])    else None
        oppo_id  = str(quote["oppo_id"]).strip()    if pd.notna(quote["oppo_id"])   else None

        if not ar_ref:
            continue

        cur.execute("""
            INSERT INTO sales (quote_id, oppo_id, user_id, ar_ref, sale_date, final_price, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (quote_id, oppo_id, user_id, ar_ref, sale_date, final_price, "Confirmed"))
        sales_inserted += 1

    conn.commit()
    print(f"\n  ✅ Sales inserted: {sales_inserted}")
    cur.close()
    conn.close()
    print()


# ============================================================
# STEP 3 — Generate fake targets
# ============================================================
def generate_targets():
    conn = get_conn()
    conn.autocommit = False
    cur  = conn.cursor()

    print("=" * 55)
    print("STEP 3 — Generating fake targets")
    print("=" * 55)

    # Quote activity per commercial per month
    cur.execute("""
        SELECT
            q.user_id,
            YEAR(q.created_date)  AS year,
            MONTH(q.created_date) AS month,
            COUNT(DISTINCT q.quote_id_crm) AS quote_count
        FROM quotes q
        WHERE q.user_id IS NOT NULL
          AND q.created_date IS NOT NULL
        GROUP BY q.user_id, YEAR(q.created_date), MONTH(q.created_date)
    """)
    quote_activity = cur.fetchall()

    # Sale count per commercial per month
    cur.execute("""
        SELECT
            s.user_id,
            YEAR(s.sale_date)  AS year,
            MONTH(s.sale_date) AS month,
            COUNT(s.sale_id)   AS sale_count
        FROM sales s
        WHERE s.user_id IS NOT NULL
          AND s.sale_date IS NOT NULL
        GROUP BY s.user_id, YEAR(s.sale_date), MONTH(s.sale_date)
    """)
    # Build lookup: (user_id, year, month) → sale_count
    sale_lookup: dict[tuple, int] = {
        (row[0], row[1], row[2]): row[3]
        for row in cur.fetchall()
    }

    targets_inserted = 0
    targets_skipped  = 0

    for user_id, year, month, quote_count in quote_activity:
        # Skip if already exists
        cur.execute("""
            SELECT 1 FROM targets
            WHERE user_id = ? AND year = ? AND month = ?
        """, (user_id, year, month))
        if cur.fetchone():
            targets_skipped += 1
            continue

        sale_count    = sale_lookup.get((user_id, year, month), 0)
        stretch       = random.uniform(*TARGET_STRETCH)
        quotes_target = max(1, round(quote_count * stretch))
        sales_target  = max(1, round((sale_count or 1) * stretch))

        cur.execute("""
            INSERT INTO targets (user_id, month, year, sales_target, quotes_target)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, month, year, sales_target, quotes_target))
        targets_inserted += 1

    conn.commit()
    print(f"  ✅ Targets inserted: {targets_inserted}")
    if targets_skipped:
        print(f"  ℹ️  Targets skipped (already exist): {targets_skipped}")
    cur.close()
    conn.close()
    print()


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    print("\n🚀 Generating fake data for Operational DB...\n")
    fill_missing_data()
    generate_sales()
    generate_targets()
    print("🎉 Done! Operational DB is ready.\n")