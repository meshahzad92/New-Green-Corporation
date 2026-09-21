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

### 8. `money_accounts`
- `id` (UUID, Primary Key, default `uuid.uuid4`)
- `title` (Text, NOT NULL) — e.g. "Shahzad Spray Center"
- `bank_name` (Text, nullable) — e.g. "UBL", "HBL"
- `account_type` (Text, default `'BANK'`) — `'BANK'` or `'CASH'`
- `account_number` (Text, nullable) — optional IBAN / account number
- `opening_balance` (Numeric(12, 2), default `0.00`) — set once on account creation
- `created_at` (DateTime with timezone)
- `is_deleted` (Boolean, default `False`)
- `deleted_at` (DateTime, nullable)

### 9. `money_transactions`
- `id` (UUID, Primary Key, default `uuid.uuid4`)
- `account_id` (UUID FK → `money_accounts.id`, ON DELETE CASCADE, NOT NULL)
- `transaction_date` (DateTime with timezone, NOT NULL)
- `type` (Text, CheckConstraint `type IN ('DEPOSIT', 'WITHDRAWAL', 'OPENING', 'COMPANY_PAYMENT')`)
- `amount` (Numeric(12, 2), NOT NULL) — always positive; direction determined by `type`
- `payment_method` (Text, nullable) — `'ONLINE'` or `'CASH'`
- `description` (Text, nullable) — free-text note
- `tid` (Text, nullable) — Transaction ID / reference number
- `company_khata_entry_id` (UUID FK → `company_khata_entries.id`, ON DELETE SET NULL, nullable) — links to Company Khata payment for 2-way sync
- `created_at` (DateTime with timezone)
- `is_deleted` (Boolean, default `False`)
- `deleted_at` (DateTime, nullable)



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
- `PUT /api/v1/transactions/{id}` — Update stock transaction (quantity, party name, purchase price, MRP, discount, date).
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
- `GET /api/v1/backup/export` — Export full database snapshot in JSON (including companies, products, sales, transactions, expenses, notes, khata, money accounts & transactions).
- `POST /api/v1/backup/import` — Import and upsert database backup JSON.
- `GET /api/v1/money/accounts` — List all money accounts with computed current balances.
- `POST /api/v1/money/accounts` — Create bank/cash account (auto-inserts OPENING transaction if opening_balance > 0).
- `PUT /api/v1/money/accounts/{id}` — Update account title/details.
- `DELETE /api/v1/money/accounts/{id}` — Soft delete account (blocked if non-OPENING transactions exist).
- `GET /api/v1/money/accounts/{id}/ledger` — Full chronological ledger with running balance.
- `POST /api/v1/money/transactions` — Record DEPOSIT or WITHDRAWAL.
- `PUT /api/v1/money/transactions/{id}` — Edit transaction details.
- `DELETE /api/v1/money/transactions/{id}` — Soft delete transaction.


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

---

## 8. Changes Log — Session 2026-09-16

### 12. **Supabase IPv4 Pooler & Local Dev Connectivity Fix**
- Switched local development `DATABASE_URL` in `backend/.env` to the Supabase IPv4 connection pooler (`aws-0-ap-southeast-1.pooler.supabase.com:5432` with username `postgres.[project-ref]`).
- Resolved timeout on local machines caused by direct Supabase endpoints being IPv6-only.
- Fixed `check_database_initialized()` in `backend/main.py` so that connection errors return `None` (preventing false table initialization attempts on network failures) and fixed SQLAlchemy `engine.url` password masking bug.

### 13. **Flexible Refill Pricing: Optional Discount % with Blue Toggle & Manual Purchase Price**
- Implemented in both `frontend/src/pages/ProductDetail.tsx` (Stock Refill modal) and `frontend/src/pages/Stock.tsx` (Stock Inward modal).
- **Default Mode (Manual Pricing)**: Displays **MRP** and **Purchase Price** as editable input fields. Users can enter purchase cost directly without needing a percentage discount.
- **Discount Mode (Blue Toggle Link)**: Clicking the blue `% Discount (Optional)` text reveals the discount percentage bar.
  - When discount % is typed, the purchase price is **auto-calculated** from `MRP * (1 - discount / 100)`.
  - Displays the live green calculation card with formula breakdown (`Rs. MRP − Discount%`).
  - Clicking `− Hide Discount` removes the discount and restores manual purchase price entry.
