# CLAUDE.md — AgriManage Pro (New Green Corporation)

> **Single source of truth for this codebase.** Read this file first — it captures the
> architecture, data model, and every business flow so you rarely need to open other files
> just to understand how things work. Open actual source only to edit or verify a detail.
> Keep this file updated when flows change.

---

## 1. What this app is

**AgriManage Pro** is an agricultural inventory + accounting system for a shop
("New Green Corporation") that buys agri products (fertilizer, seeds, pesticides) from
**companies** and sells them to **customers / dealers / farmers**, often on **credit (khata)**.

It tracks the full money cycle:
**Buy stock from company → hold inventory → sell to customer (cash or credit) → recover credit → manage cash/bank accounts → report profit.**

Single-tenant, single admin user. Login: `waris92` / `waris92` (seeded on first boot).

---

## 2. Tech stack & layout

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy, Pydantic v2, PostgreSQL (SQLite fallback for local dev) |
| Frontend | React 18 + TypeScript, Vite, React Router (**HashRouter**), TailwindCSS, axios, lucide-react icons, react-datepicker, recharts |
| Auth | JWT (OAuth2 password flow), HS256, 60-min tokens |
| DB | PostgreSQL on Supabase / AWS RDS |

```
backend/
  main.py                     # entry: uvicorn app.main:app ; `python main.py --init-db`
  app/
    main.py                   # FastAPI app + CORS + startup migrations + seed
    core/config.py            # Settings (env), CORS origins, SECRET_KEY guard
    core/security.py          # password hash + JWT create
    db/session.py             # engine, SessionLocal, Base, get_db(); Supabase SSL + hardcoded hostaddr
    api/deps.py               # get_current_active_user (JWT -> User)
    api/v1/api.py             # router registration (all endpoints mounted here)
    api/v1/endpoints/*.py     # route handlers (thin; delegate to crud)
    crud/*.py                 # ALL business logic lives here
    models/models.py          # ALL SQLAlchemy tables (single file, 13 models)
    schemas/*.py              # Pydantic request/response models
frontend/
  src/
    App.tsx                   # routes + provider nesting
    context/                  # AuthContext, DataContext (core inventory state), ThemeContext
    pages/*.tsx               # one file per screen
    components/*.tsx          # modals + shared UI
    utils/                    # api.ts (axios), *Api.ts (per-module clients), calculations, formatters, logoHelper
    types.ts                  # frontend domain types (camelCase)
```

### Key convention: naming boundary
- **Backend/DB/JSON = `snake_case`** (`purchase_price`, `product_id`, `created_at`).
- **Frontend types = `camelCase`** (`purchasePrice`, `productId`, `date`).
- The mapping happens manually in `DataContext.tsx` and the `utils/*Api.ts` files. When you
  add a field, update **both** sides and the mapping.

---

## 3. Run / build

```bash
# Backend
cd backend
python -m venv venv && . venv/Scripts/activate   # Windows
pip install -r requirements.txt
python main.py --init-db        # create tables + seed
python main.py                  # serve on :8000 ; docs at /docs

# Frontend
cd frontend
npm install
npm run dev                     # :3000 (vite)  | npm run build | npm run preview
```

- Frontend API base: `VITE_API_URL` (default prod `https://api.newgreencorporation.app/api/v1`).
- Backend `DATABASE_URL`, `SECRET_KEY` (must be set — app refuses to boot on the insecure default),
  `ACCESS_TOKEN_EXPIRE_MINUTES`, `SIGNUP_ENABLED` (default false).

### Hosting / CI (`.github/workflows/`)
- **Frontend** → Vercel (`new-green-corporation.vercel.app`).
- **Backend** → AWS EC2 via Docker Compose + Caddy HTTPS (`api.newgreencorporation.app`);
  `deploy-aws.yml` SSHes in and runs `docker compose up -d --build`. `deploy-render.yml`
  (Render deploy hook) is the legacy/alternate path.
