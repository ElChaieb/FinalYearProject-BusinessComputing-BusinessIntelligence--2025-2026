# etl/pipeline/file_processor.py
"""
Main ETL entry point for a single xlsx file.

Flow:
  1. Load OP + DEVIS sheets
  2. Schema validation  → reject immediately if required columns missing
  3. Parse users        → dim_user
  4. Parse vehicles     → dim_vehicle
  5. Parse clients      → dim_client  (NEW)
  6. Parse opportunities → fact_opportunities (with client_id FK)
  7. Parse quotes       → fact_quotes  (with oppo_id FK + smart user resolution)
  8. Move file to processed/ or rejected/
"""
import os
import re
import shutil
import pandas as pd
from datetime import datetime

from etl.pipeline.validators.schema_validator import validate_sheets
from etl.pipeline.parsers.parse_agency       import get_or_create_agency
from etl.pipeline.parsers.parse_users        import parse_and_load_users
from etl.pipeline.parsers.parse_vehicles     import parse_and_load_vehicles
from etl.pipeline.parsers.parse_clients      import get_or_create_client   # noqa: F401 (used via parse_opportunities)
from etl.pipeline.parsers.parse_opportunities import parse_and_load_opportunities
from etl.pipeline.parsers.parse_quotes       import parse_and_load_quotes
from etl.utils.logger import logger
from dotenv import load_dotenv

load_dotenv()
BASE_DIR      = os.getenv("BASE_DIR")
RAW_DIR       = os.path.join(BASE_DIR, "etl", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "etl", "processed")
REJECTED_DIR  = os.path.join(BASE_DIR, "etl", "rejected")

OP_SHEET    = "OP"
DEVIS_SHEET = "DEVIS"


def extract_agency_name(filepath: str) -> str:
    basename = os.path.basename(filepath).replace(".xlsx", "")
    match = re.search(r'-(.+)$', basename)
    return match.group(1).strip().title() if match else "Unknown"


def move_file(filepath: str, destination_dir: str) -> str:
    filename  = os.path.basename(filepath)
    basename  = os.path.splitext(filename)[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    new_name  = f"{basename}_{timestamp}.xlsx"
    dest_path = os.path.join(destination_dir, new_name)
    shutil.move(filepath, dest_path)
    return new_name


def _load_sheet(filepath: str, sheet_name: str):
    """Load a sheet, returning None if the sheet doesn't exist or is empty."""
    try:
        xl = pd.ExcelFile(filepath, engine="calamine")
        if sheet_name not in xl.sheet_names:
            return None
        df = xl.parse(sheet_name)
        return df if not df.empty else None
    except Exception as e:
        logger.error(f"  Failed to load sheet '{sheet_name}': {e}")
        return None


def process_file(filepath: str) -> dict:
    filename = os.path.basename(filepath)
    logger.info(f"=== Processing file: {filename} ===")

    report = {
        "file":          filename,
        "agency":        None,
        "validation":    {"errors": [], "warnings": []},
        "users":         {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "vehicles":      {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "clients":       {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "opportunities": {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "quotes":        {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "status":        "success",
        "error":         None,
    }

    if not os.path.isabs(filepath):
        filepath = os.path.join(BASE_DIR, filepath)
    if not os.path.exists(filepath):
        report["status"] = "failed"
        report["error"]  = f"File not found: {filepath}"
        logger.error(report["error"])
        return report

    try:
        # ── Load sheets ───────────────────────────────────────────────────
        df_op    = _load_sheet(filepath, OP_SHEET)
        df_devis = _load_sheet(filepath, DEVIS_SHEET)

        logger.info(f"  OP rows: {len(df_op) if df_op is not None else 'MISSING'}")
        logger.info(f"  DEVIS rows: {len(df_devis) if df_devis is not None else 'MISSING'}")

        # ── Schema validation ─────────────────────────────────────────────
        validation = validate_sheets(df_op, df_devis, filename)
        report["validation"] = {
            "errors":   validation["errors"],
            "warnings": validation["warnings"],
        }

        for w in validation["warnings"]:
            logger.warning(f"  [WARN] {w}")

        if not validation["valid"]:
            for e in validation["errors"]:
                logger.error(f"  [REJECT] {e}")
            report["status"] = "rejected"
            report["error"]  = " | ".join(validation["errors"])
            _move(filepath, REJECTED_DIR, report, logger)
            return report

        # ── Agency ────────────────────────────────────────────────────────
        agency_name = extract_agency_name(filepath)
        agency_id   = get_or_create_agency(agency_name)
        report["agency"] = agency_name
        source = agency_name.lower().replace(" ", "_")
        logger.info(f"  Agency: {agency_name} (id={agency_id})")

        # ── Parsers ───────────────────────────────────────────────────────
        # Order matters: users and vehicles must be loaded before
        # opportunities and quotes so FK lookups succeed.
        report["users"]         = parse_and_load_users(df_op, df_devis, agency_id)
        report["vehicles"]      = parse_and_load_vehicles(df_devis)
        report["opportunities"] = parse_and_load_opportunities(df_op, agency_id, source)
        report["quotes"]        = parse_and_load_quotes(df_devis, agency_id, source)

        # Client count comes from fact_opportunities inserts
        # (get_or_create_client is called per-opportunity row internally)
        logger.info(f"=== Done: {filename} ===")

    except Exception as e:
        report["status"] = "failed"
        report["error"]  = str(e)
        logger.error(f"Pipeline failed for {filename}: {e}")

    _move(filepath, PROCESSED_DIR if report["status"] == "success" else REJECTED_DIR,
          report, logger)
    return report


def _move(filepath, dest_dir, report, log):
    os.makedirs(dest_dir, exist_ok=True)
    new_name = move_file(filepath, dest_dir)
    label = "processed" if dest_dir == PROCESSED_DIR else "rejected"
    log.info(f"Moved to {label}/: {new_name}")


def process_all_raw_files() -> list:
    files = [
        os.path.join(RAW_DIR, f)
        for f in os.listdir(RAW_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    logger.info(f"Found {len(files)} file(s) in raw/")
    return [process_file(fp) for fp in files]
