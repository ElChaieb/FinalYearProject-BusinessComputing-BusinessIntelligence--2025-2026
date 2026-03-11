# etl/pipeline/parsers/parse_vehicles.py
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_vehicles(df_devis: pd.DataFrame) -> dict:
    """
    Extract unique vehicles from DEVIS sheet and insert into dim_vehicle.
    Skips vehicles that already exist by ar_ref.
    Returns a report dict.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    vehicle_cols = ['AR_Ref', 'AR_Design', 'Marque', 'Modèle']
    available = [c for c in vehicle_cols if c in df_devis.columns]

    if 'AR_Ref' not in available:
        logger.warning("AR_Ref not found in DEVIS sheet — skipping vehicles")
        return report

    vehicles_df = df_devis[available].drop_duplicates(subset=['AR_Ref'])
    vehicles_df = vehicles_df.dropna(subset=['AR_Ref'])
    report["total"] = len(vehicles_df)

    conn = get_connection()
    cur = conn.cursor()

    try:
        for _, row in vehicles_df.iterrows():
            ar_ref = str(row['AR_Ref']).strip()

            # Skip if already exists
            cur.execute("SELECT vehicle_id FROM dim_vehicle WHERE ar_ref = %s", (ar_ref,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            ar_design = str(row.get('AR_Design', '') or '').strip()
            brand     = str(row.get('Marque', '') or '').strip().title()
            model     = str(row.get('Modèle', '') or '').strip().title()

            cur.execute("""
                INSERT INTO dim_vehicle (ar_ref, brand, model)
                VALUES (%s, %s, %s)
            """, (ar_ref, brand, model))
            report["inserted"] += 1

        conn.commit()
        logger.info(f"Vehicles — inserted: {report['inserted']}, skipped: {report['skipped']}")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading vehicles: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report
