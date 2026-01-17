#!/usr/bin/env python
"""
Manual API Endpoint Verification Script
Tests all endpoints without pytest to verify everything works
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"
TEST_RESULTS = []

def log_test(test_name, success, details=""):
    """Log test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    TEST_RESULTS.append({
        "test": test_name,
        "success": success,
        "details": details
    })
    print(f"{status} - {test_name}")
    if details and not success:
        print(f"   Details: {details}")

def test_login():
    """Test 1: Login and get token"""
    print("\n🔐 Testing Authentication...")
    try:
        response = requests.post(
            f"{BASE_URL}/login/access-token",
            data={"username": "waris92", "password": "waris92"}
        )
        if response.status_code == 200:
            token = response.json().get("access_token")
            if token:
                log_test("Login & Authentication", True)
                return token
        log_test("Login & Authentication", False, f"Status: {response.status_code}")
        return None
    except Exception as e:
        log_test("Login & Authentication", False, str(e))
        return None

def test_companies(token):
    """Test 2-4: Company endpoints"""
    print("\n🏢 Testing Company Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test GET companies
    try:
        response = requests.get(f"{BASE_URL}/companies/", headers=headers)
        log_test("GET /companies", response.status_code == 200)
    except Exception as e:
        log_test("GET /companies", False, str(e))
    
    # Test CREATE company
    try:
        test_company = {
            "name": f"Test Company {datetime.now().timestamp()}"
        }
        response = requests.post(f"{BASE_URL}/companies/", json=test_company, headers=headers)
        # Accept both 200 and 201 as success
        if response.status_code in [200, 201]:
            company_id = response.json().get("id")
            log_test("POST /companies (Create)", True)
            return company_id
        log_test("POST /companies (Create)", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /companies (Create)", False, str(e))
    
    return None

def test_products(token, company_id):
    """Test 5-7: Product endpoints"""
    print("\n📦 Testing Product Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test GET products
    try:
        response = requests.get(f"{BASE_URL}/products/", headers=headers)
        log_test("GET /products", response.status_code == 200)
    except Exception as e:
        log_test("GET /products", False, str(e))
    
    if not company_id:
        log_test("POST /products (Create)", False, "No company_id available")
        return None
    
    # Test CREATE product
    try:
        test_product = {
            "company_id": company_id,
            "name": f"Test Product {datetime.now().timestamp()}",
            "category": "Fertilizer",
            "unit": "Bags",
            "purchase_price": 1000.00,
            "min_stock": 5
        }
        response = requests.post(f"{BASE_URL}/products/", json=test_product, headers=headers)
        # Accept both 200 and 201 as success
        if response.status_code in [200, 201]:
            product_id = response.json().get("id")
            log_test("POST /products (Create)", True)
            return product_id
        log_test("POST /products (Create)", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /products (Create)", False, str(e))
    
    return None

def test_stock(token, product_id):
    """Test 8-9: Stock transaction endpoints"""
    print("\n📊 Testing Stock Transaction Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test GET transactions
    try:
        response = requests.get(f"{BASE_URL}/transactions", headers=headers)
        log_test("GET /transactions", response.status_code == 200)
    except Exception as e:
        log_test("GET /transactions", False, str(e))
    
    if not product_id:
        log_test("POST /transactions (Add Stock)", False, "No product_id available")
        return
    
    # Test ADD stock
    try:
        test_transaction = {
            "product_id": product_id,
            "quantity": 50,
            "party_name": "Test Supplier",
            "purchase_price": 1000.00,
            "type": "IN"
        }
        response = requests.post(f"{BASE_URL}/transactions/", json=test_transaction, headers=headers)
        log_test("POST /transactions (Add Stock)", response.status_code in [200, 201])
    except Exception as e:
        log_test("POST /transactions (Add Stock)", False, str(e))

def test_sales(token, product_id):
    """Test 10-11: Sales endpoints"""
    print("\n💰 Testing Sales Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test GET sales
    try:
        response = requests.get(f"{BASE_URL}/sales", headers=headers)
        log_test("GET /sales", response.status_code == 200)
    except Exception as e:
        log_test("GET /sales", False, str(e))
    
    if not product_id:
        log_test("POST /sales (Create Sale)", False, "No product_id available")
        return
    
    # Test CREATE sale
    try:
        test_sale = {
            "product_id": product_id,
            "customer_name": "Test Customer",
            "customer_phone": "03001234567",
            "quantity": 5,
            "selling_price": 1200.00,
            "payment_type": "Debit"
        }
        response = requests.post(f"{BASE_URL}/sales/", json=test_sale, headers=headers)
        log_test("POST /sales (Create Sale)", response.status_code in [200, 201])
    except Exception as e:
        log_test("POST /sales (Create Sale)", False, str(e))

def test_dashboard(token):
    """Test 12: Dashboard stats"""
    print("\n📈 Testing Dashboard Endpoint...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/reports/", headers=headers)
        log_test("GET /reports/ (Dashboard)", response.status_code == 200)
    except Exception as e:
        log_test("GET /reports/ (Dashboard)", False, str(e))

def main():
    print("="*80)
    print("🚀 AGRIMANAGE PRO - API ENDPOINT VERIFICATION")
    print("="*80)
    print(f"Testing API at: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    token = test_login()
    if not token:
        print("\n❌ Authentication failed. Cannot proceed with other tests.")
        print("Make sure the backend server is running at http://localhost:8000")
        return 1
    
    company_id = test_companies(token)
    product_id = test_products(token, company_id)
    test_stock(token, product_id)
    test_sales(token, product_id)
    test_dashboard(token)
    
    # Summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    
    total = len(TEST_RESULTS)
    passed = sum(1 for t in TEST_RESULTS if t["success"])
    failed = total - passed
    
    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {failed}/{total}")
    
    if failed == 0:
        print("\n🎉 ALL ENDPOINTS WORKING PERFECTLY!")
        print("✅ Your application is production-ready!")
    else:
        print("\n⚠️  Some endpoints failed. Details above.")
    
    print("\n" + "="*80)
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