- `keep-alive.yml` pings to avoid cold starts; `backup-db.yml` weekly DB backup to Google Drive.

---

## 4. Data model (`backend/app/models/models.py`)

All tables use UUID primary keys and almost all support **soft delete** (`is_deleted`, `deleted_at`).
Queries filter `is_deleted == False` by default. Numeric money = `Numeric(12,2)`.

| Model | Table | Purpose / key columns |
|---|---|---|
| `Company` | `companies` | Catalog brand (Bayer, Syngenta…). `name`, `logo` (filename or Data URL). |
| `Product` | `products` | `company_id`, `name`, `category`, `unit`, `purchase_price` (**latest** cost), `mrp`, `company_discount` (%), `min_stock`. |
| `StockTransaction` | `stock_transactions` | Inventory ledger. `type` = `'IN'`/`'OUT'`, `quantity`, `party_name`, `purchase_price`, `mrp`, `company_discount`, optional `sale_id` (links the OUT to its Sale). |
| `Sale` | `sales` | A sold line item. `product_id`, `customer_name`, `customer_phone`, `dealer_id`/`dealer_name`/`farmer_name`, `quantity`, `selling_price`, `purchase_price` (**snapshot** for profit), `total_amount`, `paid_amount`, `invoice_id` (UUID groups a multi-item sale), `invoice_no` (human `INV-YYMMDD-XXXX`), `payment_type` = `'Credit'`/`'Debit'`. |
| `Expense` | `expenses` | `amount` **signed**: negative = expense, positive = income/gift. `name`, `quantity`, `details`, `expense_date`. |
| `User` | `users` | `email` (used as username), `hashed_password`, `is_active`. |
| `Note` | `notes` | To-do. `status` (pending/in_progress/completed), `is_important`, `priority`, `target_date`. |
| `KhataAccount` | `khata_accounts` | **Dealer** ledger account. `name`, `phone`, `address`, `role` (default `'Dealer'`). |
| `KhataEntry` | `khata_entries` | Dealer ledger row. `entry_type` = `'CREDIT'`/`'RECOVERY'`, `credit_amount`, `recovery_amount`, `products_detail` (JSON line items), `invoice_id`, `sale_id`, `payment_method`, `bank_name`, `farmer_name`. |
| `CompanyKhataAccount` | `company_khata_accounts` | **Payable** account for a supplier company. `name`, `phone`, `catalog_company_id` → `Company`. |
| `CompanyKhataEntry` | `company_khata_entries` | `entry_type` = `'PAYMENT'` (we pay company) / `'PURCHASE'` (stock received). `amount_paid`, `total_purchase_amount`, `products_detail` (JSON), `stock_transaction_ids` (JSON). |
| `MoneyAccount` | `money_accounts` | Bank/cash wallet. `title`, `bank_name`, `account_type` (`BANK`/`CASH`), `opening_balance`. |
| `MoneyTransaction` | `money_transactions` | `type` = `DEPOSIT`/`WITHDRAWAL`/`OPENING`/`COMPANY_PAYMENT`, `amount`, `payment_method`, `tid`, `company_khata_entry_id` (link to a company payment). |

### Schema migrations
There is **no Alembic**. On every startup, `app/main.py::startup_event()` runs idempotent raw SQL
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), prunes unreferenced duplicate
products/companies, and seeds the admin user + 7 default companies if the DB is empty.
**To add a column: add it to the model AND add an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
line in `startup_event`.** (`backend/apply_migration.py` / `apply_expenses_migration.py` are
one-off helper scripts.)

---

## 5. Stock → Products → Sales flow (the core loop)

This is the heart of the app. Follow this to understand everything else.

### Stock levels are derived, never stored
There is no "quantity on hand" column. Remaining stock is always computed:
```
remaining = Σ(IN qty) − Σ(OUT qty)   over non-deleted stock_transactions
```
Computed in SQL in `crud_product.get_products` (adds a `current_stock` label) and
`crud_transaction.get_product_stock()`. The frontend also recomputes/aggregates in `DataContext`.