- **Backend Sync**: Updated `crud_transaction.create_transaction` so that when a stock refill has no discount relief (`company_discount = null`), the product's `company_discount` is updated to `0.00` rather than retaining stale discount rates from prior shipments.

### 14. **Stock Refill Entry Editing on Product Detail & Stock Ledger**
- **Backend**:
  - Added `StockTransactionUpdate` Pydantic schema in `backend/app/schemas/transactions.py` with optional `quantity`, `party_name`, `purchase_price`, `mrp`, `company_discount`, and `created_at`.
  - Added `crud_transaction.update_transaction` in `backend/app/crud/crud_transaction.py`: updates the transaction and, for 'IN' transactions, automatically recalculates the product's `purchase_price`, `mrp`, and `company_discount` from the latest remaining active refill log.
  - Added `PUT /api/v1/transactions/{transaction_id}` in `backend/app/api/v1/endpoints/transactions.py`.
- **Frontend State**:
  - Added `updateStockTransaction` method to `DataContext.tsx` which calls `PUT /transactions/{id}` and triggers `refreshData()`.
- **Product Detail Page (`ProductDetail.tsx`)**:
  - Added Edit (`Edit2`) button next to Delete on each inventory refill row in the Transaction History table.
  - Opens dedicated "Edit Refill Entry" modal pre-populated with the existing refill's details: Supplier (Party Name), Refill Date (`CustomDatePicker`), Pricing Details (with flexible `% Discount (Optional)` toggle and live auto-calculation card), and Quantity.
  - Includes anti-deduplication `isSubmittingEditRefill` loading indicator.
- **Stock Ledger Page (`Stock.tsx`)**:
  - Also added Edit (`Edit2`) button next to Delete in the Inward Logs table with dedicated "Edit Stock Entry" modal for seamless stock management across views.

---

## 9. Changes Log — Session 2026-09-19

### 15. **Khata (Credit & Recovery Ledger) System**
- **Architecture**:
  - Added `khata_accounts` table: tracks dealers, field officers, and credit customers (`name`, `phone`, `role`, `created_at`, soft-delete flags).
  - Added `khata_entries` table: records credit sales and cash recoveries (`account_id`, `entry_date`, `entry_type` ['CREDIT', 'RECOVERY'], `farmer_name`, `credit_amount`, `recovery_amount`, `products_detail` JSON, `invoice_id`, `sale_id`, `remarks`).
  - Extended `sales` table with `dealer_id` (UUID FK), `dealer_name` (Text), and `farmer_name` (Text).
- **Sales Page Integration**:
  - Renamed previous "ADD SALE" button to **"CASH SALE"** (Blue).
  - Added **"CREDIT SALE"** button in prominent **Red**.
  - Built `CreditSaleModal.tsx` with dual mode switch:
    - **Credit Sale Mode**: Searchable dealer combobox with inline "+ Add New Dealer" action, optional farmer name, date picker, multiple products taken with live stock previews, company filter, quick product search, quantity, and total price. Deducts inventory stock via `OUT` transactions, records `Sale` rows, and logs entry to Dealer's Khata.
    - **Recovery Mode**: Select dealer + Date + Amount (only 2 fields). Directly reduces dealer's pending dues without affecting inventory stock.
  - Sales table displays a red badge `Dealer: [Name]` next to customer/farmer names on credit sales.
- **Khata Module**:
  - Placed in `Sidebar.tsx` strictly after **Expenses** and before **Reports**.
  - Route `/khata`: Overview dashboard with 4 summary cards (Total Accounts, Total Credit Given, Total Recovery Collected, Net Market Dues Left), instant search, and dealer balance cards.
  - Route `/khata/:dealerId`: Detailed chronological statement showing dealer's ledger with live running balance (`Total Amount Left`), itemized product badges, edit entry modal, soft delete with automatic stock restoration, and print statement.
