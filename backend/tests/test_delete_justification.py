"""
Tests for Delete with Justification feature.
Validates that DELETE endpoints require a justificacion parameter of at least 10 characters.
"""
import pytest
import requests
import time

API = "https://secfind-board.preview.emergentagent.com/api"


@pytest.fixture(scope="module")
def headers():
    """Get auth headers by logging in."""
    login_resp = requests.post(
        f"{API}/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=30,
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


class TestDeleteWithoutJustification:
    """Tests that DELETE without justification returns 422 (Unprocessable Entity) or 400 (Bad Request)"""
    
    @pytest.fixture
    def test_vuln_id(self, headers):
        """Create a test vulnerability to attempt deletion."""
        payload = {
            "codigo": f"TEST_DEL_{int(time.time())}",
            "vulnerabilidad": "Test vulnerability for delete justification",
            "severidad": "Baja",
            "estatus": "Pendiente",
        }
        r = requests.post(f"{API}/vulnerabilidades", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Create failed: {r.text}"
        vuln_id = r.json().get("id")
        yield vuln_id
        # Cleanup - try to delete with proper justification
        try:
            requests.delete(
                f"{API}/vulnerabilidades/{vuln_id}",
                headers=headers,
                params={"justificacion": "Cleanup after test - automatic deletion"},
                timeout=15
            )
        except Exception:
            pass

    def test_delete_vuln_without_justification_fails(self, headers, test_vuln_id):
        """DELETE /vulnerabilidades/{id} without justificacion should fail with 422"""
        r = requests.delete(
            f"{API}/vulnerabilidades/{test_vuln_id}",
            headers=headers,
            timeout=15
        )
        # FastAPI returns 422 for missing required query params
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
        
    def test_delete_vuln_with_short_justification_fails(self, headers, test_vuln_id):
        """DELETE /vulnerabilidades/{id} with justificacion < 10 chars should fail"""
        r = requests.delete(
            f"{API}/vulnerabilidades/{test_vuln_id}",
            headers=headers,
            params={"justificacion": "short"},  # Only 5 characters
            timeout=15
        )
        # FastAPI should reject short justifications
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_delete_vuln_with_valid_justification_succeeds(self, headers, test_vuln_id):
        """DELETE /vulnerabilidades/{id} with valid justificacion should succeed"""
        r = requests.delete(
            f"{API}/vulnerabilidades/{test_vuln_id}",
            headers=headers,
            params={"justificacion": "Test deletion - validating justification feature works correctly"},
            timeout=15
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert "exitosamente" in r.json().get("message", "").lower()


class TestDeleteInstitutionWithoutJustification:
    """Test that institutions DELETE also requires justification"""
    
    @pytest.fixture
    def test_inst_id(self, headers):
        """Create a test institution."""
        payload = {"nombre": f"TestInst_{int(time.time())}"}
        r = requests.post(f"{API}/config/instituciones", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Create failed: {r.text}"
        inst_id = r.json().get("id")
        yield inst_id
        # Cleanup
        try:
            requests.delete(
                f"{API}/config/instituciones/{inst_id}",
                headers=headers,
                params={"justificacion": "Cleanup after test - automatic deletion"},
                timeout=15
            )
        except Exception:
            pass

    def test_delete_institucion_without_justification_fails(self, headers, test_inst_id):
        """DELETE /config/instituciones/{id} without justificacion should fail"""
        r = requests.delete(
            f"{API}/config/instituciones/{test_inst_id}",
            headers=headers,
            timeout=15
        )
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_delete_institucion_with_valid_justification_succeeds(self, headers, test_inst_id):
        """DELETE /config/instituciones/{id} with valid justificacion should succeed"""
        r = requests.delete(
            f"{API}/config/instituciones/{test_inst_id}",
            headers=headers,
            params={"justificacion": "Eliminación de institución de prueba para testing"},
            timeout=15
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"


class TestAuditLogRegistration:
    """Test that deletions are properly registered in audit log"""
    
    def test_deletion_creates_audit_entry(self, headers):
        """Verify that a deletion with justification creates an audit log entry"""
        # Create a test item
        unique_name = f"AuditTest_{int(time.time())}"
        payload = {"nombre": unique_name}
        r = requests.post(f"{API}/config/proveedores", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Create failed: {r.text}"
        prov_id = r.json().get("id")
        
        # Delete with justification
        justificacion = "Test de auditoría - eliminación controlada para validar registro"
        r = requests.delete(
            f"{API}/config/proveedores/{prov_id}",
            headers=headers,
            params={"justificacion": justificacion},
            timeout=15
        )
        assert r.status_code == 200, f"Delete failed: {r.text}"
        
        # Check audit log for the entry
        r = requests.get(
            f"{API}/historial",
            headers=headers,
            params={"entidad": "proveedor", "accion": "ELIMINAR"},
            timeout=15
        )
        assert r.status_code == 200, f"Audit log fetch failed: {r.text}"
        
        data = r.json()
        historial = data.get("historial", [])
        
        # Find the entry for our deletion
        found = False
        for entry in historial:
            if entry.get("entidad_nombre") == unique_name:
                assert entry.get("justificacion_borrado") == justificacion
                assert entry.get("accion") == "ELIMINAR"
                found = True
                break
        
        assert found, f"Audit entry not found for deleted proveedor '{unique_name}'"
