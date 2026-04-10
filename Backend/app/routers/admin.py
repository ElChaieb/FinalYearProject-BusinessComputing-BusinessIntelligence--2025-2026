# Backend/app/routers/admin.py
import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.auth import require_role
from etl.pipeline.file_processor import process_file, process_all_raw_files
from dotenv import load_dotenv

router = APIRouter(prefix="/admin", tags=["Admin"])

load_dotenv()
BASE_DIR      = os.getenv("BASE_DIR")
RAW_DIR       = os.path.join(BASE_DIR, "etl", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "etl", "processed")
REJECTED_DIR  = os.path.join(BASE_DIR, "etl", "rejected")

for folder in [RAW_DIR, PROCESSED_DIR, REJECTED_DIR]:
    os.makedirs(folder, exist_ok=True)

_SUMMARY_TABLES = ["users", "vehicles", "clients", "opportunities", "quotes"]


def file_info(filepath: str) -> dict:
    import re
    filename = os.path.basename(filepath)
    size_kb  = round(os.path.getsize(filepath) / 1024, 1)
    match    = re.search(r'-(.+?)(?:_\d{8})?(?:\.xlsx)?$', filename)
    agency   = match.group(1).strip().title() if match else "Unknown"
    return {"filename": filename, "agency": agency, "size_kb": size_kb}


# ── Excel ETL endpoints ──────────────────────────────────────

@router.get("/data/files")
def list_raw_files(current_user=Depends(require_role("Administrateur BI"))):
    files = [
        os.path.join(RAW_DIR, f)
        for f in os.listdir(RAW_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    return {"count": len(files), "files": [file_info(f) for f in files]}


@router.get("/data/processed")
def list_processed_files(current_user=Depends(require_role("Administrateur BI"))):
    files = [
        os.path.join(PROCESSED_DIR, f)
        for f in os.listdir(PROCESSED_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    return {"count": len(files), "files": [file_info(f) for f in files]}


@router.get("/data/rejected")
def list_rejected_files(current_user=Depends(require_role("Administrateur BI"))):
    files = [
        os.path.join(REJECTED_DIR, f)
        for f in os.listdir(REJECTED_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    return {"count": len(files), "files": [file_info(f) for f in files]}


@router.post("/data/upload")
def upload_files(
    files: list[UploadFile] = File(...),
    current_user=Depends(require_role("Administrateur BI")),
):
    saved, errors = [], []
    for file in files:
        if not file.filename.endswith(".xlsx"):
            errors.append({"file": file.filename, "error": "Only .xlsx files are accepted"})
            continue
        dest = os.path.join(RAW_DIR, file.filename)
        try:
            with open(dest, "wb") as f:
                shutil.copyfileobj(file.file, f)
            saved.append(file.filename)
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})
    return {
        "saved":   saved,
        "errors":  errors,
        "message": f"{len(saved)} file(s) uploaded successfully.",
    }


@router.post("/data/run")
def run_etl(current_user=Depends(require_role("Administrateur BI"))):
    files = [
        os.path.join(RAW_DIR, f)
        for f in os.listdir(RAW_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    if not files:
        raise HTTPException(status_code=400, detail="No files in raw/ folder to process.")

    reports = process_all_raw_files()

    total_inserted = sum(
        r.get(table, {}).get("inserted", 0)
        for r in reports
        for table in _SUMMARY_TABLES
    )
    total_skipped = sum(
        r.get(table, {}).get("skipped", 0)
        for r in reports
        for table in _SUMMARY_TABLES
    )

    processed = [r for r in reports if r["status"] == "success"]
    rejected  = [r for r in reports if r["status"] == "rejected"]
    failed    = [r for r in reports if r["status"] == "failed"]

    return {
        "files_processed": len(processed),
        "files_rejected":  len(rejected),
        "files_failed":    len(failed),
        "total_inserted":  total_inserted,
        "total_skipped":   total_skipped,
        "reports":         reports,
    }


# ── OpDB → DWH sync endpoint ─────────────────────────────────

@router.post("/opdb/sync")
def sync_opdb(current_user=Depends(require_role("Administrateur BI"))):
    """
    Manually trigger an OpDB → DWH sync.
    Returns inserted/skipped counts per table.
    If nothing is new, total_inserted = 0 (not an error).
    """
    try:
        from etl.opdb_sync.sync_engine import sync_opdb_to_dwh
        result = sync_opdb_to_dwh()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    return result
