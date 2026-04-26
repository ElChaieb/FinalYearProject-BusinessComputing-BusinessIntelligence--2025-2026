CREATE DATABASE OperationalDB;
GO

USE OperationalDB;
GO

CREATE TABLE users (
    user_id     INT             NOT NULL,
    last_name   NVARCHAR(100)   NULL,
    first_name  NVARCHAR(100)   NULL,
    email       NVARCHAR(150)   NULL,
    role        NVARCHAR(50)    NULL,
    agency_name VARCHAR(50)     NULL,
    CONSTRAINT PK_users PRIMARY KEY (user_id)
);
GO

CREATE TABLE vehicles (
    ar_ref      NVARCHAR(50)    NOT NULL,
    ar_design   NVARCHAR(200)   NULL,
    brand       NVARCHAR(100)   NULL,
    model       NVARCHAR(100)   NULL,
    category    NVARCHAR(100)   NULL,
    base_price  DECIMAL(10,2)   NULL,
    CONSTRAINT PK_vehicles PRIMARY KEY (ar_ref)
);
GO

CREATE TABLE clients (
    client_id   INT             NOT NULL IDENTITY(1,1),
    full_name   NVARCHAR(200)   NULL,
    city        NVARCHAR(100)   NULL,
    email       NVARCHAR(150)   NULL,
    CONSTRAINT PK_clients PRIMARY KEY (client_id)
);
GO

CREATE TABLE opportunities (
    oppo_id          INT             NOT NULL,
    user_id          INT             NULL,
    client_id        INT             NULL,
    agency_name      NVARCHAR(50)    NULL,
    created_date     DATETIME        NULL,
    client_reference NVARCHAR(100)   NULL,
    deleted          BIT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_opportunities PRIMARY KEY (oppo_id),
    CONSTRAINT FK_oppo_user   FOREIGN KEY (user_id)   REFERENCES users   (user_id),
    CONSTRAINT FK_oppo_client FOREIGN KEY (client_id) REFERENCES clients (client_id)
);
GO

CREATE TABLE quotes (
    quote_id     INT             NOT NULL,
    oppo_id      INT             NULL,
    ar_ref       NVARCHAR(50)    NULL,
    user_id      INT             NULL,
    client_id    INT             NULL,
    agency_name  NVARCHAR(50)    NULL,
    price        DECIMAL(10,2)   NULL,
    created_date DATETIME        NULL,
    deleted      BIT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_quotes        PRIMARY KEY (quote_id),
    CONSTRAINT FK_quote_oppo    FOREIGN KEY (oppo_id)   REFERENCES opportunities (oppo_id),
    CONSTRAINT FK_quote_vehicle FOREIGN KEY (ar_ref)    REFERENCES vehicles      (ar_ref),
    CONSTRAINT FK_quote_user    FOREIGN KEY (user_id)   REFERENCES users         (user_id),
    CONSTRAINT FK_quote_client  FOREIGN KEY (client_id) REFERENCES clients       (client_id)
);
GO

CREATE TABLE sales (
    sale_id     INT             NOT NULL IDENTITY(1,1),
    quote_id    INT             NULL,
    oppo_id     INT             NULL,
    user_id     INT             NULL,
    client_id   INT             NULL,
    ar_ref      NVARCHAR(50)    NULL,
    agency_name NVARCHAR(50)    NULL,
    sale_date   DATE            NULL,
    quantity    INT             NULL,
    final_price DECIMAL(10,2)   NULL,
    CONSTRAINT PK_sales        PRIMARY KEY (sale_id),
    CONSTRAINT FK_sale_quote   FOREIGN KEY (quote_id)  REFERENCES quotes        (quote_id),
    CONSTRAINT FK_sale_oppo    FOREIGN KEY (oppo_id)   REFERENCES opportunities (oppo_id),
    CONSTRAINT FK_sale_user    FOREIGN KEY (user_id)   REFERENCES users         (user_id),
    CONSTRAINT FK_sale_client  FOREIGN KEY (client_id) REFERENCES clients       (client_id),
    CONSTRAINT FK_sale_vehicle FOREIGN KEY (ar_ref)    REFERENCES vehicles      (ar_ref)
);
GO