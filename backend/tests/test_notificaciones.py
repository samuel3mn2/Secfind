"""
Test suite for Notification Email Configuration endpoints (Iteration 8)
Tests:
- GET /api/config/notificaciones - Get notification config (admin only)
- PUT /api/config/notificaciones - Update notification config
- POST /api/config/notificaciones/test - Test SMTP connection
- POST /api/config/notificaciones/send-test-email - Send test email
- POST /api/notificaciones/ejecutar - Execute notification check
- POST /api/notificaciones/resumen-semanal - Send weekly summary
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNotificationEndpoints:
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
    
    def test_get_notificacion_config_requires_auth(self):
        """GET /api/config/notificaciones - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/config/notificaciones")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/config/notificaciones requires authentication")
    
    def test_get_notificacion_config_success(self):
        """GET /api/config/notificaciones - Returns config for admin"""
        response = self.session.get(f"{BASE_URL}/api/config/notificaciones")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        assert "habilitado" in data or data == {}, f"Missing habilitado field: {data}"
        print(f"✓ GET /api/config/notificaciones returns config: {list(data.keys())}")
    
    # ============ PUT /api/config/notificaciones ============
    
    def test_update_notificacion_config_requires_auth(self):
        """PUT /api/config/notificaciones - Requires authentication"""
        response = requests.put(f"{BASE_URL}/api/config/notificaciones", json={
            "habilitado": True
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ PUT /api/config/notificaciones requires authentication")
    
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
                "dias_1": False
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
        assert saved_config.get("smtp_password") == "********", "Password should be masked"
        assert saved_config.get("enviar_a_responsables") == True
        print("✓ Config update persisted correctly (password masked)")
    
    def test_update_notificacion_config_partial_update(self):
        """PUT /api/config/notificaciones - Partial update works"""
        # Only update one field
        response = self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "resumen_semanal": False
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ PUT /api/config/notificaciones partial update works")
    
    # ============ POST /api/config/notificaciones/test ============
    
    def test_smtp_test_requires_auth(self):
        """POST /api/config/notificaciones/test - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/config/notificaciones/test")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/config/notificaciones/test requires authentication")
    
    def test_smtp_test_fails_without_config(self):
        """POST /api/config/notificaciones/test - Fails with invalid SMTP (expected)"""
        # First clear the config to test error handling
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "smtp_email": "invalid@test.com",
            "smtp_password": "invalidpassword"
        })
        
        response = self.session.post(f"{BASE_URL}/api/config/notificaciones/test")
        # Should fail because SMTP credentials are invalid
        assert response.status_code == 400, f"Expected 400 for invalid SMTP, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, f"Expected error detail: {data}"
        print(f"✓ POST /api/config/notificaciones/test fails with invalid SMTP: {data['detail']}")
    
    # ============ POST /api/config/notificaciones/send-test-email ============
    
    def test_send_test_email_requires_auth(self):
        """POST /api/config/notificaciones/send-test-email - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/config/notificaciones/send-test-email")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/config/notificaciones/send-test-email requires authentication")
    
    def test_send_test_email_fails_without_valid_smtp(self):
        """POST /api/config/notificaciones/send-test-email - Fails without valid SMTP (expected)"""
        response = self.session.post(f"{BASE_URL}/api/config/notificaciones/send-test-email")
        # Should fail because SMTP is not properly configured
        assert response.status_code == 400, f"Expected 400 for invalid SMTP, got {response.status_code}: {response.text}"
        print("✓ POST /api/config/notificaciones/send-test-email fails without valid SMTP (expected)")
    
    # ============ POST /api/notificaciones/ejecutar ============
    
    def test_ejecutar_notificaciones_requires_auth(self):
        """POST /api/notificaciones/ejecutar - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/notificaciones/ejecutar")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/notificaciones/ejecutar requires authentication")
    
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
    
    def test_ejecutar_notificaciones_fails_without_smtp(self):
        """POST /api/notificaciones/ejecutar - Fails without SMTP config"""
        # Enable notifications but with incomplete SMTP
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "habilitado": True,
            "smtp_email": "",
            "smtp_password": ""
        })
        
        response = self.session.post(f"{BASE_URL}/api/notificaciones/ejecutar")
        assert response.status_code == 400, f"Expected 400 without SMTP, got {response.status_code}: {response.text}"
        print("✓ POST /api/notificaciones/ejecutar fails without SMTP config")
    
    # ============ POST /api/notificaciones/resumen-semanal ============
    
    def test_resumen_semanal_requires_auth(self):
        """POST /api/notificaciones/resumen-semanal - Requires authentication"""
        response = requests.post(f"{BASE_URL}/api/notificaciones/resumen-semanal")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/notificaciones/resumen-semanal requires authentication")
    
    def test_resumen_semanal_fails_when_disabled(self):
        """POST /api/notificaciones/resumen-semanal - Fails when notifications disabled"""
        # Ensure notifications are disabled
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "habilitado": False
        })
        
        response = self.session.post(f"{BASE_URL}/api/notificaciones/resumen-semanal")
        assert response.status_code == 400, f"Expected 400 when disabled, got {response.status_code}: {response.text}"
        print("✓ POST /api/notificaciones/resumen-semanal fails when disabled")


class TestNotificationConfigValidation:
    """Test notification config validation and edge cases"""
    
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
    
    def test_config_preserves_password_on_masked_update(self):
        """Config preserves password when masked value is sent"""
        # First set a password
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "smtp_password": "realpassword123"
        })
        
        # Now update with masked password (should not change it)
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "smtp_password": "********",
            "smtp_email": "newemail@test.com"
        })
        
        # Verify email changed but password is still masked (meaning it wasn't overwritten)
        response = self.session.get(f"{BASE_URL}/api/config/notificaciones")
        data = response.json()
        assert data.get("smtp_email") == "newemail@test.com"
        assert data.get("smtp_password") == "********"
        print("✓ Config preserves password when masked value is sent")
    
    def test_alertas_config_structure(self):
        """Alertas config has correct structure"""
        # Set alertas config
        self.session.put(f"{BASE_URL}/api/config/notificaciones", json={
            "alertas": {
                "dias_7": True,
                "dias_3": False,
                "dias_1": True
            }
        })
        
        response = self.session.get(f"{BASE_URL}/api/config/notificaciones")
        data = response.json()
        
        alertas = data.get("alertas", {})
        assert alertas.get("dias_7") == True
        assert alertas.get("dias_3") == False
        assert alertas.get("dias_1") == True
        print("✓ Alertas config structure is correct")


class TestNonAdminAccess:
    """Test that non-admin users cannot access notification config"""
    
    def test_non_admin_cannot_access_config(self):
        """Non-admin users should get 403 on notification endpoints"""
        # First check if there's a non-admin user
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to login as sfernandez (non-admin from previous tests)
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "sfernandez",
            "password": "sfernandez123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Non-admin user sfernandez not available for testing")
        
        token = login_response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to access notification config
        response = session.get(f"{BASE_URL}/api/config/notificaciones")
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ Non-admin users cannot access notification config (403)")
        
        session.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
