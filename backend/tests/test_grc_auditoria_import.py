"""
Test GRC Auditoría Integration and Excel Import Features
Tests for:
1. Auditoría filters for GRC entities (dominio, control, catalogo_riesgo, hallazgo_auditoria)
2. Catálogo Riesgos: Template download and Excel import
3. Hallazgos Auditoría: Template download and Excel import
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication helper"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestCatalogoRiesgosTemplateAndImport(TestAuth):
    """Tests for Catálogo de Riesgos template download and Excel import"""
    
    def test_download_template_returns_excel(self, auth_headers):
        """GET /api/catalogo-riesgos/plantilla/descargar returns Excel file"""
        response = requests.get(
            f"{BASE_URL}/api/catalogo-riesgos/plantilla/descargar",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Template download failed: {response.text}"
        
        # Check content type is Excel
        content_type = response.headers.get('Content-Type', '')
        assert 'spreadsheet' in content_type or 'excel' in content_type or 'octet-stream' in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Check content disposition header
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'plantilla_catalogo_riesgos.xlsx' in content_disp, \
            f"Expected filename in Content-Disposition, got: {content_disp}"
        
        # Check file has content
        assert len(response.content) > 0, "Template file is empty"
        print(f"Template downloaded successfully: {len(response.content)} bytes")
    
    def test_import_excel_endpoint_exists(self, auth_headers):
        """POST /api/catalogo-riesgos/import/excel endpoint exists"""
        # Test with empty request to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/catalogo-riesgos/import/excel",
            headers=auth_headers
        )
        # Should return 422 (validation error) not 404
        assert response.status_code != 404, "Import endpoint not found"
        print(f"Import endpoint exists, status: {response.status_code}")
    
    def test_import_rejects_non_excel(self, auth_headers):
        """POST /api/catalogo-riesgos/import/excel rejects non-Excel files"""
        files = {'file': ('test.txt', b'not an excel file', 'text/plain')}
        response = requests.post(
            f"{BASE_URL}/api/catalogo-riesgos/import/excel",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 400, f"Expected 400 for non-Excel file, got: {response.status_code}"
        assert "Excel" in response.json().get("detail", ""), "Error should mention Excel format"
        print(f"Non-Excel file correctly rejected: {response.json()}")


class TestHallazgosAuditoriaTemplateAndImport(TestAuth):
    """Tests for Hallazgos de Auditoría template download and Excel import"""
    
    def test_download_template_returns_excel(self, auth_headers):
        """GET /api/hallazgos-auditoria/plantilla/descargar returns Excel file"""
        response = requests.get(
            f"{BASE_URL}/api/hallazgos-auditoria/plantilla/descargar",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Template download failed: {response.text}"
        
        # Check content type is Excel
        content_type = response.headers.get('Content-Type', '')
        assert 'spreadsheet' in content_type or 'excel' in content_type or 'octet-stream' in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Check content disposition header
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'plantilla_hallazgos_auditoria.xlsx' in content_disp, \
            f"Expected filename in Content-Disposition, got: {content_disp}"
        
        # Check file has content
        assert len(response.content) > 0, "Template file is empty"
        print(f"Template downloaded successfully: {len(response.content)} bytes")
    
    def test_import_excel_endpoint_exists(self, auth_headers):
        """POST /api/hallazgos-auditoria/import/excel endpoint exists"""
        # Test with empty request to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/hallazgos-auditoria/import/excel",
            headers=auth_headers
        )
        # Should return 422 (validation error) not 404
        assert response.status_code != 404, "Import endpoint not found"
        print(f"Import endpoint exists, status: {response.status_code}")
    
    def test_import_rejects_non_excel(self, auth_headers):
        """POST /api/hallazgos-auditoria/import/excel rejects non-Excel files"""
        files = {'file': ('test.txt', b'not an excel file', 'text/plain')}
        response = requests.post(
            f"{BASE_URL}/api/hallazgos-auditoria/import/excel",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 400, f"Expected 400 for non-Excel file, got: {response.status_code}"
        assert "Excel" in response.json().get("detail", ""), "Error should mention Excel format"
        print(f"Non-Excel file correctly rejected: {response.json()}")


class TestAuditoriaGRCFilters(TestAuth):
    """Tests for Auditoría page GRC entity filters"""
    
    def test_historial_endpoint_exists(self, auth_headers):
        """GET /api/historial endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/historial",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Historial endpoint failed: {response.text}"
        data = response.json()
        assert "historial" in data, "Response should contain 'historial' key"
        assert "total" in data, "Response should contain 'total' key"
        print(f"Historial endpoint works: {data['total']} total records")
    
    def test_filter_by_dominio_entity(self, auth_headers):
        """GET /api/historial?entidad=dominio filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=dominio",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filter by dominio failed: {response.text}"
        data = response.json()
        
        # All returned items should have entidad=dominio
        for item in data.get("historial", []):
            assert item.get("entidad") == "dominio", f"Expected entidad=dominio, got: {item.get('entidad')}"
        
        print(f"Filter by dominio: {data['total']} records found")
    
    def test_filter_by_control_entity(self, auth_headers):
        """GET /api/historial?entidad=control filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=control",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filter by control failed: {response.text}"
        data = response.json()
        
        # All returned items should have entidad=control
        for item in data.get("historial", []):
            assert item.get("entidad") == "control", f"Expected entidad=control, got: {item.get('entidad')}"
        
        print(f"Filter by control: {data['total']} records found")
    
    def test_filter_by_catalogo_riesgo_entity(self, auth_headers):
        """GET /api/historial?entidad=catalogo_riesgo filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=catalogo_riesgo",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filter by catalogo_riesgo failed: {response.text}"
        data = response.json()
        
        # All returned items should have entidad=catalogo_riesgo
        for item in data.get("historial", []):
            assert item.get("entidad") == "catalogo_riesgo", f"Expected entidad=catalogo_riesgo, got: {item.get('entidad')}"
        
        print(f"Filter by catalogo_riesgo: {data['total']} records found")
    
    def test_filter_by_hallazgo_auditoria_entity(self, auth_headers):
        """GET /api/historial?entidad=hallazgo_auditoria filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=hallazgo_auditoria",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filter by hallazgo_auditoria failed: {response.text}"
        data = response.json()
        
        # All returned items should have entidad=hallazgo_auditoria
        for item in data.get("historial", []):
            assert item.get("entidad") == "hallazgo_auditoria", f"Expected entidad=hallazgo_auditoria, got: {item.get('entidad')}"
        
        print(f"Filter by hallazgo_auditoria: {data['total']} records found")


