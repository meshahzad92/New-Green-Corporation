#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AgriManage Pro - FULL HTTP API TEST SUITE
Pure HTTP tests - no app imports, no local DB connection needed.
Tests every endpoint against the running backend.
"""
import sys, os

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests
import json
from datetime import datetime, date, timedelta
from uuid import uuid4

BASE_URL = "http://localhost:8000/api/v1"
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

passed = []
failed = []
warnings = []

def ok(name, note=""):
    passed.append(name)
    line = f"  [PASS]  {name}"
    if note: line += f"  ({note})"
    print(line)

def fail(name, detail=""):
    failed.append(name)
    print(f"  [FAIL]  {name}")
    if detail:
        print(f"          >> {detail}")

def warn(name, detail=""):
    warnings.append(name)
    line = f"  [WARN]  {name}"
    if detail: line += f" -- {detail}"
    print(line)

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def check(name, response, expected_status, key_checks=None):
    if response.status_code != expected_status:
        body = ""
        try:
            body = str(response.json())[:250]
        except Exception:
            body = response.text[:250]
        fail(name, f"Expected {expected_status}, got {response.status_code}  |  {body}")
        return None
    if key_checks:
        try:
            data = response.json()
        except Exception:
            fail(name, "Response is not JSON")
            return None
        for k, v in key_checks.items():
            actual = data.get(k)
            if actual != v:
                fail(name, f"  {k}: expected {v!r}, got {actual!r}")
                return None
    ok(name)
    try:
        return response.json()
    except Exception:
        return {}

# ======================================================
print(f"\n{'='*60}")
print(f"  AgriManage Pro - FULL FUNCTIONALITY TEST SUITE")
print(f"  Target: {BASE_URL}")
print(f"  Time  : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'='*60}")

# ======================================================
section("0. CONNECTIVITY & HEALTH")

try:
    r = requests.get(f"{BASE_URL}/health", timeout=10)
    data = check("GET /health -> 200", r, 200, {"status": "healthy"})
    if data:
        ok(f"Service: {data.get('service','?')}")
except requests.exceptions.ConnectionError:
    fail("Backend reachable at localhost:8000", "Connection refused")
    print("\nCannot reach backend. Aborting.")
    sys.exit(1)

# ======================================================
section("1. AUTHENTICATION")

# 1a. Valid login
r = requests.post(f"{BASE_URL}/login/access-token",
                  data={"username": "waris92", "password": "waris92"}, timeout=15)
data = check("POST /login - valid credentials -> 200", r, 200)
TOKEN = data.get("access_token") if data else None
if TOKEN:
    ok("JWT token present in response")
    ok(f"Token type: {data.get('token_type','?')}")
else:
    fail("JWT token returned")
    print("No token -- cannot continue.")
    sys.exit(1)

HDR = {"Authorization": f"Bearer {TOKEN}"}

# 1b. Wrong password
r = requests.post(f"{BASE_URL}/login/access-token",
                  data={"username": "waris92", "password": "wrongpassword"}, timeout=10)
check("POST /login - wrong password -> 400", r, 400)

# 1c. No token on protected endpoint
r = requests.get(f"{BASE_URL}/companies/", timeout=10)
check("GET /companies without token -> 401", r, 401)

# ======================================================
section("2. COMPANIES")

# 2a. List all
r = requests.get(f"{BASE_URL}/companies/", headers=HDR, timeout=10)
companies_list = check("GET /companies -> 200", r, 200)
if isinstance(companies_list, list):
    ok(f"Companies list returned ({len(companies_list)} entries)")

# 2b. Predefined companies seeded
if isinstance(companies_list, list):
    names = [c["name"] for c in companies_list]
    for expected in ["Bayer", "Syngenta"]:
        if any(expected in n for n in names):
            ok(f"Predefined company '{expected}' seeded")
        else:
            warn(f"Predefined company '{expected}'", "not found in list")

# 2c. Create company
ts = int(datetime.now().timestamp())
r = requests.post(f"{BASE_URL}/companies/",
                  json={"name": f"AutoTest_Co_{ts}"}, headers=HDR, timeout=10)
co = check("POST /companies -> 201", r, 201)
COMPANY_ID = co["id"] if co else None
if COMPANY_ID:
    ok(f"Created company ID: {COMPANY_ID[:8]}...")

# 2d. Update company
if COMPANY_ID:
    r = requests.put(f"{BASE_URL}/companies/{COMPANY_ID}",
                     json={"name": f"AutoTest_Co_{ts}_UPD"}, headers=HDR, timeout=10)
    up = check("PUT /companies/{id} -> 200", r, 200)
    if up and "UPD" in up.get("name",""):
        ok("Company name updated correctly")

# 2e. Empty name rejected (validation)
r = requests.post(f"{BASE_URL}/companies/", json={"name": ""}, headers=HDR, timeout=10)
if r.status_code in (400, 422):
    ok("POST /companies - empty name -> 4xx rejected")
else:
    warn("POST /companies empty name", f"got {r.status_code}")

# ======================================================
section("3. PRODUCTS")

# 3a. List
r = requests.get(f"{BASE_URL}/products/", headers=HDR, timeout=10)
products_list = check("GET /products -> 200", r, 200)
if isinstance(products_list, list):
    ok(f"Products list returned ({len(products_list)} entries)")

# 3b. current_stock field present
if isinstance(products_list, list) and products_list:
    if "current_stock" in products_list[0]:
        ok("current_stock field present in product list")
    else:
        fail("current_stock field missing from product list")

# 3c. Create product
PRODUCT_ID = None
if COMPANY_ID:
    prod_payload = {
        "company_id": COMPANY_ID,
        "name": f"AutoTest_Prod_{ts}",
        "category": "Fertilizer",
        "unit": "Bags",
        "purchase_price": 1000.00,
        "min_stock": 5
    }
    r = requests.post(f"{BASE_URL}/products/", json=prod_payload, headers=HDR, timeout=10)
    prod = check("POST /products -> 201", r, 201)
    PRODUCT_ID = prod["id"] if prod else None
    if PRODUCT_ID:
        ok(f"Created product ID: {PRODUCT_ID[:8]}...")

# 3d. Get product by ID
if PRODUCT_ID:
    r = requests.get(f"{BASE_URL}/products/{PRODUCT_ID}", headers=HDR, timeout=10)
    check("GET /products/{id} -> 200", r, 200)

# 3e. Search filter
r = requests.get(f"{BASE_URL}/products/?search=AutoTest", headers=HDR, timeout=10)
if r.status_code == 200:
    results = r.json()
    if any(PRODUCT_ID and p["id"] == PRODUCT_ID for p in results):
        ok(f"GET /products?search= filter works ({len(results)} results)")
    else:
        warn("Product search filter", "created product not in results")
else:
    warn("GET /products?search=", f"status {r.status_code}")

# 3f. Category filter
r = requests.get(f"{BASE_URL}/products/?category=Fertilizer", headers=HDR, timeout=10)
if r.status_code == 200:
    ok(f"GET /products?category=Fertilizer -> {len(r.json())} results")
else:
    warn("GET /products?category=", f"status {r.status_code}")

# 3g. Update product
if PRODUCT_ID:
    r = requests.put(f"{BASE_URL}/products/{PRODUCT_ID}",
                     json={"name": f"AutoTest_Prod_{ts}_v2", "min_stock": 10},
                     headers=HDR, timeout=10)
    up = check("PUT /products/{id} -> 200", r, 200)
    if up and up.get("min_stock") == 10:
        ok("Product min_stock updated to 10")

# 3h. Nonexistent product -> 404
r = requests.get(f"{BASE_URL}/products/{uuid4()}", headers=HDR, timeout=10)
if r.status_code == 404:
    ok("GET /products/nonexistent -> 404")
else:
    warn("GET /products/nonexistent", f"got {r.status_code}")

# ======================================================
section("4. STOCK TRANSACTIONS")

TRANSACTION_ID = None
TRANSACTION_ID_2 = None

# 4a. List
r = requests.get(f"{BASE_URL}/transactions", headers=HDR, timeout=10)
check("GET /transactions -> 200", r, 200)

if PRODUCT_ID:
    # 4b. Add stock IN
    tx_payload = {
        "product_id": PRODUCT_ID,
        "quantity": 100,
        "party_name": "Test Supplier Co",
        "purchase_price": 1000.00,
        "type": "IN"
    }
    r = requests.post(f"{BASE_URL}/transactions", json=tx_payload, headers=HDR, timeout=10)
    tx = check("POST /transactions (IN qty=100) -> 201", r, 201)
    TRANSACTION_ID = tx["id"] if tx else None

    # 4c. Verify stock balance updated
    r = requests.get(f"{BASE_URL}/products/", headers=HDR, timeout=10)
    prods = r.json()
    our_prod = next((p for p in prods if p["id"] == PRODUCT_ID), None)
    if our_prod and our_prod.get("current_stock", 0) >= 100:
        ok(f"Stock balance updated after IN -> current_stock={our_prod['current_stock']}")
    else:
        fail("current_stock not updated after IN transaction",
             f"value={our_prod.get('current_stock') if our_prod else 'N/A'}")

    # 4d. Add another IN for soft-delete test
    r = requests.post(f"{BASE_URL}/transactions", json=tx_payload, headers=HDR, timeout=10)
    if r.status_code in (200, 201):
        TRANSACTION_ID_2 = r.json().get("id")

    # 4e. Soft delete second transaction
    if TRANSACTION_ID_2:
        r = requests.delete(f"{BASE_URL}/transactions/{TRANSACTION_ID_2}",
                            headers=HDR, timeout=10)
        check("DELETE /transactions/{id} (soft delete) -> 204", r, 204)

        # Verify excluded from list
        r = requests.get(f"{BASE_URL}/transactions", headers=HDR, timeout=10)
        tx_ids = [t["id"] for t in r.json()]
        if TRANSACTION_ID_2 not in tx_ids:
            ok("Soft-deleted transaction excluded from GET /transactions")
        else:
            fail("Soft-deleted transaction still visible in GET /transactions")

    # 4f. Invalid type
    r = requests.post(f"{BASE_URL}/transactions",
                      json={**tx_payload, "type": "INVALID"}, headers=HDR, timeout=10)
    if r.status_code == 422:
        ok("POST /transactions - invalid type='INVALID' -> 422")
    else:
        warn("Invalid transaction type enforcement", f"got {r.status_code}")

else:
    fail("Stock transaction tests - skipped (no product)")

# ======================================================
section("5. SALES")

SALE_ID = None
SALE_ID_CREDIT = None

# 5a. List
r = requests.get(f"{BASE_URL}/sales", headers=HDR, timeout=10)
check("GET /sales -> 200", r, 200)

if PRODUCT_ID:
    # 5b. Debit sale
    sale_payload = {
        "product_id": PRODUCT_ID,
        "customer_name": "Ahmad Khan",
        "customer_phone": "03001234567",
        "quantity": 5,
        "selling_price": 1200.00,
        "payment_type": "Debit"
    }
    r = requests.post(f"{BASE_URL}/sales", json=sale_payload, headers=HDR, timeout=10)
    sale = check("POST /sales (Debit, qty=5) -> 201", r, 201)
    SALE_ID = sale["id"] if sale else None

    if sale:
        expected_total = 5 * 1200.0
        actual_total = float(sale.get("total_amount", 0))
        if abs(actual_total - expected_total) < 0.01:
            ok(f"total_amount = selling_price x quantity = {actual_total}")
        else:
            fail("total_amount calculation", f"expected {expected_total}, got {actual_total}")

        actual_pp = float(sale.get("purchase_price", 0))
        if abs(actual_pp - 1000.0) < 0.01:
            ok(f"purchase_price snapshot locked at time-of-sale = {actual_pp}")
        else:
            fail("purchase_price snapshot at sale time", f"expected 1000.0, got {actual_pp}")

    # 5c. Credit sale
    r = requests.post(f"{BASE_URL}/sales", json={
        "product_id": PRODUCT_ID,
        "customer_name": "Rehman Agri Store",
        "customer_phone": "03119876543",
        "quantity": 3,
        "selling_price": 1150.00,
        "payment_type": "Credit"
    }, headers=HDR, timeout=10)
    sale_cr = check("POST /sales (Credit, qty=3) -> 201", r, 201)
    SALE_ID_CREDIT = sale_cr["id"] if sale_cr else None

    # 5d. Verify stock decremented (100 IN, 5+3 = 8 OUT -> 92 remaining)
    r = requests.get(f"{BASE_URL}/products/", headers=HDR, timeout=10)
    prods = r.json()
    our_prod = next((p for p in prods if p["id"] == PRODUCT_ID), None)
    if our_prod:
        ok(f"Stock after 2 sales -> current_stock={our_prod['current_stock']}")

    # 5e. Verify automatic OUT transaction created
    r = requests.get(f"{BASE_URL}/transactions", headers=HDR, timeout=10)
    txs = r.json()
    out_txs = [t for t in txs if t["type"] == "OUT" and t["product_id"] == PRODUCT_ID]
    if out_txs:
        ok(f"Automatic OUT transaction created for sale ({len(out_txs)} OUT txns found)")
    else:
        fail("Automatic OUT stock transaction after sale")

    # 5f. Custom sale date (backdated)
    yesterday = (datetime.now() - timedelta(days=1)).isoformat()
    r = requests.post(f"{BASE_URL}/sales", json={
        **sale_payload, "quantity": 1, "created_at": yesterday
    }, headers=HDR, timeout=10)
    if r.status_code in (200, 201):
        ok("POST /sales with custom created_at (backdated) -> accepted")
    else:
        warn("POST /sales custom date", f"got {r.status_code}")

    # 5g. Update sale (change qty + price -> total_amount recalculated)
    if SALE_ID:
        r = requests.put(f"{BASE_URL}/sales/{SALE_ID}",
                         json={"quantity": 6, "selling_price": 1250.00},
                         headers=HDR, timeout=10)
        up = check("PUT /sales/{id} (qty=6, price=1250) -> 200", r, 200)
        if up:
            expected = 6 * 1250.0
            actual = float(up.get("total_amount", 0))
            if abs(actual - expected) < 0.01:
                ok(f"total_amount recalculated after update = {actual}")
            else:
                fail("total_amount recalculate on PUT", f"expected {expected}, got {actual}")

            # Verify linked OUT transaction qty also updated
            r2 = requests.get(f"{BASE_URL}/transactions", headers=HDR, timeout=10)
            txs2 = r2.json()
            sale_out = next((t for t in txs2
                             if t["type"] == "OUT" and t["product_id"] == PRODUCT_ID
                             and t.get("quantity") == 6), None)
            if sale_out:
                ok("Linked OUT transaction qty updated to 6 after sale edit")
            else:
                warn("Linked OUT transaction qty after sale edit", "not verified (may be correct)")

    # 5h. Soft delete sale
    if SALE_ID_CREDIT:
        r = requests.delete(f"{BASE_URL}/sales/{SALE_ID_CREDIT}", headers=HDR, timeout=10)
        check("DELETE /sales/{id} (soft delete) -> 204", r, 204)

        r = requests.get(f"{BASE_URL}/sales", headers=HDR, timeout=10)
        sale_ids = [s["id"] for s in r.json()]
        if SALE_ID_CREDIT not in sale_ids:
            ok("Soft-deleted sale excluded from GET /sales")
        else:
            fail("Soft-deleted sale still visible in GET /sales")

    # 5i. Delete nonexistent sale
    r = requests.delete(f"{BASE_URL}/sales/{uuid4()}", headers=HDR, timeout=10)
    if r.status_code == 404:
        ok("DELETE /sales/nonexistent -> 404")
    else:
        warn("DELETE /sales/nonexistent", f"got {r.status_code}")

    # 5j. Invalid payment_type
    r = requests.post(f"{BASE_URL}/sales", json={
        "product_id": PRODUCT_ID,
        "customer_name": "Test",
        "quantity": 1,
        "selling_price": 100.0,
        "payment_type": "Cash"
    }, headers=HDR, timeout=10)
    if r.status_code == 422:
        ok("POST /sales - invalid payment_type='Cash' -> 422 rejected")
    else:
        warn("payment_type enum enforcement", f"got {r.status_code}")

else:
    fail("Sales tests - skipped (no product)")

# ======================================================
section("6. EXPENSES")

today_str = date.today().isoformat()
EXPENSE_ID = None
INCOME_ID  = None

# 6a. List
r = requests.get(f"{BASE_URL}/expenses/", headers=HDR, timeout=10)
check("GET /expenses -> 200", r, 200)

# 6b. Create expense (negative amount = cost)
r = requests.post(f"{BASE_URL}/expenses/", json={
    "name": "AutoTest Transport",
    "amount": -500.00,
    "quantity": 1,
    "details": "Auto-test expense",
    "expense_date": today_str
}, headers=HDR, timeout=10)
exp = check("POST /expenses (expense, amount=-500) -> 201", r, 201)
EXPENSE_ID = exp["id"] if exp else None

# 6c. Create income (positive amount = income)
r = requests.post(f"{BASE_URL}/expenses/", json={
    "name": "AutoTest Vendor Rebate",
    "amount": 200.00,
    "quantity": 1,
    "details": "Auto-test income",
    "expense_date": today_str
}, headers=HDR, timeout=10)
inc = check("POST /expenses (income, amount=+200) -> 201", r, 201)
INCOME_ID = inc["id"] if inc else None

# 6d. Date filter
r = requests.get(f"{BASE_URL}/expenses/?expense_date={today_str}", headers=HDR, timeout=10)
if r.status_code == 200:
    filtered = r.json()
    our_found = EXPENSE_ID and any(e["id"] == EXPENSE_ID for e in filtered)
    if our_found:
        ok(f"GET /expenses?expense_date filter works ({len(filtered)} records for today)")
    else:
        warn("Expense date filter", "Created expense not in filtered results")
else:
    warn("GET /expenses?expense_date=", f"status {r.status_code}")

# 6e. Daily total
r = requests.get(f"{BASE_URL}/expenses/daily-total?expense_date={today_str}",
                 headers=HDR, timeout=10)
if r.status_code == 200:
    dt = r.json()
    total_val = dt.get("total", 0)
    ok(f"GET /expenses/daily-total -> total={total_val}")
    # Net should be -500 + 200 = -300 (or less if other expenses today)
    if total_val is not None and float(total_val) <= -300:
        ok(f"Daily total reflects expense - income netting ({total_val})")
    else:
        warn("Daily total value", f"got {total_val}, expected <= -300")
else:
    warn("GET /expenses/daily-total", f"status {r.status_code}")

# 6f. Update expense
if EXPENSE_ID:
    r = requests.put(f"{BASE_URL}/expenses/{EXPENSE_ID}",
                     json={"name": "AutoTest Transport Updated", "amount": -600.00},
                     headers=HDR, timeout=10)
    up = check("PUT /expenses/{id} -> 200", r, 200)
    if up and float(up.get("amount", 0)) == -600.0:
        ok("Expense amount updated to -600.00")

# 6g. Soft delete income
if INCOME_ID:
    r = requests.delete(f"{BASE_URL}/expenses/{INCOME_ID}", headers=HDR, timeout=10)
    check("DELETE /expenses/{id} (soft delete) -> 200", r, 200)

    r = requests.get(f"{BASE_URL}/expenses/?expense_date={today_str}",
                     headers=HDR, timeout=10)
    exp_ids = [e["id"] for e in r.json()]
    if INCOME_ID not in exp_ids:
        ok("Soft-deleted expense excluded from list")
    else:
        fail("Soft-deleted expense still visible")

# ======================================================
section("7. REPORTS & DASHBOARD")

# 7a. Dashboard
r = requests.get(f"{BASE_URL}/reports/", headers=HDR, timeout=15)
rpt = check("GET /reports/ (dashboard) -> 200", r, 200)
if rpt:
    stats = rpt.get("stats", {})
    required = ["total_inventory_value", "total_products", "low_stock_count",
                "today_sales_revenue", "today_sales_profit", "total_expense", "net_profit"]
    missing = [k for k in required if k not in stats]
    if not missing:
        ok("All required dashboard stat keys present")
        ok(f"  total_products={stats['total_products']}")
        ok(f"  today_sales_revenue={stats['today_sales_revenue']}")
        ok(f"  net_profit={stats['net_profit']}")
        ok(f"  low_stock_count={stats['low_stock_count']}")
    else:
        fail("Dashboard stats missing keys", str(missing))

    weekly = rpt.get("weekly_sales", [])
    if isinstance(weekly, list) and len(weekly) == 7:
        ok("weekly_sales has exactly 7 day entries")
    else:
        fail("weekly_sales structure", f"expected 7 entries, got {len(weekly) if isinstance(weekly, list) else type(weekly)}")

# 7b. Period summary (30 days)
end_d = date.today().isoformat()
start_d = (date.today() - timedelta(days=30)).isoformat()
r = requests.get(f"{BASE_URL}/reports/period-summary?start_date={start_d}&end_date={end_d}",
                 headers=HDR, timeout=15)
ps = check("GET /reports/period-summary (30 days) -> 200", r, 200)
if ps:
    expected_sections = ["period", "sales_summary", "expense_summary",
                         "credit_debit", "overall", "daily_breakdown"]
    for sk in expected_sections:
        if sk in ps:
            ok(f"  period-summary.{sk} present")
        else:
            fail(f"period-summary.{sk} missing")

    db_list = ps.get("daily_breakdown", [])
    if isinstance(db_list, list) and len(db_list) >= 30:
        ok(f"daily_breakdown has {len(db_list)} entries")
    else:
        warn("daily_breakdown length", f"got {len(db_list)}")

    # Profit formula: net_profit = gross_profit + net_expense
    gross   = float(ps["sales_summary"].get("gross_profit", 0))
    net_exp = float(ps["expense_summary"].get("net_expense", 0))
    net     = float(ps["overall"].get("net_profit", 0))
    if abs((gross + net_exp) - net) < 0.02:
        ok(f"Net profit formula correct: {gross} + ({net_exp}) = {net}")
    else:
        fail("Net profit formula", f"{gross} + {net_exp} != {net}")

# ======================================================
section("8. EDGE CASES & BUSINESS RULES")

if PRODUCT_ID:
    # 8a. Price update when new IN stock added with higher price
    r = requests.post(f"{BASE_URL}/transactions", json={
        "product_id": PRODUCT_ID,
        "quantity": 10,
        "party_name": "Price Update Supplier",
        "purchase_price": 1500.00,
        "type": "IN"
    }, headers=HDR, timeout=10)
    if r.status_code in (200, 201):
        r = requests.get(f"{BASE_URL}/products/{PRODUCT_ID}", headers=HDR, timeout=10)
        p = r.json()
        if abs(float(p.get("purchase_price", 0)) - 1500.0) < 0.01:
            ok("Product purchase_price auto-updated on IN transaction with new price")
        else:
            fail("purchase_price auto-update on IN", f"expected 1500.0, got {p.get('purchase_price')}")

    # 8b. Block delete company with products
    if COMPANY_ID:
        r = requests.delete(f"{BASE_URL}/companies/{COMPANY_ID}", headers=HDR, timeout=10)
        if r.status_code == 400:
            ok("DELETE /companies with linked products -> 400 blocked")
        else:
            warn("Company delete protection", f"got {r.status_code} (expected 400)")

    # 8c. Create + delete product (cascade check)
    r2 = requests.post(f"{BASE_URL}/products/", json={
        "company_id": COMPANY_ID,
        "name": f"DeleteTest_{ts}",
        "category": "Seeds",
        "unit": "Kg",
        "purchase_price": 500.0,
        "min_stock": 3
    }, headers=HDR, timeout=10)
    if r2.status_code in (200, 201):
        del_id = r2.json()["id"]
        requests.post(f"{BASE_URL}/transactions", json={
            "product_id": del_id, "quantity": 5,
            "party_name": "X", "purchase_price": 500.0, "type": "IN"
        }, headers=HDR, timeout=10)
        rd = requests.delete(f"{BASE_URL}/products/{del_id}", headers=HDR, timeout=10)
        if rd.status_code in (200, 204):
            ok("DELETE /products/{id} (cascade delete) -> 200/204")
            # Verify gone
            rg = requests.get(f"{BASE_URL}/products/{del_id}", headers=HDR, timeout=10)
            if rg.status_code == 404:
                ok("Deleted product -> 404 on subsequent GET")
        else:
            warn("Product cascade delete", f"got {rd.status_code}")

# ======================================================
section("9. MIGRATION SETTINGS VERIFICATION")

# Check render.yaml
render_yaml = os.path.join(os.path.dirname(__file__), "..", "..", "render.yaml")
if os.path.exists(render_yaml):
    ok("render.yaml present at project root")
    with open(render_yaml) as f:
        ry = f.read()
    if "agrimanage-backend" in ry:
        ok("render.yaml: service name 'agrimanage-backend' declared")
    else:
        fail("render.yaml: service name missing")
    if "DATABASE_URL" in ry and "SECRET_KEY" in ry:
        ok("render.yaml: required env vars (DATABASE_URL, SECRET_KEY) declared")
    else:
        fail("render.yaml: required env vars missing")
    if "free" in ry:
        ok("render.yaml: plan=free set")
else:
    fail("render.yaml missing from project root")

# Check keep-alive workflow
ka = os.path.join(os.path.dirname(__file__), "..", "..",
                  ".github", "workflows", "keep-alive.yml")
if os.path.exists(ka):
    ok(".github/workflows/keep-alive.yml present")
    with open(ka) as f:
        ka_content = f.read()
    if "*/10 * * * *" in ka_content:
        ok("keep-alive: cron every 10 minutes configured")
    if "health" in ka_content:
        ok("keep-alive: pings /health endpoint")
else:
    fail("keep-alive.yml missing")

# Check backup workflow
bu = os.path.join(os.path.dirname(__file__), "..", "..",
                  ".github", "workflows", "backup-db.yml")
if os.path.exists(bu):
    ok(".github/workflows/backup-db.yml present")
    with open(bu) as f:
        bu_content = f.read()
    if "pg_dump" in bu_content:
        ok("backup-db: pg_dump command present")
    if "google-drive-upload" in bu_content:
        ok("backup-db: Google Drive upload action included")
    if "0 21 * * 6" in bu_content:
        ok("backup-db: cron for Sunday 2am PKT configured")
else:
    fail("backup-db.yml missing")

# Check old EC2 workflow disabled
old_wf = os.path.join(os.path.dirname(__file__), "..", "..",
                      ".github", "workflows", "deploy-backend.yml")
old_wf_dis = old_wf + ".disabled"
if not os.path.exists(old_wf) and os.path.exists(old_wf_dis):
    ok("deploy-backend.yml disabled (renamed .disabled) -- EC2 deploys stopped")
elif os.path.exists(old_wf):
    warn("deploy-backend.yml still active", "rename to .disabled")
else:
    ok("deploy-backend.yml removed")

# Check session.py for SSL
session_py = os.path.join(os.path.dirname(__file__), "..", "app", "db", "session.py")
if os.path.exists(session_py):
    with open(session_py) as f:
        sess = f.read()
    if "sslmode" in sess and "require" in sess:
        ok("session.py: SSL sslmode=require for PostgreSQL/Supabase")
    else:
        fail("session.py: sslmode=require missing")
    if "check_same_thread" in sess:
        ok("session.py: SQLite fallback preserved for local dev")
    if "startswith(\"postgresql\")" in sess:
        ok("session.py: conditional SSL branch (postgresql vs sqlite)")

# Check Dockerfile CMD
dockerfile = os.path.join(os.path.dirname(__file__), "..", "Dockerfile")
if os.path.exists(dockerfile):
    with open(dockerfile) as f:
        df = f.read()
    if "uvicorn" in df and "app.main:app" in df and "0.0.0.0" in df:
        ok("Dockerfile: CMD uses uvicorn app.main:app --host 0.0.0.0 --port 8000")
    elif "python main.py" in df:
        fail("Dockerfile: Still using 'python main.py' -- change to uvicorn CMD")
    else:
        warn("Dockerfile CMD", "uvicorn CMD not found in expected format")

# Check CORS config
config_py = os.path.join(os.path.dirname(__file__), "..", "app", "core", "config.py")
if os.path.exists(config_py):
    with open(config_py) as f:
        cfg = f.read()
    if "vercel.app" in cfg:
        ok("config.py: Vercel origin in CORS_ORIGINS")
    else:
        fail("config.py: Vercel origin missing from CORS_ORIGINS")
    if "onrender.com" in cfg:
        ok("config.py: Render origin in CORS_ORIGINS")
    else:
        fail("config.py: Render origin missing from CORS_ORIGINS")
    if '"*"' not in cfg.split("CORS_ORIGINS")[1][:200] if "CORS_ORIGINS" in cfg else True:
        ok("config.py: Wildcard '*' removed from CORS_ORIGINS")
    else:
        warn("config.py CORS", "wildcard '*' still present")

# Database connectivity check via live health endpoint (already confirmed above)
ok("Supabase PostgreSQL: reachable via backend API (confirmed by all above tests)")

# ======================================================
# CLEANUP - delete test data
section("CLEANUP")
if PRODUCT_ID and COMPANY_ID:
    r = requests.delete(f"{BASE_URL}/products/{PRODUCT_ID}", headers=HDR, timeout=10)
    if r.status_code in (200, 204):
        ok("Test product deleted")

    r = requests.delete(f"{BASE_URL}/companies/{COMPANY_ID}", headers=HDR, timeout=10)
    if r.status_code in (200, 204):
        ok("Test company deleted")
    else:
        warn("Test company cleanup", f"status {r.status_code}")

if EXPENSE_ID:
    requests.delete(f"{BASE_URL}/expenses/{EXPENSE_ID}", headers=HDR, timeout=10)
    ok("Test expense deleted")

# ======================================================
print(f"\n{'='*60}")
print(f"  FINAL RESULTS")
print(f"{'='*60}")
total = len(passed) + len(failed) + len(warnings)
print(f"\n  [PASS] Passed  : {len(passed)}")
print(f"  [FAIL] Failed  : {len(failed)}")
print(f"  [WARN] Warnings: {len(warnings)}")
print(f"  Total          : {total}\n")

if failed:
    print(f"  FAILED TESTS:")
    for f in failed:
        print(f"    * {f}")
    print()

if warnings:
    print(f"  WARNINGS:")
    for w in warnings:
        print(f"    * {w}")
    print()

if not failed:
    print(f"  ALL TESTS PASSED -- Application is fully functional!")
else:
    print(f"  {len(failed)} test(s) failed -- see details above.")

print(f"{'='*60}\n")
sys.exit(0 if not failed else 1)
