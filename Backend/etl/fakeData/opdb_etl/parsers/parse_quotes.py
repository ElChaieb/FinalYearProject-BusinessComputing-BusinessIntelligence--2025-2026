# opdb_etl/parsers/parse_quotes.py
"""
Loads quotes from the DEVIS sheet into the operational DB quotes table.

One row per quote_id_crm — if multiple lines share the same
Quot_OrderQuoteID, only the FIRST occurrence is kept (drop_duplicates).

User resolution:
  1. User_UserId (crm_user_id) → users.user_id
  2. Fallback: (User_LastName, User_FirstName) name match within agency

oppo_id FK validated against opportunities before insert.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from utils.logger import logger

UNDETERMINED = "Undetermined"


def parse_and_load_quotes(
    df_devis: pd.DataFrame,
    source: str,
    cur,
) -> dict:
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    if "Quot_OrderQuoteID" not in df_devis.columns:
        logger.warning("Quot_OrderQuoteID not found in DEVIS — skipping quotes.")
        return report

    # ── One row per quote_id_crm — keep first occurrence only ────────────
    df = (
        df_devis
        .dropna(subset=["Quot_OrderQuoteID"])
        .drop_duplicates(subset=["Quot_OrderQuoteID"], keep="first")
        .copy()
    )
    df["Quot_CreatedDate"] = pd.to_datetime(
        df.get("Quot_CreatedDate"), dayfirst=True, errors="coerce"
    )
    report["total"] = len(df)

    has_user_id = "User_UserId" in df.columns
    if not has_user_id:
        logger.warning(
            "DEVIS missing 'User_UserId' — resolving quote users by name."
        )

    user_cache: dict = {}
    oppo_cache: dict = {}

    for _, row in df.iterrows():
        quote_id_crm = str(row["Quot_OrderQuoteID"]).strip()
        ar_ref       = _clean_raw(row.get("AR_Ref"))

        # ── Skip if already in DB ─────────────────────────────────────────
        cur.execute(
            "SELECT 1 FROM quotes WHERE quote_id_crm = ?", (quote_id_crm,)
        )
        if cur.fetchone():
            report["skipped"] += 1
            continue

        # ── Validate ar_ref exists in vehicles ────────────────────────────
        if ar_ref:
            cur.execute("SELECT 1 FROM vehicles WHERE ar_ref = ?", (ar_ref,))
            if not cur.fetchone():
                logger.warning(
                    f"  quote {quote_id_crm}: ar_ref '{ar_ref}' not in vehicles "
                    f"— inserting with ar_ref=NULL"
                )
                ar_ref = None

        # ── Validate oppo_id FK ───────────────────────────────────────────
        raw_oppo = row.get("Quot_opportunityid")
        oppo_id  = str(raw_oppo).strip() if pd.notna(raw_oppo) else None
        if oppo_id:
            if oppo_id not in oppo_cache:
                cur.execute(
                    "SELECT 1 FROM opportunities WHERE oppo_id = ?", (oppo_id,)
                )
                oppo_cache[oppo_id] = cur.fetchone() is not None
            if not oppo_cache[oppo_id]:
                logger.warning(
                    f"  quote {quote_id_crm}: oppo_id {oppo_id} not found "
                    f"in opportunities — inserting with oppo_id=NULL"
                )
                oppo_id = None

        # ── Resolve user_id ───────────────────────────────────────────────
        user_id    = _resolve_user(row, has_user_id, cur, user_cache, quote_id_crm)
        created_by = user_id

        # ── Other fields ──────────────────────────────────────────────────
        ar_design    = _clean(row.get("AR_Design"))  or UNDETERMINED
        brand        = _clean(row.get("Marque"))     or UNDETERMINED
        model        = _clean(row.get("Modèle"))     or UNDETERMINED
        created_date = _safe_date(row.get("Quot_CreatedDate"))

        cur.execute(
            """
            INSERT INTO quotes (
                quote_id_crm, oppo_id, ar_ref, ar_design,
                brand, model, created_date, created_by,
                user_id, source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                quote_id_crm, oppo_id, ar_ref, ar_design,
                brand, model, created_date, created_by,
                user_id, source,
            ),
        )
        report["inserted"] += 1

    logger.info(
        f"Quotes — inserted: {report['inserted']}, "
        f"skipped: {report['skipped']}, errors: {report['errors']}"
    )
    return report


def _resolve_user(row, has_user_id, cur, cache, quote_id_crm):
    if has_user_id:
        crm_uid   = _safe_int(row.get("User_UserId"))
        cache_key = ("id", crm_uid)
        if cache_key not in cache:
            if crm_uid is None:
                cache[cache_key] = None
            else:
                cur.execute(
                    "SELECT user_id FROM users WHERE crm_user_id = ?", (crm_uid,)
                )
                r = cur.fetchone()
                cache[cache_key] = r[0] if r else None
                if cache[cache_key] is None:
                    logger.warning(
                        f"  quote {quote_id_crm}: crm_user_id {crm_uid} not in users"
                    )
        return cache[cache_key]
    else:
        ln = _clean(row.get("User_LastName"))
        fn = _clean(row.get("User_FirstName"))
        cache_key = ("name", ln, fn)
        if cache_key not in cache:
            cur.execute(
                """
                SELECT user_id FROM users
                WHERE UPPER(last_name)  = UPPER(?)
                  AND UPPER(first_name) = UPPER(?)
                """,
                (ln or "", fn or ""),
            )
            r = cur.fetchone()
            cache[cache_key] = r[0] if r else None
            if cache[cache_key] is None:
                logger.warning(
                    f"  quote {quote_id_crm}: user '{fn} {ln}' not found in users"
                )
        return cache[cache_key]


def _safe_int(val):
    try:
        return int(val) if pd.notna(val) else None
    except (ValueError, TypeError):
        return None


def _safe_date(val):
    try:
        ts = pd.Timestamp(val)
        return None if pd.isna(ts) else ts.to_pydatetime()
    except Exception:
        return None


def _clean(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().title() or None


def _clean_raw(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip() or None