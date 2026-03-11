# etl/pipeline/parsers/parse_quotes.py
import pandas as pd
from etl.pipeline.parsers.parse_date import get_or_create_date
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_quotes(df_devis: pd.DataFrame, agency_id: int, source: str) -> dict:
    """
    Extract quotes from DEVIS sheet and insert into fact_quotes.
    Skips quotes that already exist by quote_id.
    Returns a report dict.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    required = ['Quot_QuoteId']
    if not all(c in df_devis.columns for c in required):
        logger.warning("Missing Quot_QuoteId in DEVIS sheet — skipping quotes")
        return report

    df = df_devis.dropna(subset=['Quot_QuoteId']).drop_duplicates(subset=['Quot_QuoteId']).copy()
    df['Quot_CreatedDate'] = pd.to_datetime(df.get('Quot_CreatedDate'), dayfirst=True, errors='coerce')
    report["total"] = len(df)

    conn = get_connection()
    cur = conn.cursor()

    try:
        for _, row in df.iterrows():
            quote_id = str(row['Quot_QuoteId']).strip()

            # Skip if already exists
            cur.execute("SELECT quote_id FROM fact_quotes WHERE quote_id = %s", (quote_id,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            # Resolve date_id
            date_id = get_or_create_date(row.get('Quot_CreatedDate'))

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

            # Resolve vehicle_id from ar_ref
            ar_ref = str(row.get('AR_Ref', '') or '').strip()
            vehicle_id = None
            if ar_ref:
                cur.execute("SELECT vehicle_id FROM dim_vehicle WHERE ar_ref = %s", (ar_ref,))
                v_row = cur.fetchone()
                vehicle_id = v_row[0] if v_row else None

            oppo_id = str(row.get('Oppo_OpportunityId', '') or '').strip() or None

            cur.execute("""
                INSERT INTO fact_quotes
                    (quote_id, date_id, user_id, agency_id, vehicle_id,
                     oppo_id, converted_to_sale, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                quote_id, date_id, user_id, agency_id, vehicle_id,
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
