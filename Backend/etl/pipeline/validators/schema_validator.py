# etl/pipeline/validators/schema_validator.py
"""
Validates sheet structure before any row-level processing.
Files that fail validation are rejected immediately with a clear reason.
Files that pass may still have optional columns missing — parsers handle that gracefully.
"""

# ── Required columns ────────────────────────────────────────────────────────
# If ANY of these are missing the entire sheet is rejected.
OP_REQUIRED = {
    "Oppo_OpportunityId",
    "Oppo_CreatedDate",
    "Oppo_AssignedUserId",
    "User_LastName",
    "User_FirstName",
    "User_EmailAddress",
    "Chan_Description",
    "Comp_Name",
}

DEVIS_REQUIRED = {
    "Quot_opportunityid",
    "Quot_OrderQuoteID",
    "Quot_CreatedDate",
    "AR_Ref",
    "AR_Design",
    "Marque",
    "Modèle",
    "User_LastName",
    "User_FirstName",
}

# ── Optional columns ─────────────────────────────────────────────────────────
# Present in most files but not all. Parsers must handle their absence.
# OP optional  : Oppo_Deleted, Addr_City, Addr_Address1,
#                Emai_EmailAddress, user_location, comp_reference
# DEVIS optional: User_UserId, Quot_CreatedBy

# ── User resolution rules ────────────────────────────────────────────────────
# DEVIS sheet: prefer User_UserId (CRM id). If absent, fall back to
#              matching (User_LastName, User_FirstName) against dim_user
#              scoped to the same agency. Parsers log a warning when
#              falling back so the admin can track it.


def validate_sheets(df_op, df_devis, filename: str) -> dict:
    """
    Validate both sheets of a CRM file.

    Returns a result dict:
        {
            "valid": bool,
            "errors": [str],          # blocking — file must be rejected
            "warnings": [str],        # non-blocking — logged but processing continues
        }
    """
    errors = []
    warnings = []

    # ── Sheet presence ───────────────────────────────────────────────────────
    if df_op is None:
        errors.append("Sheet 'OP' is missing from the file.")
    if df_devis is None:
        errors.append("Sheet 'DEVIS' is missing from the file.")

    if errors:
        return {"valid": False, "errors": errors, "warnings": warnings}

    # ── OP: empty check ──────────────────────────────────────────────────────
    if df_op.empty or len(df_op.columns) == 0:
        errors.append("Sheet 'OP' is empty.")
    if df_devis.empty or len(df_devis.columns) == 0:
        errors.append("Sheet 'DEVIS' is empty.")

    if errors:
        return {"valid": False, "errors": errors, "warnings": warnings}

    op_cols = set(df_op.columns)
    devis_cols = set(df_devis.columns)

    # ── OP: required columns ─────────────────────────────────────────────────
    missing_op = OP_REQUIRED - op_cols
    if missing_op:
        errors.append(
            f"Sheet 'OP' is missing required columns: {sorted(missing_op)}"
        )

    # ── DEVIS: required columns ──────────────────────────────────────────────
    missing_devis = DEVIS_REQUIRED - devis_cols
    if missing_devis:
        errors.append(
            f"Sheet 'DEVIS' is missing required columns: {sorted(missing_devis)}"
        )

    # ── DEVIS: user resolution warning ──────────────────────────────────────
    # User_UserId is the reliable link to dim_user. Without it we fall back
    # to name matching which is fuzzy — flag it so the admin knows.
    if "User_UserId" not in devis_cols and not missing_devis:
        warnings.append(
            "Sheet 'DEVIS' is missing 'User_UserId'. "
            "User will be resolved by (last_name, first_name) within the agency — "
            "verify results manually."
        )

    if "Quot_CreatedBy" not in devis_cols and not missing_devis:
        warnings.append(
            "Sheet 'DEVIS' is missing 'Quot_CreatedBy' (non-blocking)."
        )

    # ── OP: optional column warnings ─────────────────────────────────────────
    if "Oppo_Deleted" not in op_cols:
        warnings.append(
            "'Oppo_Deleted' not found in OP — all opportunities will be treated as active."
        )
    if "Addr_City" not in op_cols:
        warnings.append("'Addr_City' not found in OP — city will be NULL for opportunities.")
    if "Emai_EmailAddress" not in op_cols:
        warnings.append("'Emai_EmailAddress' not found in OP — client email will be NULL.")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