- **Mouse Wheel Scroll Input Fix**:
  - Removed number input spin-buttons via CSS and added a global wheel event listener that prevents mouse wheel scrolling from accidentally changing entered numbers in quantity and price inputs across the entire application.
- **Backup & Restore Integration**:
  - Included `khata_accounts` and `khata_entries` in full JSON database `/backup/export` and `/backup/import` endpoints.

### 16. **Khata Main Page List / Table View**
- Updated the main Khata dashboard (`frontend/src/pages/Khata.tsx`) to display dealers in a compact, high-density **Table / List View** by default.
- Allows seamless management when dealing with 50–100+ dealers/officers.
- Shows columns for Dealer / Account (avatar + initials + role), Phone (with link), Total Credit, Total Recovery, Net Balance Left / Settled badge, Total Entries count, and Action buttons (Open Ledger, Edit, Delete).
- Added a view toggle in the filter bar allowing instant switching between List View (`LayoutList`) and Grid View (`LayoutGrid`).
- Entire row is interactive and opens the dealer's chronological statement (`/khata/:id`).

### 17. **Deletion Protection & Blocked Action Popups (Dealers, Companies, Products)**
- **Khata Dealers**:
  - Frontend: If a dealer has `entry_count > 0`, clicking Delete intercepts immediately and opens a blocked alert popup (`ConfirmDialog` in `alertOnly` mode) informing the user of the active transaction logs count, credit, and recovery totals.
  - Backend: `DELETE /api/v1/khata/dealers/{id}` counts active `KhataEntry` rows and raises HTTP 400 with a descriptive error if entries exist.
- **Supply Partner Companies**:
  - Frontend: Clicking Delete on a company with linked products (`products.filter(p => p.companyId === id).length > 0`) intercepts immediately and shows a blocked alert popup listing linked product names and counts.
  - Backend: `DELETE /api/v1/companies/{id}` verifies no `Product` rows exist before allowing deletion.
- **Product Catalog**:
  - Frontend: Clicking Delete on a product with stock logs (`stockTransactions`), sales (`sales`), or remaining stock (`stocks.remaining > 0`) intercepts immediately and opens a blocked alert popup showing exact logs, sales count, and remaining units.
  - Backend: `DELETE /api/v1/products/{id}` checks for existing `StockTransaction` and `Sale` records and raises HTTP 400 if history exists.
- **Modal Component**: `ConfirmDialog` now supports `alertOnly?: boolean` with a single full-width button (`Understood`) to deliver clean, native UI alerts without raw browser `alert()` popups.

### 18. **Khata Recovery: Cash vs. Online Transfer with Bank Details**
- **Schema & Database**:
  - Added `payment_method` (`'CASH'` | `'ONLINE'`, default `'CASH'`) and `bank_name` (Text, nullable) to `khata_entries`.
  - Non-destructive `ALTER TABLE khata_entries ADD COLUMN IF NOT EXISTS ...` executed on FastAPI startup.
  - Included in JSON database `/backup/export` and `/backup/import`.
- **UI in `CreditSaleModal.tsx`**:
  - In Recovery mode, user chooses between **Cash Handover** (default) and **Online / Bank Transfer**.
  - Selecting **Online** reveals a dedicated detail box with a bank name input and quick-fill chips for common banks (Meezan Bank, HBL, Allied Bank, MCB, UBL, Bank Alfalah, JazzCash, Easypaisa).
  - Validation requires bank name before saving if Online is selected.
- **Statement & Ledger in `KhataDetail.tsx`**:
  - Chronological ledger table displays distinct badges in the Farmer / Channel column:
    - `Cash Handover` (emerald badge with banknote icon).
    - `Online • [Bank Name]` (blue badge with landmark icon).
  - Edit Entry modal allows updating payment method and bank name for recovery entries.

