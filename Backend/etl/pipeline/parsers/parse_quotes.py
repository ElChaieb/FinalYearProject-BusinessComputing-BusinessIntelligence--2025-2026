# etl/pipeline/parsers/parse_quotes.py
"""
Loads quotes from the DEVIS sheet into fact_quotes, then generates
fake sales for 10–23% of the inserted quotes.

deleted semantics (DWH business rule — NOT a CRM source value):
  deleted=TRUE  → quote did not lead to a sale
  deleted=FALSE → quote led to a sale  ("won")

All quotes are inserted with deleted=TRUE. After fake sales are inserted,
the winning quote_ids are flipped to deleted=FALSE in the same transaction.
Then mark_won_opportunities() runs after commit to propagate the win upward.

ID strategy:
  - quote_id : direct from Quot_OrderQuoteID
  - oppo_id  : direct from Quot_opportunityid (FK, nullable)
  - user_id  : direct from User_UserId when present;
               fallback: (User_LastName, User_FirstName) → dim_user

Deduplication: if multiple rows share Quot_OrderQuoteID, only the FIRST is kept.

Faked columns (no source equivalent):
  price → copied from dim_vehicle.base_price for the quoted ar_ref (NULL if unknown)

Column mapping (DEVIS → DWH):
  Quot_opportunityid → fact_quotes.oppo_id      (FK, nullable)
  Quot_OrderQuoteID  → fact_quotes.quote_id      (PK)
  AR_Ref             → fact_quotes.ar_ref        (FK → dim_vehicle)
  Quot_CreatedDate   → fact_quotes.created_date
  User_UserId        → fact_quotes.user_id       (preferred)
  User_LastName      → fallback name resolution
  User_FirstName     → fallback name resolution
  agency_name        → inherited from linked fact_opportunities row
"""
import random
from datetime import date, timedelta

import pandas as pd

from etl.pipeline.parsers.parse_users import resolve_user_id_by_name
from etl.pipeline.parsers.parse_opportunities import mark_won_opportunities
from etl.utils.db import get_connection
from etl.utils.logger import logger

FAKE_SALE_RATE_MIN = 0.10
FAKE_SALE_RATE_MAX = 0.23


