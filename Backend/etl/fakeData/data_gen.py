# generate_fake_sales.py
# ============================================================
# Standalone script — run ONCE after ETL pipeline has loaded
# all agency Excel files into the DWH.
#
# Steps (in order):
#   1. fill_missing_dim_data()  — fills city/region/category/price
#   2. generate_sales()         — fakes 15% conversion of quotes → sales
#   3. generate_targets()       — fakes monthly targets per commercial
#
# Run from Backend/ folder:
#   python generate_fake_sales.py
# ============================================================

import os
import random
import pandas as pd
import psycopg2
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# CONFIG
# ============================================================
CONVERSION_RATE = 0.15   # 15% of quotes become sales
MIN_DELAY_DAYS  = 3      # min days between quote and sale
MAX_DELAY_DAYS  = 45     # max days between quote and sale
DISCOUNT_MIN    = 0.00
DISCOUNT_MAX    = 0.10   # up to 10% discount on base_price

DWH_HOST     = os.getenv("DWH_HOST", "localhost")
DWH_PORT     = os.getenv("DWH_PORT", 5432)
DWH_NAME     = os.getenv("DWH_NAME", "datawarehouse")
DWH_USER     = os.getenv("DWH_USER")
DWH_PASSWORD = os.getenv("DWH_PASSWORD")

# ── "Undetermined" sentinel values ────────────────────────────────────────────
# Used wherever a text field is NULL or empty in source data.
# This ensures dashboards always show a clean label instead of null/blank.
UNDETERMINED = "Undetermined"


# ============================================================
# DB
# ============================================================
def get_conn():
    return psycopg2.connect(
        host=DWH_HOST, port=DWH_PORT,
        database=DWH_NAME, user=DWH_USER, password=DWH_PASSWORD
    )


def get_or_create_date(cur, date_obj) -> int:
    cur.execute("SELECT date_id FROM dim_date WHERE date = %s", (date_obj,))
    row = cur.fetchone()
    if row:
        return row[0]
    ts = pd.Timestamp(date_obj)
    cur.execute("""
        INSERT INTO dim_date (date, day, month, month_name, quarter, year, week, day_name)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING date_id
    """, (
        date_obj, ts.day, ts.month, ts.strftime("%B"),
        ts.quarter, ts.year, ts.isocalendar()[1], ts.strftime("%A")
    ))
    return cur.fetchone()[0]


