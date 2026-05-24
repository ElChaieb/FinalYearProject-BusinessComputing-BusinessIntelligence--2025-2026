# Backend/app/routers/dw_chat_router.py
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import re
import sqlalchemy
from sqlalchemy import text, inspect, MetaData, Table
from sqlalchemy.sql import sqltypes
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import logging

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Ollama configuration
_ollama_base = os.getenv("OLLAMA_URL")
if not _ollama_base:
    raise RuntimeError("OLLAMA_URL is not set in the environment / .env file.")
OLLAMA_URL = _ollama_base.rstrip("/") + "/api/generate"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

DW_CONNECTION_STRING = os.getenv("DWH_CONNECTION_STRING")
if not DW_CONNECTION_STRING:
    raise RuntimeError("DWH_CONNECTION_STRING is not set in the environment / .env file.")

_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = sqlalchemy.create_engine(
            DW_CONNECTION_STRING, 
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10
        )
    return _engine

# ── Enhanced Schema Introspection ───────────────────────────────────────────────

# Build a detailed summary of the public schema (columns, FKs, samples)
def get_detailed_schema_summary() -> Dict[str, Any]:
    """
    Returns detailed schema information including:
    - Table relationships
    - Foreign keys
    - Data types with descriptions
    - Sample data for context
    """
    engine = get_engine()
    inspector = inspect(engine)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    
    schema_info = {
        "tables": {},
        "relationships": [],
        "summary": ""
    }
    
    # Get all tables in public schema
    for table_name in inspector.get_table_names(schema="public"):
        # Get columns with types and nullable info
        columns = []
        for col in inspector.get_columns(table_name, schema="public"):
            col_info = {
                "name": col['name'],
                "type": str(col['type']),
                "nullable": col['nullable'],
                "default": str(col.get('default', 'None'))
            }
            columns.append(col_info)
        
        # Get primary keys
        pk_constraint = inspector.get_pk_constraint(table_name, schema="public")
        primary_keys = pk_constraint.get('constrained_columns', []) if pk_constraint else []
        
        # Get foreign keys
        foreign_keys = []
        for fk in inspector.get_foreign_keys(table_name, schema="public"):
            foreign_keys.append({
                "column": fk['constrained_columns'],
                "references": f"{fk['referred_schema']}.{fk['referred_table']}({fk['referred_columns']})"
            })
        
        # Get row count for context
        try:
            with engine.connect() as conn:
                count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                row_count = count_result.scalar()
        except Exception:
            row_count = "unknown"
        
        # Get sample data (first 3 rows)
        sample_data = []
        try:
            with engine.connect() as conn:
                sample_result = conn.execute(text(f"SELECT * FROM {table_name} LIMIT 3"))
                sample_data = [dict(row._mapping) for row in sample_result]
        except Exception:
            sample_data = []
        
        schema_info["tables"][table_name] = {
            "columns": columns,
            "primary_keys": primary_keys,
            "foreign_keys": foreign_keys,
            "row_count": row_count,
            "sample_data": sample_data
        }
    
    # Build relationships summary
    for table_name, table_info in schema_info["tables"].items():
        for fk in table_info["foreign_keys"]:
            schema_info["relationships"].append(
                f"{table_name}.{fk['column']} -> {fk['references']}"
            )
    
    # Create human-readable summary
    summary_lines = []
    for table_name, table_info in schema_info["tables"].items():
        col_names = [col["name"] for col in table_info["columns"]]
        summary_lines.append(
            f"Table '{table_name}' ({table_info['row_count']} rows): "
            f"Columns: {', '.join(col_names[:10])}{'...' if len(col_names) > 10 else ''}"
        )
    schema_info["summary"] = "\n".join(summary_lines)
    
    return schema_info

# Return a compact textual schema summary suitable for inclusion in LLM prompts
def get_schema_summary(max_tables: int = 40) -> str:
    """Returns compact text description for LLM prompt"""
    schema_info = get_detailed_schema_summary()
    return schema_info["summary"]

# ── Query Analysis and Optimization ───────────────────────────────────────────

