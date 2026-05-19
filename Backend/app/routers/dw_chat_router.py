# Backend/app/routers/dw_chat.py
# Append this router to your existing FastAPI app, or merge into ai_analysis.py

import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import re
import sqlalchemy
from sqlalchemy import text, inspect

load_dotenv()

router = APIRouter()

# FIX #3: validate OLLAMA_URL at startup and strip trailing slash consistently
_ollama_base = os.getenv("OLLAMA_URL")
if not _ollama_base:
    raise RuntimeError("OLLAMA_URL is not set in the environment / .env file.")
# FIX #7: .rstrip('/') prevents double-slash if the env var has a trailing slash
OLLAMA_URL = _ollama_base.rstrip("/") + "/api/generate"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

DW_CONNECTION_STRING = os.getenv("DWH_CONNECTION_STRING")
if not DW_CONNECTION_STRING:
    raise RuntimeError("DWH_CONNECTION_STRING is not set in the environment / .env file.")

# FIX #1: lazy engine — only created on first use, so a DB outage at startup
# does NOT crash the entire FastAPI process.
_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = sqlalchemy.create_engine(DW_CONNECTION_STRING, pool_pre_ping=True)
    return _engine


# ── Schema introspection ───────────────────────────────────────────────────────

def get_schema_summary(max_tables: int = 40) -> str:
    """
    Returns a compact text description of the DW schema:
        table_name (col1 TYPE, col2 TYPE, ...)
    Capped at max_tables to keep the prompt manageable.
    """
    insp = inspect(get_engine())  # FIX #1: use lazy getter
    lines = []
    # FIX #8: filter to the 'public' schema so system/internal tables are excluded.
    # Remove the schema= argument if your DW uses a different default schema.
    for table_name in insp.get_table_names(schema="public")[:max_tables]:
        cols = insp.get_columns(table_name, schema="public")
        col_defs = ", ".join(
            f"{c['name']} {str(c['type'])}" for c in cols
        )
        lines.append(f"{table_name} ({col_defs})")
    return "\n".join(lines)


# ── Safety guard ───────────────────────────────────────────────────────────────

DANGEROUS_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)

def is_safe_sql(sql: str) -> bool:
    """Allow only SELECT statements; block DML/DDL and stacked queries."""
    # FIX #2: strip a single trailing semicolon before checks so a well-formed
    # "SELECT ...;" is accepted, but "SELECT ...; DROP TABLE ..." is caught by
    # the ";" in stripped check below.
    stripped = sql.strip().rstrip(";")
    if not stripped.upper().startswith("SELECT"):
        return False
    if DANGEROUS_KEYWORDS.search(stripped):
        return False
    # FIX #2: block stacked queries — an LLM could emit
    # "SELECT 1; DROP TABLE users--" which passes startswith("SELECT") alone.
    if ";" in stripped:
        return False
    return True


# ── LLM helpers ───────────────────────────────────────────────────────────────

async def llm(prompt: str, timeout: int = 60) -> str:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        })
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


async def nl_to_sql(question: str, schema: str) -> str:
    prompt = f"""You are a SQL expert. Convert the user's question into a valid SQL SELECT query.

=== DATABASE SCHEMA ===
{schema}

=== RULES ===
- Output ONLY the raw SQL query, nothing else — no explanation, no markdown, no backticks.
- Use only SELECT statements. Never INSERT, UPDATE, DELETE, DROP, or any DDL.
- If the question cannot be answered with the available schema, output exactly: CANNOT_ANSWER
- Use table and column names exactly as they appear in the schema.
- Limit results to 200 rows unless the user asks for something specific.

=== USER QUESTION ===
{question}

SQL:"""
    return await llm(prompt)


async def explain_results(question: str, sql: str, rows: list, columns: list) -> str:
    # Truncate to 50 rows in the explanation prompt to save tokens
    sample = rows[:50]
    rows_text = "\n".join(
        "  " + ", ".join(f"{col}: {val}" for col, val in zip(columns, row))
        for row in sample
    )
    truncation_note = f"\n(showing first 50 of {len(rows)} total rows)" if len(rows) > 50 else ""

    prompt = f"""You are a friendly data analyst assistant. A user asked a question about business data.

=== USER QUESTION ===
{question}

=== SQL THAT WAS RUN ===
{sql}

=== QUERY RESULTS ({len(rows)} rows){truncation_note} ===
{rows_text if rows_text else "(no rows returned)"}

=== YOUR TASK ===
Explain the results clearly in plain language, as if talking to a business user.
- Lead with the direct answer to their question.
- Highlight any notable numbers, trends, or patterns.
- If there are no results, say so and suggest why that might be.
- Keep it concise (3–6 sentences). Do not repeat the SQL.
"""
    return await llm(prompt, timeout=90)


# ── Request / response models ──────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[list]
    total_rows: int
    explanation: str


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/ai/query-dw", response_model=QueryResponse)
async def query_datawarehouse(req: QueryRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # 1. Get schema context
    try:
        schema = get_schema_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read schema: {e}")

    # 2. Generate SQL
    sql = await nl_to_sql(question, schema)

    if sql == "CANNOT_ANSWER":
        return QueryResponse(
            question=question,
            sql="",
            columns=[],
            rows=[],
            total_rows=0,
            explanation="I couldn't find data in the warehouse that would answer this question. "
                        "The schema may not contain the information you're looking for.",
        )

    # 3. Safety check
    if not is_safe_sql(sql):
        raise HTTPException(
            status_code=400,
            detail=f"Generated SQL failed safety check (non-SELECT or dangerous keyword). SQL: {sql}",
        )

    # 4. Execute
    try:
        with get_engine().connect() as conn:  # FIX #1: use lazy getter
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [list(row) for row in result.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SQL execution error: {e}\n\nGenerated SQL:\n{sql}")

    # 5. Explain results in plain language
    explanation = await explain_results(question, sql, rows, columns)

    return QueryResponse(
        question=question,
        sql=sql,
        columns=columns,
        rows=rows[:200],       # cap the payload
        total_rows=len(rows),
        explanation=explanation,
    )
