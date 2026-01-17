"""
Test cases for Product endpoints
Tests all CRUD operations for products
"""
import pytest
from uuid import uuid4

class TestProductEndpoints:
    """Test suite for /api/v1/products endpoints"""
    
    @pytest.fixture
    def test_company_id(self, client, auth_headers):
        """Create a test company and return its ID"""
        response = client.post(
            "/api/v1/companies/",
            json={"name": "Test Product Company"},
            headers=auth_headers
        )
        return response.json()["id"]
    
    def test_create_product(self, client, auth_headers, test_company_id):
        """Test creating a new product"""
        product_data = {
            "company_id": test_company_id,
            "name": "Urea Fertilizer",
            "category": "Fertilizer",
            "unit": "Bags",
            "purchase_price": 1500.00,
            "min_stock": 10
        }
        
        response = client.post(
            "/api/v1/products/",
            json=product_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == product_data["name"]
        assert data["category"] == product_data["category"]
        assert "id" in data
    
    def test_get_products(self, client, auth_headers, test_company_id):
        """Test retrieving all products"""
        # Create a product
        client.post(
            "/api/v1/products/",
            json={
                "company_id": test_company_id,
                "name": "Test Product",
                "category": "Seeds",
                "unit": "Kg",
                "purchase_price": 500.00,
                "min_stock": 5
            },
            headers=auth_headers
        )
        
        # Get all products
        response = client.get("/api/v1/products/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_get_product_by_id(self, client, auth_headers, test_company_id):
        """Test retrieving a specific product"""
        # Create product
        create_response = client.post(
            "/api/v1/products/",
            json={
                "company_id": test_company_id,
                "name": "Specific Product",
                "category": "Pesticide",
                "unit": "Liters",
                "purchase_price": 2000.00,
                "min_stock": 3
            },
            headers=auth_headers
        )
        product_id = create_response.json()["id"]
        
        # Get product
        response = client.get(f"/api/v1/products/{product_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product_id
        assert data["name"] == "Specific Product"
    
    def test_update_product(self, client, auth_headers, test_company_id):
        """Test updating a product"""
        # Create product
        create_response = client.post(
            "/api/v1/products/",
            json={
                "company_id": test_company_id,
                "name": "Original Product",
                "category": "Tools",
                "unit": "Pieces",
                "purchase_price": 300.00,
                "min_stock": 2
            },
            headers=auth_headers
        )
        product_id = create_response.json()["id"]
        
        # Update product
        update_data = {
            "name": "Updated Product",
            "purchase_price": 350.00
        }
        response = client.put(
            f"/api/v1/products/{product_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Product"
        assert float(data["purchase_price"]) == 350.00
    
    def test_delete_product(self, client, auth_headers, test_company_id):
        """Test deleting a product"""
        # Create product
        create_response = client.post(
            "/api/v1/products/",
            json={
                "company_id": test_company_id,
                "name": "Product to Delete",
                "category": "Other",
                "unit": "Units",
                "purchase_price": 100.00,
                "min_stock": 1
            },
            headers=auth_headers
        )
        product_id = create_response.json()["id"]
        
        # Delete product
        response = client.delete(f"/api/v1/products/{product_id}", headers=auth_headers)
        
        assert response.status_code == 200
        
        # Verify deletion
        get_response = client.get(f"/api/v1/products/{product_id}", headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_create_product_invalid_company(self, client, auth_headers):
        """Test creating product with non-existent company"""
        response = client.post(
            "/api/v1/products/",
            json={
                "company_id": str(uuid4()),
                "name": "Invalid Product",
                "category": "Fertilizer",
                "unit": "Bags",
                "purchase_price": 100.00,
                "min_stock": 1
            },
            headers=auth_headers
        )
        
        assert response.status_code in [404, 422]
    
    def test_search_products(self, client, auth_headers, test_company_id):
        """Test searching products by name"""
        # Create products
        client.post("/api/v1/products/", json={
            "company_id": test_company_id,
            "name": "Urea Special",
            "category": "Fertilizer",
            "unit": "Bags",
            "purchase_price": 1500.00,
            "min_stock": 10
        }, headers=auth_headers)
        
        # Search
        response = client.get("/api/v1/products/?search=Urea", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any("Urea" in p["name"] for p in data)
