# opdb_etl/parsers/parse_users.py
# ============================================================
# Extracts unique commercials from OP + DEVIS sheets
# and inserts into the operational DB users table.
#
# Note: SQL Server uses ? placeholders (not %s like psycopg2).
# No agency_id — single agency scope.
# No date dimension — dates stored directly.
# ============================================================

import pandas as pd
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.logger import logger

UNDETERMINED = "Undetermined"


def parse_and_load_users(
    df_op: pd.DataFrame,
    df_devis: pd.DataFrame,
    cur,
) -> dict:
    """
    Merge users from OP (Oppo_AssignedUserId) and DEVIS (User_UserId).
    Deduplicate by crm_user_id in memory before hitting the DB.
    Skip rows that already exist in users table.
    """
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}
    users: dict[int, dict] = {}  # crm_user_id → user data

    # ── From OP sheet ─────────────────────────────────────────
    for _, row in df_op.iterrows():
        uid = _safe_int(row.get("Oppo_AssignedUserId"))
        if uid is None or uid in users:
            continue
        users[uid] = {
            "crm_user_id": uid,
            "last_name":   _clean(row.get("User_LastName"))   or UNDETERMINED,
            "first_name":  _clean(row.get("User_FirstName"))  or UNDETERMINED,
            "email":       _clean_lower(row.get("User_EmailAddress")) or UNDETERMINED,
        }

    # ── From DEVIS sheet ──────────────────────────────────────
    has_user_id = "User_UserId" in df_devis.columns
    if not has_user_id:
        logger.warning("DEVIS missing 'User_UserId' — only OP users will be loaded.")

    if has_user_id:
        for _, row in df_devis.iterrows():
            uid = _safe_int(row.get("User_UserId"))
            if uid is None or uid in users:
                continue
            users[uid] = {
                "crm_user_id": uid,
                "last_name":   _clean(row.get("User_LastName"))  or UNDETERMINED,
                "first_name":  _clean(row.get("User_FirstName")) or UNDETERMINED,
                "email":       UNDETERMINED,  # DEVIS has no email column
            }

    report["total"] = len(users)
    if not users:
        logger.warning("No users found — skipping.")
        return report

    for user in users.values():
        # Skip if crm_user_id already exists
        cur.execute(
            "SELECT user_id FROM users WHERE crm_user_id = ?",
            (user["crm_user_id"],)
        )
        if cur.fetchone():
            report["skipped"] += 1
            continue

        cur.execute(
            """
            INSERT INTO users (crm_user_id, last_name, first_name, email, role)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user["crm_user_id"],
                user["last_name"],
                user["first_name"],
                user["email"],
                "Commercial",
            ),
        )
        report["inserted"] += 1

    logger.info(
        f"Users — inserted: {report['inserted']}, skipped: {report['skipped']}"
    )
    return report


# ── Helpers ───────────────────────────────────────────────────
def _safe_int(val):
    try:
        return int(val) if pd.notna(val) else None
    except (ValueError, TypeError):
        return None

def _clean(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().title() or None

def _clean_lower(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().lower() or None
