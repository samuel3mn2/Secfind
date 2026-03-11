"""
Test file for Proveedores CRUD endpoints and dropdown integration
Tests the new Providers module added to the configuration section
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://secfind-board.preview.emergentagent.com')

class TestProveedoresAPI:
    """Tests for Provider CRUD endpoints and dropdown integration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get authentication token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    # === Proveedores CRUD Tests ===
    
    def test_get_proveedores_list(self):
        """GET /api/config/proveedores - Should return list of providers"""
        response = self.session.get(f"{BASE_URL}/api/config/proveedores")
        assert response.status_code == 200, f"Failed to get proveedores: {response.text}"
        
        proveedores = response.json()
        assert isinstance(proveedores, list), "Response should be a list"
        print(f"Found {len(proveedores)} proveedores")
        
        # Verify expected providers exist (F2TC, GBM, Pentraze, SISAP)
        nombres = [p["nombre"] for p in proveedores]
        expected_providers = ["F2TC", "GBM", "Pentraze", "SISAP"]
        for expected in expected_providers:
            assert expected in nombres, f"Expected provider '{expected}' not found in list"
        print(f"All expected providers found: {expected_providers}")
        
    def test_get_proveedores_structure(self):
        """Verify provider objects have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/config/proveedores")
        assert response.status_code == 200
        
        proveedores = response.json()
        if len(proveedores) > 0:
            prov = proveedores[0]
            assert "id" in prov, "Provider should have 'id' field"
            assert "nombre" in prov, "Provider should have 'nombre' field"
            assert "activo" in prov, "Provider should have 'activo' field"
            assert "created_at" in prov, "Provider should have 'created_at' field"
            print(f"Provider structure valid: {list(prov.keys())}")
    
    def test_create_proveedor(self):
        """POST /api/config/proveedores - Should create new provider"""
        test_name = "TEST_NuevoProveedor"
        
        response = self.session.post(
            f"{BASE_URL}/api/config/proveedores",
            json={"nombre": test_name}
        )
        assert response.status_code == 200, f"Failed to create proveedor: {response.text}"
        
        created = response.json()
        assert created["nombre"] == test_name, "Created provider name mismatch"
        assert created["activo"] == True, "New provider should be active by default"
        assert "id" in created, "Created provider should have an id"
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/config/proveedores")
        nombres = [p["nombre"] for p in get_response.json()]
        assert test_name in nombres, "Created provider not found in list"
        print(f"Provider '{test_name}' created successfully with id: {created['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/config/proveedores/{created['id']}")
        
    def test_create_duplicate_proveedor_fails(self):
        """POST /api/config/proveedores - Should fail for duplicate name"""
        # First create
        test_name = "TEST_DuplicateProveedor"
        response1 = self.session.post(
            f"{BASE_URL}/api/config/proveedores",
            json={"nombre": test_name}
        )
        assert response1.status_code == 200
        created_id = response1.json()["id"]
        
        # Try duplicate
        response2 = self.session.post(
            f"{BASE_URL}/api/config/proveedores",
            json={"nombre": test_name}
        )
        assert response2.status_code == 400, f"Duplicate should fail: {response2.status_code}"
        assert "ya existe" in response2.json().get("detail", "").lower()
        print("Duplicate provider creation correctly rejected")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/config/proveedores/{created_id}")
        
    def test_update_proveedor(self):
        """PUT /api/config/proveedores/{id} - Should update provider"""
        # Create test provider
        test_name = "TEST_UpdateProveedor"
        create_response = self.session.post(
            f"{BASE_URL}/api/config/proveedores",
            json={"nombre": test_name}
        )
        prov_id = create_response.json()["id"]
        
        # Update name
        new_name = "TEST_UpdatedProveedor"
        update_response = self.session.put(
            f"{BASE_URL}/api/config/proveedores/{prov_id}",
            json={"nombre": new_name}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["nombre"] == new_name, "Provider name not updated"
        print(f"Provider updated: {test_name} -> {new_name}")
        
        # Verify persistence
        get_response = self.session.get(f"{BASE_URL}/api/config/proveedores")
        nombres = [p["nombre"] for p in get_response.json()]
        assert new_name in nombres, "Updated name not found in list"
        assert test_name not in nombres, "Old name still exists in list"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/config/proveedores/{prov_id}")
        
    def test_update_proveedor_activo_status(self):
        """PUT /api/config/proveedores/{id} - Should toggle active status"""
        # Create test provider
        test_name = "TEST_StatusProveedor"
        create_response = self.session.post(
            f"{BASE_URL}/api/config/proveedores",
            json={"nombre": test_name}
        )
        prov_id = create_response.json()["id"]
        
        # Set to inactive
        update_response = self.session.put(
            f"{BASE_URL}/api/config/proveedores/{prov_id}",
            json={"activo": False}
        )
        assert update_response.status_code == 200
        assert update_response.json()["activo"] == False
        print("Provider set to inactive")
        
        # Verify inactive provider NOT in dropdown options (only active shown)
        options_response = self.session.get(f"{BASE_URL}/api/dropdown-options")
        assert options_response.status_code == 200
        proveedores_dropdown = options_response.json()["proveedores"]
        assert test_name not in proveedores_dropdown, "Inactive provider should not appear in dropdown"
        print("Inactive provider correctly excluded from dropdown")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/config/proveedores/{prov_id}")
        
    def test_delete_proveedor(self):
        """DELETE /api/config/proveedores/{id} - Should delete provider"""
        # Create test provider
        test_name = "TEST_DeleteProveedor"
        create_response = self.session.post(
            f"{BASE_URL}/api/config/proveedores",
            json={"nombre": test_name}
        )
        prov_id = create_response.json()["id"]
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/config/proveedores/{prov_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        assert "eliminado" in delete_response.json().get("message", "").lower()
        print(f"Provider '{test_name}' deleted successfully")
        
        # Verify removal
        get_response = self.session.get(f"{BASE_URL}/api/config/proveedores")
        nombres = [p["nombre"] for p in get_response.json()]
        assert test_name not in nombres, "Deleted provider still exists"
        
    def test_delete_nonexistent_proveedor(self):
        """DELETE /api/config/proveedores/{id} - Should return 404 for non-existent"""
        fake_id = "nonexistent-id-12345"
        response = self.session.delete(f"{BASE_URL}/api/config/proveedores/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent provider delete correctly returns 404")
        
    def test_update_nonexistent_proveedor(self):
        """PUT /api/config/proveedores/{id} - Should return 404 for non-existent"""
        fake_id = "nonexistent-id-12345"
        response = self.session.put(
            f"{BASE_URL}/api/config/proveedores/{fake_id}",
            json={"nombre": "Updated"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent provider update correctly returns 404")


class TestDropdownOptionsWithProveedores:
    """Tests for /api/dropdown-options endpoint with providers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # No auth needed for dropdown-options
        
    def test_dropdown_options_includes_proveedores(self):
        """GET /api/dropdown-options - Should include proveedores field"""
        response = self.session.get(f"{BASE_URL}/api/dropdown-options")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "proveedores" in data, "Response should include 'proveedores' field"
        
        proveedores = data["proveedores"]
        assert isinstance(proveedores, list), "proveedores should be a list"
        print(f"Dropdown options includes {len(proveedores)} proveedores: {proveedores}")
        
    def test_dropdown_options_proveedores_from_catalog(self):
        """Dropdown proveedores should come from catalog, not vulnerabilities"""
        response = self.session.get(f"{BASE_URL}/api/dropdown-options")
        assert response.status_code == 200
        
        proveedores = response.json()["proveedores"]
        
        # Expected catalog providers (active only)
        expected = ["F2TC", "GBM", "Pentraze", "SISAP"]
        for p in expected:
            assert p in proveedores, f"Catalog provider '{p}' missing from dropdown"
        print(f"All catalog providers present in dropdown: {proveedores}")
        
    def test_dropdown_options_all_fields_present(self):
        """Verify all required dropdown fields are present"""
        response = self.session.get(f"{BASE_URL}/api/dropdown-options")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["severidades", "estatus", "instituciones", "aplicaciones", 
                          "resultado_retest", "informes_pentest", "años", "proveedores"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        print(f"All required fields present: {required_fields}")


class TestVulnerabilidadesProveedorFilter:
    """Tests for vulnerabilities filtering by proveedor"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        token = login_response.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_filter_vulnerabilidades_by_proveedor(self):
        """GET /api/vulnerabilidades?proveedor=X - Should filter by provider"""
        response = self.session.get(f"{BASE_URL}/api/vulnerabilidades?proveedor=F2TC")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        vulns = response.json()
        print(f"Found {len(vulns)} vulnerabilities from F2TC")
        
        # All results should have the filtered provider
        for v in vulns:
            assert v.get("proveedor") == "F2TC", f"Vuln has wrong provider: {v.get('proveedor')}"
            
    def test_filter_vulnerabilidades_by_year(self):
        """GET /api/vulnerabilidades?año=2024 - Should filter by year"""
        response = self.session.get(f"{BASE_URL}/api/vulnerabilidades?año=2024")
        assert response.status_code == 200
        
        vulns = response.json()
        print(f"Found {len(vulns)} vulnerabilities from 2024")
        
        for v in vulns:
            fecha = v.get("fecha_hallazgo", "")
            assert fecha.startswith("2024"), f"Vuln has wrong year: {fecha}"


class TestVulnerabilidadesProveedorField:
    """Tests for proveedor field in vulnerability CRUD"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        token = login_response.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_create_vulnerability_with_proveedor(self):
        """POST /api/vulnerabilidades - Should accept proveedor from dropdown"""
        test_vuln = {
            "fecha_hallazgo": "2026-01-10",
            "institucion": "BAC",
            "aplicaciones": ["App1"],
            "vulnerabilidad": "TEST_Vulnerabilidad con proveedor dropdown",
            "severidad": "Media",
            "estatus": "Pendiente",
            "proveedor": "F2TC"
        }
        
        response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=test_vuln)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        created = response.json()
        assert created["proveedor"] == "F2TC", "Proveedor not saved correctly"
        vuln_id = created["id"]
        print(f"Created vulnerability with proveedor F2TC, id: {vuln_id}")
        
        # Verify persistence
        get_response = self.session.get(f"{BASE_URL}/api/vulnerabilidades/{vuln_id}")
        assert get_response.status_code == 200
        assert get_response.json()["proveedor"] == "F2TC"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vulnerabilidades/{vuln_id}")
        
    def test_update_vulnerability_proveedor(self):
        """PUT /api/vulnerabilidades/{id} - Should update proveedor field"""
        # Create test vulnerability
        test_vuln = {
            "vulnerabilidad": "TEST_Update proveedor",
            "severidad": "Alta",
            "estatus": "Pendiente",
            "proveedor": "GBM"
        }
        create_response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=test_vuln)
        vuln_id = create_response.json()["id"]
        
        # Update proveedor
        update_response = self.session.put(
            f"{BASE_URL}/api/vulnerabilidades/{vuln_id}",
            json={"proveedor": "Pentraze"}
        )
        assert update_response.status_code == 200
        assert update_response.json()["proveedor"] == "Pentraze"
        print("Vulnerability proveedor updated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vulnerabilidades/{vuln_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