### 19. **Two-Way Synchronized & Idempotent Deletion (Khata & Sales)**
- **Khata -> Sales Deletion**:
  - When a credit sale entry is deleted from a dealer's statement (`KhataDetail.tsx`), the backend soft-deletes both the `KhataEntry` and all linked `Sale` rows (matched by either `invoice_id` or `sale_id`), and automatically soft-deletes the associated `StockTransaction` (restoring inventory stock balance).
  - `KhataDetail.tsx` now calls `refreshData()` from `DataContext` alongside `loadData()` upon entry deletion and update, ensuring global React state instantly clears the deleted sale without requiring a browser page refresh.
- **Sales -> Khata Deletion**:
  - When an invoice or sale is deleted from the Sales page (`Sales.tsx`), `delete_invoice` and `delete_sale` in `backend/app/crud/crud_transaction.py` automatically soft-delete any associated `KhataEntry` rows (by `invoice_id` or `sale_id`).
- **Idempotency & Resiliency**:
  - `delete_invoice` and `delete_sale` endpoints now handle already-soft-deleted sales gracefully (no 404 crashes).
  - In `DataContext.tsx`, `refreshData()` is executed in a `finally` block for `deleteSale` and `deleteInvoice`, ensuring the client UI always synchronizes with the server even if an item was already removed by another action.

### 20. **Financial Report Performance Optimization & Card Order**
- **Root Cause of Slowness**:
  - `get_period_financial_summary` in `backend/app/crud/crud_report.py` ran an `N`-day `while` loop that issued 2 sequential network queries for every single day in the period.
  - For a 1-month report, this executed 60 sequential queries over SSL to Supabase (taking 14.5+ seconds); for a 1-year report, it attempted 730+ queries (taking over 2 minutes).
- **Backend Optimizations**:
  - Replaced the day-by-day loop with 2 grouped queries (`GROUP BY func.date(...)`) for sales and expenses across the entire date range, mapping them into memory in microseconds.
  - Combined `sales_summary` and `credit_debit_summary` into a single unified `Sale` aggregation query.
  - Executed Sales queries and Expense queries in parallel using a `ThreadPoolExecutor(max_workers=2)`.
  - Also optimized `get_dashboard_stats` weekly sales chart from 7 queries into a single grouped query.
  - Added in-memory server cache with a 60-second TTL (`_period_report_cache`), making repeated or toggled queries resolve in **0.000035s (0 ms)**.
  - Reduced query time from **14.5s $\rightarrow$ ~3.3s** on first cold run, and **0 ms** on cache hits, even for a full 1-year period (366 days).
- **Frontend Optimizations & UI Card Reorder (`frontend/src/pages/Reports.tsx`)**:
  - Switched from raw `axios` to the configured `api` instance (`import api from '../utils/api'`).
  - Added a `cacheRef` memory cache so switching between 1 Month, 3 Months, 6 Months, and 1 Year is instantaneous with zero spinner delay.
  - Removed unused `dailyData` calculation.
  - **Reordered Summary Cards**: Reordered the 4 top metrics cards to standard accounting flow:
    1. **Total Revenue** (Blue)
    2. **Gross Profit** (Green)
    3. **Total Expenses** (Rose) — *moved before Net Profit*
    4. **Net Profit** (Emerald/Rose) — *Gross Profit minus Total Expenses*

### 21. **Unified Date Formatting (Day/Month/Year) & Asterisk Number Masking**
- **Date Formatting Across Application**:
  - Standardized all displayed dates and date inputs to `Day/Month/Year` (e.g. `23/9/2026`).
  - Added reusable `formatDate` helper and `DATE_PICKER_FORMAT = 'd/M/yyyy'` in `frontend/src/utils/formatters.ts`.
  - Updated `CustomDatePicker.tsx` to use `'d/M/yyyy'`.
  - Applied `formatDate` across Sales, Stock, Expenses, Khata & KhataDetail, Notes, Companies, ProductDetail, and Payments.
