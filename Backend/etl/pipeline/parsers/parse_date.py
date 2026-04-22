# etl/pipeline/parsers/parse_date.py
"""
Resolves dim_date entries.
Uses the caller's cursor (no separate connection) to stay in the same transaction.
Module-level cache avoids repeated DB round-trips for the same date within a run.
"""
import pandas as pd
from etl.utils.logger import logger

_date_cache: dict = {}


def get_or_create_date(date, cur) -> int | None:
    if date is None or (isinstance(date, float) and pd.isna(date)):
        return None
    try:
        ts = pd.Timestamp(date)
        if pd.isna(ts):
            return None
    except Exception:
        return None

    date_obj = ts.date()

    if date_obj in _date_cache:
        return _date_cache[date_obj]

    cur.execute("SELECT date_id FROM dim_date WHERE date = %s", (date_obj,))
    row = cur.fetchone()
    if row:
        _date_cache[date_obj] = row[0]
        return row[0]

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
    _date_cache.clear()
