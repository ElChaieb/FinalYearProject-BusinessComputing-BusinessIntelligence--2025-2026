# etl/pipeline/parsers/parse_quotes.py
"""
Loads quotes from the DEVIS sheet into fact_quotes.

Per-row user resolution:
  1. User_UserId present  → look up dim_user.user_id by crm_user_id
  2. User_UserId absent   → fall back to (User_LastName, User_FirstName, agency_id)
                            using resolve_user_id_by_name() from parse_users

oppo_id is a FK to fact_opportunities — if the linked opportunity doesn't
exist yet (shouldn't happen if OP is processed first, but just in case),
the quote row is skipped with a warning rather than failing the whole file.
"""
import pandas as pd
from etl.pipeline.parsers.parse_date import get_or_create_date
from etl.pipeline.parsers.parse_users import resolve_user_id_by_name
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_quotes(
    df_devis: pd.DataFrame, agency_id: int, source: str
) -> dict:
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    df = df_devis.dropna(subset=["Quot_OrderQuoteID"]).copy()
    df["Quot_CreatedDate"] = pd.to_datetime(
        df.get("Quot_CreatedDate"), dayfirst=True, errors="coerce"
    )
    report["total"] = len(df)

    has_user_id = "User_UserId" in df.columns
    if not has_user_id:
        logger.warning(
            "DEVIS missing 'User_UserId' — resolving quote users by "
            "(last_name, first_name, agency_id) for this file."
        )

    # Per-row caches to avoid repeated DB hits
    user_cache:    dict[tuple, int | None] = {}  # key: crm_id or (ln, fn)
    vehicle_cache: dict[str, int | None]   = {}
    oppo_cache:    dict[str, bool]         = {}   # oppo_id → exists in DB

    conn = get_connection()
    cur  = conn.cursor()
    try:
        for _, row in df.iterrows():
            quote_id_crm = str(row["Quot_OrderQuoteID"]).strip()
            ar_ref       = _clean(row.get("AR_Ref"))

            # ── Resolve vehicle_id ────────────────────────────────────────
            if ar_ref not in vehicle_cache:
                cur.execute(
                    "SELECT vehicle_id FROM dim_vehicle WHERE ar_ref = %s", (ar_ref,)
                )
                r = cur.fetchone()
                vehicle_cache[ar_ref] = r[0] if r else None
            vehicle_id = vehicle_cache[ar_ref]

            # ── Skip duplicate (quote_id_crm, vehicle_id) ─────────────────
            cur.execute(
                "SELECT 1 FROM fact_quotes WHERE quote_id_crm = %s AND vehicle_id = %s",
                (quote_id_crm, vehicle_id),
            )
            if cur.fetchone():
                report["skipped"] += 1
                continue

            # ── Validate oppo_id FK ───────────────────────────────────────
            raw_oppo = row.get("Quot_opportunityid")
            oppo_id  = str(raw_oppo).strip() if raw_oppo is not None and not (
                isinstance(raw_oppo, float) and pd.isna(raw_oppo)
            ) else None

            if oppo_id:
                if oppo_id not in oppo_cache:
                    cur.execute(
                        "SELECT 1 FROM fact_opportunities WHERE oppo_id = %s", (oppo_id,)
                    )
                    oppo_cache[oppo_id] = cur.fetchone() is not None
                if not oppo_cache[oppo_id]:
                    logger.warning(
                        f"  quote {quote_id_crm}: oppo_id {oppo_id} not found in "
                        f"fact_opportunities — inserting quote with oppo_id=NULL"
                    )
                    oppo_id = None

            # ── Resolve user_id ───────────────────────────────────────────
            user_id = _resolve_user(
                row, has_user_id, agency_id, cur, user_cache, quote_id_crm
            )

            # ── Resolve date_id ───────────────────────────────────────────
            date_id = get_or_create_date(row.get("Quot_CreatedDate"), cur)

            cur.execute(
                """
                INSERT INTO fact_quotes
                    (quote_id_crm, date_id, user_id, agency_id, vehicle_id,
                     oppo_id, converted_to_sale, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (quote_id_crm, date_id, user_id, agency_id, vehicle_id,
                 oppo_id, False, source),
            )
            report["inserted"] += 1

        conn.commit()
        logger.info(
            f"Quotes — inserted: {report['inserted']}, "
            f"skipped: {report['skipped']}, errors: {report['errors']}"
        )
    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading quotes: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report


def _resolve_user(row, has_user_id, agency_id, cur, cache, quote_id_crm):
    """Resolve user_id with crm_user_id first, name fallback second."""
    if has_user_id:
        crm_uid = _safe_int(row.get("User_UserId"))
        cache_key = ("id", crm_uid)
        if cache_key not in cache:
            if crm_uid is None:
                cache[cache_key] = None
            else:
                cur.execute(
                    "SELECT user_id FROM dim_user WHERE crm_user_id = %s", (crm_uid,)
                )
                r = cur.fetchone()
                cache[cache_key] = r[0] if r else None
                if cache[cache_key] is None:
                    logger.warning(
                        f"  quote {quote_id_crm}: crm_user_id {crm_uid} not in dim_user"
                    )
        return cache[cache_key]
    else:
        # Fallback: match by name within this agency
        ln = _clean(row.get("User_LastName"))
        fn = _clean(row.get("User_FirstName"))
        cache_key = ("name", ln, fn)
        if cache_key not in cache:
            cache[cache_key] = resolve_user_id_by_name(cur, ln, fn, agency_id)
            if cache[cache_key] is None:
                logger.warning(
                    f"  quote {quote_id_crm}: user '{fn} {ln}' not found "
                    f"in dim_user for agency {agency_id}"
                )
        return cache[cache_key]


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
    return str(val).strip() or None
