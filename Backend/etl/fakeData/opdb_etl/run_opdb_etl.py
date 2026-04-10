# opdb_etl/run_opdb_etl.py
# ============================================================
# ONE-TIME MIGRATION — Excel files → Operational DB (SQL Server)
#
# Usage:
#   python run_opdb_etl.py
#   python run_opdb_etl.py --folder "C:/path/to/your/xlsx/files"
#
# Reads all CRM FIRSTNAME-AGENCYNAME.xlsx files from the folder,
# validates their structure, and loads data into SQL Server.
#
# Safe to re-run — all inserts are idempotent (skip if exists).
#
# Required packages:
#   pip install pandas python-calamine pyodbc python-dotenv
#
# .env variables needed (add to your Backend/.env):
#   OPDB_SERVER   = localhost
#   OPDB_PORT     = 1433
#   OPDB_NAME     = OperationalDB
#   OPDB_USER     = sa
#   OPDB_PASSWORD = your_password
#   OPDB_DRIVER   = ODBC Driver 17 for SQL Server
# ============================================================

import os
import re
import sys
import argparse
import pandas as pd
from dotenv import load_dotenv

# ── Make imports work whether you run from inside or outside the folder ───────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.db     import get_connection
from utils.logger import logger
from parsers.parse_users         import parse_and_load_users
from parsers.parse_vehicles      import parse_and_load_vehicles
from parsers.parse_opportunities import parse_and_load_opportunities
from parsers.parse_quotes        import parse_and_load_quotes

load_dotenv()

OP_SHEET    = "OP"
DEVIS_SHEET = "DEVIS"

# ── Required columns — same rules as DWH ETL validator ───────
OP_REQUIRED = {
    "Oppo_OpportunityId", "Oppo_CreatedDate", "Oppo_AssignedUserId",
    "User_LastName", "User_FirstName", "User_EmailAddress",
    "Chan_Description", "Comp_Name",
}
DEVIS_REQUIRED = {
    "Quot_opportunityid", "Quot_OrderQuoteID", "Quot_CreatedDate",
    "AR_Ref", "AR_Design", "Marque", "Modèle",
    "User_LastName", "User_FirstName",
}


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def extract_agency_name(filepath: str) -> str:
    """CRM FIRSTNAME-AGENCYNAME.xlsx → 'Agencyname'"""
    basename = os.path.basename(filepath).replace(".xlsx", "")
    # Strip timestamp suffix if file came from processed/ folder
    basename = re.sub(r"_\d{8}_\d{6}$", "", basename)
    match = re.search(r"-(.+)$", basename)
    return match.group(1).strip().title() if match else "Unknown"


def load_sheet(filepath: str, sheet_name: str) -> pd.DataFrame | None:
    try:
        xl = pd.ExcelFile(filepath, engine="calamine")
        if sheet_name not in xl.sheet_names:
            return None
        df = xl.parse(sheet_name)
        return df if not df.empty and len(df.columns) > 0 else None
    except Exception as e:
        logger.error(f"  Failed to load sheet '{sheet_name}': {e}")
        return None


def validate(df_op, df_devis, filename: str) -> tuple[bool, list[str], list[str]]:
    errors, warnings = [], []

    if df_op is None:
        errors.append("Sheet 'OP' is missing or empty.")
    if df_devis is None:
        errors.append("Sheet 'DEVIS' is missing or empty.")
    if errors:
        return False, errors, warnings

    missing_op    = OP_REQUIRED    - set(df_op.columns)
    missing_devis = DEVIS_REQUIRED - set(df_devis.columns)

    if missing_op:
        errors.append(f"OP missing required columns: {sorted(missing_op)}")
    if missing_devis:
        errors.append(f"DEVIS missing required columns: {sorted(missing_devis)}")

    if "User_UserId" not in df_devis.columns and not missing_devis:
        warnings.append(
            "DEVIS missing 'User_UserId' — quote users will be resolved by name."
        )
    if "Oppo_Deleted" not in df_op.columns:
        warnings.append("'Oppo_Deleted' absent — all opportunities treated as active.")
    if "Emai_EmailAddress" not in df_op.columns:
        warnings.append("'Emai_EmailAddress' absent — client email will be NULL.")

    return len(errors) == 0, errors, warnings


