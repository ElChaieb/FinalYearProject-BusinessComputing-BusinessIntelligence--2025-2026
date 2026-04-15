# data_gen.py (DWH Version)
import os, random, psycopg2
import pandas as pd
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

UNDETERMINED = "Undetermined"

def get_conn():
    return psycopg2.connect(host=os.getenv("DWH_HOST"), port=os.getenv("DWH_PORT"), database=os.getenv("DWH_NAME"), user=os.getenv("DWH_USER"), password=os.getenv("DWH_PASSWORD"))

def fill_missing_dim_data():
    conn = get_conn(); cur = conn.cursor()
    print("STEP 1 — Filling DWH dimension data & status correction")
    
    # Logic: Restore active status if a quote exists in the DWH
    cur.execute("UPDATE fact_opportunities SET deleted = FALSE WHERE deleted = TRUE AND oppo_id IN (SELECT DISTINCT oppo_id FROM fact_quotes)")
    print("  ✅ Status correction applied to quoted opportunities in DWH.")
    
    cur.execute("UPDATE dim_client SET email = %s WHERE email IS NULL OR email = ''", (UNDETERMINED,))
    cur.execute("UPDATE fact_opportunities SET channel = %s WHERE channel IS NULL OR channel = ''", (UNDETERMINED,))
    conn.commit(); conn.close()

def generate_sales():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT fq.quote_id_crm, fq.user_id, fq.agency_id, fq.vehicle_id, fq.oppo_id, dd.date, dv.base_price FROM fact_quotes fq JOIN dim_date dd ON fq.date_id = dd.date_id LEFT JOIN dim_vehicle dv ON fq.vehicle_id = dv.vehicle_id WHERE fq.converted_to_sale = FALSE")
    rows = cur.fetchall()
    for r in rows:
        if random.random() < 0.15 and r[3]: # r[3] is vehicle_id
            sale_date = r[5] + timedelta(days=random.randint(3, 45))
            cur.execute("SELECT date_id FROM dim_date WHERE date = %s", (sale_date,))
            d_id = cur.fetchone()[0]
            price = round(float(r[6] or 90000) * (1 - random.uniform(0, 0.10)), 2)
            cur.execute("INSERT INTO fact_sales (date_id, user_id, agency_id, vehicle_id, oppo_id, amount, quotes_before_sale, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", (d_id, r[1], r[2], r[3], r[4], price, 1, "generated"))
            cur.execute("UPDATE fact_quotes SET converted_to_sale = TRUE WHERE quote_id_crm = %s", (r[0],))
    conn.commit(); conn.close()

if __name__ == "__main__":
    fill_missing_dim_data(); generate_sales()