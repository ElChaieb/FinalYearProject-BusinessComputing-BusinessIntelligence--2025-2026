# etl/pipeline/parsers/parse_opportunities.py
import pandas as pd
from etl.pipeline.parsers.parse_date import get_or_create_date
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_opportunities(df_op: pd.DataFrame, agency_id: int, source: str) -> dict:
    """
    Extract opportunities from OP sheet and insert into fact_opportunities.
    Skips opportunities that already exist by oppo_id.
    Returns a report dict.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    required = ['Oppo_OpportunityId']
    if not all(c in df_op.columns for c in required):
        logger.warning("Missing required columns in OP sheet — skipping opportunities")
        return report

    df = df_op.dropna(subset=['Oppo_OpportunityId']).drop_duplicates(subset=['Oppo_OpportunityId']).copy()

    # Normalize dates
    df['Oppo_CreatedDate'] = pd.to_datetime(df.get('Oppo_CreatedDate'), dayfirst=True, errors='coerce')
    report["total"] = len(df)

    conn = get_connection()
    cur = conn.cursor()

    try:
        for _, row in df.iterrows():
            oppo_id = str(row['Oppo_OpportunityId']).strip()

            # Skip if already exists
            cur.execute("SELECT oppo_id FROM fact_opportunities WHERE oppo_id = %s", (oppo_id,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            # Resolve date_id
            date_id = get_or_create_date(row.get('Oppo_CreatedDate'))

            # Resolve user_id from crm_user_id
            crm_user_id = row.get('Oppo_AssignedUserId')
            user_id = None
            if crm_user_id and not pd.isna(crm_user_id):
                cur.execute(
                    "SELECT user_id FROM dim_user WHERE crm_user_id = %s",
                    (int(crm_user_id),)
                )
                user_row = cur.fetchone()
                user_id = user_row[0] if user_row else None

            channel  = str(row.get('Chan_Description', '') or '').strip().title()
            city     = str(row.get('Addr_City', '') or '').strip().title()
            deleted  = bool(row.get('Oppo_Deleted', False))

            cur.execute("""
                INSERT INTO fact_opportunities
                    (oppo_id, date_id, user_id, agency_id, channel, city, deleted, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (oppo_id, date_id, user_id, agency_id, channel, city, deleted, source))
            report["inserted"] += 1

        conn.commit()
        logger.info(f"Opportunities — inserted: {report['inserted']}, skipped: {report['skipped']}")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading opportunities: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report
