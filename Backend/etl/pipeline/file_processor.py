# etl/pipeline/file_processor.py
import os
import re
import pandas as pd
from etl.pipeline.parsers.parse_agency import get_or_create_agency
from etl.pipeline.parsers.parse_users import parse_and_load_users
from etl.pipeline.parsers.parse_vehicles import parse_and_load_vehicles
from etl.pipeline.parsers.parse_opportunities import parse_and_load_opportunities
from etl.pipeline.parsers.parse_quotes import parse_and_load_quotes
from etl.utils.logger import logger

OP_SHEET    = "OP"
DEVIS_SHEET = "DEVIS"


def extract_agency_name(filepath: str) -> str:
    """Extract agency name from filename e.g. 'CRM AYDA-GABES.xlsx' → 'Gabes'"""
    basename = os.path.basename(filepath).replace(".xlsx", "")
    match = re.search(r'-(.+)$', basename)
    return match.group(1).strip().title() if match else "Unknown"


def process_file(filepath: str) -> dict:
    """
    Main entry point. Processes a single xlsx file and loads
    all data into the PostgreSQL Data Warehouse.

    Returns a full quality report.
    """
    filename = os.path.basename(filepath)
    logger.info(f"=== Processing file: {filename} ===")

    report = {
        "file": filename,
        "agency": None,
        "users":         {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "vehicles":      {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "opportunities": {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "quotes":        {"total": 0, "inserted": 0, "skipped": 0, "errors": 0},
        "status": "success",
        "error": None
    }

    try:
        # ── Load sheets ──────────────────────────────────────────
        df_op = pd.read_excel(filepath, sheet_name=OP_SHEET, engine="calamine")
        logger.info(f"  OP sheet loaded: {len(df_op)} rows")

        df_devis = pd.read_excel(filepath, sheet_name=DEVIS_SHEET, engine="calamine")
        logger.info(f"  DEVIS sheet loaded: {len(df_devis)} rows")

        # ── Agency ───────────────────────────────────────────────
        agency_name = extract_agency_name(filepath)
        agency_id   = get_or_create_agency(agency_name)
        report["agency"] = agency_name
        logger.info(f"  Agency: {agency_name} (id={agency_id})")

        # Source label for fact tables
        source = agency_name.lower().replace(" ", "_")

        # ── Users ────────────────────────────────────────────────
        report["users"] = parse_and_load_users(df_op, agency_id)

        # ── Vehicles ─────────────────────────────────────────────
        report["vehicles"] = parse_and_load_vehicles(df_devis)

        # ── Opportunities ────────────────────────────────────────
        report["opportunities"] = parse_and_load_opportunities(df_op, agency_id, source)

        # ── Quotes ───────────────────────────────────────────────
        report["quotes"] = parse_and_load_quotes(df_devis, agency_id, source)

        logger.info(f"=== Done: {filename} ===")

    except Exception as e:
        report["status"] = "failed"
        report["error"]  = str(e)
        logger.error(f"Pipeline failed for {filename}: {e}")

    return report


def process_multiple_files(filepaths: list) -> list:
    """Process a list of xlsx files and return a list of reports."""
    return [process_file(fp) for fp in filepaths]