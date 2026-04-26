-- ============================================================
--  Data Warehouse — Star Schema (PostgreSQL)
--  Generated from: dwh_schema_v4.puml
-- ============================================================

-- ------------------------------------------------------------
--  DIMENSIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_user (
    user_id     INT             PRIMARY KEY,
    last_name   VARCHAR(100),
    first_name  VARCHAR(100),
    email       VARCHAR(150),
    role        VARCHAR(50),
    agency_name VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS dim_client (
    client_id   SERIAL          PRIMARY KEY,
    full_name   VARCHAR(200),
    email       VARCHAR(150),
    city        VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS dim_vehicle (
    ar_ref      VARCHAR(50)     PRIMARY KEY,
    ar_design   VARCHAR(200),
    brand       VARCHAR(100),
    model       VARCHAR(100),
    category    VARCHAR(100),
    base_price  NUMERIC(10, 2)
);

-- ------------------------------------------------------------
--  FACTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fact_opportunities (
    oppo_id          INT             PRIMARY KEY,
    user_id          INT             REFERENCES dim_user(user_id),
    client_id        INT             REFERENCES dim_client(client_id),
    agency_name      VARCHAR(50),
    created_date     DATE,
    client_reference VARCHAR(100),
    deleted          BOOLEAN         DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS fact_quotes (
    quote_id     INT             PRIMARY KEY,
    oppo_id      INT,                                          -- degenerate dimension
    ar_ref       VARCHAR(50)     REFERENCES dim_vehicle(ar_ref),
    user_id      INT             REFERENCES dim_user(user_id),
    client_id    INT             REFERENCES dim_client(client_id),
    agency_name  VARCHAR(50),
    price        NUMERIC(10, 2),
    created_date DATE,
    deleted      BOOLEAN         DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS fact_sales (
    sale_id     SERIAL          PRIMARY KEY,                  -- auto-increment, no manual insert needed
    quote_id    INT             UNIQUE,                       -- degenerate dimension + ON CONFLICT target
    oppo_id     INT,                                          -- degenerate dimension
    user_id     INT             REFERENCES dim_user(user_id),
    client_id   INT             REFERENCES dim_client(client_id),
    ar_ref      VARCHAR(50)     REFERENCES dim_vehicle(ar_ref),
    agency_name VARCHAR(50),
    sale_date   DATE,
    quantity    INT,
    final_price NUMERIC(10, 2)
);

-- ------------------------------------------------------------
--  INDEXES  (common analytical access patterns)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fact_oppo_user    ON fact_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_oppo_client  ON fact_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_fact_oppo_date    ON fact_opportunities(created_date);

CREATE INDEX IF NOT EXISTS idx_fact_quotes_user   ON fact_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_quotes_client ON fact_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_fact_quotes_ar_ref ON fact_quotes(ar_ref);
CREATE INDEX IF NOT EXISTS idx_fact_quotes_date   ON fact_quotes(created_date);
CREATE INDEX IF NOT EXISTS idx_fact_quotes_oppo   ON fact_quotes(oppo_id);

CREATE INDEX IF NOT EXISTS idx_fact_sales_user    ON fact_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_sales_client  ON fact_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_fact_sales_ar_ref  ON fact_sales(ar_ref);
CREATE INDEX IF NOT EXISTS idx_fact_sales_date    ON fact_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_fact_sales_quote   ON fact_sales(quote_id);
CREATE INDEX IF NOT EXISTS idx_fact_sales_oppo    ON fact_sales(oppo_id);