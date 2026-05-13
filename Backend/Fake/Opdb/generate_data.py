"""
generate_data.py
────────────────
Connects to your OperationalDB (MS SQL Server), reads real users/clients/vehicles,
then generates and inserts opportunities → quotes → sales.

Requirements:
    pip install pyodbc python-dotenv

.env file expected next to this script (or pass --env <path>):
    OPDB_SERVER=localhost
    OPDB_PORT=1433
    OPDB_NAME=OperationalDB
    OPDB_USER=sa
    OPDB_PASSWORD=Password7@
    OPDB_DRIVER=ODBC Driver 17 for SQL Server

Usage:
    python generate_data.py
    python generate_data.py --env /path/to/.env
    python generate_data.py --dry-run     # prints SQL, does NOT insert
"""

import argparse
import datetime
import os
import random
import sys

try:
    import pyodbc
except ImportError:
    sys.exit("✗ pyodbc not installed. Run: pip install pyodbc")

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("✗ python-dotenv not installed. Run: pip install python-dotenv")


# ─── CLI args ────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(
    description="Seed OperationalDB with opportunities/quotes/sales"
)
parser.add_argument("--env",     default=".env", help="Path to .env file (default: .env)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print SQL only, do not insert")
args = parser.parse_args()


# ─── load .env ───────────────────────────────────────────────────────────────

env_path = os.path.abspath(args.env)
if not os.path.exists(env_path):
    sys.exit(f"✗ .env file not found at: {env_path}")
load_dotenv(env_path)

DB_SERVER   = os.getenv("OPDB_SERVER",   "localhost")
DB_PORT     = os.getenv("OPDB_PORT",     "1433")
DB_NAME     = os.getenv("OPDB_NAME",     "OperationalDB")
DB_USER     = os.getenv("OPDB_USER",     "sa")
DB_PASSWORD = os.getenv("OPDB_PASSWORD", "")
DB_DRIVER   = os.getenv("OPDB_DRIVER",   "ODBC Driver 17 for SQL Server")


# ─── helpers ─────────────────────────────────────────────────────────────────

def prompt_int(msg, lo=None, hi=None, default=None):
    while True:
        raw = input(msg).strip()
        if raw == "" and default is not None:
            return default
        try:
            v = int(raw)
            if lo is not None and v < lo:
                print(f"  ✗ Must be >= {lo}")
                continue
            if hi is not None and v > hi:
                print(f"  ✗ Must be <= {hi}")
                continue
            return v
        except ValueError:
            print("  ✗ Please enter a whole number.")

def prompt_float(msg, lo=0.0, hi=100.0, default=None):
    while True:
        raw = input(msg).strip()
        if raw == "" and default is not None:
            return default
        try:
            v = float(raw)
            if v < lo or v > hi:
                print(f"  ✗ Must be between {lo} and {hi}.")
                continue
            return v
        except ValueError:
            print("  ✗ Please enter a number.")

def rand_date_in_range(start: datetime.date, end: datetime.date) -> datetime.date:
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + datetime.timedelta(days=random.randint(0, delta))

def rand_datetime(date: datetime.date) -> datetime.datetime:
    return datetime.datetime(
        date.year, date.month, date.day,
        random.randint(8, 17),
        random.randint(0, 59),
        random.randint(0, 59),
    )

def last_day(year, month):
    if month == 12:
        return datetime.date(year, 12, 31)
    return datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)


# ─── DB helpers ──────────────────────────────────────────────────────────────

def make_conn():
    conn_str = (
        f"DRIVER={{{DB_DRIVER}}};"
        f"SERVER={DB_SERVER},{DB_PORT};"
        f"DATABASE={DB_NAME};"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD};"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)

def fetch_all(conn, sql):
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]

def next_id(conn, table, pk_col):
    cur = conn.cursor()
    cur.execute(f"SELECT ISNULL(MAX({pk_col}), 0) + 1 FROM {table}")
    return cur.fetchone()[0]


# ─── main ────────────────────────────────────────────────────────────────────

