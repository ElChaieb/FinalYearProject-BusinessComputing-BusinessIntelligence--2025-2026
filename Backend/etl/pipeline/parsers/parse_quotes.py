# etl/pipeline/parsers/parse_quotes.py
import pandas as pd
from etl.pipeline.parsers.parse_date import get_or_create_date
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_quotes(df_devis: pd.DataFrame, agency_id: int, source: str) -> dict:
    """
    Extract quotes from DEVIS sheet and insert into fact_quotes.
    One row per (quote_id_crm + vehicle) combination.
    Skips if (quote_id_crm, vehicle_id) already exists.
    Returns a report dict.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    required = ['Quot_OrderQuoteID']
    if not all(c in df_devis.columns for c in required):
        logger.warning(f"Missing Quot_OrderQuoteID in DEVIS sheet — skipping quotes")
        logger.warning(f"Available columns: {list(df_devis.columns)}")
        return report

    # Keep all rows (no dedup by quote ID alone — one quote can have multiple vehicles)
    df = df_devis.dropna(subset=['Quot_OrderQuoteID']).copy()
    df['Quot_CreatedDate'] = pd.to_datetime(df.get('Quot_CreatedDate'), dayfirst=True, errors='coerce')
    report["total"] = len(df)

    conn = get_connection()
    cur = conn.cursor()

    try:
        for _, row in df.iterrows():
            quote_id_crm = str(row['Quot_OrderQuoteID']).strip()

            # Resolve vehicle_id from AR_Ref
            ar_ref = str(row.get('AR_Ref', '') or '').strip()
            vehicle_id = None
            if ar_ref:
                cur.execute("SELECT vehicle_id FROM dim_vehicle WHERE ar_ref = %s", (ar_ref,))
                v_row = cur.fetchone()
                vehicle_id = v_row[0] if v_row else None

            # Skip if (quote_id_crm, vehicle_id) already exists
            cur.execute(
                "SELECT 1 FROM fact_quotes WHERE quote_id_crm = %s AND vehicle_id = %s",
                (quote_id_crm, vehicle_id)
            )
            if cur.fetchone():
                report["skipped"] += 1
                continue

            # Resolve date_id
            date_id = get_or_create_date(row.get('Quot_CreatedDate'))

            # Resolve user_id from User_UserId
            crm_user_id = row.get('User_UserId')
            user_id = None
            if crm_user_id and not pd.isna(crm_user_id):
                cur.execute(
                    "SELECT user_id FROM dim_user WHERE crm_user_id = %s",
                    (int(crm_user_id),)
                )
                user_row = cur.fetchone()
                user_id = user_row[0] if user_row else None

            # Opportunity ID
            oppo_id = str(row.get('Quot_opportunityid', '') or '').strip() or None

            cur.execute("""
                INSERT INTO fact_quotes
                    (quote_id_crm, date_id, user_id, agency_id, vehicle_id,
                     oppo_id, converted_to_sale, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                quote_id_crm, date_id, user_id, agency_id, vehicle_id,
                oppo_id, False, source
            ))
            report["inserted"] += 1

        conn.commit()
        logger.info(f"Quotes — inserted: {report['inserted']}, skipped: {report['skipped']}")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading quotes: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report