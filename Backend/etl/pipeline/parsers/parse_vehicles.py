# etl/pipeline/parsers/parse_vehicles.py
"""
Extracts unique vehicles from DEVIS sheet and upserts into dim_vehicle.

Column mapping (source → DWH):
  AR_Ref    → dim_vehicle.ar_ref      (PK — direct from source)
  AR_Design → dim_vehicle.ar_design
  Marque    → dim_vehicle.brand
  Modèle    → dim_vehicle.model

Faked columns (no source equivalent — looked up from VEHICLE_CATALOGUE,
then defaulted if ar_ref not found):
  category   → dim_vehicle.category   (e.g. "SUV", "Citadine", "Électrique"…)
  base_price → dim_vehicle.base_price
"""
import pandas as pd
from etl.utils.db import get_connection
from etl.utils.logger import logger

# ── Catalogue: ar_ref → (category, base_price) ───────────────────────────────
# Sourced from the known vehicle list; used to populate the two faked columns.
_CATALOGUE: dict[str, tuple[str, float]] = {
    ar_ref: (category, float(price))
    for ar_ref, category, price in [
        ("SX11-GF+-080",    "SUV Compact", 105000),
        ("SX11-GS-080",     "SUV Compact",  98000),
        ("NL-3B-A10",       "SUV",         110000),
        ("NL-3B-B07",       "SUV",         110000),
        ("SX11-GF+-F36",    "SUV Compact", 105000),
        ("NL-3B-C19",       "SUV",         110000),
        ("NL-3B-E29",       "SUV",         110000),
        ("SX11-GF+-E32",    "SUV Compact", 105000),
        ("SX11-GS-D14",     "SUV Compact",  98000),
        ("NL-3B-D06",       "SUV",         110000),
        ("GX3-CVT-OR",      "Citadine",     70000),
        ("GX3-CVT-BAS",     "Citadine",     70000),
        ("GX3-CVT-WAA",     "Citadine",     70000),
        ("SX11-GS-E32",     "SUV Compact",  98000),
        ("LF7154B-208",     "Citadine",     75000),
        ("LF7154B-C23",     "Citadine",     75000),
        ("LF7154B-K22",     "Citadine",     75000),
        ("LF7154B-E43",     "Citadine",     75000),
        ("LF7154B-G65",     "Citadine",     75000),
        ("E22H-ADA",        "Électrique",  130000),
        ("SX11-GF+-D14",    "SUV Compact", 105000),
        ("SX11-GF+-G66",    "SUV Compact", 105000),
        ("SX11-GS-G66",     "SUV Compact",  98000),
        ("SS11-BVA",        "Berline",      85000),
        ("FX11",            "SUV",         140000),
        ("FY11",            "SUV",         135000),
        ("LP5SEF",          "Électrique",  125000),
        ("KX11",            "SUV",         150000),
        ("FY11-BA-ADE",     "SUV",         138000),
        ("GX3P-MT-WAA",     "Citadine",     72000),
        ("KX11-BA-LAK",     "SUV",         150000),
        ("SX11-MT-WAA",     "SUV Compact",  95000),
        ("GX3-CVT-BAS-CRM", "Citadine",    70000),
        ("GX3P-CVT-WAA",    "Citadine",     75000),
        ("KX11-BA-ACT",     "SUV",         150000),
        ("GE13-LAK",        "Électrique",  128000),
        ("FY11-BA-LAK",     "SUV",         138000),
        ("LF7154B-MT-208",  "Citadine",     72000),
        ("LF7154B-MT-C23",  "Citadine",     72000),
        ("LF7154B-MT-G65",  "Citadine",     72000),
        ("LF7154B-MT-E43",  "Citadine",     72000),
        ("GE13-BAS",        "Électrique",  128000),
        ("SS11-BVM",        "Berline",      80000),
        ("GE13-WAA",        "Électrique",  128000),
        ("SS11-MT-WAA",     "Berline",      80000),
        ("GX3-CVT-RAM",     "Citadine",     70000),
        ("LF7154B-MT-K22",  "Citadine",     72000),
        ("SX11-GS-F36",     "SUV Compact",  98000),
        ("SS11-MT-SAI",     "Berline",      80000),
        ("FY11-BA-WAA",     "SUV",         138000),
        ("EX5-EL-ADA",      "Électrique",  132000),
        ("EX5-EL-GRE",      "Électrique",  132000),
        ("EX5-EL-LAK",      "Électrique",  132000),
        ("EX5-EL-SAI",      "Électrique",  132000),
        ("EX5-EL-WAA",      "Électrique",  132000),
        ("SX11-GF-ADA",     "SUV Compact", 100000),
        ("SX11-GF-WAA",     "SUV Compact", 100000),
        ("SS11T-MT-ADA",    "Berline",      78000),
        ("SS11T-MT-BAS",    "Berline",      78000),
        ("SS11T-MT-SAI",    "Berline",      78000),
        ("SS11T-MT-WAA",    "Berline",      78000),
        ("SS11-AT-OR",      "Berline",      85000),
        ("SX11-GS-WAA",     "SUV Compact",  98000),
        ("SX11-GF-CS",      "SUV Compact", 102000),
        ("GX3-CVT-WAA-CRM", "Citadine",    70000),
        ("GX3-MT-BAS",      "Citadine",     68000),
        ("GX3-MT-WAA",      "Citadine",     68000),
        ("KX11-BA-WAA",     "SUV",         150000),
        ("SX11-CVT-WAA",    "SUV Compact",  98000),
        ("SS11-MT-ADA",     "Berline",      80000),
        ("SS11-MT-BAS",     "Berline",      80000),
        ("EX5",             "Électrique",  132000),
        ("SS11-AT-WAA",     "Berline",      85000),
        ("GC6M72M-WAA",     "Berline",      75000),
        ("GC6M72M-LAK",     "Berline",      75000),
        ("GC6M72M-RAM",     "Berline",      75000),
        ("GC6M72M-BAS",     "Berline",      75000),
        ("GC6M72M-SAI",     "Berline",      75000),
        ("GC6M72M-OR",      "Berline",      75000),
        ("FE-3JCM72-WAA",   "Berline",      68000),
        ("GX3-MT-RAM",      "Citadine",     68000),
        ("GX3-MT-OR",       "Citadine",     68000),
        ("GX3-MT-OR-CRM",   "Citadine",     68000),
        ("GX3-MT-WAA-CRM",  "Citadine",     68000),
        ("GX3-MT-RAM-CRM",  "Citadine",     68000),
        ("GX3-CVT-OR-CRM",  "Citadine",     70000),
        ("GX3-CVT-RAM-CRM", "Citadine",     70000),
        ("GX3-MT-BAS-CRM",  "Citadine",     68000),
        ("SX11",            "SUV Compact",  95000),
        ("SS11-AT-ADA",     "Berline",      85000),
        ("SS11-AT-SAI",     "Berline",      85000),
        ("SS11-AT-BAS",     "Berline",      85000),
        ("KX11-BA-SAF",     "SUV",         150000),
        ("GE13-SAF",        "Électrique",  128000),
        ("SX11-GS-SAF",     "SUV Compact",  98000),
        ("SX11-GF-RAM",     "SUV Compact", 100000),
        ("EX5EM-I-ADA",     "Électrique",  136000),
        ("NL-3B",           "SUV",         108000),
        ("SX11-DCT-WAA",    "SUV Compact",  98000),
        ("SX11-GS-ADA",     "SUV Compact",  98000),
        ("FE-7A74-BAS",     "Berline",      72000),
        ("SX11-GS-BAS",     "SUV Compact",  98000),
    ]
}