# Utility class that analyzes SQL and suggests optimizations
class QueryAnalyzer:
    """Analyzes and optimizes SQL queries before execution"""
    
    @staticmethod
    def analyze_query(sql: str) -> Dict[str, Any]:
        """Analyze query for potential issues"""
        analysis = {
            "has_joins": bool(re.search(r'\bJOIN\b', sql, re.IGNORECASE)),
            "has_where": bool(re.search(r'\bWHERE\b', sql, re.IGNORECASE)),
            "has_group_by": bool(re.search(r'\bGROUP\s+BY\b', sql, re.IGNORECASE)),
            "has_order_by": bool(re.search(r'\bORDER\s+BY\b', sql, re.IGNORECASE)),
            "has_limit": bool(re.search(r'\bLIMIT\b', sql, re.IGNORECASE)),
            "potential_issues": []
        }
        
        # Check for missing LIMIT on large tables
        if not analysis["has_limit"] and "SELECT" in sql.upper():
            analysis["potential_issues"].append("No LIMIT clause - may return many rows")
        
        # Check for SELECT *
        if re.search(r'SELECT\s+\*', sql, re.IGNORECASE):
            analysis["potential_issues"].append("SELECT * used - consider specifying columns")
        
        # Check for potential cartesian products
        if analysis["has_joins"] and not analysis["has_where"]:
            analysis["potential_issues"].append("JOIN without WHERE - possible cartesian product")
        
        return analysis
    
    @staticmethod
    def suggest_optimizations(sql: str, analysis: Dict[str, Any]) -> str:
        """Generate optimization suggestions"""
        suggestions = []
        
        if "No LIMIT clause" in analysis["potential_issues"]:
            suggestions.append("Add LIMIT 100 to restrict results")
        
        if "SELECT * used" in analysis["potential_issues"]:
            suggestions.append("Specify only needed columns for better performance")
        
        if suggestions:
            return f"Optimization suggestions: {'; '.join(suggestions)}"
        return "Query looks well-optimized"

# ── Enhanced Safety Guard ───────────────────────────────────────────────────────

DANGEROUS_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|COMMIT|ROLLBACK)\b",
    re.IGNORECASE,
)

# Check whether a SQL statement is a safe single SELECT and return feedback
def is_safe_sql(sql: str) -> tuple[bool, str]:
    """Enhanced safety check with detailed feedback"""
    stripped = sql.strip().rstrip(";")
    
    if not stripped.upper().startswith("SELECT"):
        return False, "Query must be a SELECT statement"
    
    if DANGEROUS_KEYWORDS.search(stripped):
        return False, "Query contains dangerous keywords (INSERT, UPDATE, DELETE, etc.)"
    
    if ";" in stripped:
        return False, "Multiple statements detected - only single SELECT allowed"
    
    # Check for potential timeouts (very complex queries)
    if stripped.upper().count("JOIN") > 5:
        return False, "Too many JOINs - query may timeout"
    
    # Check for inconsistent aliases (catches model hallucinations like fs vs f)
    alias_pattern = re.compile(
        r'(?:FROM|JOIN)\s+\w+\s+(?:AS\s+)?(\w+)', re.IGNORECASE
    )
    defined_aliases = set(alias_pattern.findall(stripped))
    ref_pattern = re.compile(r'([a-z_][a-z0-9_]*)\.', re.IGNORECASE)
    used_aliases = set(ref_pattern.findall(stripped))
    # Remove known SQL keywords that might match
    used_aliases -= {"NULL", "TRUE", "FALSE"}
    undefined = used_aliases - defined_aliases
    # Filter out table names used directly without alias
    known_tables = {
        "dim_user", "dim_client", "dim_vehicle",
        "fact_opportunities", "fact_quotes", "fact_sales"
    }
    undefined -= known_tables
    if undefined:
        return False, f"Query references undefined aliases: {undefined}. This is a SQL generation error — please rephrase your question."
    
    return True, "Query is safe"

# ── Enhanced LLM Prompts ───────────────────────────────────────────────────────

async def llm_with_retry(prompt: str, timeout: int = 60, retries: int = 2) -> str:
    """Call the LLM with retries and return the cleaned response"""
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(OLLAMA_URL, json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Lower temperature for more consistent SQL
                        "num_predict": 1500,
                        "top_k": 40,
                        "top_p": 0.9
                    }
                })
                resp.raise_for_status()
                result = resp.json().get("response", "").strip()
                
                # Clean up markdown code blocks if present
                result = re.sub(r'```sql\n?', '', result)
                result = re.sub(r'```\n?', '', result)
                return result
        except Exception as e:
            logger.warning(f"LLM attempt {attempt + 1} failed: {e}")
            if attempt == retries - 1:
                raise
    return ""

