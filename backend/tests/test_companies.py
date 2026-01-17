"""
Test cases for Company endpoints
Tests all CRUD operations for companies
"""
import pytest
from uuid import uuid4

class TestCompanyEndpoints:
    """Test suite for /api/v1/companies endpoints"""
    
    def test_create_company(self, client, auth_headers):
        """Test creating a new company"""
        company_data = {
            "name": "Test Farm Supplies Ltd"
        }
        
        response = client.post(
            "/api/v1/companies/",
            json=company_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == company_data["name"]
        assert "id" in data
        assert "created_at" in data
    
    def test_create_company_duplicate_name(self, client, auth_headers):
        """Test that duplicate company names are allowed (business requirement)"""
        company_data = {"name": "Duplicate Test Company"}
        
        # Create first company
        response1 = client.post("/api/v1/companies/", json=company_data, headers=auth_headers)
        assert response1.status_code == 200
        
        # Create second company with same name (should succeed)
        response2 = client.post("/api/v1/companies/", json=company_data, headers=auth_headers)
        assert response2.status_code == 200
        
        # They should have different IDs
        assert response1.json()["id"] != response2.json()["id"]
    
    def test_get_companies(self, client, auth_headers):
        """Test retrieving all companies"""
        # Create a company first
        client.post(
            "/api/v1/companies/",
            json={"name": "Test Company 1"},
            headers=auth_headers
        )
        
        # Get all companies
        response = client.get("/api/v1/companies/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_get_company_by_id(self, client, auth_headers):
        """Test retrieving a specific company by ID"""
        # Create a company
        create_response = client.post(
            "/api/v1/companies/",
            json={"name": "Specific Test Company"},
            headers=auth_headers
        )
        company_id = create_response.json()["id"]
        
        # Get the company by ID
        response = client.get(f"/api/v1/companies/{company_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == company_id
        assert data["name"] == "Specific Test Company"
    
    def test_get_nonexistent_company(self, client, auth_headers):
        """Test retrieving a company that doesn't exist"""
        fake_id = str(uuid4())
        response = client.get(f"/api/v1/companies/{fake_id}", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_update_company(self, client, auth_headers):
        """Test updating a company"""
        # Create a company
        create_response = client.post(
            "/api/v1/companies/",
            json={"name": "Original Name"},
            headers=auth_headers
        )
        company_id = create_response.json()["id"]
        
        # Update the company
        update_data = {"name": "Updated Name"}
        response = client.put(
            f"/api/v1/companies/{company_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["id"] == company_id
    
    def test_delete_company_without_products(self, client, auth_headers):
        """Test deleting a company that has no products"""
        # Create a company
        create_response = client.post(
            "/api/v1/companies/",
            json={"name": "Company to Delete"},
            headers=auth_headers
        )
        company_id = create_response.json()["id"]
        
        # Delete the company
        response = client.delete(f"/api/v1/companies/{company_id}", headers=auth_headers)
        
        assert response.status_code == 200
        
        # Verify it's deleted
        get_response = client.get(f"/api/v1/companies/{company_id}", headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_delete_company_with_products(self, client, auth_headers):
        """Test that deleting a company with products fails"""
        # Create a company
        company_response = client.post(
            "/api/v1/companies/",
            json={"name": "Company with Products"},
            headers=auth_headers
        )
        company_id = company_response.json()["id"]
        
        # Create a product for this company
        client.post(
            "/api/v1/products/",
            json={
                "company_id": company_id,
                "name": "Test Product",
                "category": "Fertilizer",
                "unit": "Bags",
                "purchase_price": 100.0,
                "min_stock": 5
            },
            headers=auth_headers
        )
        
        # Try to delete the company (should fail)
        response = client.delete(f"/api/v1/companies/{company_id}", headers=auth_headers)
        
        assert response.status_code == 400
        assert "products" in response.json()["detail"].lower()
    
    def test_create_company_empty_name(self, client, auth_headers):
        """Test that creating a company with empty name fails"""
        response = client.post(
            "/api/v1/companies/",
            json={"name": ""},
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_unauthorized_access(self, client):
        """Test that endpoints require authentication"""
        response = client.get("/api/v1/companies/")
        assert response.status_code == 401