_DEFAULT_CATEGORY   = "Inconnu"
_DEFAULT_BASE_PRICE = None   # NULL — honestly unknown is better than a wrong number


def _lookup(ar_ref: str) -> tuple[str, float | None]:
    """Return (category, base_price) from catalogue, with safe defaults."""
    entry = _CATALOGUE.get(ar_ref)
    if entry:
        return entry
    # Try prefix match: "SX11-GF+-080" → "SX11" won't match, but
    # unknown variants like "SX11-GF+-NEW" should at least get the family category.
    for key, val in _CATALOGUE.items():
        if ar_ref.startswith(key + "-") or key.startswith(ar_ref + "-"):
            return val
    return _DEFAULT_CATEGORY, _DEFAULT_BASE_PRICE


def parse_and_load_vehicles(df_devis: pd.DataFrame) -> dict:
    report = {"total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    if "AR_Ref" not in df_devis.columns:
        logger.warning("DEVIS missing 'AR_Ref' — skipping vehicles.")
        return report

    keep = [c for c in ("AR_Ref", "AR_Design", "Marque", "Modèle") if c in df_devis.columns]
    vehicles_df = (
        df_devis[keep]
        .dropna(subset=["AR_Ref"])
        .drop_duplicates(subset=["AR_Ref"])
    )
    report["total"] = len(vehicles_df)

    conn = get_connection()
    cur  = conn.cursor()
    try:
        for _, row in vehicles_df.iterrows():
            ar_ref = str(row["AR_Ref"]).strip()

            cur.execute("SELECT 1 FROM dim_vehicle WHERE ar_ref = %s", (ar_ref,))
            if cur.fetchone():
                report["skipped"] += 1
                continue

            ar_design  = _clean(row.get("AR_Design"))
            brand      = _clean(row.get("Marque"))
            model      = _clean(row.get("Modèle"))
            category, base_price = _lookup(ar_ref)

            cur.execute(
                """
                INSERT INTO dim_vehicle (ar_ref, ar_design, brand, model, category, base_price)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (ar_ref, ar_design, brand, model, category, base_price),
            )
            report["inserted"] += 1

        conn.commit()
        logger.info(
            f"Vehicles — inserted: {report['inserted']}, skipped: {report['skipped']}"
        )
    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading vehicles: {e}")
        report["errors"] += 1
        raise
    finally:
        cur.close()
        conn.close()

    return report


def _clean(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip().title() or None
