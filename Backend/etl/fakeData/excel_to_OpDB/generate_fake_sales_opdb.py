# generate_fake_sales_opdb.py
import os, sys, random
import pandas as pd
import pyodbc
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

CONVERSION_RATE = 0.15
MIN_DELAY_DAYS, MAX_DELAY_DAYS = 3, 45
DISCOUNT_MIN, DISCOUNT_MAX = 0.00, 0.10
TARGET_STRETCH = (1.10, 1.30)

def get_conn() -> pyodbc.Connection:
    conn_str = (f"DRIVER={{{os.getenv('OPDB_DRIVER', 'ODBC Driver 17 for SQL Server')}}};"
                f"SERVER={os.getenv('OPDB_SERVER', 'localhost')},{os.getenv('OPDB_PORT', '1433')};"
                f"DATABASE={os.getenv('OPDB_NAME', 'OperationalDB')};"
                f"UID={os.getenv('OPDB_USER')};PWD={os.getenv('OPDB_PASSWORD')};"
                "TrustServerCertificate=yes;")
    return pyodbc.connect(conn_str)

def fill_missing_data():
    conn = get_conn(); cur = conn.cursor()
    print("STEP 1 — Filling missing data & restoring quoted opportunities")
    
    # Restoring logic: If it has a quote, it's not deleted
    cur.execute("UPDATE opportunities SET deleted = 0 WHERE deleted = 1 AND oppo_id IN (SELECT DISTINCT oppo_id FROM quotes)")
    print(f"  ✅ Restored {cur.rowcount} quoted opportunities to active status.")
    
    cur.execute("UPDATE clients SET email = 'Undetermined' WHERE email IS NULL OR email = ''")
    cur.execute("UPDATE opportunities SET channel = 'Undetermined' WHERE channel IS NULL OR channel = ''")
    cur.execute("UPDATE vehicles SET base_price = 90000 WHERE base_price IS NULL")
    conn.commit(); conn.close()

def generate_sales():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT q.quote_id, q.oppo_id, q.ar_ref, q.user_id, q.created_date, v.base_price FROM quotes q LEFT JOIN vehicles v ON q.ar_ref = v.ar_ref WHERE q.quote_id NOT IN (SELECT quote_id FROM sales WHERE quote_id IS NOT NULL)")
    cols = ["quote_id", "oppo_id", "ar_ref", "user_id", "created_date", "base_price"]
    df = pd.DataFrame.from_records(cur.fetchall(), columns=cols)
    
    for _, r in df.iterrows():
        if random.random() < CONVERSION_RATE and pd.notna(r['ar_ref']):
            sale_date = pd.Timestamp(r['created_date']).date() + timedelta(days=random.randint(MIN_DELAY_DAYS, MAX_DELAY_DAYS))
            price = round(float(r['base_price'] or 90000) * (1 - random.uniform(DISCOUNT_MIN, DISCOUNT_MAX)), 2)
            cur.execute("INSERT INTO sales (quote_id, oppo_id, user_id, ar_ref, sale_date, final_price, status) VALUES (?, ?, ?, ?, ?, ?, ?)", (int(r['quote_id']), r['oppo_id'], int(r['user_id']), r['ar_ref'], sale_date, price, "Confirmed"))
    conn.commit(); conn.close()

def generate_targets():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT user_id, YEAR(created_date), MONTH(created_date), COUNT(*) FROM quotes GROUP BY user_id, YEAR(created_date), MONTH(created_date)")
    for user_id, yr, mon, count in cur.fetchall():
        cur.execute("SELECT 1 FROM targets WHERE user_id = ? AND year = ? AND month = ?", (user_id, yr, mon))
        if not cur.fetchone():
            stretch = random.uniform(*TARGET_STRETCH)
            cur.execute("INSERT INTO targets (user_id, month, year, sales_target, quotes_target) VALUES (?, ?, ?, ?, ?)", (user_id, mon, yr, max(1, round(count * stretch * 0.15)), max(1, round(count * stretch))))
    conn.commit(); conn.close()

if __name__ == "__main__":
    fill_missing_data(); generate_sales(); generate_targets()