### A. Stock Inward (buying/receiving stock) — Stock page, "STOCK INWARD"
1. UI (`pages/Stock.tsx`) → `DataContext.addStock()` → `POST /transactions` with `type:'IN'`.
2. `crud_transaction.create_transaction`:
   - 20-second **idempotency guard** (ignores an identical IN re-submitted within 20s — prevents double-click dupes).
   - Inserts the `StockTransaction`.
   - **Side effect:** on an IN, it **overwrites the Product's `purchase_price`, `mrp`, `company_discount`** with this transaction's values (latest-cost model).
3. **Discount helper (Stock page):** if "add discount" is on, purchase cost is auto-computed as
   `effectivePurchasePrice = MRP × (1 − discount/100)`. Otherwise the typed purchase price is used.
4. Editing/deleting an IN (`update_transaction`/`delete_transaction`) **recomputes** the product's
   price from the **latest remaining non-deleted IN** (or resets to 0/None if none remain).

### B. Products page (`pages/Products.tsx`)
- Lists deduplicated products with current stock, low-stock flag (`remaining ≤ min_stock`, default 5).
- Per the latest change, each card shows **category and MRP in blue** only.
- Add/edit product metadata (name/category/unit/min_stock/company). Price is normally set
  via Stock Inward, not here. Clicking a product → `ProductDetail.tsx` (full per-product history).

### C. Selling — Sales page (`pages/Sales.tsx`)
Two paths:
- **Single sale** → `addSale()` → `POST /sales` → `crud_transaction.create_sale`.
- **Multi-item invoice** → `addBulkSale()` → `POST /sales/bulk` → `create_bulk_sale`.

`create_sale` logic:
1. 20-sec idempotency guard.
2. Validate stock: reject if `get_product_stock() < quantity` → 400 "Insufficient stock".
3. Snapshot `purchase_price` from the product **at sale time** (so profit stays correct even if cost changes later).
4. `total_amount = selling_price × quantity`.
5. Insert `Sale`, then **auto-insert a matching `StockTransaction(type='OUT', sale_id=…)`** so the sale reduces stock. The OUT's date is synced to the sale date.

`create_bulk_sale`: one shared `invoice_id` + `invoice_no`; validates **all** items' stock first;
allocates `paid_amount` sequentially across items; each item becomes `Debit` if fully paid else `Credit`.

**Payment semantics:** `Debit` = paid (green), `Credit` = unpaid/on-account (red).
`paid_amount` defaults to full total for Debit, 0 for Credit.

### D. Profit
`profit = (selling_price − purchase_price) × quantity` — uses the **snapshotted** purchase price.
(`utils/calculations.ts::calculateProfit` on the frontend; mirrored in SQL in reports.)

### Delete cascades (soft)
- `delete_sale` soft-deletes the Sale **+** its linked OUT `StockTransaction` **+** any linked
  dealer `KhataEntry` (matched by `invoice_id`, else `sale_id`).
- `delete_invoice` does the same for every sale sharing an `invoice_id`.

---

## 6. Dealer Khata (customer credit ledger) — `crud_khata.py`, `pages/Khata*.tsx`

A dealer owes money; we track credit given and recovery received. Balance = Σcredit − Σrecovery.

- **Credit sale** (`POST /khata/credit-sale` → `create_credit_sale`): the heavyweight op.
  For each item it creates a `Sale` (payment_type `Credit`, dealer linked) **and** an OUT
  `StockTransaction`, then one `KhataEntry(entry_type='CREDIT')` holding a `products_detail`
  JSON summary and the shared `invoice_id`. So a credit sale touches Sales, Stock, and Khata at once.
