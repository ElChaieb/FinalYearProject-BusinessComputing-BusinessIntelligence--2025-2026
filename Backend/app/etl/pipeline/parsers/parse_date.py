# etl/pipeline/parsers/parse_date.py
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger


def get_or_create_date(date) -> int:
    """Insert date into dim_date if not exists, return date_id"""
    if pd.isna(date) or date is None:
        return None

    conn = get_connection()
    cur = conn.cursor()
    try:
        date_obj = pd.Timestamp(date).date()

        # Check if exists
        cur.execute("SELECT date_id FROM dim_date WHERE date = %s", (date_obj,))
        row = cur.fetchone()
        if row:
            return row[0]

        # Insert new date
        ts = pd.Timestamp(date_obj)
        cur.execute("""
            INSERT INTO dim_date (date, day, month, month_name, quarter, year, week, day_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING date_id
        """, (
            date_obj,
            ts.day,
            ts.month,
            ts.strftime("%B"),
            ts.quarter,
            ts.year,
            ts.isocalendar()[1],
            ts.strftime("%A")
        ))
        date_id = cur.fetchone()[0]
        conn.commit()
        return date_id

    except Exception as e:
        conn.rollback()
        logger.error(f"Error in get_or_create_date: {e}")
        raise
    finally:
        cur.close()
        conn.close()
