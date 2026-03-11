# etl/pipeline/parsers/parse_users.py
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_users(df_op: pd.DataFrame, agency_id: int) -> dict:
    """
    Extract unique users from OP sheet and insert into dim_user.
    Uses Oppo_AssignedUserId as the source user ID.
    Skips users that already exist.
    Returns a report dict.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    # Extract unique users by AssignedUserId
    user_cols = ['Oppo_AssignedUserId', 'User_LastName', 'User_FirstName',
                 'User_EmailAddress', 'user_location']

    available = [c for c in user_cols if c in df_op.columns]
    if 'Oppo_AssignedUserId' not in available:
        logger.warning("Oppo_AssignedUserId not found in OP sheet — skipping users")
        return report

    users_df = df_op[available].drop_duplicates(subset=['Oppo_AssignedUserId'])
    users_df = users_df.dropna(subset=['Oppo_AssignedUserId'])
    report["total"] = len(users_df)

    conn = get_connection()
    cur = conn.cursor()

    try:
        for _, row in users_df.iterrows():
            crm_user_id = int(row['Oppo_AssignedUserId'])

            # Check if user already exists by crm_user_id
            cur.execute("SELECT user_id FROM dim_user WHERE crm_user_id = %s", (crm_user_id,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            last_name  = str(row.get('User_LastName', '') or '').strip().title()
            first_name = str(row.get('User_FirstName', '') or '').strip().title()
            email      = str(row.get('User_EmailAddress', '') or '').strip().lower()
            location   = str(row.get('user_location', '') or '').strip().title()

            # Get agency name from dim_agency
            cur.execute("SELECT name, region FROM dim_agency WHERE agency_id = %s", (agency_id,))
            agency_row = cur.fetchone()
            agency_name = agency_row[0] if agency_row else None
            region      = agency_row[1] if agency_row else None

            cur.execute("""
                INSERT INTO dim_user
                    (crm_user_id, last_name, first_name, email, role,
                     agency_id, agency_name, region)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                crm_user_id, last_name, first_name, email,
                'Commercial', agency_id, agency_name, region
            ))
            report["inserted"] += 1

        conn.commit()
        logger.info(f"Users — inserted: {report['inserted']}, skipped: {report['skipped']}")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading users: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report