- **Recovery** (`POST /khata/recovery`): a `KhataEntry(entry_type='RECOVERY')` with `payment_method`/`bank_name`; 15-sec dedup guard. No stock impact.
- **Manual credit** (`POST /khata/manual-credit`): record old register dues — credit entry with **no** sale/stock impact.
- **2-way sync:** editing a linked `Sale` (`update_sale`) recomputes the dealer `KhataEntry`
  `credit_amount` + rebuilds its `products_detail`; and editing a `KhataEntry` (`update_entry`)
  syncs back to the linked `Sale`/`StockTransaction`. Keep these two in mind — changing one side
  must not desync the other.
- Settled dealers hide credit/recovery values and the recovery column (recent UX change).

---

## 7. Company Khata (supplier payables) — `crud_company_khata.py`, `pages/CompanyKhata*.tsx`

Mirrors dealer khata but for money **we owe companies**. Balance = Σpurchase − Σpayment.

- **Purchase** (`POST /company-khata/purchase` → `create_company_purchase`): for each item,
  creates `StockTransaction(type='IN')` (so a supplier delivery **adds inventory**),
  auto-computes `unit_price = total_price / quantity`, updates the product's `purchase_price`,
  and records a `CompanyKhataEntry(entry_type='PURCHASE')` with `products_detail` +
  `stock_transaction_ids`. **This is the second way stock enters the system (besides Stock Inward).**
- **Payment** (`POST /company-khata/payment` → `create_company_payment`): records
  `CompanyKhataEntry(entry_type='PAYMENT')`; if a `money_account_id` is passed it **also** creates
  a `MoneyTransaction(type='COMPANY_PAYMENT')` deducting from that wallet (2-way money sync).

---

## 8. Money Management — `crud_money.py`, `pages/Money*.tsx`

Bank/cash wallets with computed balances.
- **Balance** (`_compute_balance`): `opening + Σ(DEPOSIT,OPENING) − Σ(WITHDRAWAL,COMPANY_PAYMENT)`.
  Guards against double-counting opening (skips `opening_balance` if an `OPENING` tx row exists).
- Transactions: deposit / withdrawal (`POST /money/transactions`).
- **Transfer** (`POST /money/transfers`): one withdrawal + one deposit across two accounts.
- Company payments made with a wallet appear here as `COMPANY_PAYMENT` (see §7).

---

## 9. Other modules

- **Expenses** (`crud_expense.py`, `pages/Expenses.tsx`): signed `amount` (−expense / +income);
  `daily-total` and `date-range` endpoints feed reports. Net = Σamount.
- **Reports** (`crud_report.py`, `pages/Reports.tsx`, `Dashboard.tsx`):
  - `GET /reports/` → dashboard stats: inventory value at cost & at MRP, projected profit,
    low-stock count, today's revenue/profit, net profit (sales profit + signed expense total),
    7-day sales chart.
  - `GET /reports/period-summary?start&end` → sales/expense/credit-debit breakdown + daily series;
    uses a **60-sec in-memory cache** and parallel queries (ThreadPoolExecutor).
- **Notes** (`crud_note.py`, `pages/Notes.tsx`): simple task list; important notes surface in top bar.
- **Companies** (`crud_company.py`, `pages/Companies.tsx`): CRUD + `POST /companies/upload-logo`
  (logos persisted as compressed Data URLs; resolved by `utils/logoHelper.ts` which checks
  Data URL → bundled `src/logos/*` → public `/logos/*` → name match).
- **Backup** (`endpoints/backup.py`, `pages/Backup.tsx`): `GET /backup/export` dumps every table
  as JSON (exact columns); `POST /backup/import` restores with smart name-based dedup + ID remapping.
  A sample dump lives at repo root: `agrimanage_backup_*.json`.

---

## 10. API surface (all under `/api/v1`, all require JWT except login/health)