def main():
    today         = datetime.date.today()
    current_year  = today.year
    current_month = today.month

    print()
    print("╔══════════════════════════════════════════════════════╗")
    print("║        OperationalDB — Seed Data Generator          ║")
    print("║        (opportunities → quotes → sales)             ║")
    print("╚══════════════════════════════════════════════════════╝")
    if args.dry_run:
        print("  ⚠  DRY-RUN mode — SQL will be printed, nothing inserted")
    print()

    # ── connect ──────────────────────────────────────────────────
    print(f"Connecting to {DB_SERVER}:{DB_PORT}/{DB_NAME} …", end=" ", flush=True)
    try:
        conn = make_conn()
    except Exception as e:
        print()
        sys.exit(f"✗ Connection failed: {e}")
    print("✓")

    # ── load reference data ───────────────────────────────────────
    users    = fetch_all(conn, "SELECT user_id, agency_name FROM users")
    clients  = fetch_all(conn, "SELECT client_id FROM clients")
    vehicles = fetch_all(conn, "SELECT ar_ref, base_price FROM vehicles")

    if not users:
        sys.exit("✗ No rows in users table — seed reference data first.")
    if not clients:
        sys.exit("✗ No rows in clients table — seed reference data first.")
    if not vehicles:
        sys.exit("✗ No rows in vehicles table — seed reference data first.")

    print(f"  Loaded  {len(users)} users  |  {len(clients)} clients  |  {len(vehicles)} vehicles")

    # current max IDs (safe starting point)
    oppo_id  = next_id(conn, "opportunities", "oppo_id")
    quote_id = next_id(conn, "quotes",        "quote_id")
    sale_id  = next_id(conn, "sales",         "sale_id")

    # ── prompts ───────────────────────────────────────────────────
    print()
    n_oppos = prompt_int("Number of opportunities to generate [100]: ", lo=1, default=100)

    print()
    print("Conversion rates  (0 – 100)")
    opp_to_quote_pct  = prompt_float("  Opportunity → Quote  % [90]: ", default=90.0)
    quote_to_sale_pct = prompt_float("  Quote → Sale          % [80]: ", default=80.0)

    print()
    year = prompt_int(f"Target year [{current_year}]: ", lo=2000, hi=2100, default=current_year)

    max_allowed = current_month if year == current_year else 12
    cap_note = (
        f" — capped at {current_month} (current month)"
        if year == current_year else ""
    )
    print(f"Max month (1–{max_allowed}){cap_note}")
    max_month = prompt_int(f"  Max month [{max_allowed}]: ", lo=1, hi=max_allowed, default=max_allowed)

    # ── build rows ────────────────────────────────────────────────
    print()
    print(f"Generating {n_oppos} opportunities …")

    period_start    = datetime.date(year, 1, 1)
    period_end      = last_day(year, max_month)
    client_ref_pool = ["REF-{:05d}".format(i) for i in range(1, 10001)]

    oppo_rows  = []
    quote_rows = []
    sale_rows  = []
    stats = {"quotes": 0, "sales": 0, "oppo_deleted": 0, "quote_deleted": 0}

    for _ in range(n_oppos):
        user       = random.choice(users)
        client     = random.choice(clients)
        oppo_date  = rand_date_in_range(period_start, period_end)
        client_ref = random.choice(client_ref_pool)

        leads_to_quote = random.random() * 100 < opp_to_quote_pct
        oppo_deleted   = not leads_to_quote
        if oppo_deleted:
            stats["oppo_deleted"] += 1

        oppo_rows.append((
            oppo_id,
            user["user_id"],
            client["client_id"],
            user["agency_name"],
            rand_datetime(oppo_date),
            client_ref,
            1 if oppo_deleted else 0,
        ))

        if leads_to_quote:
            stats["quotes"] += 1
            vehicle  = random.choice(vehicles)
            q_offset = random.randint(3, 14)
            q_date   = min(oppo_date + datetime.timedelta(days=q_offset), period_end)
            price    = round(float(vehicle["base_price"]) * random.uniform(0.95, 1.10), 2)

            leads_to_sale = random.random() * 100 < quote_to_sale_pct
            quote_deleted = not leads_to_sale
            if quote_deleted:
                stats["quote_deleted"] += 1

            quote_rows.append((
                quote_id,
                oppo_id,
                vehicle["ar_ref"],
                user["user_id"],
                client["client_id"],
                user["agency_name"],
                price,
                rand_datetime(q_date),
                1 if quote_deleted else 0,
            ))

            if leads_to_sale:
                stats["sales"] += 1
                s_offset    = random.randint(3, 21)
                s_date      = min(q_date + datetime.timedelta(days=s_offset), period_end)
                quantity    = random.randint(1, 3)
                final_price = round(price * quantity * random.uniform(0.97, 1.03), 2)

                sale_rows.append((
                    sale_id,
                    quote_id,
                    oppo_id,
                    user["user_id"],
                    client["client_id"],
                    vehicle["ar_ref"],
                    user["agency_name"],
                    s_date,
                    quantity,
                    final_price,
                ))
                sale_id += 1

            quote_id += 1
        oppo_id += 1

    # ── dry-run: print SQL ────────────────────────────────────────
    if args.dry_run:
        print()
        print("-- ── Opportunities ───────────────────────────────────────")
        for r in oppo_rows:
            print(
                f"INSERT INTO opportunities "
                f"(oppo_id,user_id,client_id,agency_name,created_date,client_reference,deleted) "
                f"VALUES ({r[0]},{r[1]},{r[2]},'{r[3]}','{r[4]}','{r[5]}',{r[6]});"
            )
        print()
        print("-- ── Quotes ──────────────────────────────────────────────")
        for r in quote_rows:
            print(
                f"INSERT INTO quotes "
                f"(quote_id,oppo_id,ar_ref,user_id,client_id,agency_name,price,created_date,deleted) "
                f"VALUES ({r[0]},{r[1]},'{r[2]}',{r[3]},{r[4]},'{r[5]}',{r[6]},'{r[7]}',{r[8]});"
            )
        print()
        print("-- ── Sales ───────────────────────────────────────────────")
        for r in sale_rows:
            print(
                f"INSERT INTO sales "
                f"(sale_id,quote_id,oppo_id,user_id,client_id,ar_ref,agency_name,"
                f"sale_date,quantity,final_price) "
                f"VALUES ({r[0]},{r[1]},{r[2]},{r[3]},{r[4]},'{r[5]}','{r[6]}',"
                f"'{r[7]}',{r[8]},{r[9]});"
            )

    # ── real insert ───────────────────────────────────────────────
    else:
        print("Inserting into DB …", end=" ", flush=True)
        try:
            cur = conn.cursor()
            cur.fast_executemany = True

            cur.executemany(
                "INSERT INTO opportunities "
                "(oppo_id,user_id,client_id,agency_name,created_date,client_reference,deleted) "
                "VALUES (?,?,?,?,?,?,?)",
                oppo_rows,
            )
            cur.executemany(
                "INSERT INTO quotes "
                "(quote_id,oppo_id,ar_ref,user_id,client_id,agency_name,price,created_date,deleted) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                quote_rows,
            )
            cur.executemany(
                "INSERT INTO sales "
                "(sale_id,quote_id,oppo_id,user_id,client_id,ar_ref,agency_name,"
                "sale_date,quantity,final_price) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                sale_rows,
            )
            conn.commit()
            print("✓")
        except Exception as e:
            conn.rollback()
            sys.exit(f"\n✗ Insert failed (rolled back): {e}")

    conn.close()

    # ── summary ───────────────────────────────────────────────────
    print()
    print("─" * 56)
    print(f"  Opportunities : {len(oppo_rows):<6}  (no-quote / deleted : {stats['oppo_deleted']})")
    print(f"  Quotes        : {len(quote_rows):<6}  (no-sale  / deleted : {stats['quote_deleted']})")
    print(f"  Sales         : {len(sale_rows)}")
    print("─" * 56)
    print()


if __name__ == "__main__":
    main()
