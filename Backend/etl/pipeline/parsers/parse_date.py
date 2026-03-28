# etl/pipeline/parsers/parse_date.py
"""
Resolves dim_date entries.

IMPORTANT CHANGE: get_or_create_date() now accepts the caller's cursor
instead of opening its own DB connection. This fixes the critical
performance issue where 10,000+ connections were opened per file
(one per row in opportunities + quotes).

The caller is responsible for commit — this function only reads/inserts.
A simple in-process cache avoids repeated SELECT for the same date within
a single file run.
"""
import pandas as pd
from etl.utils.logger import logger

# Module-level cache: date_obj → date_id
# Shared across all parsers within one Python process run.
_date_cache: dict = {}


def get_or_create_date(date, cur) -> int | None:
    """
    Insert date into dim_date if not exists, return date_id.

    Args:
        date: datetime-like value (pandas Timestamp, datetime, or NaT/None)
        cur:  psycopg2 cursor from the caller — no new connection opened here
    """
    if date is None or (isinstance(date, float) and pd.isna(date)):
        return None
    try:
        ts = pd.Timestamp(date)
        if pd.isna(ts):
            return None
    except Exception:
        return None

    date_obj = ts.date()

    # ── Cache hit ─────────────────────────────────────────────────────────────
    if date_obj in _date_cache:
        return _date_cache[date_obj]

    # ── DB lookup ─────────────────────────────────────────────────────────────
    cur.execute("SELECT date_id FROM dim_date WHERE date = %s", (date_obj,))
    row = cur.fetchone()
    if row:
        _date_cache[date_obj] = row[0]
        return row[0]

    # ── Insert ────────────────────────────────────────────────────────────────
    cur.execute(
        """
        INSERT INTO dim_date (date, day, month, month_name, quarter, year, week, day_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING date_id
        """,
        (
            date_obj,
            ts.day,
            ts.month,
            ts.strftime("%B"),
            ts.quarter,
            ts.year,
            ts.isocalendar()[1],
            ts.strftime("%A"),
        ),
    )
    date_id = cur.fetchone()[0]
    _date_cache[date_obj] = date_id
    logger.debug(f"  New date inserted: {date_obj} (id={date_id})")
    return date_id


def clear_cache():
    """Call between test runs if needed."""
    _date_cache.clear()