- **Dashboard Asterisk Masking**:
  - When financial figures on the dashboard are toggled off via the eye icon, amounts are masked in asterisk form (`Rs. ******` and `******`), replacing bullet points (`••••••`).
- **Stock Ledger Default State & Price Masking**:
  - Stock page defaults to hidden amounts (`amountsVisible = false`).
  - Masked values appear in `*` form (`Rs. ******`).
  - In addition to totals, "Purchase Price", "Retail (MRP)", and company discount `% off` badge are masked in `*` form when amounts are hidden, keeping vendor pricing confidential.

### 22. **Comprehensive Expense Navigation & Date Independence**
- **Date Independence & Any Date Selection**:
  - `toISODateString(date)` added in `frontend/src/utils/formatters.ts` to convert local dates directly to `YYYY-MM-DD` without UTC timezone skew.
  - In `Expenses.tsx`, users can freely pick any past, present, or future date via `CustomDatePicker` without artificial blocking.
  - Added day-by-day steppers (`◀ Prev Day` and `Next Day ▶`), quick jumps (`📅 Today`, `⏮️ Yesterday`), and `🌐 All History` mode to see all recorded entries.
  - Live search input filters expenses by description, payee, notes, date, and amounts in real-time.
  - Summary metrics display Total Outflows (Expenses), Total Inflows (Income), and Net Flow.
- **Record Expenses Anytime (With Date in Form)**:
  - The form in `Expenses.tsx` includes a dedicated **Expense Date** picker.
  - Users can record shop expenses for yesterday, last week, or today without needing to switch the page view.
  - Editing an existing expense supports updating the expense date alongside description, amount, quantity, and details.
- **Clean Dedicated Workflow & UI Simplification**:
  - Removed quick category chips from the expense form to keep entry creation simple and direct.
  - Removed redundant `📦 Available In Stock:` preview badge from sales modals (`AddSaleModal.tsx` and `CreditSaleModal.tsx`), as available stock is already cleanly displayed inside each item's dropdown label (e.g. `[415 in stock]`).
  - Kept sidebar and global layouts completely clean and un-cluttered.

### 23. **Sidebar Restructure & Dedicated Company Khata (Supplier Ledger & Inward Stock)**
- **Sidebar Restructure & "More" Hub**:
  - Reorganized sidebar items to keep navigation streamlined:
    - **Dashboard**, **Companies**, **Products**, **Stock**, **Sales**, **Expenses**, **Dealer Khata** (renamed from Khata), **Company Khata** (new dedicated supplier ledger), **More** (`...` icon).
  - Created dedicated Hub page `frontend/src/pages/MoreHub.tsx` (`/more`) hosting **Financial Reports**, **Target Notes & To-Do**, and **Database Backup & Restore**.
- **Dedicated Database Architecture (`company_khata_accounts`)**:
  - Maintained as a completely separate table from `companies` catalog:
    - `id` (UUID PK)
    - `name` (Text NOT NULL) — Supplier/company account name
    - `phone` (String(50), nullable)
    - `catalog_company_id` (UUID FK -> `companies.id`, ondelete `SET NULL`, nullable) — links account to catalog company for product intake
    - `created_at` (DateTime with timezone)
    - `is_deleted` (Boolean, default False) & `deleted_at` (DateTime, nullable)
  - `company_khata_entries` links via `account_id` (UUID FK -> `company_khata_accounts.id`, ondelete `CASCADE`).
  - Only companies explicitly added by the user appear in Company Khata (does not dump catalog companies).
- **Single-Query Performance Optimization & Float Serialization**:
  - Replaced slow N+1 query loop with a single aggregated SQL query joining `company_khata_accounts` with subqueries on `company_khata_entries` and `products`. Response time is under 50ms.
  - All monetary totals (`total_paid`, `total_purchased`, `net_balance`) are serialized explicitly as floating point numbers, completely eliminating the JavaScript string concatenation (`00.000.000.000` / `NaN`) glitch.
