# etl/pipeline/parsers/parse_users.py
"""
Extracts unique commercials from OP + DEVIS and loads them into dim_user.

Resolution priority (per row):
  1. crm_user_id  (Oppo_AssignedUserId / User_UserId) — reliable, preferred
  2. (last_name, first_name, agency_id) — fallback when User_UserId absent in DEVIS

Since one file can contain multiple commercials, every row is processed
individually and deduplicated before the DB write.
"""
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_users(df_op: pd.DataFrame, df_devis: pd.DataFrame, agency_id: int) -> dict:
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    users: dict[int, dict] = {}  # crm_user_id → user data, deduped in memory

    # ── From OP sheet (always has Oppo_AssignedUserId — it's required) ───────
    for _, row in df_op.iterrows():
        uid = _safe_int(row.get("Oppo_AssignedUserId"))
        if uid is None:
            continue
        if uid not in users:
            users[uid] = {
                "crm_user_id": uid,
                "last_name":   _clean(row.get("User_LastName")),
                "first_name":  _clean(row.get("User_FirstName")),
                "email":       _clean_lower(row.get("User_EmailAddress")),
            }

    # ── From DEVIS sheet ──────────────────────────────────────────────────────
    has_user_id = "User_UserId" in df_devis.columns

    if not has_user_id:
        logger.warning(
            "DEVIS missing 'User_UserId' — will attempt name-based "
            "lookup for quote user resolution (no new users inserted from DEVIS)."
        )

    if has_user_id:
        for _, row in df_devis.iterrows():
            uid = _safe_int(row.get("User_UserId"))
            if uid is None:
                continue
            if uid not in users:
                users[uid] = {
                    "crm_user_id": uid,
                    "last_name":   _clean(row.get("User_LastName")),
                    "first_name":  _clean(row.get("User_FirstName")),
                    "email":       None,  # DEVIS has no email column
                }

    report["total"] = len(users)
    if not users:
        logger.warning("No user data found — skipping users.")
        return report

    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute(
            "SELECT name, region FROM dim_agency WHERE agency_id = %s", (agency_id,)
        )
        agency_row  = cur.fetchone()
        agency_name = agency_row[0] if agency_row else None
        region      = agency_row[1] if agency_row else None

        for user in users.values():
            cur.execute(
                "SELECT user_id FROM dim_user WHERE crm_user_id = %s",
                (user["crm_user_id"],),
            )
            if cur.fetchone():
                report["skipped"] += 1
                continue

            cur.execute(
                """
                INSERT INTO dim_user
                    (crm_user_id, last_name, first_name, email, role,
                     agency_id, agency_name, region)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user["crm_user_id"],
                    user["last_name"],
                    user["first_name"],
                    user["email"],
                    "Commercial",
                    agency_id,
                    agency_name,
                    region,
                ),
            )
            report["inserted"] += 1

        conn.commit()
        logger.info(
            f"Users — inserted: {report['inserted']}, skipped: {report['skipped']}"
        )
    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading users: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report


def resolve_user_id_by_name(cur, last_name: str, first_name: str, agency_id: int):
    """
    Fallback: resolve dim_user.user_id by (last_name, first_name, agency_id).
    Used when DEVIS is missing User_UserId.
    Returns user_id or None.
    """
    cur.execute(
        """
        SELECT user_id FROM dim_user
        WHERE UPPER(last_name)  = UPPER(%s)
          AND UPPER(first_name) = UPPER(%s)
          AND agency_id = %s
        LIMIT 1
        """,
        (last_name, first_name, agency_id),
    )
    row = cur.fetchone()
    return row[0] if row else None


# ── Helpers ───────────────────────────────────────────────────────────────────
def _safe_int(val):
    try:
        return int(val) if val is not None and not (
            isinstance(val, float) and pd.isna(val)
        ) else None
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
