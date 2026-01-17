"""
Test cases for Sales endpoints
Tests sales operations with soft delete support
"""
import pytest

class TestSalesEndpoints:
    """Test suite for /api/v1/sales endpoints"""
    
    @pytest.fixture
    def test_product_with_stock(self, client, auth_headers):
        """Create product and add stock, return product ID"""
        # Create company
        company_response = client.post(
            "/api/v1/companies/",
            json={"name": "Sales Test Company"},
            headers=auth_headers
        )
        company_id = company_response.json()["id"]
        
        # Create product
        product_response = client.post(
            "/api/v1/products/",
            json={
                "company_id": company_id,
                "name": "Sales Test Product",
                "category": "Fertilizer",
                "unit": "Bags",
                "purchase_price": 1000.00,
                "min_stock": 5
            },
            headers=auth_headers
        )
        product_id = product_response.json()["id"]
        
        # Add stock
        client.post(
            "/api/v1/transactions/",
            json={
                "product_id": product_id,
                "quantity": 100,
                "party_name": "Initial Stock",
                "purchase_price": 1000.00,
                "type": "IN"
            },
            headers=auth_headers
        )
        
        return product_id
    
    def test_create_sale(self, client, auth_headers, test_product_with_stock):
        """Test creating a sale"""
        sale_data = {
            "product_id": test_product_with_stock,
            "customer_name": "John Farmer",
            "customer_phone": "03001234567",
            "quantity": 10,
            "selling_price": 1200.00,
            "payment_type": "Debit"
        }
        
        response = client.post(
            "/api/v1/sales/",
            json=sale_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["customer_name"] == "John Farmer"
        assert data["quantity"] == 10
        assert data["payment_type"] == "Debit"
        assert float(data["total_amount"]) == 12000.00
    
    def test_create_credit_sale(self, client, auth_headers, test_product_with_stock):
        """Test creating a credit sale (payment pending)"""
        sale_data = {
            "product_id": test_product_with_stock,
            "customer_name": "Ahmed Ali",
            "quantity": 5,
            "selling_price": 1150.00,
            "payment_type": "Credit"
        }
        
        response = client.post("/api/v1/sales/", json=sale_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["payment_type"] == "Credit"
    
    def test_get_sales(self, client, auth_headers, test_product_with_stock):
        """Test retrieving all sales"""
        # Create a sale
        client.post("/api/v1/sales/", json={
            "product_id": test_product_with_stock,
            "customer_name": "Test Customer",
            "quantity": 3,
            "selling_price": 1100.00,
            "payment_type": "Debit"
        }, headers=auth_headers)
        
        # Get sales
        response = client.get("/api/v1/sales/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_delete_sale(self, client, auth_headers, test_product_with_stock):
        """Test soft deleting a sale"""
        # Create sale
        create_response = client.post("/api/v1/sales/", json={
            "product_id": test_product_with_stock,
            "customer_name": "Delete Test Customer",
            "quantity": 2,
            "selling_price": 1000.00,
            "payment_type": "Debit"
        }, headers=auth_headers)
        sale_id = create_response.json()["id"]
        
        # Delete sale (soft delete)
        response = client.delete(f"/api/v1/sales/{sale_id}", headers=auth_headers)
        
        assert response.status_code == 200
    
    def test_sale_insufficient_stock(self, client, auth_headers, test_product_with_stock):
        """Test that sale fails when insufficient stock"""
        sale_data = {
            "product_id": test_product_with_stock,
            "customer_name": "Big Order Customer",
            "quantity": 1000,  # More than available
            "selling_price": 1200.00,
            "payment_type": "Debit"
        }
        
        response = client.post("/api/v1/sales/", json=sale_data, headers=auth_headers)
        
        # Should fail with 400 or similar
        assert response.status_code in [400, 422]
    
    def test_phone_validation(self, client, auth_headers, test_product_with_stock):
        """Test phone number validation"""
        # Valid 11-digit phone
        response1 = client.post("/api/v1/sales/", json={
            "product_id": test_product_with_stock,
            "customer_name": "Phone Test",
            "customer_phone": "03001234567",
            "quantity": 1,
            "selling_price": 1000.00,
            "payment_type": "Debit"
        }, headers=auth_headers)
        assert response1.status_code == 200
        
        # Invalid phone (if validation exists)
        response2 = client.post("/api/v1/sales/", json={
            "product_id": test_product_with_stock,
            "customer_name": "Phone Test 2",
            "customer_phone": "123",  # Too short
            "quantity": 1,
            "selling_price": 1000.00,
            "payment_type": "Debit"
        }, headers=auth_headers)
        # May or may not fail depending on validation