# ============================================================
# STEP 1 — Fill missing dimension data
# ============================================================
def fill_missing_dim_data():
    conn = get_conn()
    cur  = conn.cursor()
    print("=" * 55)
    print("STEP 1 — Filling missing dimension data")
    print("=" * 55)

    # ── dim_agency ────────────────────────────────────────────
    agencies = [
        ("Akouda",   "Akouda",    "Sousse"),
        ("Birkassa", "Bir Kassa", "Ben Arous"),
        ("Sfax",     "Sfax",      "Sfax"),
        ("Gabes",    "Gabès",     "Gabès"),
        ("Benarous", "Ben Arous", "Ben Arous"),
    ]
    for name, city, region in agencies:
        cur.execute(
            "UPDATE dim_agency SET city = %s, region = %s WHERE name = %s",
            (city, region, name)
        )
    print("  ✅ dim_agency — city and region filled")

    # ── dim_user — propagate region from agency ───────────────
    cur.execute("""
        UPDATE dim_user u
        SET region = a.region
        FROM dim_agency a
        WHERE u.agency_id = a.agency_id
          AND (u.region IS NULL OR u.region = '')
    """)
    print("  ✅ dim_user — region propagated from agency")

    # ── dim_client — replace NULL email / city with Undetermined ─
    cur.execute("""
        UPDATE dim_client
        SET email = %s
        WHERE email IS NULL OR TRIM(email) = ''
    """, (UNDETERMINED,))

    cur.execute("""
        UPDATE dim_client
        SET city = %s
        WHERE city IS NULL OR TRIM(city) = ''
    """, (UNDETERMINED,))
    print("  ✅ dim_client — NULL email/city replaced with 'Undetermined'")

    # ── fact_opportunities — replace NULL channel / city ─────
    cur.execute("""
        UPDATE fact_opportunities
        SET channel = %s
        WHERE channel IS NULL OR TRIM(channel) = ''
    """, (UNDETERMINED,))

    cur.execute("""
        UPDATE fact_opportunities
        SET city = %s
        WHERE city IS NULL OR TRIM(city) = ''
    """, (UNDETERMINED,))
    print("  ✅ fact_opportunities — NULL channel/city replaced with 'Undetermined'")

    # ── dim_vehicle — category + base_price ──────────────────
    vehicles = [
        ("SX11-GF+-080",    "SUV Compact", 105000),
        ("SX11-GS-080",     "SUV Compact", 98000),
        ("NL-3B-A10",       "SUV",         110000),
        ("NL-3B-B07",       "SUV",         110000),
        ("SX11-GF+-F36",    "SUV Compact", 105000),
        ("NL-3B-C19",       "SUV",         110000),
        ("NL-3B-E29",       "SUV",         110000),
        ("SX11-GF+-E32",    "SUV Compact", 105000),
        ("SX11-GS-D14",     "SUV Compact", 98000),
        ("NL-3B-D06",       "SUV",         110000),
        ("GX3-CVT-OR",      "Citadine",    70000),
        ("GX3-CVT-BAS",     "Citadine",    70000),
        ("GX3-CVT-WAA",     "Citadine",    70000),
        ("SX11-GS-E32",     "SUV Compact", 98000),
        ("LF7154B-208",     "Citadine",    75000),
        ("LF7154B-C23",     "Citadine",    75000),
        ("LF7154B-K22",     "Citadine",    75000),
        ("LF7154B-E43",     "Citadine",    75000),
        ("LF7154B-G65",     "Citadine",    75000),
        ("E22H-ADA",        "Électrique",  130000),
        ("SX11-GF+-D14",    "SUV Compact", 105000),
        ("SX11-GF+-G66",    "SUV Compact", 105000),
        ("SX11-GS-G66",     "SUV Compact", 98000),
        ("SS11-BVA",        "Berline",     85000),
        ("FX11",            "SUV",         140000),
        ("FY11",            "SUV",         135000),
        ("LP5SEF",          "Électrique",  125000),
        ("KX11",            "SUV",         150000),
        ("FY11-BA-ADE",     "SUV",         138000),
        ("GX3P-MT-WAA",     "Citadine",    72000),
        ("KX11-BA-LAK",     "SUV",         150000),
        ("SX11-MT-WAA",     "SUV Compact", 95000),
        ("GX3-CVT-BAS-CRM", "Citadine",   70000),
        ("GX3P-CVT-WAA",    "Citadine",    75000),
        ("KX11-BA-ACT",     "SUV",         150000),
        ("GE13-LAK",        "Électrique",  128000),
        ("FY11-BA-LAK",     "SUV",         138000),
        ("LF7154B-MT-208",  "Citadine",    72000),
        ("LF7154B-MT-C23",  "Citadine",    72000),
        ("LF7154B-MT-G65",  "Citadine",    72000),
        ("LF7154B-MT-E43",  "Citadine",    72000),
        ("GE13-BAS",        "Électrique",  128000),
        ("SS11-BVM",        "Berline",     80000),
        ("GE13-WAA",        "Électrique",  128000),
        ("SS11-MT-WAA",     "Berline",     80000),
        ("GX3-CVT-RAM",     "Citadine",    70000),
        ("LF7154B-MT-K22",  "Citadine",    72000),
        ("SX11-GS-F36",     "SUV Compact", 98000),
        ("SS11-MT-SAI",     "Berline",     80000),
        ("FY11-BA-WAA",     "SUV",         138000),
        ("EX5-EL-ADA",      "Électrique",  132000),
        ("EX5-EL-GRE",      "Électrique",  132000),
        ("EX5-EL-LAK",      "Électrique",  132000),
        ("EX5-EL-SAI",      "Électrique",  132000),
        ("EX5-EL-WAA",      "Électrique",  132000),
        ("SX11-GF-ADA",     "SUV Compact", 100000),
        ("SX11-GF-WAA",     "SUV Compact", 100000),
        ("SS11T-MT-ADA",    "Berline",     78000),
        ("SS11T-MT-BAS",    "Berline",     78000),
        ("SS11T-MT-SAI",    "Berline",     78000),
        ("SS11T-MT-WAA",    "Berline",     78000),
        ("SS11-AT-OR",      "Berline",     85000),
        ("SX11-GS-WAA",     "SUV Compact", 98000),
        ("SX11-GF-CS",      "SUV Compact", 102000),
        ("GX3-CVT-WAA-CRM", "Citadine",   70000),
        ("GX3-MT-BAS",      "Citadine",    68000),
        ("GX3-MT-WAA",      "Citadine",    68000),
        ("KX11-BA-WAA",     "SUV",         150000),
        ("SX11-CVT-WAA",    "SUV Compact", 98000),
        ("SS11-MT-ADA",     "Berline",     80000),
        ("SS11-MT-BAS",     "Berline",     80000),
        ("EX5",             "Électrique",  132000),
        ("SS11-AT-WAA",     "Berline",     85000),
        ("GC6M72M-WAA",     "Berline",     75000),
        ("GC6M72M-LAK",     "Berline",     75000),
        ("GC6M72M-RAM",     "Berline",     75000),
        ("GC6M72M-BAS",     "Berline",     75000),
        ("GC6M72M-SAI",     "Berline",     75000),
        ("GC6M72M-OR",      "Berline",     75000),
        ("FE-3JCM72-WAA",   "Berline",     68000),
        ("GX3-MT-RAM",      "Citadine",    68000),
        ("GX3-MT-OR",       "Citadine",    68000),
        ("GX3-MT-OR-CRM",   "Citadine",    68000),
        ("GX3-MT-WAA-CRM",  "Citadine",    68000),
        ("GX3-MT-RAM-CRM",  "Citadine",    68000),
        ("GX3-CVT-OR-CRM",  "Citadine",    70000),
        ("GX3-CVT-RAM-CRM", "Citadine",    70000),
        ("GX3-MT-BAS-CRM",  "Citadine",    68000),
        ("SX11",            "SUV Compact", 95000),
        ("SS11-AT-ADA",     "Berline",     85000),
        ("SS11-AT-SAI",     "Berline",     85000),
        ("SS11-AT-BAS",     "Berline",     85000),
        ("KX11-BA-SAF",     "SUV",         150000),
        ("GE13-SAF",        "Électrique",  128000),
        ("SX11-GS-SAF",     "SUV Compact", 98000),
        ("SX11-GF-RAM",     "SUV Compact", 100000),
        ("EX5EM-I-ADA",     "Électrique",  136000),
        ("NL-3B",           "SUV",         108000),
        ("SX11-DCT-WAA",    "SUV Compact", 98000),
        ("SX11-GS-ADA",     "SUV Compact", 98000),
        ("FE-7A74-BAS",     "Berline",     72000),
        ("SX11-GS-BAS",     "SUV Compact", 98000),
    ]
    updated = 0
    for ar_ref, category, base_price in vehicles:
        cur.execute(
            "UPDATE dim_vehicle SET category = %s, base_price = %s WHERE ar_ref = %s",
            (category, base_price, ar_ref)
        )
        updated += cur.rowcount
    print(f"  ✅ dim_vehicle — {updated} vehicles updated with category and base_price")

    # ── dim_vehicle — remaining vehicles with no price get a default ──
    cur.execute("""
        UPDATE dim_vehicle
        SET category   = %s,
            base_price = 90000
        WHERE category IS NULL OR base_price IS NULL
    """, (UNDETERMINED,))
    remaining = cur.rowcount
    if remaining:
        print(f"  ⚠️  dim_vehicle — {remaining} vehicles had no price data, set to 90,000 TND / '{UNDETERMINED}'")

    conn.commit()
    cur.close()
    conn.close()
    print("\nDimension data filled successfully.\n")


