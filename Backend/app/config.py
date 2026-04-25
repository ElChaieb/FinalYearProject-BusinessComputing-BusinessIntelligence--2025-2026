"""
Centralized configuration for paths and environment variables.
Uses relative paths based on project structure instead of hardcoded absolute paths.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ── Project Structure ──────────────────────────────────────────────────────────
# Get the Backend directory (one level up from this file)
PROJECT_ROOT = Path(__file__).parent.parent

# ETL Directories
ETL_DIR = PROJECT_ROOT / "etl"
RAW_DIR = ETL_DIR / "raw"
PROCESSED_DIR = ETL_DIR / "processed"
REJECTED_DIR = ETL_DIR / "rejected"
LOGS_DIR = ETL_DIR / "logs"

# Create directories if they don't exist
for directory in [RAW_DIR, PROCESSED_DIR, REJECTED_DIR, LOGS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Convert to strings for compatibility with os.path
BASE_DIR = str(PROJECT_ROOT)
RAW_DIR_STR = str(RAW_DIR)
PROCESSED_DIR_STR = str(PROCESSED_DIR)
REJECTED_DIR_STR = str(REJECTED_DIR)
LOGS_DIR_STR = str(LOGS_DIR)

# ── Database Configuration ─────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/app_db")

# ── Data Warehouse Configuration ───────────────────────────────────────────────
DWH_HOST = os.getenv("DWH_HOST", "localhost")
DWH_PORT = int(os.getenv("DWH_PORT", 5432))
DWH_NAME = os.getenv("DWH_NAME", "warehouse_v2")
DWH_USER = os.getenv("DWH_USER", "admin")
DWH_PASSWORD = os.getenv("DWH_PASSWORD", "admin")

# ── Operational Database (SQL Server) Configuration ────────────────────────────
OPDB_SERVER = os.getenv("OPDB_SERVER", "localhost")
OPDB_PORT = int(os.getenv("OPDB_PORT", 1433))
OPDB_NAME = os.getenv("OPDB_NAME", "OperationalDB")
OPDB_USER = os.getenv("OPDB_USER", "sa")
OPDB_PASSWORD = os.getenv("OPDB_PASSWORD", "Password7@")
OPDB_DRIVER = os.getenv("OPDB_DRIVER", "ODBC Driver 17 for SQL Server")

# ── JWT Configuration ──────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# ── Email Configuration ────────────────────────────────────────────────────────
MAIL_EMAIL = os.getenv("MAIL_EMAIL")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
