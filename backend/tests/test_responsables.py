"""
Test suite for Responsables CRUD endpoints
Tests the new Responsables catalog feature for vulnerability management
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestResponsablesEndpoints:
    """Test CRUD operations for Responsables catalog"""
    
    created_responsable_id = None
    
    def test_get_responsables_requires_auth(self):
        """GET /api/config/responsables should require authentication"""
        response = requests.get(f"{BASE_URL}/api/config/responsables")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/config/responsables requires authentication")
    
    def test_get_responsables_list(self, auth_headers):
        """GET /api/config/responsables should return list of responsables"""
        response = requests.get(f"{BASE_URL}/api/config/responsables", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/config/responsables returns list ({len(data)} items)")
    
    def test_create_responsable_requires_auth(self):
        """POST /api/config/responsables should require authentication"""
        response = requests.post(f"{BASE_URL}/api/config/responsables", json={
            "nombre": "Test User",
            "email": "test@example.com"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/config/responsables requires authentication")
    
    def test_create_responsable_success(self, auth_headers):
        """POST /api/config/responsables should create a new responsable"""
        unique_name = f"TEST_Responsable_{uuid.uuid4().hex[:8]}"
        payload = {
            "nombre": unique_name,
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/config/responsables", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["nombre"] == payload["nombre"], "Name should match"
        assert data["email"] == payload["email"], "Email should match"
        assert data["activo"] == True, "Should be active by default"
        
        # Store for later tests
        TestResponsablesEndpoints.created_responsable_id = data["id"]
        print(f"✓ POST /api/config/responsables creates responsable: {data['nombre']}")
    
    def test_create_responsable_without_email(self, auth_headers):
        """POST /api/config/responsables should allow creating without email"""
        unique_name = f"TEST_NoEmail_{uuid.uuid4().hex[:8]}"
        payload = {"nombre": unique_name}
        response = requests.post(f"{BASE_URL}/api/config/responsables", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["nombre"] == unique_name
        assert data.get("email") is None or data.get("email") == ""
        print(f"✓ POST /api/config/responsables allows creation without email")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/config/responsables/{data['id']}", headers=auth_headers)
    
    def test_create_responsable_duplicate_name(self, auth_headers):
        """POST /api/config/responsables should reject duplicate names"""
        if not TestResponsablesEndpoints.created_responsable_id:
            pytest.skip("No responsable created in previous test")
        
        # Get the created responsable's name
        response = requests.get(f"{BASE_URL}/api/config/responsables", headers=auth_headers)
        responsables = response.json()
        created = next((r for r in responsables if r["id"] == TestResponsablesEndpoints.created_responsable_id), None)
        
        if created:
            # Try to create with same name
            response = requests.post(f"{BASE_URL}/api/config/responsables", json={
                "nombre": created["nombre"],
                "email": "different@example.com"
            }, headers=auth_headers)
            assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
            print("✓ POST /api/config/responsables rejects duplicate names")
    
    def test_update_responsable_requires_auth(self):
        """PUT /api/config/responsables/{id} should require authentication"""
        response = requests.put(f"{BASE_URL}/api/config/responsables/fake-id", json={
            "nombre": "Updated Name"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ PUT /api/config/responsables requires authentication")
    
    def test_update_responsable_success(self, auth_headers):
        """PUT /api/config/responsables/{id} should update responsable"""
        if not TestResponsablesEndpoints.created_responsable_id:
            pytest.skip("No responsable created in previous test")
        
        responsable_id = TestResponsablesEndpoints.created_responsable_id
        new_email = f"updated_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.put(
            f"{BASE_URL}/api/config/responsables/{responsable_id}",
            json={"email": new_email},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == new_email, "Email should be updated"
        print(f"✓ PUT /api/config/responsables/{responsable_id} updates email")
    
    def test_update_responsable_not_found(self, auth_headers):
        """PUT /api/config/responsables/{id} should return 404 for non-existent"""
        response = requests.put(
            f"{BASE_URL}/api/config/responsables/non-existent-id",
            json={"nombre": "Test"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT /api/config/responsables returns 404 for non-existent")
    
    def test_delete_responsable_requires_auth(self):
        """DELETE /api/config/responsables/{id} should require authentication"""
        response = requests.delete(f"{BASE_URL}/api/config/responsables/fake-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ DELETE /api/config/responsables requires authentication")
    
    def test_delete_responsable_not_found(self, auth_headers):
        """DELETE /api/config/responsables/{id} should return 404 for non-existent"""
        response = requests.delete(
            f"{BASE_URL}/api/config/responsables/non-existent-id",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE /api/config/responsables returns 404 for non-existent")
    
    def test_delete_responsable_success(self, auth_headers):
        """DELETE /api/config/responsables/{id} should delete responsable"""
        if not TestResponsablesEndpoints.created_responsable_id:
            pytest.skip("No responsable created in previous test")
        
        responsable_id = TestResponsablesEndpoints.created_responsable_id
        response = requests.delete(
            f"{BASE_URL}/api/config/responsables/{responsable_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/config/responsables", headers=auth_headers)
        responsables = get_response.json()
        assert not any(r["id"] == responsable_id for r in responsables), "Responsable should be deleted"
        print(f"✓ DELETE /api/config/responsables/{responsable_id} deletes successfully")


class TestDropdownOptionsResponsables:
    """Test that dropdown-options includes responsables"""
    
    def test_dropdown_options_includes_responsables(self, auth_headers):
        """GET /api/dropdown-options should include responsables list"""
        response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "responsables" in data, "Response should include 'responsables' field"
        assert isinstance(data["responsables"], list), "responsables should be a list"
        
        # Each responsable should have nombre and email
        for resp in data["responsables"]:
            assert "nombre" in resp, "Each responsable should have 'nombre'"
            assert "email" in resp, "Each responsable should have 'email'"
        
        print(f"✓ GET /api/dropdown-options includes responsables ({len(data['responsables'])} items)")


class TestResponsableCascadeUpdate:
    """Test that updating responsable name cascades to vulnerabilities"""
    
    def test_cascade_update_on_name_change(self, auth_headers):
        """PUT /api/config/responsables should cascade name change to vulnerabilities"""
        # Create a responsable
        unique_name = f"TEST_Cascade_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/config/responsables", json={
            "nombre": unique_name,
            "email": "cascade@test.com"
        }, headers=auth_headers)
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create responsable: {create_resp.text}")
        
        responsable_id = create_resp.json()["id"]
        
        # Create a vulnerability with this responsable
        vuln_resp = requests.post(f"{BASE_URL}/api/vulnerabilidades", json={
            "vulnerabilidad": f"TEST_Vuln_Cascade_{uuid.uuid4().hex[:8]}",
            "responsable": unique_name,
            "severidad": "Media",
            "estatus": "Pendiente"
        }, headers=auth_headers)
        
        if vuln_resp.status_code != 200:
            # Cleanup responsable
            requests.delete(f"{BASE_URL}/api/config/responsables/{responsable_id}", headers=auth_headers)
            pytest.skip(f"Could not create vulnerability: {vuln_resp.text}")
        
        vuln_id = vuln_resp.json()["id"]
        
        # Update responsable name
        new_name = f"TEST_Cascade_Updated_{uuid.uuid4().hex[:8]}"
        update_resp = requests.put(
            f"{BASE_URL}/api/config/responsables/{responsable_id}",
            json={"nombre": new_name},
            headers=auth_headers
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        # Check vulnerability was updated
        get_vuln = requests.get(f"{BASE_URL}/api/vulnerabilidades/{vuln_id}", headers=auth_headers)
        assert get_vuln.status_code == 200
        vuln_data = get_vuln.json()
        assert vuln_data["responsable"] == new_name, f"Expected '{new_name}', got '{vuln_data['responsable']}'"
        
        print("✓ Cascade update: responsable name change propagates to vulnerabilities")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vulnerabilidades/{vuln_id}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/config/responsables/{responsable_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
