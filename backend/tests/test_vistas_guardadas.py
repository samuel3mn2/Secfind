"""
Test suite for Vistas Guardadas (Saved Views) feature in Vista Comité
Tests CRUD operations for /api/vistas-guardadas endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = "admin"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": TEST_USER,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestVistasGuardadasAuth:
    """Test authentication requirements for vistas-guardadas endpoints"""
    
    def test_get_vistas_requires_auth(self):
        """GET /api/vistas-guardadas requires authentication"""
        response = requests.get(f"{BASE_URL}/api/vistas-guardadas")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/vistas-guardadas requires authentication (401)")
    
    def test_post_vistas_requires_auth(self):
        """POST /api/vistas-guardadas requires authentication"""
        response = requests.post(f"{BASE_URL}/api/vistas-guardadas", json={
            "nombre": "Test Vista",
            "severidades": ["Critica", "Alta"]
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/vistas-guardadas requires authentication (401)")
    
    def test_delete_vistas_requires_auth(self):
        """DELETE /api/vistas-guardadas/{id} requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/vistas-guardadas/fake-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ DELETE /api/vistas-guardadas/{id} requires authentication (401)")


class TestVistasGuardadasCRUD:
    """Test CRUD operations for vistas-guardadas"""
    
    def test_get_vistas_guardadas_list(self, auth_headers):
        """GET /api/vistas-guardadas returns list of saved views"""
        response = requests.get(f"{BASE_URL}/api/vistas-guardadas", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/vistas-guardadas returns list ({len(data)} views)")
    
    def test_create_vista_guardada_individual_mode(self, auth_headers):
        """POST /api/vistas-guardadas creates view in individual mode"""
        vista_data = {
            "nombre": "TEST_Vista Individual Test",
            "descripcion": "Vista de prueba en modo individual",
            "agrupar_por_grupo": False,
            "grupos_ids": [],
            "informes_adicionales": [],
            "informes_individuales": ["Informe Test 1", "Informe Test 2"],
            "severidades": ["Critica", "Alta", "Media"]
        }
        
        response = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["nombre"] == vista_data["nombre"], "Name should match"
        assert data["agrupar_por_grupo"] == False, "agrupar_por_grupo should be False"
        assert data["severidades"] == vista_data["severidades"], "Severidades should match"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vistas-guardadas/{data['id']}", headers=auth_headers)
        print("✓ POST /api/vistas-guardadas creates view in individual mode")
    
    def test_create_vista_guardada_group_mode(self, auth_headers):
        """POST /api/vistas-guardadas creates view in group mode"""
        # First get existing grupos
        grupos_response = requests.get(f"{BASE_URL}/api/config/grupos-informes", headers=auth_headers)
        grupos = grupos_response.json() if grupos_response.status_code == 200 else []
        grupo_ids = [g["id"] for g in grupos[:2]] if grupos else []
        
        vista_data = {
            "nombre": "TEST_Vista Grupo Test",
            "descripcion": "Vista de prueba en modo grupo",
            "agrupar_por_grupo": True,
            "grupos_ids": grupo_ids,
            "informes_adicionales": ["Informe Adicional 1"],
            "informes_individuales": [],
            "severidades": ["Critica", "Alta"]
        }
        
        response = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["agrupar_por_grupo"] == True, "agrupar_por_grupo should be True"
        assert data["grupos_ids"] == grupo_ids, "grupos_ids should match"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vistas-guardadas/{data['id']}", headers=auth_headers)
        print("✓ POST /api/vistas-guardadas creates view in group mode")
    
    def test_create_vista_duplicate_name_rejected(self, auth_headers):
        """POST /api/vistas-guardadas rejects duplicate names"""
        vista_data = {
            "nombre": "TEST_Vista Duplicada",
            "severidades": ["Critica"]
        }
        
        # Create first view
        response1 = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert response1.status_code == 200, f"First create failed: {response1.text}"
        created_id = response1.json()["id"]
        
        # Try to create duplicate
        response2 = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vistas-guardadas/{created_id}", headers=auth_headers)
        print("✓ POST /api/vistas-guardadas rejects duplicate names (400)")
    
    def test_update_vista_guardada(self, auth_headers):
        """PUT /api/vistas-guardadas/{id} updates view"""
        # Create a view first
        vista_data = {
            "nombre": "TEST_Vista Para Actualizar",
            "severidades": ["Critica", "Alta"]
        }
        create_response = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert create_response.status_code == 200
        vista_id = create_response.json()["id"]
        
        # Update the view
        update_data = {
            "nombre": "TEST_Vista Actualizada",
            "severidades": ["Critica", "Alta", "Media", "Baja"]
        }
        update_response = requests.put(f"{BASE_URL}/api/vistas-guardadas/{vista_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        updated = update_response.json()
        assert updated["nombre"] == update_data["nombre"], "Name should be updated"
        assert updated["severidades"] == update_data["severidades"], "Severidades should be updated"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vistas-guardadas/{vista_id}", headers=auth_headers)
        print("✓ PUT /api/vistas-guardadas/{id} updates view successfully")
    
    def test_update_nonexistent_vista_returns_404(self, auth_headers):
        """PUT /api/vistas-guardadas/{id} returns 404 for non-existent view"""
        response = requests.put(
            f"{BASE_URL}/api/vistas-guardadas/nonexistent-id-12345",
            json={"nombre": "Test"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT /api/vistas-guardadas/{id} returns 404 for non-existent view")
    
    def test_delete_vista_guardada(self, auth_headers):
        """DELETE /api/vistas-guardadas/{id} deletes view"""
        # Create a view first
        vista_data = {
            "nombre": "TEST_Vista Para Eliminar",
            "severidades": ["Critica"]
        }
        create_response = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert create_response.status_code == 200
        vista_id = create_response.json()["id"]
        
        # Delete the view
        delete_response = requests.delete(f"{BASE_URL}/api/vistas-guardadas/{vista_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/vistas-guardadas", headers=auth_headers)
        vistas = get_response.json()
        assert not any(v["id"] == vista_id for v in vistas), "View should be deleted"
        print("✓ DELETE /api/vistas-guardadas/{id} deletes view successfully")
    
    def test_delete_nonexistent_vista_returns_404(self, auth_headers):
        """DELETE /api/vistas-guardadas/{id} returns 404 for non-existent view"""
        response = requests.delete(
            f"{BASE_URL}/api/vistas-guardadas/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE /api/vistas-guardadas/{id} returns 404 for non-existent view")


class TestVistasGuardadasDataStructure:
    """Test data structure of saved views"""
    
    def test_vista_contains_all_required_fields(self, auth_headers):
        """Saved view contains all required fields"""
        vista_data = {
            "nombre": "TEST_Vista Completa",
            "descripcion": "Descripción de prueba",
            "agrupar_por_grupo": True,
            "grupos_ids": ["grupo-1", "grupo-2"],
            "informes_adicionales": ["informe-1"],
            "informes_individuales": ["informe-2", "informe-3"],
            "severidades": ["Critica", "Alta", "Media", "Baja"]
        }
        
        response = requests.post(f"{BASE_URL}/api/vistas-guardadas", json=vista_data, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all required fields
        assert "id" in data, "Should have id"
        assert "nombre" in data, "Should have nombre"
        assert "descripcion" in data, "Should have descripcion"
        assert "agrupar_por_grupo" in data, "Should have agrupar_por_grupo"
        assert "grupos_ids" in data, "Should have grupos_ids"
        assert "informes_adicionales" in data, "Should have informes_adicionales"
        assert "informes_individuales" in data, "Should have informes_individuales"
        assert "severidades" in data, "Should have severidades"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vistas-guardadas/{data['id']}", headers=auth_headers)
        print("✓ Saved view contains all required fields")
    
    def test_existing_vista_comite_q4_2024(self, auth_headers):
        """Check if existing 'Comité Q4 2024' view exists (mentioned in context)"""
        response = requests.get(f"{BASE_URL}/api/vistas-guardadas", headers=auth_headers)
        assert response.status_code == 200
        
        vistas = response.json()
        comite_q4 = next((v for v in vistas if "Q4 2024" in v.get("nombre", "")), None)
        
        if comite_q4:
            print(f"✓ Found existing view: '{comite_q4['nombre']}'")
        else:
            print("ℹ No 'Comité Q4 2024' view found (may have been deleted)")


class TestHistorialAuditoria:
    """Test historial/auditoria endpoint"""
    
    def test_get_historial_requires_auth(self):
        """GET /api/historial requires authentication"""
        response = requests.get(f"{BASE_URL}/api/historial")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/historial requires authentication (401)")
    
    def test_get_historial_returns_data(self, auth_headers):
        """GET /api/historial returns audit history"""
        response = requests.get(f"{BASE_URL}/api/historial", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "historial" in data, "Response should have 'historial' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["historial"], list), "historial should be a list"
        print(f"✓ GET /api/historial returns audit history ({data['total']} records)")
    
    def test_historial_with_filters(self, auth_headers):
        """GET /api/historial supports filtering"""
        # Test with entidad filter
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=vulnerabilidad&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # If there are results, verify they match the filter
        for item in data["historial"]:
            assert item["entidad"] == "vulnerabilidad", "Filtered items should match entidad"
        
        print("✓ GET /api/historial supports filtering by entidad")
    
    def test_historial_pagination(self, auth_headers):
        """GET /api/historial supports pagination"""
        # Get first page
        response1 = requests.get(f"{BASE_URL}/api/historial?limit=5&skip=0", headers=auth_headers)
        assert response1.status_code == 200
        
        # Get second page
        response2 = requests.get(f"{BASE_URL}/api/historial?limit=5&skip=5", headers=auth_headers)
        assert response2.status_code == 200
        
        data1 = response1.json()
        data2 = response2.json()
        
        # If there are enough records, pages should be different
        if data1["total"] > 5:
            ids1 = [item["id"] for item in data1["historial"]]
            ids2 = [item["id"] for item in data2["historial"]]
            # Check that pages don't overlap
            assert not set(ids1).intersection(set(ids2)), "Pages should not overlap"
        
        print("✓ GET /api/historial supports pagination")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
