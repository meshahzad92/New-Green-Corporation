# AgriManage Pro (New Green Corporation) - System Context & Architecture

## 1. Executive Summary

**AgriManage Pro** is an agricultural inventory management, sales tracking, and financial intelligence platform built for agricultural dealerships, distributors, and agrochemical/seed suppliers (specifically tailored for operations such as New Green Corporation in Pakistan).

The application provides real-time stock balance tracking, historical cost accounting, credit/debit customer ledger management, daily expense logging, and business performance reporting.

---

## 2. High-Level Architecture

```mermaid
graph TD
    Client["Frontend (React 19 + TypeScript + Vite)"]
    API["Backend (FastAPI + Uvicorn)"]
    DB[("PostgreSQL Database")]
    Host["AWS EC2 Host Network"]

    Client -->|REST API with JWT Bearer Token| API
    API -->|SQLAlchemy 2.0 ORM| DB
    Host -.->|Hosts Container & DB| API
    Host -.->|Local Port 5432| DB
```

### Architecture Topology
- **Frontend**: Single Page Application (SPA) deployed on Vercel or local static server. Built with React 19, TypeScript, Tailwind CSS, Lucide React, and Recharts. Uses `HashRouter` for client-side routing.
- **Backend**: Containerized FastAPI service running on AWS EC2 (`network_mode: host` to communicate directly with PostgreSQL on `localhost:5432`). Auto-reloading Uvicorn server in dev, multi-worker in prod.
- **Database**: PostgreSQL with UUID primary keys, relational constraints, and soft-delete capabilities. Fallback to SQLite (`sqlite:///./sql_app.db`) for local testing.
- **CI/CD**: GitHub Actions workflow (`.github/workflows/deploy-backend.yml`) triggering on pushes to `main` with SSH deployment to AWS EC2.

---

## 3. Technology Stack

| Layer | Technology | Key Libraries / Frameworks |
|---|---|---|
| **Frontend** | React 19, TypeScript ~5.8, Vite 6 | `react-router-dom` v7, `recharts` v3, `axios`, `lucide-react`, `react-datepicker`, Tailwind CSS |
| **Backend** | Python 3.11+, FastAPI 0.128 | `SQLAlchemy` 2.0, `pydantic` v2, `psycopg2-binary`, `python-jose` (JWT), `passlib` / `bcrypt`, `uvicorn` |
| **Database** | PostgreSQL / SQLite | UUID keys, soft delete timestamps, relational cascade rules |
| **Deployment** | Docker, Docker Compose, AWS EC2, GitHub Actions | Host networking, automated image pruning, health-check probes |

---

## 4. Domain Data Model & Entity Relationships

```mermaid
erDiagram
    COMPANY ||--o{ PRODUCT : manufactures
    PRODUCT ||--o{ STOCK_TRANSACTION : tracks
    PRODUCT ||--o{ SALE : sells
    SALE ||--o| STOCK_TRANSACTION : triggers
    USER {
        uuid id PK
        string email UK
        string full_name
        string hashed_password
        boolean is_active
    }
    COMPANY {
        uuid id PK
        text name
        text logo
        timestamp created_at
    }
    PRODUCT {
        uuid id PK
        uuid company_id FK
        text name
        text category
        text unit
        numeric purchase_price
        integer min_stock
    }
    STOCK_TRANSACTION {
        uuid id PK
        uuid product_id FK
        integer quantity
        text party_name
        numeric purchase_price
        text type "IN | OUT"
        uuid sale_id FK
        boolean is_deleted
        timestamp deleted_at
        timestamp created_at
    }
    SALE {
        uuid id PK
        uuid product_id FK
        text customer_name
        string customer_phone
        integer quantity
        numeric selling_price
        numeric purchase_price
        numeric total_amount
        text payment_type "Credit | Debit"
        boolean is_deleted
        timestamp deleted_at
        timestamp created_at
    }
    EXPENSE {
        uuid id PK
        text name
        numeric amount "Negative: Expense, Positive: Income"
        integer quantity
        text details
        timestamp expense_date
        boolean is_deleted
        timestamp deleted_at
        timestamp created_at
    }
```

### Key Entity Details

1. **Company (`companies`)**:
   - Represents agrochemical and seed multinational/national suppliers (e.g., Bayer, Chatta Seeds, Corteva (Pioneer), Mercury, Monsanto, Sohni Dharti, Syngenta).
   - Seeded automatically during database initialization (`init_db.py`).
   - Logos stored in `frontend/src/logos/` and matched dynamically by file basename.

