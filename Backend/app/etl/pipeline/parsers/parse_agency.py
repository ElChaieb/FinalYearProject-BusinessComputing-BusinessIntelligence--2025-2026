# etl/pipeline/parsers/parse_agency.py
import re
from etl.utils.db import get_connection
from etl.utils.logger import logger


def extract_agency_name(filename: str) -> str:
    """Extract agency name from filename e.g. 'CRM AYDA-GABES.xlsx' → 'Gabes'"""
    basename = os.path.basename(filename).replace(".xlsx", "")
    match = re.search(r'-(.+)$', basename)
    return match.group(1).strip().title() if match else "Unknown"


def get_or_create_agency(agency_name: str) -> int:
    """Insert agency if not exists, return agency_id"""
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Check if exists
        cur.execute("SELECT agency_id FROM dim_agency WHERE name = %s", (agency_name,))
        row = cur.fetchone()
        if row:
            logger.info(f"Agency '{agency_name}' already exists (id={row[0]})")
            return row[0]

        # Insert new agency
        cur.execute(
            "INSERT INTO dim_agency (name) VALUES (%s) RETURNING agency_id",
            (agency_name,)
        )
        agency_id = cur.fetchone()[0]
        conn.commit()
        logger.info(f"Inserted new agency '{agency_name}' (id={agency_id})")
        return agency_id

    except Exception as e:
        conn.rollback()
        logger.error(f"Error in get_or_create_agency: {e}")
        raise
    finally:
        cur.close()
        conn.close()


import os
