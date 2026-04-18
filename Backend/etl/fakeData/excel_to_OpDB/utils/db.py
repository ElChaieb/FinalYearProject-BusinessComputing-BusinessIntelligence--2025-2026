# opdb_etl/utils/db.py
# ============================================================
# SQL Server connection utility.
# pip install pyodbc
# Requires: ODBC Driver 17 (or 18) for SQL Server installed.
# ============================================================

import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()


def get_connection() -> pyodbc.Connection:
    """
    Returns a pyodbc connection to the MS SQL Server Operational DB.

    .env variables:
        OPDB_SERVER   = localhost        (or IP)
        OPDB_PORT     = 1433
        OPDB_NAME     = OperationalDB
        OPDB_USER     = sa
        OPDB_PASSWORD = your_password
        OPDB_DRIVER   = ODBC Driver 17 for SQL Server
    """
    server   = os.getenv("OPDB_SERVER",  "localhost")
    port     = os.getenv("OPDB_PORT",    "1433")
    database = os.getenv("OPDB_NAME",    "OperationalDB")
    user     = os.getenv("OPDB_USER")
    password = os.getenv("OPDB_PASSWORD")
    driver   = os.getenv("OPDB_DRIVER",  "ODBC Driver 17 for SQL Server")

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},{port};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)
