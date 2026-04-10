# opdb_etl/parsers/parse_opportunities.py
# ============================================================
# Extracts opportunities from OP sheet and inserts into the
# operational DB opportunities table.
#
# Per-row:
#   - user_id  resolved via crm_user_id (Oppo_AssignedUserId)
#   - client_id resolved via get_or_create_client()
#   - date stored directly as DATETIME (no dim_date here)
#   - Skips oppo_id values already in the table (idempotent)
# ============================================================

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
from utils.logger import logger
from parsers.parse_clients import get_or_create_client

UNDETERMINED = "Undetermined"


def parse_and_load_opportunities(
    df_op: pd.DataFrame,
    source: str,
    cur,
) -> dict:
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    df = (
        df_op
        .dropna(subset=["Oppo_OpportunityId"])
        .drop_duplicates(subset=["Oppo_OpportunityId"])
        .copy()
    )
    df["Oppo_CreatedDate"] = pd.to_datetime(
        df["Oppo_CreatedDate"], dayfirst=True, errors="coerce"
    )
    report["total"] = len(df)

    # Cache crm_user_id → user_id to avoid repeated queries
    user_cache: dict[int, int | None] = {}

    for _, row in df.iterrows():
        oppo_id = str(row["Oppo_OpportunityId"]).strip()

        # ── Skip if already exists ────────────────────────────
        cur.execute(
            "SELECT oppo_id FROM opportunities WHERE oppo_id = ?", (oppo_id,)
        )
        if cur.fetchone():
            report["skipped"] += 1
            continue

        # ── Resolve user_id ───────────────────────────────────
        crm_uid = _safe_int(row.get("Oppo_AssignedUserId"))
        if crm_uid not in user_cache:
            if crm_uid is None:
                user_cache[crm_uid] = None
            else:
                cur.execute(
                    "SELECT user_id FROM users WHERE crm_user_id = ?", (crm_uid,)
                )
                r = cur.fetchone()
                user_cache[crm_uid] = r[0] if r else None
                if user_cache[crm_uid] is None:
                    logger.warning(
                        f"  oppo {oppo_id}: crm_user_id {crm_uid} not found in users"
                    )
        user_id = user_cache[crm_uid]

        # ── Resolve client_id ─────────────────────────────────
        client_id = get_or_create_client(
            cur=cur,
            full_name=row.get("Comp_Name"),
            email=row.get("Emai_EmailAddress"),
            city=row.get("Addr_City"),
        )

        # ── Optional fields ───────────────────────────────────
        channel        = _clean(row.get("Chan_Description")) or UNDETERMINED
        city           = _clean(row.get("Addr_City"))        or UNDETERMINED
        address        = _clean(row.get("Addr_Address1"))    or None
        deleted        = bool(row.get("Oppo_Deleted", False))
        user_email     = _clean_lower(row.get("User_EmailAddress"))  or UNDETERMINED
        client_email   = _clean_lower(row.get("Emai_EmailAddress"))  or None
        client_company = _clean(row.get("Comp_Name"))        or UNDETERMINED
        client_ref     = _clean(row.get("comp_reference"))   or None
        created_date   = _safe_date(row.get("Oppo_CreatedDate"))

        cur.execute(
            """
            INSERT INTO opportunities (
                oppo_id, channel, user_id, client_id,
                created_date, city, address, deleted,
                user_email, client_email, client_company,
                client_reference, source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                oppo_id, channel, user_id, client_id,
                created_date, city, address, deleted,
                user_email, client_email, client_company,
                client_ref, source,
            ),
        )
        report["inserted"] += 1

    logger.info(
        f"Opportunities — inserted: {report['inserted']}, "
        f"skipped: {report['skipped']}, errors: {report['errors']}"
    )
    return report


# ── Helpers ───────────────────────────────────────────────────
def _safe_int(val):
    try:
        return int(val) if pd.notna(val) else None
    except (ValueError, TypeError):
        return None


def _safe_date(val):
    try:
        ts = pd.Timestamp(val)
        return None if pd.isna(ts) else ts.to_pydatetime()
    except Exception:
        return None


def _clean(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().title() or None


def _clean_lower(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().lower() or None
