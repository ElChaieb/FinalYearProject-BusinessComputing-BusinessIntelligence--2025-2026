# etl/pipeline/parsers/parse_users.py
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_users(df_op: pd.DataFrame, df_devis: pd.DataFrame, agency_id: int) -> dict:
    """
    Extract unique users from both OP and DEVIS sheets and insert into dim_user.
    OP sheet   -> Oppo_AssignedUserId, User_LastName, User_FirstName, User_EmailAddress
    DEVIS sheet -> User_UserId, User_LastName, User_FirstName
    Merges both sources, deduplicates by crm_user_id.
    Skips users that already exist.
    Returns a report dict.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    users_combined = []

    # From OP sheet
    op_id_col = 'Oppo_AssignedUserId'
    if op_id_col in df_op.columns:
        op_users = df_op[
            [c for c in [op_id_col, 'User_LastName', 'User_FirstName', 'User_EmailAddress']
             if c in df_op.columns]
        ].copy()
        op_users = op_users.rename(columns={op_id_col: 'crm_user_id'})
        op_users = op_users.dropna(subset=['crm_user_id'])
        users_combined.append(op_users)
        logger.info(f"  OP sheet: {len(op_users)} user rows found")
    else:
        logger.warning("Oppo_AssignedUserId not found in OP sheet — skipping OP users")

    # From DEVIS sheet
    devis_id_col = 'User_UserId'
    if devis_id_col in df_devis.columns:
        devis_users = df_devis[
            [c for c in [devis_id_col, 'User_LastName', 'User_FirstName']
             if c in df_devis.columns]
        ].copy()
        devis_users = devis_users.rename(columns={devis_id_col: 'crm_user_id'})
        devis_users = devis_users.dropna(subset=['crm_user_id'])
        users_combined.append(devis_users)
        logger.info(f"  DEVIS sheet: {len(devis_users)} user rows found")
    else:
        logger.warning("User_UserId not found in DEVIS sheet — skipping DEVIS users")

    if not users_combined:
        logger.warning("No user data found in either sheet — skipping users")
        return report

    # Merge + deduplicate
    merged = pd.concat(users_combined, ignore_index=True)
    merged['crm_user_id'] = merged['crm_user_id'].astype(int)
    merged = merged.drop_duplicates(subset=['crm_user_id'], keep='first')
    report["total"] = len(merged)

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SELECT name, region FROM dim_agency WHERE agency_id = %s", (agency_id,))
        agency_row  = cur.fetchone()
        agency_name = agency_row[0] if agency_row else None
        region      = agency_row[1] if agency_row else None

        for _, row in merged.iterrows():
            crm_user_id = int(row['crm_user_id'])

            cur.execute("SELECT user_id FROM dim_user WHERE crm_user_id = %s", (crm_user_id,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            last_name  = str(row.get('User_LastName',  '') or '').strip().title()
            first_name = str(row.get('User_FirstName', '') or '').strip().title()
            email      = str(row.get('User_EmailAddress', '') or '').strip().lower()

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