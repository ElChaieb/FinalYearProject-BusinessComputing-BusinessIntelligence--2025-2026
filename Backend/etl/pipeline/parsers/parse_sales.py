# etl/pipeline/parsers/parse_sales.py
"""
Loads pre-generated sales from the SALES sheet into fact_sales.

The SALES sheet is produced upstream by generate_fake_sales.py and attached
to the Excel file before ETL ingestion. This parser must run AFTER
parse_and_load_quotes() commits, since it looks up client_id and agency_name
from fact_opportunities.

Column mapping (SALES sheet → fact_sales):
    quote_id    → fact_sales.quote_id    (PK — ON CONFLICT DO NOTHING)
    oppo_id     → fact_sales.oppo_id
    ar_ref      → fact_sales.ar_ref
    user_id     → fact_sales.user_id
    sale_date   → fact_sales.sale_date
    quantity    → fact_sales.quantity
    final_price → fact_sales.final_price
    client_id   → looked up from fact_opportunities (no source equivalent)
    agency_name → looked up from fact_opportunities (no source equivalent)

Business rules:
    - Parser must run after quotes are committed because it looks up
        `client_id` and `agency_name` from `fact_opportunities`.
    - Rows with a non-numeric or missing `quote_id` are skipped.
    - Insertion uses `ON CONFLICT (quote_id) DO NOTHING` to avoid duplicates.
    - If `quantity` is missing or invalid, it defaults to 1.
    - `client_id` and `agency_name` are retrieved from the linked opportunity
        when `oppo_id` is present.
"""
import pandas as pd

from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_sales(df_sales: pd.DataFrame | None) -> dict:
    # Main loader for SALES sheet; looks up related opportunity info and
    # inserts into `fact_sales` with conflict-handling.
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    if df_sales is None or df_sales.empty:
        logger.warning("No SALES sheet — fact_sales will not be populated.")
        return report

    conn = get_connection()
    cur  = conn.cursor()
    try:
        for _, row in df_sales.iterrows():
            quote_id    = _safe_int(row.get("quote_id"))
            oppo_id     = _safe_int(row.get("oppo_id"))
            ar_ref      = _clean(row.get("ar_ref"))
            user_id     = _safe_int(row.get("user_id"))
            sale_date   = row.get("sale_date") or None
            quantity    = _safe_int(row.get("quantity")) or 1
            final_price = row.get("final_price") or None

            report["total"] += 1

            if quote_id is None:
                report["skipped"] += 1
                continue

            # Pull client_id + agency_name from the linked opportunity
            client_id   = None
            agency_name = None
            if oppo_id is not None:
                cur.execute(
                    "SELECT client_id, agency_name FROM fact_opportunities WHERE oppo_id = %s",
                    (oppo_id,),
                )
                r = cur.fetchone()
                if r:
                    client_id, agency_name = r[0], r[1]

            cur.execute(
                """
                INSERT INTO fact_sales
                    (quote_id, oppo_id, user_id, client_id, ar_ref,
                     agency_name, sale_date, quantity, final_price)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (quote_id) DO NOTHING
                """,
                (
                    quote_id, oppo_id, user_id, client_id, ar_ref,
                    agency_name, sale_date, quantity, final_price,
                ),
            )
            if cur.rowcount:
                report["inserted"] += 1
            else:
                report["skipped"] += 1

        conn.commit()
        logger.info(
            f"Sales — inserted: {report['inserted']}, "
            f"skipped: {report['skipped']}, errors: {report['errors']}"
        )

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading sales: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_int(val):
    try:
        return int(val) if val is not None and not (
            isinstance(val, float) and pd.isna(val)
        ) else None
    except (ValueError, TypeError):
        return None


def _clean(val) -> str | None:
    # Normalize simple string values: strip and return None for empty.
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip() or None