def parse_and_load_quotes(df_devis: pd.DataFrame) -> dict:
    report = {
        "total": 0, "inserted": 0, "skipped": 0, "errors": 0,
        "sales_generated": 0,
    }

    if "Quot_OrderQuoteID" not in df_devis.columns:
        logger.warning("DEVIS missing 'Quot_OrderQuoteID' — skipping quotes.")
        return report

    df = (
        df_devis
        .dropna(subset=["Quot_OrderQuoteID"])
        .drop_duplicates(subset=["Quot_OrderQuoteID"], keep="first")
        .copy()
    )
    if "Quot_CreatedDate" in df.columns:
        df["Quot_CreatedDate"] = pd.to_datetime(
            df["Quot_CreatedDate"], dayfirst=True, errors="coerce"
        )
    else:
        df["Quot_CreatedDate"] = pd.NaT

    report["total"] = len(df)
    has_user_id = "User_UserId" in df.columns
    if not has_user_id:
        logger.warning(
            "DEVIS missing 'User_UserId' — resolving quote users by "
            "(last_name, first_name)."
        )

    user_cache:    dict = {}
    vehicle_cache: dict = {}
    oppo_cache:    dict = {}

    conn = get_connection()
    cur  = conn.cursor()
    try:
        newly_inserted: list[dict] = []

        for _, row in df.iterrows():
            quote_id = _safe_int(row["Quot_OrderQuoteID"])
            if quote_id is None:
                report["skipped"] += 1
                continue

            cur.execute("SELECT 1 FROM fact_quotes WHERE quote_id = %s", (quote_id,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            # ── ar_ref + price ────────────────────────────────────────────
            ar_ref = _clean(row.get("AR_Ref"))
            if ar_ref and ar_ref not in vehicle_cache:
                cur.execute(
                    "SELECT base_price FROM dim_vehicle WHERE ar_ref = %s", (ar_ref,)
                )
                r = cur.fetchone()
                vehicle_cache[ar_ref] = r[0] if r else None
            price = vehicle_cache.get(ar_ref) if ar_ref else None

            # ── oppo_id FK ────────────────────────────────────────────────
            oppo_id = _safe_int(row.get("Quot_opportunityid"))
            if oppo_id is not None:
                if oppo_id not in oppo_cache:
                    cur.execute(
                        "SELECT 1 FROM fact_opportunities WHERE oppo_id = %s", (oppo_id,)
                    )
                    oppo_cache[oppo_id] = cur.fetchone() is not None
                if not oppo_cache[oppo_id]:
                    logger.warning(
                        f"  quote {quote_id}: oppo_id {oppo_id} not found "
                        "in fact_opportunities — inserting with oppo_id=NULL"
                    )
                    oppo_id = None

            # ── user_id ───────────────────────────────────────────────────
            user_id = _resolve_user(row, has_user_id, cur, user_cache, quote_id)

            # ── agency_name from linked opportunity ───────────────────────
            agency_name = None
            if oppo_id is not None:
                cur.execute(
                    "SELECT agency_name FROM fact_opportunities WHERE oppo_id = %s",
                    (oppo_id,),
                )
                r = cur.fetchone()
                agency_name = r[0] if r else None

            # ── date ──────────────────────────────────────────────────────
            raw_date     = row.get("Quot_CreatedDate")
            created_date = (
                raw_date.date()
                if pd.notna(raw_date) and hasattr(raw_date, "date")
                else None
            )

            # ── Insert with deleted=TRUE (default — no sale yet) ──────────
            cur.execute(
                """
                INSERT INTO fact_quotes
                    (quote_id, oppo_id, ar_ref, user_id, client_id,
                     agency_name, price, created_date, deleted)
                VALUES (%s, %s, %s, %s,
                        (SELECT client_id FROM fact_opportunities
                         WHERE oppo_id = %s LIMIT 1),
                        %s, %s, %s, TRUE)
                """,
                (
                    quote_id, oppo_id, ar_ref, user_id,
                    oppo_id,
                    agency_name, price, created_date,
                ),
            )
            report["inserted"] += 1
            newly_inserted.append({
                "quote_id":     quote_id,
                "oppo_id":      oppo_id,
                "ar_ref":       ar_ref,
                "user_id":      user_id,
                "agency_name":  agency_name,
                "price":        price,
                "created_date": created_date,
            })

        # ── Fake sales + flip won quotes to deleted=FALSE ─────────────────
        won_quote_ids: list[int] = []
        if newly_inserted:
            rate   = random.uniform(FAKE_SALE_RATE_MIN, FAKE_SALE_RATE_MAX)
            k      = max(1, round(len(newly_inserted) * rate))
            chosen = random.sample(newly_inserted, min(k, len(newly_inserted)))
            today  = date.today()

            for q in chosen:
                client_id = None
                if q["oppo_id"]:
                    cur.execute(
                        "SELECT client_id FROM fact_opportunities WHERE oppo_id = %s",
                        (q["oppo_id"],),
                    )
                    r = cur.fetchone()
                    client_id = r[0] if r else None

                sale_date = _random_date_after(q["created_date"], today)
                cur.execute(
                    """
                    INSERT INTO fact_sales
                        (quote_id, oppo_id, user_id, client_id, ar_ref,
                         agency_name, sale_date, quantity, final_price)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (quote_id) DO NOTHING
                    """,
                    (
                        q["quote_id"], q["oppo_id"], q["user_id"],
                        client_id, q["ar_ref"], q["agency_name"],
                        sale_date, 1, q["price"],
                    ),
                )
                won_quote_ids.append(q["quote_id"])

            # ── quote won → deleted=FALSE (same transaction) ──────────────
            if won_quote_ids:
                cur.execute(
                    "UPDATE fact_quotes SET deleted = FALSE WHERE quote_id = ANY(%s)",
                    (won_quote_ids,),
                )
                logger.info(f"Quotes marked won (deleted=FALSE): {len(won_quote_ids)}")

            report["sales_generated"] = len(chosen)
            logger.info(
                f"Fake sales generated: {len(chosen)} "
                f"({len(chosen) / len(newly_inserted) * 100:.1f}% of new quotes)"
            )

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

    # ── opportunity won → deleted=FALSE ───────────────────────────────────
    # Runs after commit so the new quote rows are visible to the UPDATE.
    if report["inserted"] > 0:
        mark_won_opportunities()

    return report


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_user(row, has_user_id: bool, cur, cache: dict, quote_id: int):
    if has_user_id:
        uid       = _safe_int(row.get("User_UserId"))
        cache_key = ("id", uid)
        if cache_key not in cache:
            if uid is None:
                cache[cache_key] = None
            else:
                cur.execute("SELECT 1 FROM dim_user WHERE user_id = %s", (uid,))
                cache[cache_key] = uid if cur.fetchone() else None
                if cache[cache_key] is None:
                    logger.warning(
                        f"  quote {quote_id}: user_id {uid} not found in dim_user"
                    )
        return cache[cache_key]
    else:
        ln  = _clean(row.get("User_LastName"))
        fn  = _clean(row.get("User_FirstName"))
        cache_key = ("name", ln, fn)
        if cache_key not in cache:
            cache[cache_key] = resolve_user_id_by_name(cur, ln, fn, agency_name="")
            if cache[cache_key] is None:
                logger.warning(
                    f"  quote {quote_id}: user '{fn} {ln}' not found in dim_user"
                )
        return cache[cache_key]


def _random_date_after(start: date | None, end: date) -> date:
    if start is None or start >= end:
        return end
    delta = (end - start).days
    return start + timedelta(days=random.randint(1, delta))


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
