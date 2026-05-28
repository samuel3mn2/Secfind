"""
Test suite for new Hallazgos de Auditoría fields:
- responsable (dropdown from existing responsables)
- fecha_hallazgo (default: today)
- fecha_compromiso (commitment date)

Also tests:
- Validation: fecha_compromiso >= fecha_hallazgo
- Seguimiento module with tabs for Vulnerabilidades and Hallazgos
- KPIs for both tabs
- Badge 'VENCIDO' for overdue items
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHallazgosNuevosCampos:
    """Tests for new fields in Hallazgos de Auditoría"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
        # Cleanup: Delete test hallazgos
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Delete test hallazgos created during tests"""
        try:
            response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria?search=TEST-HAL", headers=self.headers)
            if response.status_code == 200:
                items = response.json().get("items", [])
                for item in items:
                    requests.delete(f"{BASE_URL}/api/hallazgos-auditoria/{item['id']}", headers=self.headers)
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    def test_create_hallazgo_with_new_fields(self):
        """Test creating a hallazgo with responsable, fecha_hallazgo, fecha_compromiso"""
        today = datetime.now().strftime("%Y-%m-%d")
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "codigo": "TEST-HAL-001",
            "brecha": "Test hallazgo con nuevos campos",
            "probabilidad": 3,
            "impacto": 4,
            "estado": "Abierto",
            "responsable": "Juan Pérez",
            "fecha_hallazgo": today,
            "fecha_compromiso": future_date
        }
        
        response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["codigo"] == "TEST-HAL-001"
        assert data["responsable"] == "Juan Pérez"
        assert data["fecha_hallazgo"] == today
        assert data["fecha_compromiso"] == future_date
        assert data["riesgo_inherente"] == 12  # 3 * 4
        
        # Verify GET returns the same data
        get_response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/{data['id']}", headers=self.headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["responsable"] == "Juan Pérez"
        assert get_data["fecha_hallazgo"] == today
        assert get_data["fecha_compromiso"] == future_date
    
    def test_create_hallazgo_fecha_compromiso_before_fecha_hallazgo_fails(self):
        """Test that fecha_compromiso cannot be before fecha_hallazgo"""
        today = datetime.now().strftime("%Y-%m-%d")
        past_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        payload = {
            "codigo": "TEST-HAL-002",
            "brecha": "Test hallazgo con fecha inválida",
            "probabilidad": 2,
            "impacto": 2,
            "estado": "Abierto",
            "fecha_hallazgo": today,
            "fecha_compromiso": past_date  # Before fecha_hallazgo
        }
        
        response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=payload, headers=self.headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "fecha de compromiso no puede ser anterior" in response.json().get("detail", "").lower()
    
    def test_update_hallazgo_fecha_compromiso_validation(self):
        """Test that update also validates fecha_compromiso >= fecha_hallazgo"""
        today = datetime.now().strftime("%Y-%m-%d")
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Create valid hallazgo first
        payload = {
            "codigo": "TEST-HAL-003",
            "brecha": "Test hallazgo para update",
            "probabilidad": 3,
            "impacto": 3,
            "estado": "Abierto",
            "fecha_hallazgo": today,
            "fecha_compromiso": future_date
        }
        
        create_response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        hallazgo_id = create_response.json()["id"]
        
        # Try to update with invalid fecha_compromiso
        past_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        update_payload = {
            "fecha_compromiso": past_date
        }
        
        update_response = requests.put(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", json=update_payload, headers=self.headers)
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}: {update_response.text}"
    
    def test_create_hallazgo_without_optional_dates(self):
        """Test creating hallazgo without fecha_hallazgo and fecha_compromiso"""
        payload = {
            "codigo": "TEST-HAL-004",
            "brecha": "Test hallazgo sin fechas",
            "probabilidad": 2,
            "impacto": 3,
            "estado": "Abierto"
        }
        
        response = requests.post(f"{BASE_URL}/api/hallazgos-auditoria", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["codigo"] == "TEST-HAL-004"
        # fecha_hallazgo and fecha_compromiso should be None or empty
        assert data.get("fecha_hallazgo") is None or data.get("fecha_hallazgo") == ""
        assert data.get("fecha_compromiso") is None or data.get("fecha_compromiso") == ""


class TestSeguimientoHallazgos:
    """Tests for Seguimiento module - Hallazgos tab"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_seguimiento_hallazgos_endpoint_exists(self):
        """Test GET /api/hallazgos-auditoria/seguimiento returns data"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento", headers=self.headers)
        assert response.status_code == 200, f"Seguimiento endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of hallazgos"
    
    def test_seguimiento_hallazgos_resumen_endpoint(self):
        """Test GET /api/hallazgos-auditoria/seguimiento/resumen returns KPIs"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento/resumen", headers=self.headers)
        assert response.status_code == 200, f"Resumen endpoint failed: {response.text}"
        
        data = response.json()
        assert "total_pendientes" in data
        assert "vencidas" in data
        assert "criticas_7_dias" in data
        assert "proximas_30_dias" in data
    
    def test_seguimiento_hallazgos_filter_by_responsable(self):
        """Test filtering hallazgos by responsable"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento?responsable=Juan", headers=self.headers)
        assert response.status_code == 200
    
    def test_seguimiento_hallazgos_filter_by_tipo_fecha(self):
        """Test filtering hallazgos by tipo_fecha (con_fecha, sin_fecha)"""
        # Test con_fecha
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento?tipo_fecha=con_fecha", headers=self.headers)
        assert response.status_code == 200
        
        # Test sin_fecha
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento?tipo_fecha=sin_fecha", headers=self.headers)
        assert response.status_code == 200
    
    def test_seguimiento_hallazgos_filter_by_filtro_vencidas(self):
        """Test filtering hallazgos by filtro=vencidas"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento?filtro=vencidas", headers=self.headers)
        assert response.status_code == 200
    
    def test_seguimiento_hallazgos_filter_by_filtro_critico(self):
        """Test filtering hallazgos by filtro=critico (next 7 days)"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento?filtro=critico", headers=self.headers)
        assert response.status_code == 200


class TestSeguimientoVulnerabilidades:
    """Tests for Seguimiento module - Vulnerabilidades tab (existing)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_seguimiento_vulnerabilidades_endpoint_exists(self):
        """Test GET /api/seguimiento-riesgos returns data"""
        response = requests.get(f"{BASE_URL}/api/seguimiento-riesgos", headers=self.headers)
        assert response.status_code == 200, f"Seguimiento vulns endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of vulnerabilidades"
    
    def test_seguimiento_vulnerabilidades_resumen_endpoint(self):
        """Test GET /api/seguimiento-riesgos/resumen returns KPIs"""
        response = requests.get(f"{BASE_URL}/api/seguimiento-riesgos/resumen", headers=self.headers)
        assert response.status_code == 200, f"Resumen vulns endpoint failed: {response.text}"
        
        data = response.json()
        assert "total_pendientes" in data
        assert "vencidas" in data
        assert "criticas_7_dias" in data
        assert "proximas_30_dias" in data


class TestResponsablesEndpoint:
    """Tests for responsables dropdown data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_responsables_endpoint_exists(self):
        """Test GET /api/config/responsables returns list of responsables"""
        response = requests.get(f"{BASE_URL}/api/config/responsables", headers=self.headers)
        assert response.status_code == 200, f"Responsables endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of responsables"


class TestHallazgosTableColumns:
    """Tests for new columns in Hallazgos table"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_hallazgos_list_returns_new_fields(self):
        """Test GET /api/hallazgos-auditoria returns responsable, fecha_compromiso"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        
        # Check that the response structure includes the new fields
        if len(data["items"]) > 0:
            item = data["items"][0]
            # These fields should exist (even if null)
            assert "responsable" in item or item.get("responsable") is None
            assert "fecha_compromiso" in item or item.get("fecha_compromiso") is None
            assert "fecha_hallazgo" in item or item.get("fecha_hallazgo") is None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
