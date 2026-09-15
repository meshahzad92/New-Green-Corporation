# AgriManage Pro (New Green Corporation) - System Context & Knowledge Base

This file serves as the comprehensive living context and knowledge base for the project. When starting or continuing development, consult this document first to understand the architecture, database schema, business rules, API contracts, and recent changes without having to parse all source files.

---

## 1. Project Overview & Architecture

- **Project Name**: AgriManage Pro (New Green Corporation)
- **Target Domain**: Agricultural inventory, stock ledger, sales invoices, company catalog, and expense management.
- **Frontend**:
  - React 18, TypeScript, Vite, Tailwind CSS, Lucide icons.
  - State Management: React Context (`DataContext.tsx`, `AuthContext.tsx`, `ThemeContext.tsx`).
  - Routing: `HashRouter` via `react-router-dom` (prevents 404s on static hosting / GitHub Pages / Vercel).
  - API Client: Axios instance in `frontend/src/utils/api.ts` with JWT bearer interceptor.
- **Backend**:
  - FastAPI (Python 3.10+), SQLAlchemy ORM, Pydantic v2 schemas.
  - Database: PostgreSQL hosted on Supabase (accessed with SSL required: `sslmode=require`).
  - Migrations: In addition to Alembic, non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` checks run on FastAPI startup in `backend/app/main.py`.
  - Authentication: JWT tokens with OAuth2 password bearer flow (`/api/v1/login/access-token`).

---

## 2. Database Models & Schema Definition

### 1. `companies`
- `id` (UUID, Primary Key, default `uuid.uuid4`)
- `name` (Text, NOT NULL)
- `logo` (Text, nullable, filename of logo in `logos/`)
- `created_at` (DateTime with timezone, default `func.now()`)

### 2. `products`
- `id` (UUID, Primary Key)
- `company_id` (UUID FK -> `companies.id`, nullable)
- `name` (Text, NOT NULL)
- `category` (Text: 'Fertilizer', 'Seeds', 'Pesticide', 'Tools', 'Other')
- `unit` (Text: e.g. 'Bags', 'Bottles', 'Packets', 'Kg')
- `purchase_price` (Numeric(12, 2), default `0.00`) — represents latest net purchase cost per unit.
- `mrp` (Numeric(12, 2), nullable) — printed retail price from company.
- `company_discount` (Numeric(5, 2), default `0.00`) — percentage discount given by company.
- `min_stock` (Integer, default `5`) — low-stock threshold badge trigger.

### 3. `stock_transactions`
- `id` (UUID, Primary Key)
- `product_id` (UUID FK -> `products.id`)
- `quantity` (Integer, NOT NULL, positive)
- `party_name` (Text, supplier or source name)
- `purchase_price` (Numeric(12, 2), nullable) — unit purchase cost at time of entry.
- `mrp` (Numeric(12, 2), nullable) — MRP at time of entry.
- `company_discount` (Numeric(5, 2), nullable) — discount % at time of entry.
- `type` (Text, CheckConstraint `type IN ('IN', 'OUT')`)
- `created_at` (DateTime with timezone)
- `sale_id` (UUID FK -> `sales.id`, ondelete `CASCADE`, nullable) — linked for `OUT` transactions created by sales.
- `is_deleted` (Boolean, default `False`) — soft-delete flag for audit preservation.
- `deleted_at` (DateTime, nullable)

### 4. `sales`
- `id` (UUID, Primary Key)
- `product_id` (UUID FK -> `products.id`)
- `customer_name` (Text, NOT NULL)
- `customer_phone` (String(11), nullable) — 11-digit phone number.
- `quantity` (Integer, NOT NULL)
- `selling_price` (Numeric(12, 2), NOT NULL) — per-pack selling rate.
- `purchase_price` (Numeric(12, 2), NOT NULL) — historical purchase cost at time of sale (for accurate profit tracking).
- `total_amount` (Numeric(12, 2), NOT NULL) — `quantity * selling_price`.
- `paid_amount` (Numeric(12, 2), nullable) — amount paid by customer towards this item.
- `invoice_id` (String(50), nullable, indexed) — UUID string grouping multiple products on the same invoice.
- `invoice_no` (String(50), nullable, indexed) — Human-readable invoice number e.g. `INV-260914-A8F2`.
- `payment_type` (Text, CheckConstraint `payment_type IN ('Credit', 'Debit')`) — 'Debit' = fully paid, 'Credit' = balance pending.
- `created_at` (DateTime with timezone)
- `is_deleted` (Boolean, default `False`) — soft delete flag.
- `deleted_at` (DateTime, nullable)

### 5. `expenses`
- `id` (UUID, Primary Key)
- `name` (Text, NOT NULL)
- `amount` (Numeric(12, 2), NOT NULL) — negative for expense, positive for income/gift.
- `quantity` (Integer, default `1`)
- `details` (Text, nullable / optional)
- `expense_date` (DateTime with timezone)
- `created_at` (DateTime with timezone)
- `is_deleted` (Boolean, default `False`)
- `deleted_at` (DateTime, nullable)

### 6. `users`
- `id` (UUID, Primary Key)
- `full_name` (String, indexed)
- `email` (String, unique, indexed, NOT NULL)
- `hashed_password` (String, NOT NULL)
- `is_active` (Boolean, default `True`)

### 7. `notes`
- `id` (UUID, Primary Key, default `uuid.uuid4`)
- `title` (Text, NOT NULL)
- `description` (Text, nullable)
- `status` (Text, default `'pending'`: `'pending'`, `'in_progress'`, `'completed'`)
- `is_important` (Boolean, default `False`) — pinned to sticky top "Most Important / Target Achieving" bar
- `priority` (Text, default `'medium'`: `'low'`, `'medium'`, `'high'`)
- `target_date` (DateTime with timezone, nullable) — target or due date for scheduling
- `created_at` (DateTime with timezone, default `func.now()`)
- `updated_at` (DateTime with timezone, default `func.now()`, onupdate `func.now()`)
- `is_deleted` (Boolean, default `False`) — soft-delete support
- `deleted_at` (DateTime with timezone, nullable)

---

## 3. Core Business Rules & Formulas

1. **MRP & Company Discount -> Purchase Cost**:
   - `purchase_cost = MRP * (1 - (company_discount / 100))`
   - When refilling stock, the user enters MRP (e.g. 1000) and Discount % (e.g. 10%). The UI calculates and displays the net purchase cost (Rs. 900) live in green.
   - On save, `mrp`, `company_discount`, and the calculated `purchase_price` are saved on both `stock_transactions` and updated on `products`.

2. **Inventory Stock Balance**:
   - `available_stock = SUM(quantity WHERE type = 'IN' AND is_deleted = False) - SUM(quantity WHERE type = 'OUT' AND is_deleted = False)`

3. **Multi-Product Sales & Invoicing**:
   - A customer can buy multiple products in one transaction.
   - All items share an `invoice_id` (UUID) and `invoice_no` (`INV-YYMMDD-XXXX`).
   - Each item creates its own `Sale` row and linked `StockTransaction` (type `OUT`, `sale_id = sale.id`).
   - `paid_amount` distribution: The overall invoice payment is allocated sequentially across line items (fill item 1 completely, then item 2, etc.).
   - Item status: If `item_paid >= item_total`, marked as `Debit`, else `Credit`.
   - Grand status: If `left <= 0`, automatically marked as `Debit (Fully Paid)`.

4. **MRP & Company Discount**: Refill purchase price calculates as `purchase_price = mrp - (mrp * discount / 100)`.

5. **Dynamic Price Recalculation on Stock Deletion**: When a stock arrival (`IN`) transaction is deleted, the backend and frontend automatically recalculate the product's `purchase_price`, `mrp`, and `company_discount` from the latest remaining active refill log. If no active refills remain, they are cleanly reset to 0/empty rather than lingering.

6. **Profit Calculation**: Unit Profit = `selling_price - purchase_price`.
   - `profit = (selling_price - purchase_price) * quantity`
   - Sales table displays a dedicated **Profit** column (in green with `+` sign when profitable).

7. **Notes & To-Do Tracking**: Notes can be prioritized, scheduled by target date, pinned to top bar if important, and toggled between pending/in_progress/completed.

8. **Soft Delete Preservation**:
   - Deleting a sale soft-deletes both the `Sale` row and its linked `StockTransaction` (`is_deleted = True`, `deleted_at = now`).
   - Restores stock balance automatically because balance calculation filters out `is_deleted = True`.

9. **Database Backup & Restore**:
   - `GET /api/v1/backup/export` dumps all tables matching exact database schema column names.
   - `POST /api/v1/backup/import` restores and upserts data in foreign-key order (`companies` -> `products` -> `sales` -> `stock_transactions` -> `expenses`).

10. **Dual Inventory Valuation (Investment at Cost vs. Retail at MRP)**:
   - **Total Stock Investment (At Purchase Cost)**: `SUM(purchase_price * remaining_stock)` — Represents actual capital locked in inventory.
   - **Projected Retail Return (At MRP)**: `SUM(mrp * remaining_stock)` — Expected gross revenue if all available units are sold at printed MRP.
   - **Projected Inventory Profit**: `Projected Retail Return - Total Stock Investment` — Expected gross profit and margin percentage from current stock.
   - Displayed in:
     - Dashboard Supply Summary: 3 dedicated cards for Capital Investment, MRP Value, and Potential Profit.
     - Stock Ledger Balance Tab: Top summary cards with dynamic company filter + table columns for Purchase Price, Retail MRP, Total Investment, and MRP Value per product.

---

## 4. API Endpoints Map

- `POST /api/v1/login/access-token` — User login, returns JWT bearer token.
- `GET /api/v1/companies/` — List all companies.
- `POST /api/v1/companies/` — Create new company.
- `PUT /api/v1/companies/{id}` — Update company.
- `DELETE /api/v1/companies/{id}` — Delete company (blocked if products linked).
- `GET /api/v1/products/` — List products with computed stock balance.
- `POST /api/v1/products/` — Create product.
- `PUT /api/v1/products/{id}` — Update product.
- `DELETE /api/v1/products/{id}` — Delete product.
- `GET /api/v1/transactions` — Get stock logs (IN/OUT).
- `POST /api/v1/transactions` — Create stock transaction (Refill / stock in).
- `DELETE /api/v1/transactions/{id}` — Soft delete stock transaction.
- `GET /api/v1/sales` — List all sales.
- `POST /api/v1/sales` — Create single sale (legacy).
- `POST /api/v1/sales/bulk` — Create multi-product invoice atomically.
- `PUT /api/v1/sales/{id}` — Update existing sale.
- `DELETE /api/v1/sales/{id}` — Soft delete sale.
- `DELETE /api/v1/sales/invoice/{invoice_id}` — Soft delete entire multi-product invoice.
- `GET /api/v1/expenses/` — List expenses.
- `POST /api/v1/expenses/` — Create expense.
- `PUT /api/v1/expenses/{id}` — Update expense.
- `DELETE /api/v1/expenses/{id}` — Soft delete expense.
- `GET /api/v1/notes/` — List all active notes with optional status or importance filters.
- `GET /api/v1/notes/{id}` — Get single note.
- `POST /api/v1/notes/` — Create note (with 15s deduplication check).
- `PUT /api/v1/notes/{id}` — Update note.
- `DELETE /api/v1/notes/{id}` — Soft delete note.
- `GET /api/v1/backup/export` — Export full database snapshot in JSON (including companies, products, sales, transactions, expenses, notes).
- `POST /api/v1/backup/import` — Import and upsert database backup JSON.

---

## 5. Recent Changes Log

1. **Multi-Product Sales Modal & Reusable Component**:
   - Created `frontend/src/components/AddSaleModal.tsx`.
   - Used by both `Sales.tsx` and `ProductDetail.tsx`.
   - When opened from `ProductDetail.tsx`, the active product is pre-selected for Item #1.
2. **MRP + Discount Pricing System**:
   - Added `mrp` and `company_discount` to `products` and `stock_transactions`.
   - Refill modal auto-calculates purchase price from `MRP * (1 - discount%)`.
   - Product catalog and product details display MRP, discount, and purchase cost.
   - Sales table features a live Profit column (`selling_price - purchase_price`).
3. **Optional Expense Details**:
   - Made Details field in `Expenses.tsx` optional ("Details (Optional)").
4. **JSON Database Backup & Restore**:
   - Added `backend/app/api/v1/endpoints/backup.py` with `/export` and `/import`.
   - Added `frontend/src/pages/Backup.tsx` with file upload preview, confirmation dialog, and instant refresh.
   - Added Backup to Sidebar navigation after Notes.
5. **Anti-Deduplication Protection**:
   - Added double-click disable guards and loading spinners to buttons across Expenses, Sales, Products, Stock, and Notes.
   - Backend idempotency checks implemented across models.
6. **Notes & To-Do Module with Sticky Most Important Bar**:
   - Added `/notes` between Reports and Backup in navigation.
   - Prominent "Most Important / Target Achieving Bar" at the top for pinned targets.
   - Chronological grouping: Overdue, Today, Tomorrow, Upcoming / Next Month, No Target Date, Completed.
   - Full CRUD, status toggle, priority badges, and inclusion in database JSON backup/restore.
7. **Fix Stock Refill Deletion Pricing Glitch**:
   - Fixed issue where deleting a stock refill left stale purchase price, MRP, and discount visible on the product.
   - Now automatically updates product pricing to the previous active refill log, or cleanly resets them to 0/empty if all stock refills are deleted.
8. **Stock Ledger & Catalog Product Deduplication**:
   - Cleaned up duplicate product rows from Supabase database (`Cruiser 100ml`, `Karate 250ml`, `Quantus 800ml`).
   - In all cases, records with active stock (`415`, `9`, `139`) and transaction history were preserved, while zero-stock duplicate rows were purged.
   - Added startup SQL cleanup in `main.py` that automatically removes zero-transaction duplicate products.
   - Implemented intelligent deduplication in `DataContext.tsx` that groups products by `(companyId, normalized_name)` and aggregates stock balances across duplicates so no inventory counts are lost.
   - Updated `Stock.tsx` (both the Balance ledger table and the Stock Inward modal item dropdown) and `Products.tsx` to ensure each item is rendered exactly once, prioritizing entries with stock > 0.
9. **Dual Inventory Valuation (Investment at Cost vs. Retail Value at MRP)**:
   - Added `total_inventory_mrp_value` and `projected_inventory_profit` to backend `DashboardStats` schema and `get_dashboard_stats()`.
   - Updated Dashboard Supply Summary with 3 distinct insight cards: Capital Invested (at purchase price), Projected Return (at MRP), and Expected Profit Margin (+X%).
   - Updated Stock Ledger Balance page with a top metrics banner (filtering dynamically with company selector) and individual product ledger columns for Purchase Price, Retail MRP, Total Invested Capital, and Projected MRP Value.

---

## 6. Deduplication & Idempotency Rules

To counteract Supabase cloud latency and accidental double-clicks:
1. **Frontend**:
   - Every modal / form must have an `isSubmitting` state.
   - Disable submit buttons immediately upon click.
   - Show loading text / spinner (`Saving...`, `Processing...`).
   - Guard against re-entry (`if (isSubmitting) return;`).
   - `DataContext.tsx` groups products and stocks by `companyId + '-' + normalizedName`. When duplicates exist, the primary record chosen is the one with `remaining > 0` (or highest stock), and stock quantities (`totalIn`, `totalOut`, `remaining`) are aggregated.
   - `Stock.tsx` and `Products.tsx` use memoized `uniqueProducts` filtering that sorts duplicate candidates by `stock.remaining > 0`, ensuring only the active product is displayed.
2. **Backend**:
   - Startup cleanup in `app/main.py`: Deletes duplicate product entries that have 0 transactions and 0 sales if a matching active product exists for that company.
   - Companies: Check if company with same trimmed name exists.
   - Products: Check if product with same name + company exists on `create_product` and `update_product`.
   - Expenses: Check if identical expense was created in the last 30 seconds.
   - Notes: Check if identical note was created in the last 15 seconds.
   - Stock Refill: Check if identical stock transaction was created in the last 20 seconds.
   - Sales: Check if bulk sale with same customer, items, and total was created in the last 20 seconds.

---

## 7. Changes Log — Session 2026-09-15

### 10. **Sale Date Editing in Edit Sale Modal**
- `SaleUpdate` Pydantic schema (`backend/app/schemas/transactions.py`) now includes an optional `created_at: Optional[datetime]` field.
- `update_sale()` in `backend/app/crud/crud_transaction.py` applies `created_at` to both the `Sale` row and its linked `StockTransaction` row when provided (keeps them in sync).
- `updateSale()` in `frontend/src/context/DataContext.tsx` accepts an optional `saleDate: Date` field in the updates object and maps it to `created_at` in the API payload.
- `frontend/src/pages/Sales.tsx` edit modal:
  - `editModal` state extended with `saleDate: Date` (initialized from `sale.date` when opening).
  - A `CustomDatePicker` field (labeled "Sale Date", `maxDate = today`) is rendered between the phone number and quantity fields.
  - `handleSaveEdit` passes `saleDate` into the `updateSale` call.
  - **Scope**: Date editing only available for single-item sales (the pencil ✏️ icon only shows for non-invoice sales).

### 11. **Pre-fill Sale Date from Filter Selection in Add Sale Modal**
- `AddSaleModalProps` in `frontend/src/components/AddSaleModal.tsx` now accepts `initialDate?: Date | null`.
- The `useEffect` that resets the modal on open now uses `initialDate ?? new Date()` to set `addSaleDate`.
- `frontend/src/pages/Sales.tsx` passes `specificDate` (the currently-selected filter date) as `initialDate` to `<AddSaleModal>`.
- **Result**: If you select "Yesterday" or any custom date from the date picker on the Sales page and then click "ADD SALE", the Add Sale modal pre-populates its Sale Date field with that date — no need to re-select it.