2. **Product (`products`)**:
   - Categorized under `Fertilizer`, `Seeds`, `Pesticide`, `Tools`, `Other`.
   - Stores latest purchase price (`purchase_price`) updated upon stock inward.
   - `min_stock` establishes low-stock thresholds.

3. **Stock Transaction (`stock_transactions`)**:
   - Type `IN`: Inward stock arrival from suppliers/parties.
   - Type `OUT`: Automatic inventory deduction triggered when a sale occurs (`sale_id` linked).
   - **Soft Delete**: Supports `is_deleted` and `deleted_at`. Deleted transactions are excluded from active stock calculation without losing audit logs.

4. **Sale (`sales`)**:
   - Captures customer name and 11-digit phone number (for credit collections).
   - Locks in `purchase_price` snapshot at the time of sale to ensure true historical margin tracking regardless of future product price changes.
   - `payment_type`:
     - `Credit`: Unpaid account balance (highlighted in Red).
     - `Debit`: Paid cash/bank balance (highlighted in Green).
   - Creates an automated linked `OUT` stock transaction.
   - Soft-deleting a sale cascades soft-deletion to its linked stock transaction.

5. **Expense (`expenses`)**:
   - Dual-purpose accounting entity:
     - Negative values (`amount < 0`): Business expenses (e.g., transport, utilities, salaries, maintenance).
     - Positive values (`amount > 0`): Incidental incomes, vendor gifts, rebates.
   - Enables real-time net profit computation (`Net Profit = Gross Sales Profit + Expense Total`).

6. **User (`users`)**:
   - System administrator credentials with bcrypt password hashing.
   - Default seeded credentials: `waris92` / `waris92`.

---

## 5. Core Business Logic & Calculations

### 1. Dynamic Stock Balance
Stock is computed dynamically on the database query layer:
$$\text{Current Stock} = \sum_{\text{type}=\text{'IN'}, \neg\text{deleted}} \text{Quantity} - \sum_{\text{type}=\text{'OUT'}, \neg\text{deleted}} \text{Quantity}$$

### 2. Profit Metrics
- **Gross Profit per Sale**:
  $$\text{Gross Profit} = (\text{Selling Price} - \text{Purchase Price}) \times \text{Quantity}$$
- **Net Profit**:
  $$\text{Net Profit} = \text{Gross Profit} + \sum \text{Expense Amount}$$
  *(Note: Since expenses are stored as negative numbers, addition accurately subtracts operational expenses).*

### 3. Customer Credit & Debt Ledger
- **Total Outstanding per Customer**:
  $$\text{Customer Outstanding} = \sum \text{Credit Sales} - \sum \text{Debit Payments/Receipts}$$
- Displayed on the `Customer Payments` page to identify overdue debts and manage credit recovery.

### 4. Timezone Localization
- Configured specifically with **Pakistan Standard Time (`Asia/Karachi` / PKT / UTC+5)** in both frontend date selectors and backend date-aggregation queries (`func.date`).

---

## 6. Project Directory Structure

```
New-Green-Corporation/
├── .github/
│   └── workflows/
│       └── deploy-backend.yml      # CI/CD deployment to AWS EC2 via SSH
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/      # companies, expenses, login, products, reports, transactions
│   │   │   │   └── api.py          # API v1 router aggregator & health check
│   │   │   └── deps.py             # Shared DB and Auth dependencies
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic Settings (.env configuration)
│   │   │   └── security.py         # JWT token generator and password hasher
│   │   ├── crud/                   # CRUD database operations for all models
│   │   ├── db/
│   │   │   └── session.py          # SQLAlchemy engine & session factory
│   │   ├── models/
│   │   │   └── models.py           # SQLAlchemy declarative ORM models
│   │   ├── schemas/                # Pydantic validation and serialization schemas
│   │   └── main.py                 # FastAPI application definition & CORS config
│   ├── migrations/                 # Raw SQL migration scripts
│   ├── tests/                      # Pytest suite & verify_api.py test harness
│   ├── Dockerfile                  # Python 3.11 slim container build
│   ├── docker-compose.yml          # Host network deployment compose
│   ├── init_db.py                  # Table creation and predefined company seeding
│   ├── main.py                     # CLI backend startup script (uvicorn launcher)
│   ├── requirements.txt            # Python dependencies
│   └── POSTGRES_SETUP.md           # AWS EC2 PostgreSQL setup documentation
├── frontend/
│   ├── src/
│   │   ├── components/             # Sidebar, ConfirmDialog, CustomDatePicker, StatCard, ProtectedRoute
│   │   ├── context/                # AuthContext, DataContext, ThemeContext
│   │   ├── logos/                  # Supplier company logos (Bayer, Corteva, Syngenta, etc.)
│   │   ├── pages/                  # Dashboard, Companies, Products, ProductDetail, Stock, Sales, Expenses, Reports, Payments
│   │   ├── utils/                  # api.ts (Axios + JWT interceptor), expenseApi.ts, calculations.ts, storage.ts
│   │   ├── types.ts                # TypeScript data interfaces
│   │   ├── App.tsx                 # Router setup and providers
│   │   └── index.tsx               # DOM root entry
│   ├── index.html                  # HTML entry point
│   ├── package.json                # Frontend dependencies and npm scripts
│   ├── tsconfig.json               # TypeScript compiler options
│   └── vite.config.ts              # Vite bundler configuration
├── README.md                       # Quick-start run guide
└── context.md                      # Complete system context (this file)
```

