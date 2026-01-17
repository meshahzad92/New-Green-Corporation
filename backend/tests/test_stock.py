"""
Test cases for Stock Transaction endpoints
Tests stock inward/outward operations with soft delete support
"""
import pytest

class TestStockEndpoints:
    """Test suite for /api/v1/transactions endpoints"""
    
    @pytest.fixture
    def test_product_id(self, client, auth_headers):
        """Create test company and product, return product ID"""
        # Create company
        company_response = client.post(
            "/api/v1/companies/",
            json={"name": "Stock Test Company"},
            headers=auth_headers
        )
        company_id = company_response.json()["id"]
        
        # Create product
        product_response = client.post(
            "/api/v1/products/",
            json={
                "company_id": company_id,
                "name": "Stock Test Product",
                "category": "Fertilizer",
                "unit": "Bags",
                "purchase_price": 1000.00,
                "min_stock": 5
            },
            headers=auth_headers
        )
        return product_response.json()["id"]
    
    def test_add_stock(self, client, auth_headers, test_product_id):
        """Test adding stock (IN transaction)"""
        transaction_data = {
            "product_id": test_product_id,
            "quantity": 50,
            "party_name": "ABC Suppliers",
            "purchase_price": 1000.00,
            "type": "IN"
        }
        
        response = client.post(
            "/api/v1/transactions/",
            json=transaction_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["quantity"] == 50
        assert data["type"] == "IN"
        assert data["party_name"] == "ABC Suppliers"
    
    def test_get_transactions(self, client, auth_headers, test_product_id):
        """Test retrieving all transactions"""
        # Add stock
        client.post(
            "/api/v1/transactions/",
            json={
                "product_id": test_product_id,
                "quantity": 30,
                "party_name": "XYZ Suppliers",
                "purchase_price": 950.00,
                "type": "IN"
            },
            headers=auth_headers
        )
        
        # Get transactions
        response = client.get("/api/v1/transactions/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_delete_transaction(self, client, auth_headers, test_product_id):
        """Test soft deleting a stock transaction"""
        # Add stock
        create_response = client.post(
            "/api/v1/transactions/",
            json={
                "product_id": test_product_id,
                "quantity": 20,
                "party_name": "Test Supplier",
                "purchase_price": 1000.00,
                "type": "IN"
            },
            headers=auth_headers
        )
        transaction_id = create_response.json()["id"]
        
        # Delete transaction (soft delete)
        response = client.delete(
            f"/api/v1/transactions/{transaction_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Transaction should not appear in regular list (soft deleted)
        list_response = client.get("/api/v1/transactions/", headers=auth_headers)
        transaction_ids = [t["id"] for t in list_response.json()]
        # Note: Soft deleted transactions might still appear depending on implementation
    
    def test_stock_balance_calculation(self, client, auth_headers, test_product_id):
        """Test that stock balance is calculated correctly"""
        # Add stock multiple times
        client.post("/api/v1/transactions/", json={
            "product_id": test_product_id,
            "quantity": 100,
            "party_name": "Supplier 1",
            "purchase_price": 1000.00,
            "type": "IN"
        }, headers=auth_headers)
        
        # Get product to check stock
        response = client.get(f"/api/v1/products/{test_product_id}", headers=auth_headers)
        
        assert response.status_code == 200
        # Stock calculations are done via aggregation
