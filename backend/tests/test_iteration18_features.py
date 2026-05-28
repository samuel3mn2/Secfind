"""
Test Iteration 18 Features:
1. Hallazgos: Brecha column expanded (min-w-[300px], line-clamp-2)
2. Hallazgos: New Dominio column visible
3. Hallazgos Form: Dropdown shows 'N/A' instead of 'Todos los dominios'
4. Vulnerabilidades: Column options include 'Dominio' and 'Control Asociado'
5. Backend Vulnerabilidades: Endpoint returns nombre_dominio and codigo_control fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestVulnerabilidadesEnrichment:
    """Test that vulnerabilidades endpoint returns enriched fields"""
    
    def test_vulnerabilidades_returns_nombre_dominio_field(self, auth_headers):
        """Verify vulnerabilidades response includes nombre_dominio field"""
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should have at least one vulnerability"
        
        # Check that nombre_dominio field exists in response
        first_vuln = data[0]
        assert "nombre_dominio" in first_vuln, "Response should include nombre_dominio field"
        print(f"SUCCESS: nombre_dominio field present in vulnerabilidades response")
    
    def test_vulnerabilidades_returns_codigo_control_field(self, auth_headers):
        """Verify vulnerabilidades response includes codigo_control field"""
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should have at least one vulnerability"
        
        # Check that codigo_control field exists in response
        first_vuln = data[0]
        assert "codigo_control" in first_vuln, "Response should include codigo_control field"
        print(f"SUCCESS: codigo_control field present in vulnerabilidades response")
    
    def test_vulnerabilidades_enrichment_with_control(self, auth_headers):
        """Test that vulnerabilities with control_id get enriched with dominio/control names"""
        # First, get available controls
        controls_response = requests.get(f"{BASE_URL}/api/config/controles", headers=auth_headers)
        assert controls_response.status_code == 200
        controls = controls_response.json()
        
        if len(controls) == 0:
            pytest.skip("No controls available for testing enrichment")
        
        # Get a control with dominio_id
        control_with_dominio = None
        for c in controls:
            if c.get("dominio_id"):
                control_with_dominio = c
                break
        
        if not control_with_dominio:
            pytest.skip("No controls with dominio_id available")
        
        # Create a test vulnerability with control_id
        test_vuln = {
            "vulnerabilidad": "TEST_Enrichment_Test_Vulnerability",
            "severidad": "Media",
            "estatus": "Pendiente",
            "control_id": control_with_dominio["id"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/vulnerabilidades", json=test_vuln, headers=auth_headers)
        assert create_response.status_code == 200
        created_vuln = create_response.json()
        vuln_id = created_vuln["id"]
        
        try:
            # Fetch vulnerabilities and find our test one
            list_response = requests.get(f"{BASE_URL}/api/vulnerabilidades", headers=auth_headers)
            assert list_response.status_code == 200
            vulns = list_response.json()
            
            test_vuln_in_list = next((v for v in vulns if v["id"] == vuln_id), None)
            assert test_vuln_in_list is not None, "Test vulnerability should be in list"
            
            # Verify enrichment
            assert test_vuln_in_list.get("codigo_control") == control_with_dominio.get("codigo_control"), \
                "codigo_control should be enriched from control"
            
            # nombre_dominio should be populated if control has dominio_id
            if control_with_dominio.get("dominio_id"):
                # Get dominio name
                dominios_response = requests.get(f"{BASE_URL}/api/config/dominios", headers=auth_headers)
                dominios = dominios_response.json()
                dominio = next((d for d in dominios if d["id"] == control_with_dominio["dominio_id"]), None)
                if dominio:
                    assert test_vuln_in_list.get("nombre_dominio") == dominio.get("nombre_dominio"), \
                        "nombre_dominio should be enriched from dominio"
            
            print(f"SUCCESS: Vulnerability enrichment working correctly")
            print(f"  - codigo_control: {test_vuln_in_list.get('codigo_control')}")
            print(f"  - nombre_dominio: {test_vuln_in_list.get('nombre_dominio')}")
            
        finally:
            # Cleanup: delete test vulnerability
            requests.delete(f"{BASE_URL}/api/vulnerabilidades/{vuln_id}", headers=auth_headers)


class TestHallazgosAuditoria:
    """Test Hallazgos Auditoría features"""
    
    def test_hallazgos_endpoint_returns_data(self, auth_headers):
        """Verify hallazgos endpoint returns data with expected fields"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data, "Response should have items field"
        assert "total" in data, "Response should have total field"
        
        print(f"SUCCESS: Hallazgos endpoint returns {data['total']} items")
    
    def test_hallazgos_returns_nombre_dominio_field(self, auth_headers):
        """Verify hallazgos response includes nombre_dominio field when control_id is set"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if len(data["items"]) > 0:
            # Find a hallazgo with control_id set (non-empty)
            hallazgo_with_control = next((h for h in data["items"] if h.get("control_id")), None)
            
            if hallazgo_with_control:
                # If control_id is set, nombre_dominio should be enriched
                assert "nombre_dominio" in hallazgo_with_control, \
                    "Response should include nombre_dominio field when control_id is present"
                print(f"SUCCESS: Hallazgos with control_id have nombre_dominio field")
            else:
                # No hallazgos have control_id set - this is expected per context
                print(f"INFO: No hallazgos have control_id assigned - enrichment not applicable")
                print(f"  (This is expected per agent context: existing hallazgos don't have control_id)")
    
    def test_hallazgos_returns_codigo_control_field(self, auth_headers):
        """Verify hallazgos response includes codigo_control field when control_id is set"""
        response = requests.get(f"{BASE_URL}/api/hallazgos-auditoria", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if len(data["items"]) > 0:
            # Find a hallazgo with control_id set (non-empty)
            hallazgo_with_control = next((h for h in data["items"] if h.get("control_id")), None)
            
            if hallazgo_with_control:
                # If control_id is set, codigo_control should be enriched
                assert "codigo_control" in hallazgo_with_control, \
                    "Response should include codigo_control field when control_id is present"
                print(f"SUCCESS: Hallazgos with control_id have codigo_control field")
            else:
                # No hallazgos have control_id set - this is expected per context
                print(f"INFO: No hallazgos have control_id assigned - enrichment not applicable")
                print(f"  (This is expected per agent context: existing hallazgos don't have control_id)")


class TestDominiosEndpoint:
    """Test Dominios configuration endpoint"""
    
    def test_dominios_endpoint_returns_list(self, auth_headers):
        """Verify dominios endpoint returns list of dominios"""
        response = requests.get(f"{BASE_URL}/api/config/dominios", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            first_dominio = data[0]
            assert "id" in first_dominio, "Dominio should have id"
            assert "nombre_dominio" in first_dominio, "Dominio should have nombre_dominio"
            print(f"SUCCESS: Dominios endpoint returns {len(data)} dominios")
            print(f"  - First dominio: {first_dominio.get('nombre_dominio')}")
        else:
            print("INFO: No dominios configured yet")


class TestControlesEndpoint:
    """Test Controles configuration endpoint"""
    
    def test_controles_endpoint_returns_list(self, auth_headers):
        """Verify controles endpoint returns list of controles"""
        response = requests.get(f"{BASE_URL}/api/config/controles", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            first_control = data[0]
            assert "id" in first_control, "Control should have id"
            assert "nombre_control" in first_control, "Control should have nombre_control"
            assert "dominio_id" in first_control, "Control should have dominio_id"
            print(f"SUCCESS: Controles endpoint returns {len(data)} controles")
            print(f"  - First control: {first_control.get('codigo_control')} - {first_control.get('nombre_control')}")
        else:
            print("INFO: No controles configured yet")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