# ── Annotated schema injected into every prompt ─────────────────────────────
ANNOTATED_SCHEMA = """
You are working with a car dealership CRM data warehouse (PostgreSQL, star schema).

CRITICAL TERMINOLOGY — read carefully before writing any query:
- "client" or "customer" = a person who buys or might buy a car → use dim_client
- "user", "salesperson", "commercial", "agent", "employee" → use dim_user (these are INTERNAL staff, NOT customers)
- Never confuse dim_client (customers) with dim_user (salespeople)

=== TABLE: dim_user ===
Purpose: Internal employees — salespeople, agency managers, directors.
NOT customers. These are the people who SELL cars.
Columns:
  user_id     INT PRIMARY KEY   — unique ID for the salesperson
  last_name   VARCHAR           — salesperson family name
  first_name  VARCHAR           — salesperson first name
  email       VARCHAR           — salesperson work email
  role        VARCHAR           — their role (Commercial, Agency Manager, etc.)
  agency_name VARCHAR           — which agency/branch they belong to

=== TABLE: dim_client ===
Purpose: Customers — people who buy or are offered cars.
These are EXTERNAL people, not employees.
Columns:
  client_id   SERIAL PRIMARY KEY — unique ID for the customer
  full_name   VARCHAR            — customer full name
  email       VARCHAR            — customer email
  city        VARCHAR            — customer city

=== TABLE: dim_vehicle ===
Purpose: Car catalogue — all vehicles available for sale.
Columns:
  ar_ref      VARCHAR PRIMARY KEY — internal vehicle reference code
  ar_design   VARCHAR             — full vehicle description
  brand       VARCHAR             — car brand (e.g. Toyota, Volkswagen)
  model       VARCHAR             — car model name
  category    VARCHAR             — vehicle category
  base_price  NUMERIC             — catalogue price before negotiation

=== TABLE: fact_opportunities ===
Purpose: Sales leads — when a salesperson opens a dossier for a potential client.
An opportunity is created when a client shows interest. It may or may not lead to a quote.
Columns:
  oppo_id          INT PRIMARY KEY
  user_id          INT → dim_user(user_id)   — salesperson who owns this lead
  client_id        INT → dim_client(client_id) — the potential customer
  agency_name      VARCHAR                   — agency handling this opportunity
  created_date     DATE                      — when the lead was opened
  client_reference VARCHAR
  deleted          BOOLEAN                   — soft delete flag; use WHERE deleted = FALSE

=== TABLE: fact_quotes ===
Purpose: Price quotes — when a salesperson sends a formal price offer to a client for a specific vehicle.
One opportunity can have multiple quotes for different vehicles.
Columns:
  quote_id     INT PRIMARY KEY
  oppo_id      INT                           — which opportunity this quote belongs to
  ar_ref       VARCHAR → dim_vehicle(ar_ref) — which vehicle was quoted
  user_id      INT → dim_user(user_id)       — salesperson who issued the quote
  client_id    INT → dim_client(client_id)   — client who received the quote
  agency_name  VARCHAR
  price        NUMERIC                       — quoted price
  created_date DATE
  deleted      BOOLEAN                       — use WHERE deleted = FALSE

=== TABLE: fact_sales ===
Purpose: Completed sales — a quote that was accepted and turned into a real purchase.
This is the most important table for revenue analysis.
Columns:
  sale_id     SERIAL PRIMARY KEY
  quote_id    INT UNIQUE                    — which quote was accepted
  oppo_id     INT                           — original opportunity
  user_id     INT → dim_user(user_id)       — salesperson who made the sale
  client_id   INT → dim_client(client_id)   — customer who bought
  ar_ref      VARCHAR → dim_vehicle(ar_ref) — vehicle sold
  agency_name VARCHAR                       — agency that made the sale
  sale_date   DATE                          — when the sale happened
  quantity    INT                           — number of units sold
  final_price NUMERIC                       — actual sale price (after negotiation)
  
  IMPORTANT: fact_sales has NO deleted column. Never add WHERE fact_sales.deleted = FALSE.
  Only fact_opportunities and fact_quotes have a deleted column.'''

=== RELATIONSHIPS ===
fact_sales.user_id    → dim_user.user_id
fact_sales.client_id  → dim_client.client_id
fact_sales.ar_ref     → dim_vehicle.ar_ref
fact_quotes.user_id   → dim_user.user_id
fact_quotes.client_id → dim_client.client_id
fact_quotes.ar_ref    → dim_vehicle.ar_ref
fact_quotes.oppo_id   → fact_opportunities.oppo_id
fact_opportunities.user_id   → dim_user.user_id
fact_opportunities.client_id → dim_client.client_id

=== COMMON PATTERNS ===
Revenue:          SELECT SUM(final_price) FROM fact_sales
Top salespeople:  ... JOIN dim_user u ON s.user_id = u.user_id GROUP BY u.user_id, u.first_name, u.last_name ORDER BY SUM(final_price) DESC
Top customers:    ... JOIN dim_client c ON s.client_id = c.client_id GROUP BY c.client_id, c.full_name ORDER BY SUM(final_price) DESC
By month:         EXTRACT(MONTH FROM sale_date), DATE_TRUNC('month', sale_date)
By agency:        GROUP BY agency_name
Conversion rate:  COUNT(DISTINCT fact_sales.quote_id) / COUNT(DISTINCT fact_quotes.quote_id)
Active records:   WHERE deleted = FALSE
"""


