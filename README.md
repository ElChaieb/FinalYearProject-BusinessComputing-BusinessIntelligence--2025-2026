
### PFE Project 2025/2026

A full-stack Business Intelligence web application built with FastAPI, React, and PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS + Recharts |
| Backend | Python + FastAPI |
| App Database | PostgreSQL (Docker) |
| Data Warehouse | PostgreSQL (Docker) |
| Operational DB | MS SQL Server |
| ETL | Python + Pandas |

---

## Prerequisites

Make sure you have the following installed before starting:

- Python 3.13+
- Node.js 18+
- Docker Desktop
- MS SQL Server
- Git

---

## 1. Database Setup (Docker)

The PostgreSQL database (with all data) is available as a Docker image on Docker Hub.

### Pull and run the image

```bash
docker pull elchaieb/pfe_dwh:latest
docker run -d \
  --name pfe_db \
  -p 5432:5432 \
  elchaieb/pfe_dwh:latest
```

### Verify it's running

```bash
docker ps
```

You should see `pfe_db` in the list with port `5432` exposed.

---

## 2. Backend Setup

### Navigate to the backend folder

```bash
cd Backend
```

### Create a virtual environment (recommended)

```bash
python -m venv venv

# Activate on Windows
venv\Scripts\activate

# Activate on Mac/Linux
source venv/bin/activate
```

### Install Python dependencies

```bash
pip install fastapi
pip install uvicorn
pip install sqlalchemy
pip install psycopg2-binary
pip install python-dotenv
pip install python-jose[cryptography]
pip install passlib[bcrypt]
pip install bcrypt==4.0.1
pip install python-multipart
pip install pandas
pip install openpyxl
pip install python-calamine
```

### Configure environment variables

Create a `.env` file in the `Backend/` folder:

```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_db_name
SECRET_KEY=your_64_char_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
MAIL_EMAIL=your_gmail@gmail.com
MAIL_PASSWORD=your_16_char_app_password
```

### Run the backend

```bash
uvicorn app.main:app --reload
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

---

## 3. Frontend Setup

### Navigate to the frontend folder

```bash
cd frontend/app_frontend
```

### Install Node dependencies

```bash
npm install
```

This installs all required packages including:

- `react` + `react-dom`
- `vite`
- `tailwindcss`
- `axios`
- `react-router-dom`
- `recharts`

### Run the frontend

```bash
npm run dev
```

Frontend runs at: http://localhost:5173

---

## 4. Running the Full App

You need 3 things running simultaneously:

| Service | Command | URL |
|---|---|---|
| Docker DB | `docker start pfe_db` | localhost:5432 |
| Backend | `uvicorn app.main:app --reload` | localhost:8000 |
| Frontend | `npm run dev` | localhost:5173 |

Open http://localhost:5173 in your browser and log in with your admin credentials.

---

## 5. Project Structure (To be updated soon)

```
PFE/
├── Backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   │   └── auth.py
│   │   └── utils/
│   │       └── email.py
│   ├── etl/
│   │   ├── data/
│   │   │   └── raw/          ← Excel files go here
│   │   ├── extract_vehicles.py
│   │   ├── extract_agences.py
│   │   ├── extract_users.py
│   │   ├── extract_opportunities.py
│   │   └── extract_devis.py
│   ├── create_admin.py
│   └── .env
│
└── frontend/
    └── app_frontend/
        ├── src/
        │   ├── api/
        │   │   └── axios.js
        │   ├── context/
        │   │   └── AuthContext.jsx
        │   ├── pages/
        │   │   ├── Login.jsx
        │   │   ├── Dashboard.jsx
        │   │   └── Admin.jsx
        │   ├── components/
        │   │   ├── Sidebar.jsx
        │   │   ├── Navbar.jsx
        │   │   └── ProtectedRoute.jsx
        │   ├── App.jsx
        │   └── main.jsx
        └── package.json
```

---

## 6. User Roles

| Role | Access |
|---|---|
| Administrateur BI | Full access + user management |
| Directeur Marketing | Global dashboards |
| Responsable d'Agence | Agency-level dashboards |
| Commercial | Personal KPIs only |

New users are created by the Administrateur BI via the Admin Panel. Credentials are sent automatically by email.

---