# ============================================================
# STEP 2 — Generate fake sales
# ============================================================
def generate_sales():
    conn = get_conn()
    cur  = conn.cursor()
    print("=" * 55)
    print("STEP 2 — Generating fake sales")
    print("=" * 55)

    # Load all unconverted quotes with vehicle price and oppo_id
    cur.execute("""
        SELECT
            fq.quote_id,
            fq.quote_id_crm,
            fq.date_id,
            fq.user_id,
            fq.agency_id,
            fq.vehicle_id,
            fq.oppo_id,
            dd.date     AS quote_date,
            dv.base_price
        FROM fact_quotes fq
        JOIN dim_date    dd ON fq.date_id    = dd.date_id
        LEFT JOIN dim_vehicle dv ON fq.vehicle_id = dv.vehicle_id
        WHERE fq.converted_to_sale = FALSE
    """)
    cols = [
        "quote_id", "quote_id_crm", "date_id", "user_id", "agency_id",
        "vehicle_id", "oppo_id", "quote_date", "base_price"
    ]
    quotes_df = pd.DataFrame(cur.fetchall(), columns=cols)
    print(f"  Found {len(quotes_df)} unconverted quote rows")

    # Each quote_id_crm is unique — iterate directly
    print(f"  Processing {len(quotes_df)} unique quotes")

    sales_inserted   = 0
    quotes_converted = 0

    for _, quote in quotes_df.iterrows():
        if random.random() > CONVERSION_RATE:
            continue

        if pd.isna(quote["vehicle_id"]):
            continue

        # Sale date
        quote_date = pd.Timestamp(quote["quote_date"]).date()
        sale_date  = quote_date + timedelta(days=random.randint(MIN_DELAY_DAYS, MAX_DELAY_DAYS))

        # Price
        base_price  = float(quote["base_price"]) if pd.notna(quote["base_price"]) else 90000
        final_price = round(base_price * (1 - random.uniform(DISCOUNT_MIN, DISCOUNT_MAX)), 2)

        # Quotes before sale = how many quotes this opportunity had total
        quotes_before = int(
            quotes_df[quotes_df["oppo_id"] == quote["oppo_id"]]["quote_id_crm"]
            .nunique()
        ) if pd.notna(quote["oppo_id"]) else 1

        sale_date_id = get_or_create_date(cur, sale_date)

        # ── Resolve FKs safely ────────────────────────────────
        user_id    = int(quote["user_id"])    if pd.notna(quote["user_id"])    else None
        agency_id  = int(quote["agency_id"])  if pd.notna(quote["agency_id"])  else None
        vehicle_id = int(quote["vehicle_id"]) if pd.notna(quote["vehicle_id"]) else None
        oppo_id    = str(quote["oppo_id"])    if pd.notna(quote["oppo_id"])    else None

        cur.execute("""
            INSERT INTO fact_sales
                (date_id, user_id, agency_id, vehicle_id,
                 oppo_id, amount, quotes_before_sale, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            sale_date_id, user_id, agency_id, vehicle_id,
            oppo_id, final_price, quotes_before, "generated"
        ))
        sales_inserted += 1

        # Mark this quote as converted
        cur.execute(
            "UPDATE fact_quotes SET converted_to_sale = TRUE WHERE quote_id_crm = %s",
            (str(quote["quote_id_crm"]),)
        )
        quotes_converted += 1

    conn.commit()
    print(f"\n  ✅ Sales inserted:   {sales_inserted}")
    print(f"  ✅ Quotes converted: {quotes_converted}")
    cur.close()
    conn.close()
    print()


# ============================================================
# STEP 3 — Generate fake targets
# ============================================================
def generate_targets():
    conn = get_conn()
    cur  = conn.cursor()
    print("=" * 55)
    print("STEP 3 — Generating fake targets")
    print("=" * 55)

    # Quote activity per commercial per month
    cur.execute("""
        SELECT
            fq.user_id,
            fq.agency_id,
            dd.year,
            dd.month,
            COUNT(DISTINCT fq.quote_id_crm) AS quote_count,
            COUNT(DISTINCT fs.sale_id)      AS sale_count
        FROM fact_quotes fq
        JOIN dim_date dd ON fq.date_id = dd.date_id
        LEFT JOIN fact_sales fs
            ON  fq.user_id   = fs.user_id
            AND fq.agency_id = fs.agency_id
            AND dd.year  = (SELECT year  FROM dim_date WHERE date_id = fs.date_id)
            AND dd.month = (SELECT month FROM dim_date WHERE date_id = fs.date_id)
        WHERE fq.user_id IS NOT NULL
        GROUP BY fq.user_id, fq.agency_id, dd.year, dd.month
        ORDER BY fq.user_id, dd.year, dd.month
    """)

    rows = cur.fetchall()
    targets_inserted = 0
    targets_skipped  = 0

    for row in rows:
        user_id, agency_id, year, month, quote_count, sale_count = row

        # Skip if already generated
        cur.execute("""
            SELECT 1 FROM fact_targets
            WHERE user_id = %s AND year = %s AND month = %s
        """, (user_id, year, month))
        if cur.fetchone():
            targets_skipped += 1
            continue

        stretch        = random.uniform(1.10, 1.30)
        quotes_target  = max(1, round(quote_count * stretch))
        sales_target   = max(1, round((sale_count or 1) * stretch))

        date_obj = pd.Timestamp(year=year, month=month, day=1).date()
        date_id  = get_or_create_date(cur, date_obj)

        agency_id_safe = int(agency_id) if pd.notna(agency_id) else None

        cur.execute("""
            INSERT INTO fact_targets
                (date_id, user_id, agency_id, month, year, sales_target, quotes_target)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (date_id, int(user_id), agency_id_safe, month, year, sales_target, quotes_target))
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
    print("\n🚀 Starting fake data generation...\n")
    fill_missing_dim_data()
    generate_sales()
    generate_targets()
    print("🎉 All done! DWH is ready for dashboards.\n")