# Convert a natural language question to a safe SQL query using the annotated schema
async def nl_to_sql(question: str, schema: str = "", conversation_history: List[Dict] = None) -> str:
    """Convert natural language to SQL with rich annotated schema context"""
    
    context = ""
    if conversation_history:
        recent = conversation_history[-3:]
        context = "\n=== PREVIOUS CONVERSATION ===\n"
        for exchange in recent:
            context += f"Q: {exchange.get('question', '')}\nSQL: {exchange.get('sql', '')}\n"
    
    prompt = f"""You are an expert SQL analyst for a car dealership CRM data warehouse.
Convert the user's question into accurate PostgreSQL.

{ANNOTATED_SCHEMA}

{context}

=== RULES ===
- Output ONLY the SQL query, no explanations, no markdown, no backticks
- Use only SELECT statements (read-only)
- Always JOIN the relevant dimension tables to show names, not just IDs
- Add LIMIT 100 unless the question asks for aggregated totals
- Use COALESCE for NULL handling where appropriate
- For "customers" or "clients" → always use dim_client, never dim_user
- For "salespeople", "commercials", "agents", "employees" → always use dim_user
- If the question cannot be answered with the available tables, output exactly: CANNOT_ANSWER
- ALIAS CONSISTENCY: every alias you define in FROM/JOIN must be used consistently throughout the query. Never reference a table with an alias you did not define. Double-check every column reference before outputting.
- Before outputting, mentally verify: for every "x.column" in the query, confirm "x" was defined as an alias in FROM or JOIN.

=== USER QUESTION ===
{question}

SQL:"""
    
    return await llm_with_retry(prompt)

async def analyze_results(
    question: str, 
    sql: str, 
    rows: List[Any], 
    columns: List[str],
    execution_time: float = None
) -> str:
    """Enhanced result analysis with insights and recommendations"""
    
    # Prepare data summary
    total_rows = len(rows)
    sample_size = min(30, total_rows)
    sample = rows[:sample_size]
    
    # Calculate basic statistics for numeric columns
    stats = {}
    if rows and columns:
        for col_idx, col_name in enumerate(columns):
            # Check if column is numeric
            numeric_values = []
            for row in rows[:100]:  # Check first 100 rows
                val = row[col_idx] if col_idx < len(row) else None
                if val is not None and isinstance(val, (int, float)):
                    numeric_values.append(val)
            
            if numeric_values:
                stats[col_name] = {
                    "min": min(numeric_values),
                    "max": max(numeric_values),
                    "avg": sum(numeric_values) / len(numeric_values),
                    "count": len(numeric_values)
                }
    
    rows_text = "\n".join(
        "  " + ", ".join(f"{col}: {val}" for col, val in zip(columns, row))
        for row in sample
    )
    
    truncation_note = f"\n(showing first {sample_size} of {total_rows} total rows)" if total_rows > sample_size else ""
    stats_text = f"\n=== DATA STATISTICS ===\n{json.dumps(stats, indent=2)}" if stats else ""
    time_text = f"\n=== EXECUTION TIME ===\n{execution_time:.2f} seconds" if execution_time else ""
    
    prompt = f"""You are a senior business analyst. Analyze these query results and provide actionable insights.

=== USER QUESTION ===
{question}

=== SQL QUERY ===
{sql}

=== RESULTS ({total_rows} rows){truncation_note} ===
{rows_text if rows_text else "(no rows returned)"}

{stats_text}
{time_text}

=== YOUR TASK ===
Provide a comprehensive analysis in 5-8 sentences:

1. **Direct Answer**: Start with a clear answer to the user's question
2. **Key Insights**: Highlight the most important numbers, trends, or patterns
3. **Business Implications**: What does this mean for the business?
4. **Recommendations**: Suggest follow-up questions or actions
5. **Data Quality Notes**: Mention any limitations or caveats

If no results:
- Explain possible reasons (date range, filters, data availability)
- Suggest how to get better results
- Don't just say "no data"

Be professional but conversational. Focus on business value, not technical details.
Avoid repeating the SQL query structure.

ANALYSIS:"""
    
    return await llm_with_retry(prompt, timeout=90)

