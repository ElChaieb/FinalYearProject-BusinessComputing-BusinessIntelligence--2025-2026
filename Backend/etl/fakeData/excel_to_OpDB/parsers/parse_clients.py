# opdb_etl/parsers/parse_clients.py
# ============================================================
# Extracts unique clients from OP sheet (Comp_Name column)
# and inserts into the operational DB clients table.
#
# Dedup key: UPPER(TRIM(full_name)) + LOWER(TRIM(email))
# If email absent: UPPER(TRIM(full_name)) only.
#
# Returns a client_id per row — used by parse_opportunities
# to populate the client_id FK.
# ============================================================

import pandas as pd
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.logger import logger

UNDETERMINED = "Undetermined"


def get_or_create_client(
    cur,
    full_name,
    email,
    city,
) -> int | None:
    """
    Look up or insert a client row.
    Returns client_id or None if full_name is empty.
    Uses the caller's cursor (shared transaction).
    """
    name_clean  = _normalize_name(full_name)
    email_clean = _normalize_email(email)
    city_clean  = _normalize_city(city) or UNDETERMINED

    if not name_clean:
        return None

    # ── Lookup ────────────────────────────────────────────────
    if email_clean and email_clean != UNDETERMINED:
        cur.execute(
            """
            SELECT client_id FROM clients
            WHERE UPPER(LTRIM(RTRIM(full_name))) = ?
              AND LOWER(LTRIM(RTRIM(email)))     = ?
            """,
            (name_clean, email_clean),
        )
    else:
        cur.execute(
            """
            SELECT client_id FROM clients
            WHERE UPPER(LTRIM(RTRIM(full_name))) = ?
              AND email IS NULL
            """,
            (name_clean,),
        )
    row = cur.fetchone()
    if row:
        return row[0]

    # ── Insert ────────────────────────────────────────────────
    # Store email as NULL when absent (dedup handles it correctly)
    email_to_store = email_clean if (email_clean and email_clean != UNDETERMINED) else None

    cur.execute(
        """
        INSERT INTO clients (full_name, email, city)
        OUTPUT INSERTED.client_id
        VALUES (?, ?, ?)
        """,
        (name_clean.title(), email_to_store, city_clean),
    )
    row = cur.fetchone()
    return row[0] if row else None


# ── Helpers ───────────────────────────────────────────────────
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
