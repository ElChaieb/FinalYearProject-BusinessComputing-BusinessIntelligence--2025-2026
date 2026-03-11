# etl/utils/db.py
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv("DWH_HOST", "localhost"),
        port=os.getenv("DWH_PORT", 5432),
        database=os.getenv("DWH_NAME", "datawarehouse"),
        user=os.getenv("DWH_USER"),
        password=os.getenv("DWH_PASSWORD")
    )