- `POST /login/access-token` (OAuth2 form), `POST /signup` (gated by `SIGNUP_ENABLED`). Login has IP+user throttling (5 fails → 15-min lockout).
- `GET /health`
- `companies/`: list/get/create/update/delete, `POST /companies/upload-logo`
- `products/`: list(`?search&category`)/get/create/update/delete (list returns `current_stock`)
- `transactions`: `GET/POST /transactions`, `PUT/DELETE /transactions/{id}`
- `sales`: `GET/POST /sales`, `POST /sales/bulk`, `PUT/DELETE /sales/{id}`, `DELETE /sales/invoice/{invoice_id}`
- `expenses/`: CRUD + `/daily-total`, `/date-range`
- `khata/`: `dealers` CRUD, `/dealers/{id}/ledger`, `/credit-sale`, `/recovery`, `/manual-credit`, `PUT/DELETE /entries/{id}`
- `company-khata/`: `accounts` CRUD, `/overview`, `/{id}/ledger`, `/payment`, `/purchase`, `PUT/DELETE /entries/{id}`
- `money/`: `accounts` CRUD, `/accounts/{id}/ledger`, `/transactions`, `/transfers`, `PUT/DELETE /transactions/{id}`
- `reports/`, `reports/period-summary`
- `notes/`: CRUD
- `backup/export`, `backup/import`

---

## 11. Frontend architecture notes

- **Providers nest** (App.tsx): Theme → Auth → Data → HashRouter. All routes except `/login`
  are wrapped in `ProtectedRoute`. Routing is **HashRouter** (`#/path`) — important for static hosting.
- **`DataContext`** is the big one: on login it fetches products+transactions+sales+companies in
  parallel, derives stocks, **deduplicates** products by `(companyId, lowercased name)` aggregating
  stock, and exposes all mutation helpers (addStock/addSale/updateSale/…), each of which calls the
  API then `refreshData()`. Other modules (khata, money, company-khata, expenses, notes) use their
  own `utils/*Api.ts` clients + page-local state rather than this context.
- **`utils/api.ts`**: axios instance; injects `Bearer` token, auto-checks JWT expiry client-side,
  and on 401/403 clears token and redirects to `#/login`.
- Amounts formatted via `utils/formatters.ts` (`formatAmount`, `formatDate` → `d/M/yyyy`).
  Dates picked with `CustomDatePicker`.
- Several pages have a "hide amounts" (`******`) banking-style privacy toggle.

---

## 12. Gotchas / conventions to respect

1. **Latest-cost pricing:** a product's `purchase_price`/`mrp`/`company_discount` reflect the most
   recent IN transaction, and are recomputed on IN edit/delete. Don't treat them as immutable.
2. **Sale profit uses a snapshot** of purchase price taken at sale time — never recompute profit
   from the product's current price.
3. **Soft delete everywhere** — always filter `is_deleted == False`; "delete" means set the flag.
4. **Stock is derived** (IN − OUT), never a stored counter.
5. **Idempotency guards** (15–20s windows) exist on create_sale/transaction/recovery to defeat
   double submits; identical rapid requests return the existing row instead of erroring.
6. **2-way syncs** to preserve: Sale ↔ dealer KhataEntry; CompanyKhata payment ↔ MoneyTransaction;
   Sale ↔ its OUT StockTransaction (and dates are kept in sync).
7. **Migrations live in `startup_event`**, not Alembic — add `ADD COLUMN IF NOT EXISTS` there.
8. **snake_case (API) ↔ camelCase (FE)** must be mapped by hand in DataContext / `*Api.ts`.
9. `db/session.py` hardcodes a Supabase IPv4 `hostaddr` to bypass flaky DNS — only relevant for that host.
10. Business logic belongs in `crud/`; endpoints stay thin; `models.py` and schema files are the contracts.

---

## 13. Other docs in repo
- `README.md` — quick setup + hosting table.
- `context.md`, `gemini.md` — older/running notes (gemini.md is a long changelog-style log). This
  `CLAUDE.md` supersedes them as the structured overview.