class TestGRCModulesAuditLogging(TestAuth):
    """Tests to verify GRC modules create audit logs in historial_cambios"""
    
    def test_create_dominio_creates_audit_log(self, auth_headers):
        """Creating a dominio should create an audit log entry"""
        import uuid
        test_name = f"TEST_DOMINIO_{uuid.uuid4().hex[:8]}"
        
        # Create dominio
        response = requests.post(
            f"{BASE_URL}/api/config/dominios",
            headers=auth_headers,
            json={
                "nombre_dominio": test_name,
                "codigo_referencia": "TEST-DOM"
            }
        )
        assert response.status_code == 200, f"Create dominio failed: {response.text}"
        dominio_id = response.json().get("id")
        
        # Check audit log
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=dominio",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Find the audit entry for our dominio
        found = False
        for item in response.json().get("historial", []):
            if item.get("entidad_id") == dominio_id:
                found = True
                assert item.get("accion") == "crear"
                assert item.get("entidad") == "dominio"
                break
        
        assert found, f"Audit log entry not found for dominio {dominio_id}"
        print(f"Dominio audit log created successfully for {test_name}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/config/dominios/{dominio_id}", headers=auth_headers)
    
    def test_create_riesgo_catalogo_creates_audit_log(self, auth_headers):
        """Creating a riesgo in catalog should create an audit log entry"""
        import uuid
        test_code = f"TEST-R-{uuid.uuid4().hex[:6].upper()}"
        
        # Create riesgo
        response = requests.post(
            f"{BASE_URL}/api/catalogo-riesgos",
            headers=auth_headers,
            json={
                "codigo_riesgo": test_code,
                "nombre_corto": "Test Risk",
                "descripcion_completa": "Test description"
            }
        )
        assert response.status_code == 200, f"Create riesgo failed: {response.text}"
        riesgo_id = response.json().get("id")
        
        # Check audit log
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=catalogo_riesgo",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Find the audit entry for our riesgo
        found = False
        for item in response.json().get("historial", []):
            if item.get("entidad_id") == riesgo_id:
                found = True
                assert item.get("accion") == "crear"
                assert item.get("entidad") == "catalogo_riesgo"
                break
        
        assert found, f"Audit log entry not found for riesgo {riesgo_id}"
        print(f"Riesgo catalog audit log created successfully for {test_code}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/catalogo-riesgos/{riesgo_id}", headers=auth_headers)
    
    def test_create_hallazgo_creates_audit_log(self, auth_headers):
        """Creating a hallazgo should create an audit log entry"""
        import uuid
        test_code = f"TEST-AUD-{uuid.uuid4().hex[:6].upper()}"
        
        # Create hallazgo
        response = requests.post(
            f"{BASE_URL}/api/hallazgos-auditoria",
            headers=auth_headers,
            json={
                "codigo": test_code,
                "brecha": "Test audit finding",
                "probabilidad": 3,
                "impacto": 3,
                "estado": "Abierto"
            }
        )
        assert response.status_code == 200, f"Create hallazgo failed: {response.text}"
        hallazgo_id = response.json().get("id")
        
        # Check audit log
        response = requests.get(
            f"{BASE_URL}/api/historial?entidad=hallazgo_auditoria",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Find the audit entry for our hallazgo
        found = False
        for item in response.json().get("historial", []):
            if item.get("entidad_id") == hallazgo_id:
                found = True
                assert item.get("accion") == "crear"
                assert item.get("entidad") == "hallazgo_auditoria"
                break
        
        assert found, f"Audit log entry not found for hallazgo {hallazgo_id}"
        print(f"Hallazgo audit log created successfully for {test_code}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/hallazgos-auditoria/{hallazgo_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
