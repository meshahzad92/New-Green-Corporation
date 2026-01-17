#!/usr/bin/env python
"""
Test Expense Endpoints
Quick verification that expense endpoints are working
"""
import requests
from datetime import date

BASE_URL = "http://localhost:8000/api/v1"
token = None

def get_token():
    """Login and get token"""
    response = requests.post(
        f"{BASE_URL}/login/access-token",
        data={"username": "waris92", "password": "waris92"}
    )
    return response.json().get("access_token")

def test_expenses():
    global token
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print("🧪 Testing Expense Endpoints\n")
    
    # Test 1: GET expenses
    print("1. GET /api/v1/expenses/")
    response = requests.get(f"{BASE_URL}/expenses/", headers=headers)
    print(f"   Status: {response.status_code} {'✅' if response.status_code == 200 else '❌'}")
    
    # Test 2: CREATE expense (negative - expense)
    print("\n2. POST /api/v1/expenses/ (Create expense)")
    expense_data = {
        "name": "Office Rent",
        "amount": -15000,
        "quantity": 1,
        "details": "Monthly office rent payment"
    }
    response = requests.post(f"{BASE_URL}/expenses/", json=expense_data, headers=headers)
    print(f"   Status: {response.status_code} {'✅' if response.status_code == 201 else '❌'}")
    expense_id = response.json().get("id") if response.status_code == 201 else None
    
    # Test 3: CREATE income (positive)
    print("\n3. POST /api/v1/expenses/ (Create income)")
    income_data = {
        "name": "Customer Gift",
        "amount": 5000,
        "quantity": 1,
        "details": "Gift from regular customer"
    }
    response = requests.post(f"{BASE_URL}/expenses/", json=income_data, headers=headers)
    print(f"   Status: {response.status_code} {'✅' if response.status_code == 201 else '❌'}")
    
    # Test 4: GET daily total
    print("\n4. GET /api/v1/expenses/daily-total")
    today = date.today().isoformat()
    response = requests.get(f"{BASE_URL}/expenses/daily-total", params={"expense_date": today}, headers=headers)
    print(f"   Status: {response.status_code} {'✅' if response.status_code == 200 else '❌'}")
    if response.status_code == 200:
        total = response.json().get("total")
        print(f"   Today's Total: {total} PKR")
    
    # Test 5: DELETE expense (if we created one)
    if expense_id:
        print(f"\n5. DELETE /api/v1/expenses/{expense_id}")
        response = requests.delete(f"{BASE_URL}/expenses/{expense_id}", headers=headers)
        print(f"   Status: {response.status_code} {'✅' if response.status_code == 200 else '❌'}")
    
    print("\n✅ All expense endpoints tested!")

if __name__ == "__main__":
    try:
        test_expenses()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
