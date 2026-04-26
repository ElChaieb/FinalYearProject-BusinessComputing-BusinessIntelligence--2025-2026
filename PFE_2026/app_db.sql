Create DATABASE app_db;







CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100),
    email           VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR,
    role            VARCHAR(50) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP,
    agency_name     VARCHAR(100)
);