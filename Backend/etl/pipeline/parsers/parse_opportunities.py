# etl/pipeline/parsers/parse_opportunities.py
"""
Loads opportunities from the OP sheet into fact_opportunities.

deleted semantics (DWH business rule — NOT the CRM source value):
    deleted=TRUE  → opportunity did not lead to any quote
    deleted=FALSE → opportunity led to at least one quote  ("won")

All opportunities are inserted with deleted=TRUE. After parse_and_load_quotes()
commits, mark_won_opportunities() flips deleted=FALSE on every opportunity
that now has at least one linked quote in fact_quotes.

Column mapping:
    Oppo_OpportunityId  → fact_opportunities.oppo_id
    Chan_Description    → fact_opportunities.agency_name
    Oppo_CreatedDate    → fact_opportunities.created_date
    Oppo_AssignedUserId → fact_opportunities.user_id        (FK → dim_user, direct)
    Comp_Name           → dim_client.full_name
    Addr_City           → dim_client.city
    Emai_EmailAddress   → dim_client.email
    comp_reference      → fact_opportunities.client_reference
    (Oppo_Deleted intentionally ignored — deleted is derived, not sourced)

Business rules:
    - Only rows with a valid numeric `Oppo_OpportunityId` are processed.
    - Duplicate opportunity IDs are ignored (first occurrence kept).
    - Every new opportunity is inserted with `deleted=TRUE` by default.
    - Client rows are resolved/created via `get_or_create_client()` using the
        same DB cursor so client creation participates in the same transaction.
    - Dates are parsed with day-first convention; invalid dates become NULL.
"""
import pandas as pd
from etl.pipeline.parsers.parse_clients import get_or_create_client
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_opportunities(df_op: pd.DataFrame) -> dict:
    # Parse OP sheet, deduplicate by Oppo_OpportunityId, resolve client/user
    # and insert new rows into `fact_opportunities` with deleted=TRUE.
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    df = (
        df_op
        .dropna(subset=["Oppo_OpportunityId"])
        .drop_duplicates(subset=["Oppo_OpportunityId"])
        .copy()
    )
    df["Oppo_CreatedDate"] = pd.to_datetime(
        df["Oppo_CreatedDate"], dayfirst=True, errors="coerce"
    )
    report["total"] = len(df)

    conn = get_connection()
    cur  = conn.cursor()
    try:
        for _, row in df.iterrows():
            oppo_id = _safe_int(row["Oppo_OpportunityId"])
            if oppo_id is None:
                report["skipped"] += 1
                continue

            cur.execute(
                "SELECT 1 FROM fact_opportunities WHERE oppo_id = %s", (oppo_id,)
            )
            if cur.fetchone():
                report["skipped"] += 1
                continue

            user_id = _safe_int(row.get("Oppo_AssignedUserId"))

            client_id = get_or_create_client(
                cur=cur,
                full_name=row.get("Comp_Name"),
                email=row.get("Emai_EmailAddress"),
                city=row.get("Addr_City"),
            )

            agency_name      = _clean(row.get("Chan_Description"))
            client_reference = _clean(row.get("comp_reference"))
            created_date     = row.get("Oppo_CreatedDate")
            created_date_val = (
                created_date.date()
                if pd.notna(created_date) and hasattr(created_date, "date")
                else None
            )

            cur.execute(
                """
                INSERT INTO fact_opportunities
                    (oppo_id, user_id, client_id, agency_name,
                     created_date, client_reference, deleted)
                VALUES (%s, %s, %s, %s, %s, %s, TRUE)
                """,
                (oppo_id, user_id, client_id, agency_name,
                 created_date_val, client_reference),
            )
            report["inserted"] += 1

        conn.commit()
        logger.info(
            f"Opportunities — inserted: {report['inserted']}, "
            f"skipped: {report['skipped']}, errors: {report['errors']}"
        )
    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading opportunities: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report


def mark_won_opportunities() -> int:
    # Business rule: mark opportunities as won (deleted=FALSE) when at least
    # one quote exists in `fact_quotes`. This runs after quotes commit.
    """
    Flip deleted=FALSE on every opportunity that has at least one linked quote.
    Called from parse_quotes after its transaction commits so the new rows
    are visible.
    Returns the number of rows updated.
    """
    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE fact_opportunities
            SET    deleted = FALSE
            WHERE  deleted = TRUE
              AND  oppo_id IN (
                  SELECT DISTINCT oppo_id
                  FROM   fact_quotes
                  WHERE  oppo_id IS NOT NULL
              )
            """
        )
        updated = cur.rowcount
        conn.commit()
        if updated:
            logger.info(f"Opportunities marked won (deleted=FALSE): {updated}")
        return updated
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in mark_won_opportunities: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def _safe_int(val):
    try:
        return int(val) if val is not None and not (
            isinstance(val, float) and pd.isna(val)
        ) else None
    except (ValueError, TypeError):
        return None


def _clean(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().title() or None
