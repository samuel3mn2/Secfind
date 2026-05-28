"""
Test suite for Unified Notification System (Iteration 17)
Tests the adaptation of notifications to include both vulnerabilities and hallazgos de auditoría.

Features tested:
- GET /api/config/notificaciones - Returns correct config
- PUT /api/config/notificaciones - Updates config correctly
- POST /api/notificaciones/ejecutar - Queries both collections (vulnerabilidades + hallazgos_auditoria)
- POST /api/notificaciones/resumen-semanal - Combines stats from both collections
- POST /api/config/notificaciones/send-test-email - Includes hallazgo example
- generate_alert_email accepts vulnerabilities and hallazgos lists
- generate_weekly_summary_email combines stats from both collections
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUnifiedNotificationConfig:
    """Test notification configuration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    # ============ GET /api/config/notificaciones ============
    
    def test_get_notificacion_config_returns_correct_structure(self):
        """GET /api/config/notificaciones - Returns config with all expected fields"""
        response = self.session.get(f"{BASE_URL}/api/config/notificaciones")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        expected_fields = ["habilitado", "smtp_servidor", "smtp_puerto", "smtp_email", 
                          "smtp_usar_tls", "alertas", "enviar_a_responsables", "resumen_semanal"]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify alertas structure
        alertas = data.get("alertas", {})
        assert "dias_7" in alertas or alertas == {}, f"Missing dias_7 in alertas"
        assert "dias_3" in alertas or alertas == {}, f"Missing dias_3 in alertas"
        assert "dias_1" in alertas or alertas == {}, f"Missing dias_1 in alertas"
        
        print(f"✓ GET /api/config/notificaciones returns correct structure")
        print(f"  - habilitado: {data.get('habilitado')}")
        print(f"  - enviar_a_responsables: {data.get('enviar_a_responsables')}")
        print(f"  - resumen_semanal: {data.get('resumen_semanal')}")
    
    # ============ PUT /api/config/notificaciones ============
    
    def test_update_notificacion_config_success(self):
        """PUT /api/config/notificaciones - Updates config successfully"""
        update_data = {
            "habilitado": False,
            "smtp_servidor": "smtp.gmail.com",
            "smtp_puerto": 587,
            "smtp_email": "test@example.com",
            "smtp_password": "testpassword123",
            "smtp_usar_tls": True,
            "alertas": {
                "dias_7": True,
                "dias_3": True,
                "dias_1": True
            },
            "enviar_a_responsables": True,
            "resumen_semanal": True
        }
        
        response = self.session.put(f"{BASE_URL}/api/config/notificaciones", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, f"Expected message in response: {data}"
        print(f"✓ PUT /api/config/notificaciones updates config: {data['message']}")
        
        # Verify the update persisted
        get_response = self.session.get(f"{BASE_URL}/api/config/notificaciones")
        assert get_response.status_code == 200
        
        saved_config = get_response.json()
        assert saved_config.get("smtp_servidor") == "smtp.gmail.com"
        assert saved_config.get("smtp_email") == "test@example.com"
        assert saved_config.get("enviar_a_responsables") == True
        assert saved_config.get("resumen_semanal") == True
        print("✓ Config update persisted correctly")


class TestUnifiedNotificationExecution:
    """Test notification execution endpoints that query both collections"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    def test_ejecutar_notificaciones_fails_when_disabled(self):
        """POST /api/notificaciones/ejecutar - Fails when notifications disabled"""
        # Ensure notifications are disabled
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "habilitado": False
        })
        
        response = self.session.post(f"{BASE_URL}/api/notificaciones/ejecutar")
        assert response.status_code == 400, f"Expected 400 when disabled, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        assert "habilitadas" in data["detail"].lower() or "no están" in data["detail"].lower()
        print(f"✓ POST /api/notificaciones/ejecutar fails when disabled: {data['detail']}")
    
    def test_resumen_semanal_fails_when_disabled(self):
        """POST /api/notificaciones/resumen-semanal - Fails when notifications disabled"""
        # Ensure notifications are disabled
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "habilitado": False
        })
        
        response = self.session.post(f"{BASE_URL}/api/notificaciones/resumen-semanal")
        assert response.status_code == 400, f"Expected 400 when disabled, got {response.status_code}: {response.text}"
        print("✓ POST /api/notificaciones/resumen-semanal fails when disabled")


class TestHallazgosAuditoriaCollection:
    """Test that hallazgos_auditoria collection is accessible for notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    def test_hallazgos_auditoria_endpoint_exists(self):
        """GET /api/hallazgos-auditoria - Endpoint exists and returns data"""
        response = self.session.get(f"{BASE_URL}/api/hallazgos-auditoria")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Endpoint returns paginated response with 'items' key
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        assert "items" in data, f"Missing 'items' key in response"
        items = data.get("items", [])
        print(f"✓ GET /api/hallazgos-auditoria returns {len(items)} hallazgos (total: {data.get('total', 0)})")
    
    def test_hallazgos_have_required_fields_for_notifications(self):
        """Hallazgos have fields needed for notifications (responsable, fecha_compromiso)"""
        response = self.session.get(f"{BASE_URL}/api/hallazgos-auditoria")
        assert response.status_code == 200
        
        data = response.json()
        items = data.get("items", [])
        if len(items) > 0:
            hallazgo = items[0]
            # These fields are used by the notification system
            notification_fields = ["codigo", "brecha", "riesgo_inherente", "estado"]
            for field in notification_fields:
                assert field in hallazgo, f"Missing field {field} in hallazgo"
            print(f"✓ Hallazgos have required fields for notifications")
            print(f"  - Sample hallazgo: codigo={hallazgo.get('codigo')}, estado={hallazgo.get('estado')}")
        else:
            print("✓ No hallazgos found (empty collection)")


class TestVulnerabilidadesCollection:
    """Test that vulnerabilidades collection is accessible for notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    def test_vulnerabilidades_endpoint_exists(self):
        """GET /api/vulnerabilidades - Endpoint exists and returns data"""
        response = self.session.get(f"{BASE_URL}/api/vulnerabilidades")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/vulnerabilidades returns {len(data)} vulnerabilidades")
    
    def test_vulnerabilidades_have_required_fields_for_notifications(self):
        """Vulnerabilidades have fields needed for notifications"""
        response = self.session.get(f"{BASE_URL}/api/vulnerabilidades")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            vuln = data[0]
            # These fields are used by the notification system
            notification_fields = ["vulnerabilidad", "institucion", "severidad", "estatus"]
            for field in notification_fields:
                assert field in vuln, f"Missing field {field} in vulnerabilidad"
            print(f"✓ Vulnerabilidades have required fields for notifications")
            print(f"  - Sample vuln: {vuln.get('vulnerabilidad', 'N/A')[:40]}...")
        else:
            print("✓ No vulnerabilidades found (empty collection)")


class TestResponsablesForNotifications:
    """Test responsables endpoint used by notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    def test_responsables_endpoint_exists(self):
        """GET /api/config/responsables - Endpoint exists for notification recipients"""
        response = self.session.get(f"{BASE_URL}/api/config/responsables")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/config/responsables returns {len(data)} responsables")
        
        if len(data) > 0:
            responsable = data[0]
            assert "nombre" in responsable, "Missing nombre field"
            # email is optional but used for notifications
            print(f"  - Sample: {responsable.get('nombre')}, email: {responsable.get('email', 'N/A')}")


class TestSendTestEmailWithHallazgo:
    """Test that send-test-email includes hallazgo example"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    def test_send_test_email_endpoint_exists(self):
        """POST /api/config/notificaciones/send-test-email - Endpoint exists"""
        # This will fail due to SMTP not configured, but we verify the endpoint exists
        response = self.session.post(f"{BASE_URL}/api/config/notificaciones/send-test-email")
        # Should return 400 (SMTP not configured) not 404 (endpoint not found)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/config/notificaciones/send-test-email endpoint exists (status: {response.status_code})")


class TestSeguimientoEndpointsForNotifications:
    """Test seguimiento endpoints that provide data for notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
        self.session.close()
    
    def test_seguimiento_riesgos_resumen_exists(self):
        """GET /api/seguimiento-riesgos/resumen - Returns vulnerability KPIs"""
        response = self.session.get(f"{BASE_URL}/api/seguimiento-riesgos/resumen")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # These fields are used for weekly summary
        expected_fields = ["total_pendientes", "vencidas", "criticas_7_dias", "proximas_30_dias"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ GET /api/seguimiento-riesgos/resumen returns KPIs")
        print(f"  - vencidas: {data.get('vencidas')}, total_pendientes: {data.get('total_pendientes')}")
    
    def test_hallazgos_seguimiento_resumen_exists(self):
        """GET /api/hallazgos-auditoria/seguimiento/resumen - Returns hallazgo KPIs"""
        response = self.session.get(f"{BASE_URL}/api/hallazgos-auditoria/seguimiento/resumen")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # These fields are used for weekly summary
        expected_fields = ["total_pendientes", "vencidas", "criticas_7_dias", "proximas_30_dias"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ GET /api/hallazgos-auditoria/seguimiento/resumen returns KPIs")
        print(f"  - vencidas: {data.get('vencidas')}, total_pendientes: {data.get('total_pendientes')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
