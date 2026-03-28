# etl/pipeline/parsers/parse_clients.py
"""
Extracts clients from the OP sheet and loads them into dim_client.

Deduplication key: (UPPER(TRIM(full_name)), LOWER(TRIM(email)))
  - If email is NULL, dedup is by name only (riskier but unavoidable —
    Emai_EmailAddress is present in only ~0.7% of rows in this dataset)
  - ETL normalizes name (UPPER TRIM) and email (LOWER TRIM) before lookup

get_or_create_client() is called per opportunity row from parse_opportunities.
It uses the cursor passed in (no new connection) so it participates in the
same transaction as the opportunity insert.
"""
import pandas as pd
from etl.utils.logger import logger


def get_or_create_client(
    cur,
    full_name,
    email,
    city,
    source: str,
) -> int | None:
    """
    Look up or insert a client. Returns client_id or None if name is empty.
    Uses the caller's cursor — no separate connection/transaction.
    """
    name_clean  = _normalize_name(full_name)
    email_clean = _normalize_email(email)
    city_clean  = _normalize_city(city)

    if not name_clean:
        return None

    # ── Lookup ────────────────────────────────────────────────────────────────
    if email_clean:
        cur.execute(
            """
            SELECT client_id FROM dim_client
            WHERE UPPER(TRIM(full_name)) = %s
              AND LOWER(TRIM(email))     = %s
            LIMIT 1
            """,
            (name_clean, email_clean),
        )
    else:
        cur.execute(
            """
            SELECT client_id FROM dim_client
            WHERE UPPER(TRIM(full_name)) = %s
              AND email IS NULL
            LIMIT 1
            """,
            (name_clean,),
        )
    row = cur.fetchone()
    if row:
        return row[0]

    # ── Insert ────────────────────────────────────────────────────────────────
    cur.execute(
        """
        INSERT INTO dim_client (full_name, email, city, source)
        VALUES (%s, %s, %s, %s)
        RETURNING client_id
        """,
        (name_clean.title(), email_clean, city_clean, source),
    )
    client_id = cur.fetchone()[0]
    logger.debug(f"  New client inserted: '{name_clean}' (id={client_id})")
    return client_id


# ── Helpers ───────────────────────────────────────────────────────────────────
def _normalize_name(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    cleaned = str(val).strip().upper()
    return cleaned or None


def _normalize_email(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    cleaned = str(val).strip().lower()
    return cleaned or None


def _normalize_city(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    cleaned = str(val).strip().title()
    return cleaned or None
