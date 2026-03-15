# app/routers/admin.py
import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.auth import require_role
from etl.pipeline.file_processor import process_file, process_all_raw_files
from dotenv import load_dotenv

router = APIRouter(prefix="/admin/data", tags=["Admin Data"])

# Base directory = Backend/

load_dotenv()
BASE_DIR      = os.getenv("BASE_DIR")
RAW_DIR       = os.path.join(BASE_DIR, "etl", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "etl", "processed")
REJECTED_DIR  = os.path.join(BASE_DIR, "etl", "rejected")

# Ensure folders exist
for folder in [RAW_DIR, PROCESSED_DIR, REJECTED_DIR]:
    os.makedirs(folder, exist_ok=True)


def file_info(filepath: str) -> dict:
    """Return metadata for a single file."""
    filename = os.path.basename(filepath)
    size_kb  = round(os.path.getsize(filepath) / 1024, 1)

    # Extract agency name from filename
    import re
    match = re.search(r'-(.+)$', filename.replace(".xlsx", ""))
    agency = match.group(1).strip().title() if match else "Unknown"

    return {
        "filename": filename,
        "agency":   agency,
        "size_kb":  size_kb,
    }


# ============================================================
# GET /admin/data/files
# List all files in raw/ folder (pending treatment)
# ============================================================
@router.get("/files")
def list_raw_files(current_user=Depends(require_role("Administrateur BI"))):
    files = [
        os.path.join(RAW_DIR, f)
        for f in os.listdir(RAW_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    return {
        "count": len(files),
        "files": [file_info(f) for f in files]
    }


# ============================================================
# GET /admin/data/processed
# List all successfully processed files
# ============================================================
@router.get("/processed")
def list_processed_files(current_user=Depends(require_role("Administrateur BI"))):
    files = [
        os.path.join(PROCESSED_DIR, f)
        for f in os.listdir(PROCESSED_DIR)
        if f.endswith(".xlsx") and not f.startswith("~$")
    ]
    return {
        "count": len(files),
        "files": [file_info(f) for f in files]
    }


# ============================================================
# POST /admin/data/upload
# Upload one or more xlsx files to etl/raw/
# ============================================================
@router.post("/upload")
def upload_files(
    files: list[UploadFile] = File(...),
    current_user=Depends(require_role("Administrateur BI"))
):
    saved = []
    errors = []

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
        "saved":  saved,
        "errors": errors,
        "message": f"{len(saved)} file(s) uploaded successfully."
    }


# ============================================================
# POST /admin/data/run
# Trigger ETL on all files currently in raw/
# ============================================================
@router.post("/run")
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
        sum(r[table]["inserted"] for table in ["users", "vehicles", "opportunities", "quotes"])
        for r in reports
    )
    total_skipped = sum(
        sum(r[table]["skipped"] for table in ["users", "vehicles", "opportunities", "quotes"])
        for r in reports
    )
    failed = [r for r in reports if r["status"] == "failed"]

    return {
        "files_processed": len(reports),
        "files_failed":    len(failed),
        "total_inserted":  total_inserted,
        "total_skipped":   total_skipped,
        "reports":         reports
    }