- **Searchable Product Combobox in Stock Intake**:
  - `CompanyPurchaseModal.tsx` features an inline search input with live autocomplete filtering.
  - As user types (e.g. "Cruiser", "Karate"), the product list filters in real-time, displaying product name, unit, and current stock badge.
  - Auto-calculates unit purchase price (`total_price / quantity`), increments inventory stock, and updates product catalog purchase price.
- **Supplier Financial Standing & Running Balance Formula**:
  - `Net Balance = Total Paid - Total Purchased`
    - If `Net Balance > 0`: **Advance with Company** (Our money held with supplier)
    - If `Net Balance < 0`: **Payable to Company** (Pending dues owed to supplier)
    - If `Net Balance == 0`: **Settled**
- **Deletion Protection**:
  - Company accounts cannot be deleted if active transactions exist (`entry_count > 0`). Displays dedicated blocked modal dialog.
- **Database Backup & Restore**:
  - Both `company_khata_accounts` and `company_khata_entries` are fully exported and imported with foreign-key preservation.

### 24. **Company Khata Stock Intake Product Filtering & Dropdown Enhancements**
- **Root Cause Fix for Product Display in Receive Stock**:
  - The frontend `Product` interface defines `companyId` (camelCase). In `CompanyPurchaseModal.tsx`, product filtering previously checked `p.company_id` (snake_case), which evaluated to `undefined` and produced an empty list (`[]`).
  - Updated to check `(p.companyId === targetCatalogId || (p as any).company_id === targetCatalogId)` with fallback matching by company name against catalog companies (`catalogCompanies`).
  - If company-specific products exist, the modal automatically displays ONLY that specific company's products by default.
  - Added a toggle pill button (`[X Products] (Show all)`) allowing users to switch between company-specific products and all catalog products if needed.
  - If a newly created company has no catalog products assigned yet, it gracefully falls back to displaying all catalog products so the user is never blocked.
- **Searchable Product Dropdown Improvements**:
  - Search input inside the dropdown automatically resets upon opening, giving immediate visibility of the company's product inventory.
  - Search input placeholder dynamically reflects the available count (`Search X products...`).
  - Added click-outside listener via `dropdownRef` to seamlessly close the popover when clicking anywhere else.
  - Applied dynamic z-index stacking (`zIndex: isDropdownOpen ? 40 : items.length - idx`) to ensure the open product menu always floats comfortably over subsequent line items.

### 25. **Supabase Pooler DNS Resolution Fix (`hostaddr` & SQLAlchemy Connection Pooling)**
- **Root Cause of `psycopg2.OperationalError: could not translate host name`**:
  - Intermittent ISP / local Wi-Fi router DNS timeouts occurred when resolving `aws-0-ap-southeast-1.pooler.supabase.com`. Windows `getaddrinfo` blocked for up to 45–50s, causing FastAPI backend endpoints (like `GET /api/v1/reports/`) to fail with 500 errors.
- **Solution (100% Inside Application Code, No OS Modification)**:
  - Configured PostgreSQL's native `hostaddr` connection argument (`52.74.252.201`) in `backend/app/db/session.py`.
  - When `hostaddr` is specified, `libpq` routes network traffic directly to the IP, completely bypassing operating system DNS lookups.
  - Hostname is preserved so SSL/TLS SNI and certificate validation continue to work seamlessly.
  - Added SQLAlchemy connection pooling configuration: `pool_pre_ping=True`, `pool_recycle=300`, `pool_size=10`, `max_overflow=20`, and TCP keepalives.
  - Connection time dropped from 45+ seconds to **1.1 seconds**, completely eliminating the DNS error.

---

## 10. Changes Log — Session 2026-09-21

### 26. **Money Management Module**
- **Architecture**:
  - Added `money_accounts` table: tracks bank accounts and cash counters (`title`, `bank_name`, `account_type` ['BANK'/'CASH'], `account_number`, `opening_balance`, soft-delete flags).
  - Added `money_transactions` table: records every movement of money (`account_id`, `transaction_date`, `type` ['DEPOSIT'/'WITHDRAWAL'/'OPENING'/'COMPANY_PAYMENT'], `amount`, `payment_method`, `description`, `tid`, `company_khata_entry_id` FK for 2-way sync).
  - Tables created automatically at backend startup via `CREATE TABLE IF NOT EXISTS` in `main.py`.