# ─────────────────────────────────────────────────────────────
# Per-file processor
# ─────────────────────────────────────────────────────────────
def process_file(filepath: str) -> dict:
    filename = os.path.basename(filepath)
    logger.info(f"=== Processing: {filename} ===")

    report = {
        "file":          filename,
        "agency":        None,
        "status":        "success",
        "error":         None,
        "validation":    {"errors": [], "warnings": []},
        "users":         {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "vehicles":      {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "clients":       {"inserted": 0},
        "opportunities": {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "quotes":        {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
    }

    # ── Load sheets ───────────────────────────────────────────
    df_op    = load_sheet(filepath, OP_SHEET)
    df_devis = load_sheet(filepath, DEVIS_SHEET)
    logger.info(f"  OP rows:    {len(df_op)    if df_op    is not None else 'MISSING'}")
    logger.info(f"  DEVIS rows: {len(df_devis) if df_devis is not None else 'MISSING'}")

    # ── Validate ──────────────────────────────────────────────
    valid, errors, warnings = validate(df_op, df_devis, filename)
    report["validation"] = {"errors": errors, "warnings": warnings}
    for w in warnings:
        logger.warning(f"  [WARN] {w}")
    if not valid:
        for e in errors:
            logger.error(f"  [REJECT] {e}")
        report["status"] = "rejected"
        report["error"]  = " | ".join(errors)
        return report

    # ── Agency / source ───────────────────────────────────────
    agency_name = extract_agency_name(filepath)
    source      = agency_name.lower().replace(" ", "_")
    report["agency"] = agency_name
    logger.info(f"  Agency: {agency_name} | source: {source}")

    # ── DB — single connection, single transaction per file ───
    conn = get_connection()
    conn.autocommit = False
    cur  = conn.cursor()

    try:
        # Order matters: users + vehicles before opportunities + quotes
        report["users"]    = parse_and_load_users(df_op, df_devis, cur)
        report["vehicles"] = parse_and_load_vehicles(df_devis, cur)

        # Opportunities (also calls get_or_create_client internally)
        report["opportunities"] = parse_and_load_opportunities(df_op, source, cur)

        # Quotes
        report["quotes"] = parse_and_load_quotes(df_devis, source, cur)

        conn.commit()
        logger.info(f"=== Done: {filename} ===")

    except Exception as e:
        conn.rollback()
        report["status"] = "failed"
        report["error"]  = str(e)
        logger.error(f"Pipeline failed for {filename}: {e}")
    finally:
        cur.close()
        conn.close()

    return report


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="One-time ETL: Excel CRM files → SQL Server Operational DB"
    )
    parser.add_argument(
        "--folder",
        default=os.getenv("OPDB_ETL_FOLDER", "./opdb_etl/raw"),
        help="Folder containing the agency .xlsx files (default: ./opdb_etl/raw)",
    )
    args = parser.parse_args()

    folder = args.folder
    if not os.path.isdir(folder):
        print(f"❌ Folder not found: {folder}")
        sys.exit(1)

    files = sorted([
        os.path.join(folder, f)
        for f in os.listdir(folder)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ])

    if not files:
        print(f"⚠️  No .xlsx files found in: {folder}")
        sys.exit(0)

    print(f"\n🚀 Starting Operational DB ETL")
    print(f"   Folder : {folder}")
    print(f"   Files  : {len(files)}\n")
    logger.info(f"Found {len(files)} file(s) in {folder}")

    reports = [process_file(f) for f in files]

    # ── Summary ───────────────────────────────────────────────
    success  = [r for r in reports if r["status"] == "success"]
    rejected = [r for r in reports if r["status"] == "rejected"]
    failed   = [r for r in reports if r["status"] == "failed"]

    _TABLES = ["users", "vehicles", "opportunities", "quotes"]
    total_inserted = sum(
        r.get(t, {}).get("inserted", 0) for r in reports for t in _TABLES
    )
    total_skipped = sum(
        r.get(t, {}).get("skipped", 0) for r in reports for t in _TABLES
    )

    print("\n" + "=" * 55)
    print("SUMMARY")
    print("=" * 55)
    print(f"  Files processed : {len(success)}")
    print(f"  Files rejected  : {len(rejected)}  (schema issues — fix and re-run)")
    print(f"  Files failed    : {len(failed)}   (unexpected errors)")
    print(f"  Rows inserted   : {total_inserted}")
    print(f"  Rows skipped    : {total_skipped}  (already existed)")

    if rejected:
        print("\n  Rejected files:")
        for r in rejected:
            print(f"    ✗ {r['file']}")
            for e in r["validation"]["errors"]:
                print(f"        → {e}")

    if failed:
        print("\n  Failed files:")
        for r in failed:
            print(f"    ✗ {r['file']}: {r['error']}")

    print("\n🎉 Done!\n")


if __name__ == "__main__":
    main()