async def suggest_followup_questions(question: str, results_summary: str) -> List[str]:
    """Generate relevant follow-up questions based on current query"""
    
    prompt = f"""Based on the user's question and results, suggest 3 relevant follow-up questions.

=== USER QUESTION ===
{question}

=== RESULTS SUMMARY ===
{results_summary[:500]}

Generate 3 natural follow-up questions that would provide deeper insight.
Each question should be on a new line, starting with "- ".

Example:
- What were the sales trends over the last 6 months?
- Which products have the highest profit margin?

FOLLOW-UP QUESTIONS:"""
    
    response = await llm_with_retry(prompt, timeout=30)
    
    # Parse questions
    questions = []
    for line in response.split('\n'):
        line = line.strip()
        if line.startswith('- '):
            questions.append(line[2:])
        elif line.startswith('* '):
            questions.append(line[2:])
        elif line and len(questions) < 3 and not line.startswith('Follow'):
            questions.append(line)
    
    return questions[:3]

# ── Request/Response Models ──────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    include_followups: bool = True

class QueryResponse(BaseModel):
    question: str
    sql: str
    columns: List[str]
    rows: List[List]
    total_rows: int
    explanation: str
    execution_time: Optional[float] = None
    optimization_suggestions: Optional[str] = None
    followup_questions: Optional[List[str]] = None
    query_analysis: Optional[Dict[str, Any]] = None

# ── Main Endpoint ───────────────────────────────────────────────────────────

