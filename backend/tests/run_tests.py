#!/usr/bin/env python
"""
Simple test runner script
Runs individual tests and shows results
"""
import subprocess
import sys

def run_test(test_path, description):
    """Run a single test and display results"""
    print(f"\n{'='*80}")
    print(f"🧪 Testing: {description}")
    print(f"{'='*80}")
    
    # Try to run with pytest
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", test_path, "-v", "--tb=short"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        
        if result.returncode == 0:
            print(f"✅ {description} - PASSED")
            return True
        else:
            print(f"❌ {description} - FAILED")
            return False
    except FileNotFoundError:
        print(f"⚠️  pytest not found. Installing dependencies...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", "tests/requirements.txt"])
        return run_test(test_path, description)
    except Exception as e:
        print(f"❌ Error running test: {e}")
        return False

def main():
    print("\n" + "="*80)
    print("🚀 AGRIMANAGE PRO - TEST SUITE RUNNER")
    print("="*80)
    
    tests = [
        ("tests/test_companies.py::TestCompanyEndpoints::test_create_company", "Create Company"),
        ("tests/test_companies.py::TestCompanyEndpoints::test_get_companies", "Get Companies List"),
        ("tests/test_companies.py::TestCompanyEndpoints::test_update_company", "Update Company"),
        ("tests/test_products.py::TestProductEndpoints::test_create_product", "Create Product"),
        ("tests/test_products.py::TestProductEndpoints::test_get_products", "Get Products List"),
        ("tests/test_stock.py::TestStockEndpoints::test_add_stock", "Add Stock"),
        ("tests/test_sales.py::TestSalesEndpoints::test_create_sale", "Create Sale"),
    ]
    
    passed = 0
    failed = 0
    
    for test_path, description in tests:
        if run_test(test_path, description):
            passed += 1
        else:
            failed += 1
    
    print(f"\n{'='*80}")
    print(f"📊 TEST SUMMARY")
    print(f"{'='*80}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📝 Total:  {passed + failed}")
    
    if failed == 0:
        print(f"\n🎉 ALL TESTS PASSED! Application is working perfectly!")
    else:
        print(f"\n⚠️  Some tests failed. Review the output above.")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
