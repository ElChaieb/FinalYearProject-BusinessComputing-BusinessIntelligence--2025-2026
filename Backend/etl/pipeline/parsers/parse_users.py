# etl/pipeline/parsers/parse_users.py
"""
Extracts unique commercials from OP + DEVIS and upserts them into dim_user.

ID strategy:
    - user_id is read directly from the source file (Oppo_AssignedUserId / User_UserId).
        There is NO crm_user_id indirection — the source ID is the DWH ID.

Resolution priority (per row):
    1. User_UserId in DEVIS (preferred — exact match on user_id)
    2. (User_LastName, User_FirstName, agency_name) — fallback when User_UserId absent in DEVIS

Column mapping:
    OP:    Oppo_AssignedUserId → user_id
                 User_LastName       → last_name
                 User_FirstName      → first_name
                 User_EmailAddress   → email
                 Chan_Description    → agency_name
    DEVIS: User_UserId         → user_id
                 User_LastName       → last_name
                 User_FirstName      → first_name

Business rules:
    - `user_id` from source is authoritative; inserts use that ID directly.
    - Users are deduplicated in-memory by `user_id` before any DB writes.
    - If DEVIS lacks `User_UserId`, name-based resolution is used for quotes
        (no new users inserted from DEVIS without an ID).
    - Inserted users receive role `Commercial`.
"""
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger


def parse_and_load_users(df_op: pd.DataFrame, df_devis: pd.DataFrame) -> dict:
    # Main loader: collects users from OP and DEVIS, deduplicates by
    # `user_id` and inserts new rows into `dim_user` assigning role `Commercial`.
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    # user_id → user data dict; deduplicated in memory before any DB write
    users: dict[int, dict] = {}

    # ── From OP sheet ─────────────────────────────────────────────────────────
    for _, row in df_op.iterrows():
        uid = _safe_int(row.get("Oppo_AssignedUserId"))
        if uid is None:
            continue
        if uid not in users:
            users[uid] = {
                "user_id":    uid,
                "last_name":  _clean(row.get("User_LastName")),
                "first_name": _clean(row.get("User_FirstName")),
                "email":      _clean_lower(row.get("User_EmailAddress")),
                "agency_name": _clean(row.get("Chan_Description")),
            }

    # ── From DEVIS sheet ──────────────────────────────────────────────────────
    has_user_id = "User_UserId" in df_devis.columns
    if not has_user_id:
        logger.warning(
            "DEVIS missing 'User_UserId' — no new users will be inserted "
            "from DEVIS; name-based lookup used for quote user resolution."
        )
    else:
        for _, row in df_devis.iterrows():
            uid = _safe_int(row.get("User_UserId"))
            if uid is None or uid in users:
                continue
            users[uid] = {
                "user_id":    uid,
                "last_name":  _clean(row.get("User_LastName")),
                "first_name": _clean(row.get("User_FirstName")),
                "email":      None,  # DEVIS has no email column
                "agency_name": None,
            }

    report["total"] = len(users)
    if not users:
        logger.warning("No user data found — skipping users.")
        return report

    conn = get_connection()
    cur  = conn.cursor()
    try:
        for user in users.values():
            cur.execute(
                "SELECT 1 FROM dim_user WHERE user_id = %s", (user["user_id"],)
            )
            if cur.fetchone():
                report["skipped"] += 1
                continue

            cur.execute(
                """
                INSERT INTO dim_user (user_id, last_name, first_name, email, role, agency_name)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    user["user_id"],
                    user["last_name"],
                    user["first_name"],
                    user["email"],
                    "Commercial",
                    user["agency_name"],
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


def resolve_user_id_by_name(cur, last_name: str, first_name: str, agency_name: str) -> int | None:
    """
    Fallback: resolve dim_user.user_id by (last_name, first_name, agency_name).
    Used when DEVIS is missing User_UserId.
    """
    # Business rule: when User_UserId is not available, resolve by exact
    # case-insensitive match on (last_name, first_name, agency_name).
    if not last_name or not first_name:
        return None
    cur.execute(
        """
        SELECT user_id FROM dim_user
        WHERE UPPER(last_name)  = UPPER(%s)
          AND UPPER(first_name) = UPPER(%s)
          AND UPPER(agency_name) = UPPER(%s)
        LIMIT 1
        """,
        (last_name, first_name, agency_name),
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