- **Backend API** (`/api/v1/money/`):
  - Full REST CRUD for accounts and transactions.
  - `GET /accounts` returns computed `current_balance` = `opening_balance + SUM(DEPOSIT+OPENING) - SUM(WITHDRAWAL+COMPANY_PAYMENT)`.
  - `POST /accounts` auto-inserts an `OPENING` type transaction if `opening_balance > 0`.
  - `GET /accounts/{id}/ledger` returns full chronological transaction list with running balance per row.
  - Account deletion blocked if non-OPENING transactions exist (same deletion-protection pattern as Company Khata).
- **2-Way Company Khata Sync**:
  - `CompanyPaymentCreate` schema gains optional `money_account_id` field.
  - `create_company_payment()` in `crud_company_khata.py`: when `money_account_id` is provided, atomically creates both the `CompanyKhataEntry` (PAYMENT) AND a `MoneyTransaction` (type=`COMPANY_PAYMENT`, linked by `company_khata_entry_id`). Both are in the same DB transaction — if either fails, both roll back.
  - Result: Paying a company from the Company Khata form automatically deducts from your chosen bank/cash account balance.
- **Frontend Pages**:
  - `/money` — Overview dashboard (`MoneyManagement.tsx`): 3 summary cards (Total / Bank / Cash), per-account cards with gradient headers, quick Deposit/Withdraw action buttons, Edit/Delete, View Ledger nav.
  - `/money/:accountId` — Ledger detail (`MoneyAccountDetail.tsx`): 3 summary cards (Deposits / Withdrawals / Balance), full transaction table with type badges (DEPOSIT=green, WITHDRAWAL=red, OPENING=slate, COMPANY_PAYMENT=blue), running balance column, inline Edit/Delete (OPENING and COMPANY_PAYMENT rows are locked).
- **Frontend Modals/Components**:
  - `AddMoneyAccountModal.tsx`: BANK/CASH type toggle, conditional bank name & IBAN fields, opening balance field (only on create).
  - `AddMoneyTransactionModal.tsx`: DEPOSIT/WITHDRAWAL type toggle (color-adapts), CustomDatePicker, ONLINE/CASH method, TID field (online-only), description.
  - `CompanyPaymentModal.tsx`: new optional "Deduct from My Account" dropdown listing all `money_accounts` with live balance preview (`current → new balance`).
- **Navigation**:
  - Sidebar: "Money" nav item (Banknote icon) between Company Khata and More.
  - MoreHub: Money Management card (blue-to-indigo gradient, Finance badge).
- **Backup & Restore**:
  - `money_accounts` and `money_transactions` fully included in `/backup/export` (sections 11 & 12) and `/backup/import` upsert logic.
- **API Client**:
  - `frontend/src/utils/api.ts`: `MoneyAccount`, `MoneyTransaction`, `MoneyAccountLedger` TypeScript interfaces + full `moneyService` singleton.

### 27. **Automatic HTTPS SSL with Caddy Reverse Proxy**
- **Architecture**:
  - Added `backend/Caddyfile` configured to route `api.newgreencorporation.app` directly to `127.0.0.1:8000` (FastAPI backend).
  - Added `caddy:2-alpine` container in `backend/docker-compose.yml` with persistent volume storage for SSL certificate storage (`caddy_data` & `caddy_config`).
  - Automatic Let's Encrypt TLS certificate provisioning, HTTP->HTTPS auto-redirect, and zero-touch auto-renewals.
- **Frontend & Deployment**:
  - Updated `frontend/src/utils/api.ts` fallback URL to `https://api.newgreencorporation.app/api/v1`.
  - Updated `.github/workflows/deploy-aws.yml` to include domain health checks (`https://api.newgreencorporation.app/api/v1/health`).
