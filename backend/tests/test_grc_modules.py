"""
Test GRC Modules: Dominios, Controles, Catálogo de Riesgos, Hallazgos de Auditoría
Tests for Iteration 13 features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = "admin"
TEST_PASSWORD = "admin123"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "usuario" in data
        assert data["usuario"]["es_admin"] == True


class TestDominios:
    """Tests for Dominios CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_dominios_requires_auth(self):
        """Test that GET /api/config/dominios requires authentication"""
        response = requests.get(f"{BASE_URL}/api/config/dominios")
        assert response.status_code == 401
    
    def test_get_dominios_success(self, auth_headers):
        """Test GET /api/config/dominios returns list"""
        response = requests.get(f"{BASE_URL}/api/config/dominios", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_dominio_success(self, auth_headers):
        """Test POST /api/config/dominios creates a new dominio"""
        payload = {
            "nombre_dominio": "TEST_Dominio_Seguridad_Endpoints",
            "codigo_referencia": "TEST-DOM-EP"
        }
        response = requests.post(f"{BASE_URL}/api/config/dominios", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["nombre_dominio"] == payload["nombre_dominio"]
        assert data["codigo_referencia"] == payload["codigo_referencia"]
        
        # Store ID for cleanup
        TestDominios.created_dominio_id = data["id"]
    
    def test_get_dominio_by_id(self, auth_headers):
        """Test GET /api/config/dominios/{id} returns the dominio"""
        dominio_id = getattr(TestDominios, 'created_dominio_id', None)
        if not dominio_id:
            pytest.skip("No dominio created")
        
        response = requests.get(f"{BASE_URL}/api/config/dominios/{dominio_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == dominio_id
        assert data["nombre_dominio"] == "TEST_Dominio_Seguridad_Endpoints"
    
    def test_update_dominio_success(self, auth_headers):
        """Test PUT /api/config/dominios/{id} updates the dominio"""
        dominio_id = getattr(TestDominios, 'created_dominio_id', None)
        if not dominio_id:
            pytest.skip("No dominio created")
        
        payload = {
            "nombre_dominio": "TEST_Dominio_Seguridad_Endpoints_Updated",
            "codigo_referencia": "TEST-DOM-EP-UPD"
        }
        response = requests.put(f"{BASE_URL}/api/config/dominios/{dominio_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["nombre_dominio"] == payload["nombre_dominio"]
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/config/dominios/{dominio_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["nombre_dominio"] == payload["nombre_dominio"]
    
    def test_delete_dominio_success(self, auth_headers):
        """Test DELETE /api/config/dominios/{id} deletes the dominio"""
        dominio_id = getattr(TestDominios, 'created_dominio_id', None)
        if not dominio_id:
            pytest.skip("No dominio created")
        
        response = requests.delete(f"{BASE_URL}/api/config/dominios/{dominio_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deletion with GET
        get_response = requests.get(f"{BASE_URL}/api/config/dominios/{dominio_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestControles:
    """Tests for Controles CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_dominio(self, auth_headers):
        """Create a test dominio for control tests"""
        payload = {
            "nombre_dominio": "TEST_Dominio_Para_Controles",
            "codigo_referencia": "TEST-DOM-CTRL"
        }
        response = requests.post(f"{BASE_URL}/api/config/dominios", json=payload, headers=auth_headers)
        assert response.status_code == 200
        dominio = response.json()
        yield dominio
        # Cleanup
        requests.delete(f"{BASE_URL}/api/config/dominios/{dominio['id']}", headers=auth_headers)
    
    def test_get_controles_requires_auth(self):
        """Test that GET /api/config/controles requires authentication"""
        response = requests.get(f"{BASE_URL}/api/config/controles")
        assert response.status_code == 401
    
    def test_get_controles_success(self, auth_headers):
        """Test GET /api/config/controles returns list"""
        response = requests.get(f"{BASE_URL}/api/config/controles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_control_success(self, auth_headers, test_dominio):
        """Test POST /api/config/controles creates a new control"""
        payload = {
            "dominio_id": test_dominio["id"],
            "codigo_control": "TEST-CTRL-001",
            "nombre_control": "TEST_Control_Proteccion_Endpoint"
        }
        response = requests.post(f"{BASE_URL}/api/config/controles", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["nombre_control"] == payload["nombre_control"]
        assert data["dominio_id"] == test_dominio["id"]
        
        # Store ID for cleanup
        TestControles.created_control_id = data["id"]
    
    def test_get_controles_filtered_by_dominio(self, auth_headers, test_dominio):
        """Test GET /api/config/controles?dominio_id={id} filters by dominio"""
        response = requests.get(
            f"{BASE_URL}/api/config/controles?dominio_id={test_dominio['id']}", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned controls should belong to the test dominio
        for control in data:
            assert control["dominio_id"] == test_dominio["id"]
    
    def test_update_control_success(self, auth_headers, test_dominio):
        """Test PUT /api/config/controles/{id} updates the control"""
        control_id = getattr(TestControles, 'created_control_id', None)
        if not control_id:
            pytest.skip("No control created")
        
        payload = {
            "nombre_control": "TEST_Control_Proteccion_Endpoint_Updated",
            "codigo_control": "TEST-CTRL-001-UPD"
        }
        response = requests.put(f"{BASE_URL}/api/config/controles/{control_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["nombre_control"] == payload["nombre_control"]
    
    def test_delete_control_success(self, auth_headers):
        """Test DELETE /api/config/controles/{id} deletes the control"""
        control_id = getattr(TestControles, 'created_control_id', None)
        if not control_id:
            pytest.skip("No control created")
        
        response = requests.delete(f"{BASE_URL}/api/config/controles/{control_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/config/controles/{control_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestCatalogoRiesgos:
    """Tests for Catálogo de Riesgos CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_riesgos_requires_auth(self):
        """Test that GET /api/catalogo-riesgos requires authentication"""
        response = requests.get(f"{BASE_URL}/api/catalogo-riesgos")
        assert response.status_code == 401
    
    def test_get_riesgos_success(self, auth_headers):
        """Test GET /api/catalogo-riesgos returns paginated list"""
        response = requests.get(f"{BASE_URL}/api/catalogo-riesgos", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    def test_get_all_riesgos_success(self, auth_headers):
        """Test GET /api/catalogo-riesgos/all returns all riesgos"""
        response = requests.get(f"{BASE_URL}/api/catalogo-riesgos/all", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_riesgo_success(self, auth_headers):
        """Test POST /api/catalogo-riesgos creates a new riesgo"""
        payload = {
            "codigo_riesgo": "TEST-R-001",
            "nombre_corto": "TEST_Acceso_No_Autorizado",
            "descripcion_completa": "Riesgo de acceso no autorizado a sistemas críticos"
        }
        response = requests.post(f"{BASE_URL}/api/catalogo-riesgos", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["codigo_riesgo"] == payload["codigo_riesgo"]
        assert data["nombre_corto"] == payload["nombre_corto"]
        
        # Store ID for cleanup
        TestCatalogoRiesgos.created_riesgo_id = data["id"]
    
    def test_search_riesgos(self, auth_headers):
        """Test GET /api/catalogo-riesgos?search={term} filters results"""
        response = requests.get(
            f"{BASE_URL}/api/catalogo-riesgos?search=TEST_Acceso", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        # Should find our test riesgo
        if data["total"] > 0:
            found = any("TEST_Acceso" in r.get("nombre_corto", "") for r in data["items"])
            assert found, "Search should find the test riesgo"
    
    def test_update_riesgo_success(self, auth_headers):
        """Test PUT /api/catalogo-riesgos/{id} updates the riesgo"""
        riesgo_id = getattr(TestCatalogoRiesgos, 'created_riesgo_id', None)
        if not riesgo_id:
            pytest.skip("No riesgo created")
        
        payload = {
            "nombre_corto": "TEST_Acceso_No_Autorizado_Updated",
            "descripcion_completa": "Descripción actualizada del riesgo"
        }
        response = requests.put(f"{BASE_URL}/api/catalogo-riesgos/{riesgo_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["nombre_corto"] == payload["nombre_corto"]
    
    def test_delete_riesgo_success(self, auth_headers):
        """Test DELETE /api/catalogo-riesgos/{id} deletes the riesgo"""
        riesgo_id = getattr(TestCatalogoRiesgos, 'created_riesgo_id', None)
        if not riesgo_id:
            pytest.skip("No riesgo created")
        
        response = requests.delete(f"{BASE_URL}/api/catalogo-riesgos/{riesgo_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/catalogo-riesgos/{riesgo_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestHallazgosAuditoria:
    """Tests for Hallazgos de Auditoría CRUD endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_dominio_and_control(self, auth_headers):
        """Create test dominio and control for hallazgo tests"""
        # Create dominio
        dominio_payload = {
            "nombre_dominio": "TEST_Dominio_Para_Hallazgos",
            "codigo_referencia": "TEST-DOM-HAL"
        }
        dom_response = requests.post(f"{BASE_URL}/api/config/dominios", json=dominio_payload, headers=auth_headers)
        dominio = dom_response.json()
        
        # Create control
        control_payload = {
            "dominio_id": dominio["id"],
            "codigo_control": "TEST-CTRL-HAL-001",
            "nombre_control": "TEST_Control_Para_Hallazgos"
        }
        ctrl_response = requests.post(f"{BASE_URL}/api/config/controles", json=control_payload, headers=auth_headers)
        control = ctrl_response.json()
        
        yield {"dominio": dominio, "control": control}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/config/controles/{control['id']}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/config/dominios/{dominio['id']}", headers=auth_headers)
    
    @pytest.fixture(scope="class")
    def test_riesgo(self, auth_headers):
        """Create test riesgo for hallazgo tests"""
        payload = {
            "codigo_riesgo": "TEST-R-HAL-001",
            "nombre_corto": "TEST_Riesgo_Para_Hallazgos",
            "descripcion_completa": "Riesgo de prueba para hallazgos"
        }
        response = requests.post(f"{BASE_URL}/api/catalogo-riesgos", json=payload, headers=auth_headers)
        riesgo = response.json()
        yield riesgo
        # Cleanup
        requests.delete(f"{BASE_URL}/api/catalogo-riesgos/{riesgo['id']}", headers=auth_headers)
    
    def test_get_hallazgos_requires_auth(self):
        """Test that GET /api/hallazgos-auditoria requires authentication"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria")
        assert response.status_code == 401
    
    def test_get_hallazgos_success(self, auth_headers):
        """Test GET /api/hallazgos-auditoria returns paginated list"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    def test_get_hallazgos_stats(self, auth_headers):
        """Test GET /api/hallazgos-auditoria/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "por_estado" in data
        assert "alto_riesgo_pendientes" in data
    
    def test_get_next_codigo(self, auth_headers):
        """Test GET /api/hallazgos-auditoria/next-codigo returns next code"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/next-codigo", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "next_codigo" in data
        assert data["next_codigo"].startswith("AUD-")
    
    def test_create_hallazgo_success(self, auth_headers, test_dominio_and_control, test_riesgo):
        """Test POST /api/hallazgos-auditoria creates a new hallazgo"""
        payload = {
            "codigo": "TEST-AUD-2026-001",
            "control_id": test_dominio_and_control["control"]["id"],
            "brecha": "TEST_Brecha de seguridad en autenticación",
            "riesgo_id": test_riesgo["id"],
            "probabilidad": 4,
            "impacto": 5,
            "estado": "Abierto",
            "observaciones": "Hallazgo de prueba"
        }
        response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["codigo"] == payload["codigo"]
        assert data["brecha"] == payload["brecha"]
        # Verify riesgo_inherente calculation (4 * 5 = 20)
        assert data["riesgo_inherente"] == 20
        
        # Store ID for cleanup
        TestHallazgosAuditoria.created_hallazgo_id = data["id"]
    
    def test_get_hallazgo_by_id(self, auth_headers):
        """Test GET /api/hallazgos-auditoria/{id} returns the hallazgo"""
        hallazgo_id = getattr(TestHallazgosAuditoria, 'created_hallazgo_id', None)
        if not hallazgo_id:
            pytest.skip("No hallazgo created")
        
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == hallazgo_id
        assert data["codigo"] == "TEST-AUD-2026-001"
    
    def test_update_hallazgo_success(self, auth_headers):
        """Test PUT /api/hallazgos-auditoria/{id} updates the hallazgo"""
        hallazgo_id = getattr(TestHallazgosAuditoria, 'created_hallazgo_id', None)
        if not hallazgo_id:
            pytest.skip("No hallazgo created")
        
        payload = {
            "brecha": "TEST_Brecha de seguridad actualizada",
            "probabilidad": 3,
            "impacto": 4,
            "estado": "En Proceso"
        }
        response = requests.put(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["brecha"] == payload["brecha"]
        assert data["estado"] == payload["estado"]
        # Verify riesgo_inherente recalculation (3 * 4 = 12)
        assert data["riesgo_inherente"] == 12
    
    def test_filter_hallazgos_by_estado(self, auth_headers):
        """Test GET /api/hallazgos-auditoria?estado={estado} filters by estado"""
        response = requests.get(
            f"{BASE_URL}/api/hallazgos-auditoria?estado=En Proceso", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        # All returned hallazgos should have estado "En Proceso"
        for hallazgo in data["items"]:
            assert hallazgo["estado"] == "En Proceso"
    
    def test_delete_hallazgo_success(self, auth_headers):
        """Test DELETE /api/hallazgos-auditoria/{id} deletes the hallazgo"""
        hallazgo_id = getattr(TestHallazgosAuditoria, 'created_hallazgo_id', None)
        if not hallazgo_id:
            pytest.skip("No hallazgo created")
        
        response = requests.delete(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestRiesgoInherenteCalculation:
    """Tests for reactive Riesgo Inherente calculation"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USER,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_riesgo_inherente_on_create(self, auth_headers):
        """Test that riesgo_inherente is calculated on create"""
        payload = {
            "codigo": "TEST-AUD-CALC-001",
            "brecha": "TEST_Brecha para cálculo",
            "probabilidad": 2,
            "impacto": 3,
            "estado": "Abierto"
        }
        response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # 2 * 3 = 6
        assert data["riesgo_inherente"] == 6
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/hallazgos-auditoria/{data['id']}", headers=auth_headers)
    
    def test_riesgo_inherente_on_update(self, auth_headers):
        """Test that riesgo_inherente is recalculated on update"""
        # Create
        create_payload = {
            "codigo": "TEST-AUD-CALC-002",
            "brecha": "TEST_Brecha para actualización",
            "probabilidad": 1,
            "impacto": 1,
            "estado": "Abierto"
        }
        create_response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=create_payload, headers=auth_headers)
        assert create_response.status_code == 200
        hallazgo_id = create_response.json()["id"]
        assert create_response.json()["riesgo_inherente"] == 1  # 1 * 1 = 1
        
        # Update probabilidad and impacto
        update_payload = {
            "probabilidad": 5,
            "impacto": 5
        }
        update_response = requests.put(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", json=update_payload, headers=auth_headers)
        assert update_response.status_code == 200
        # 5 * 5 = 25
        assert update_response.json()["riesgo_inherente"] == 25
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
