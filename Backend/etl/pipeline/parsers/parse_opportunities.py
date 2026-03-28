# etl/pipeline/parsers/parse_opportunities.py
"""
Loads opportunities from the OP sheet into fact_opportunities.

Per-row logic:
  - user_id  resolved via crm_user_id (Oppo_AssignedUserId) — required column so always present
  - client_id resolved via get_or_create_client() — extracted from Comp_Name / Emai_EmailAddress
  - Rows with a NULL or unparseable oppo_id are skipped with a warning (not rejected)
  - Rows already in DB are skipped (idempotent)
"""
import pandas as pd
from etl.pipeline.parsers.parse_date import get_or_create_date
from etl.pipeline.parsers.parse_clients import get_or_create_client
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_opportunities(
    df_op: pd.DataFrame, agency_id: int, source: str
) -> dict:
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

    # Pre-build a crm_user_id → user_id lookup for this file
    # (avoids one DB round-trip per row for the common case)
    user_cache: dict[int, int | None] = {}

    conn = get_connection()
    cur  = conn.cursor()
    try:
        for _, row in df.iterrows():
            oppo_id = str(row["Oppo_OpportunityId"]).strip()

            # ── Skip if already loaded ────────────────────────────────────
            cur.execute(
                "SELECT 1 FROM fact_opportunities WHERE oppo_id = %s", (oppo_id,)
            )
            if cur.fetchone():
                report["skipped"] += 1
                continue

            # ── Resolve date_id ───────────────────────────────────────────
            date_id = get_or_create_date(row.get("Oppo_CreatedDate"), cur)

            # ── Resolve user_id (per-row, cached) ─────────────────────────
            crm_uid = _safe_int(row.get("Oppo_AssignedUserId"))
            if crm_uid not in user_cache:
                cur.execute(
                    "SELECT user_id FROM dim_user WHERE crm_user_id = %s", (crm_uid,)
                )
                r = cur.fetchone()
                user_cache[crm_uid] = r[0] if r else None
                if user_cache[crm_uid] is None:
                    logger.warning(
                        f"  oppo {oppo_id}: crm_user_id {crm_uid} not found in dim_user"
                    )
            user_id = user_cache[crm_uid]

            # ── Resolve client_id ─────────────────────────────────────────
            client_id = get_or_create_client(
                cur=cur,
                full_name=row.get("Comp_Name"),
                email=row.get("Emai_EmailAddress"),
                city=row.get("Addr_City"),
                source=source,
            )

            # ── Optional fields ───────────────────────────────────────────
            channel = _clean(row.get("Chan_Description"))
            city    = _clean(row.get("Addr_City"))
            deleted = bool(row.get("Oppo_Deleted", False))

            cur.execute(
                """
                INSERT INTO fact_opportunities
                    (oppo_id, date_id, user_id, agency_id, client_id,
                     channel, city, deleted, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (oppo_id, date_id, user_id, agency_id, client_id,
                 channel, city, deleted, source),
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