---

## 7. API Endpoints Reference (`/api/v1`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Health probe for load balancers and Docker | No |
| `POST` | `/login/access-token` | OAuth2 username/password login returning JWT | No |
| `POST` | `/signup` | Create system user | No |
| `GET` | `/companies/` | List all companies | Yes |
| `POST` | `/companies/` | Add a new company | Yes |
| `PUT` | `/companies/{id}` | Update company name | Yes |
| `DELETE` | `/companies/{id}` | Delete company (blocked if products linked) | Yes |
| `GET` | `/products/` | List products with calculated `current_stock` | Yes |
| `POST` | `/products/` | Create product catalog item | Yes |
| `GET` | `/products/{id}` | Get product details | Yes |
| `PUT` | `/products/{id}` | Update product attributes | Yes |
| `DELETE` | `/products/{id}` | Delete product and cascaded records | Yes |
| `GET` | `/transactions` | List stock transactions (`skip`, `limit`, soft-delete filter) | Yes |
| `POST` | `/transactions` | Inward stock receipt (`type: IN`) | Yes |
| `DELETE` | `/transactions/{id}` | Soft delete stock transaction | Yes |
| `GET` | `/sales` | List sales records | Yes |
| `POST` | `/sales` | Register sale (auto-creates `OUT` stock transaction) | Yes |
| `PUT` | `/sales/{id}` | Edit sale details (updates linked stock transaction) | Yes |
| `DELETE` | `/sales/{id}` | Soft delete sale and matching stock transaction | Yes |
| `GET` | `/expenses/` | List expenses (supports date filtering) | Yes |
| `POST` | `/expenses/` | Record expense or income | Yes |
| `PUT` | `/expenses/{id}` | Update expense | Yes |
| `DELETE` | `/expenses/{id}` | Soft delete expense | Yes |
| `GET` | `/expenses/daily-total`| Daily expense total | Yes |
| `GET` | `/reports/` | Dashboard KPI stats + last 7 days chart | Yes |
| `GET` | `/reports/period-summary` | Comprehensive periodic financial analytics | Yes |

---

## 8. Environment Variables

### Backend (`backend/.env`)
| Variable | Default / Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://agrimanage:pass@localhost:5432/agrimanage_db` | Connection string (fallback to SQLite) |
| `SECRET_KEY` | Hex 32 string | JWT cryptographic signature secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | JWT token lifespan |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8000` | API port |

### Frontend (`frontend/.env`)
| Variable | Default / Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

---

## 9. Operating & Development Procedures

### Local Development Setup

#### 1. Backend:
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python main.py --init-db
```
Backend will start on `http://localhost:8000` with Swagger documentation at `http://localhost:8000/docs`.

#### 2. Frontend:
```bash
cd frontend
npm install
npm run dev
```
Frontend will serve on `http://localhost:3000`.

### Running Verification Tests
```bash
cd backend
python tests/verify_api.py
```
Or with pytest:
```bash
cd backend
pytest tests/
```

### Production Deployment (AWS EC2)
- Production EC2 host IP: `18.216.254.232` (managed under `GreenCorportion.pem`).
- Backend runs in Docker with host network integration (`network_mode: host`) accessing local PostgreSQL.
- Continuous deployment executes automatically via GitHub Actions upon git push to `main`.