@router.post("/ai/query-dw", response_model=QueryResponse)
async def query_datawarehouse(req: QueryRequest):
    """Enhanced endpoint for natural language queries with analysis"""
    
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    
    import time
    start_time = time.time()
    
    # 1. Schema is hardcoded with full business annotations (see ANNOTATED_SCHEMA)
    # Dynamic introspection is still available via /ai/dw-schema for debugging
    logger.info("Using annotated schema for SQL generation")

    # 2. Generate SQL
    try:
        sql = await nl_to_sql(question)
        logger.info(f"Generated SQL: {sql[:200]}...")
    except Exception as e:
        logger.error(f"SQL generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate SQL: {e}")
    
    if sql == "CANNOT_ANSWER":
        return QueryResponse(
            question=question,
            sql="",
            columns=[],
            rows=[],
            total_rows=0,
            explanation="I couldn't find data in the warehouse that would answer this question accurately. "
                       "The schema may not contain the information you're looking for, or the question "
                       "might need to be rephrased. Try asking about sales, opportunities, quotes, users, "
                       "clients, or vehicles instead.",
            execution_time=time.time() - start_time
        )
    
    # 3. Enhanced safety check
    is_safe, safety_message = is_safe_sql(sql)
    if not is_safe:
        logger.warning(f"Unsafe SQL blocked: {sql}")
        raise HTTPException(
            status_code=400,
            detail=f"Generated SQL failed safety check: {safety_message}\nSQL: {sql}"
        )
    
    # 4. Analyze query for optimization
    query_analysis = QueryAnalyzer.analyze_query(sql)
    optimization_suggestions = QueryAnalyzer.suggest_optimizations(sql, query_analysis)
    
    # 5. Execute with auto-fix retry
    rows = []
    columns = []
    max_sql_retries = 2
    for sql_attempt in range(max_sql_retries):
        try:
            with get_engine().connect() as conn:
                result = conn.execute(text(sql))
                columns = list(result.keys())
                rows = [list(row) for row in result.fetchall()]
                logger.info(f"Query returned {len(rows)} rows")
            break  # success
        except Exception as e:
            error_msg = str(e)
            logger.warning(f"SQL attempt {sql_attempt + 1} failed: {error_msg}")
            if sql_attempt < max_sql_retries - 1:
                # Ask the model to fix its own mistake
                fix_prompt = f"""The following PostgreSQL query has an error. Fix it and return ONLY the corrected SQL, no explanation.

ERROR: {error_msg[:300]}

BROKEN SQL:
{sql}

Common causes:
- Alias used in HAVING/WHERE that was never defined in FROM/JOIN (e.g. used "f." but table was aliased as "fs")
- Make sure every alias used in SELECT, WHERE, HAVING, ORDER BY was defined in FROM or JOIN

FIXED SQL:"""
                try:
                    sql = await llm_with_retry(fix_prompt, timeout=60)
                    logger.info(f"Model produced fixed SQL: {sql[:200]}")
                    # Safety check on fixed SQL too
                    is_safe, safety_msg = is_safe_sql(sql)
                    if not is_safe:
                        raise HTTPException(status_code=400, detail=f"Fixed SQL failed safety check: {safety_msg}")
                except HTTPException:
                    raise
                except Exception as fix_err:
                    logger.error(f"Fix attempt failed: {fix_err}")
                    raise HTTPException(status_code=500, detail=f"SQL execution error: {error_msg[:200]}\n\nGenerated SQL:\n{sql}")
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"SQL execution error after retry: {error_msg[:200]}\n\nGenerated SQL:\n{sql}"
                )
    
    execution_time = time.time() - start_time
    
    # 6. Enhanced result analysis
    try:
        explanation = await analyze_results(question, sql, rows, columns, execution_time)
    except Exception as e:
        logger.error(f"Result analysis error: {e}")
        explanation = f"Query returned {len(rows)} rows. For detailed analysis, please try rephrasing your question."
    
    # 7. Generate follow-up questions
    followup_questions = None
    if req.include_followups and len(rows) > 0:
        try:
            results_summary = f"Found {len(rows)} results. First result: {rows[0] if rows else 'None'}"
            followup_questions = await suggest_followup_questions(question, results_summary)
        except Exception as e:
            logger.warning(f"Follow-up generation failed: {e}")
    
    # 8. Return enhanced response
    return QueryResponse(
        question=question,
        sql=sql,
        columns=columns,
        rows=rows[:200],  # Cap payload size
        total_rows=len(rows),
        explanation=explanation,
        execution_time=execution_time,
        optimization_suggestions=optimization_suggestions if query_analysis["potential_issues"] else None,
        followup_questions=followup_questions,
        query_analysis=query_analysis
    )

# ── Additional Helper Endpoints ──────────────────────────────────────────────

@router.get("/ai/dw-schema")
async def get_warehouse_schema():
    """Endpoint to explore the data warehouse schema"""
    try:
        schema_info = get_detailed_schema_summary()
        return {
            "tables": list(schema_info["tables"].keys()),
            "relationships": schema_info["relationships"],
            "details": {
                table: {
                    "columns": len(info["columns"]),
                    "rows": info["row_count"],
                    "primary_keys": info["primary_keys"]
                }
                for table, info in schema_info["tables"].items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ai/dw-example-queries")
async def get_example_queries():
    """Provide example queries for common business questions"""
    return {
        "example_queries": [
            {
                "question": "What were the total sales by month for 2024?",
                "sql": "SELECT DATE_TRUNC('month', sale_date) as month, SUM(final_price) as total_sales FROM fact_sales WHERE EXTRACT(YEAR FROM sale_date) = 2024 GROUP BY month ORDER BY month"
            },
            {
                "question": "Who are the top 5 salespeople by revenue?",
                "sql": "SELECT u.first_name, u.last_name, u.agency_name, SUM(s.final_price) as total_revenue FROM fact_sales s JOIN dim_user u ON s.user_id = u.user_id GROUP BY u.user_id ORDER BY total_revenue DESC LIMIT 5"
            },
            {
                "question": "Which car models sell the most?",
                "sql": "SELECT v.brand, v.model, COUNT(*) as units_sold, SUM(s.final_price) as total_revenue FROM fact_sales s JOIN dim_vehicle v ON s.ar_ref = v.ar_ref GROUP BY v.brand, v.model ORDER BY units_sold DESC LIMIT 10"
            }
        ]
    }