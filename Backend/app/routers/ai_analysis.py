# Backend/app/routers/ai_analysis.py
from fastapi import APIRouter
import httpx
import os
from dotenv import load_dotenv
import zipfile
import openpyxl
import pandas as pd

# Load environment variables from .env if present
load_dotenv()

router = APIRouter()

# Ollama settings: allow overriding via .env (e.g. OLLAMA_URL=http://ollama:11434)
_ollama_base = os.getenv("OLLAMA_URL")
if not _ollama_base:
    raise RuntimeError("OLLAMA_URL is not set in the environment / .env file.")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
# FIX #1 (shared with dw_chat_router): strip trailing slash before appending path
OLLAMA_URL = f"{_ollama_base.rstrip('/')}/api/generate"

# FIX #3 (Docker path): use a Docker-friendly default that works when WORKDIR=/app
# The env var override (REJECTED_DIR) is the right way to customise this per environment.
from app.config import REJECTED_DIR_STR as REJECTED_DIR

BUSINESS_RULES = """
Each uploaded Excel file must contain two mandatory sheets: 'OP' and 'DEVIS'.

Sheet OP - Required columns:
- Oppo_OpportunityId   : unique opportunity ID
- Oppo_CreatedDate     : date the opportunity was created
- Oppo_AssignedUserId  : ID of the assigned salesperson
- User_LastName        : salesperson last name
- User_FirstName       : salesperson first name
- User_EmailAddress    : salesperson email
- Chan_Description     : agency/channel name
- Comp_Name            : client company name

Sheet OP - Optional (missing = warning only, not rejection):
- Oppo_Deleted, Addr_City, Emai_EmailAddress

Sheet DEVIS - Required columns:
- Quot_opportunityid   : links quote to an opportunity
- Quot_OrderQuoteID    : unique quote ID
- AR_Ref               : vehicle reference (primary key)
- User_LastName        : salesperson last name
- User_FirstName       : salesperson first name

Sheet DEVIS - Optional (missing = warning only):
- User_UserId, Quot_CreatedDate, AR_Design, Marque, Modele

Sheet SALES - Fully optional. If present, expected columns:
quote_id, oppo_id, ar_ref, user_id, sale_date, quantity, final_price

A file is REJECTED when:
- Sheet 'OP' or 'DEVIS' is completely missing
- Either mandatory sheet is empty
- Any required column listed above is absent from its sheet
"""


def _read_with_openpyxl(fpath):
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    sheets = {}
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        headers = []
        for row in ws.iter_rows(min_row=1, max_row=1, values_only=True):
            headers = [str(c) for c in row if c is not None]
            break
        sheets[sheet_name] = headers
    wb.close()
    return sheets


def _read_with_pandas(fpath):
    sheets = {}
    try:
        xl = pd.ExcelFile(fpath, engine="openpyxl")
    except Exception:
        xl = pd.ExcelFile(fpath, engine="xlrd")
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name, nrows=0)
        sheets[sheet_name] = list(df.columns.astype(str))
    return sheets


def _read_as_zip(fpath):
    """Last resort: open as raw zip to at least get sheet names."""
    sheets = {}
    with zipfile.ZipFile(fpath, "r") as z:
        for name in z.namelist():
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                sheets[name.split("/")[-1].replace(".xml", "")] = []
    return sheets


def read_rejected_files():
    results = []

    if not os.path.exists(REJECTED_DIR):
        return results

    for fname in sorted(os.listdir(REJECTED_DIR)):
        if not fname.lower().endswith(".xlsx"):
            continue

        fpath = os.path.join(REJECTED_DIR, fname)
        file_info = {"filename": fname, "sheets": {}}

        # Strategy 1: openpyxl (standard)
        try:
            file_info["sheets"] = _read_with_openpyxl(fpath)
            results.append(file_info)
            continue
        except Exception:
            pass

        # Strategy 2: pandas (handles some XML quirks openpyxl rejects)
        try:
            file_info["sheets"] = _read_with_pandas(fpath)
            results.append(file_info)
            continue
        except Exception:
            pass

        # Strategy 3: raw zip (sheet names only, no column info)
        try:
            file_info["sheets"] = _read_as_zip(fpath)
            file_info["partial_read"] = True
            results.append(file_info)
            continue
        except Exception as e:
            file_info["read_error"] = (
                "File is unreadable by all methods — it may be corrupted, "
                "password-protected, or saved in an unsupported format. "
                f"Detail: {e}"
            )
            results.append(file_info)

    return results


@router.get("/ai/analyze-rejected")
async def analyze_rejected():
    rejected_files = read_rejected_files()

    if not rejected_files:
        return {
            "total_rejected": 0,
            "analysis": "No rejected files found in the rejected folder."
        }

    file_summaries = []
    for f in rejected_files:
        if "read_error" in f:
            file_summaries.append(
                f"- {f['filename']}: UNREADABLE — {f['read_error']}"
            )
        elif f.get("partial_read"):
            sheet_names = list(f["sheets"].keys())
            file_summaries.append(
                f"- {f['filename']}: Partially readable. "
                f"Sheets detected: {sheet_names}. Column headers could not be extracted."
            )
        else:
            sheet_lines = []
            for sheet, cols in f["sheets"].items():
                col_str = ", ".join(cols) if cols else "(empty — no headers found)"
                sheet_lines.append(f"    Sheet '{sheet}': {col_str}")
            body = "\n".join(sheet_lines) if sheet_lines else "    (no sheets found)"
            file_summaries.append(f"- {f['filename']}:\n{body}")

    files_block = "\n".join(file_summaries)

    prompt = f"""You are a data quality assistant for a CRM/sales ETL pipeline.

The following Excel files were REJECTED during the ETL validation process.
Analyze each file and explain exactly why it was rejected based on the rules below.

=== BUSINESS RULES ===
{BUSINESS_RULES}

=== REJECTED FILES (sheet names and column headers actually found in each file) ===
{files_block}

=== YOUR TASK ===
For each rejected file:
1. State the exact reason(s) it failed (missing sheet, missing required columns, empty sheet, or unreadable file)
2. List specifically which sheets or columns are missing by name
3. Give a clear, practical fix instruction for the person who uploaded the file

If multiple files share the same problem, group them together.
For UNREADABLE files, explain that the file itself is corrupted or in the wrong format,
and tell the user to re-export it from the source CRM system as a proper .xlsx file.
Be concise and direct. The audience is a business user, not a developer.
"""

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,  # FIX #1: was hardcoded "llama3.2", now uses env var
            "prompt": prompt,
            "stream": False
        })
        response.raise_for_status()  # FIX #2: propagate HTTP errors from Ollama
        result = response.json()

    return {
        "total_rejected": len(rejected_files),
        "analysis": result.get("response", "No response from model.")
    }
