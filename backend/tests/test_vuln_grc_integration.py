"""
Test Vulnerabilidades GRC Integration
Tests for control_id and riesgo_id fields in vulnerabilidades
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVulnerabilidadesGRCIntegration:
    """Test GRC integration in Vulnerabilidades module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get existing GRC data
        self.dominios = self.session.get(f"{BASE_URL}/api/config/dominios").json()
        self.controles = self.session.get(f"{BASE_URL}/api/config/controles").json()
        self.riesgos = self.session.get(f"{BASE_URL}/api/catalogo-riesgos/all").json()
        
        yield
        
        # Cleanup: Delete test vulnerabilities
        vulns = self.session.get(f"{BASE_URL}/api/vulnerabilidades?search=TEST-GRC").json()
        for vuln in vulns:
            self.session.delete(f"{BASE_URL}/api/vulnerabilidades/{vuln['id']}")
    
    def test_dominios_endpoint_returns_all_dominios(self):
        """Test GET /api/config/dominios returns all dominios"""
        response = self.session.get(f"{BASE_URL}/api/config/dominios")
        assert response.status_code == 200
        
        dominios = response.json()
        assert isinstance(dominios, list)
        assert len(dominios) >= 6, "Should have at least 6 seed dominios"
        
        # Check expected dominios exist
        dominio_names = [d['nombre_dominio'] for d in dominios]
        expected_dominios = [
            "Gestión de Identidades",
            "Seguridad EndPoints",
            "Seguridad de Aplicaciones",
            "Seguridad de Datos",
            "Seguridad de Red y Perímetro"
        ]
        for expected in expected_dominios:
            assert expected in dominio_names, f"Missing dominio: {expected}"
        
        print(f"✓ Found {len(dominios)} dominios")
    
    def test_controles_endpoint_returns_all_controles(self):
        """Test GET /api/config/controles returns all controles"""
        response = self.session.get(f"{BASE_URL}/api/config/controles")
        assert response.status_code == 200
        
        controles = response.json()
        assert isinstance(controles, list)
        assert len(controles) >= 4, "Should have at least 4 seed controles"
        
        # Check controles have required fields
        for control in controles:
            assert 'id' in control
            assert 'dominio_id' in control
            assert 'nombre_control' in control
            assert 'nombre_dominio' in control  # Enriched field
        
        print(f"✓ Found {len(controles)} controles")
    
    def test_controles_filter_by_dominio(self):
        """Test GET /api/config/controles?dominio_id=X filters correctly"""
        # Find Seguridad EndPoints dominio
        ep_dominio = next((d for d in self.dominios if 'EndPoints' in d['nombre_dominio']), None)
        assert ep_dominio is not None, "Seguridad EndPoints dominio not found"
        
        response = self.session.get(f"{BASE_URL}/api/config/controles?dominio_id={ep_dominio['id']}")
        assert response.status_code == 200
        
        controles = response.json()
        assert len(controles) == 4, f"Expected 4 controls for Seguridad EndPoints, got {len(controles)}"
        
        # All controls should belong to this dominio
        for control in controles:
            assert control['dominio_id'] == ep_dominio['id']
            assert 'CTRL-EP' in control.get('codigo_control', '')
        
        print(f"✓ Filtered {len(controles)} controles for Seguridad EndPoints")
    
    def test_catalogo_riesgos_all_endpoint(self):
        """Test GET /api/catalogo-riesgos/all returns all riesgos"""
        response = self.session.get(f"{BASE_URL}/api/catalogo-riesgos/all")
        assert response.status_code == 200
        
        riesgos = response.json()
        assert isinstance(riesgos, list)
        assert len(riesgos) >= 1, "Should have at least 1 seed riesgo"
        
        # Check R-0001 exists
        r0001 = next((r for r in riesgos if r['codigo_riesgo'] == 'R-0001'), None)
        assert r0001 is not None, "R-0001 riesgo not found"
        assert r0001['nombre_corto'] == 'Fraude de identidad masivo'
        
        print(f"✓ Found {len(riesgos)} riesgos in catalog")
    
    def test_create_vulnerabilidad_with_control_id(self):
        """Test creating a vulnerability with control_id"""
        # Get a control
        control = self.controles[0] if self.controles else None
        assert control is not None, "No controls available"
        
        vuln_data = {
            "codigo": "TEST-GRC-001",
            "fecha_hallazgo": "2026-01-27",
            "institucion": "BHD",
            "vulnerabilidad": "Test vulnerability with control_id",
            "severidad": "Media",
            "estatus": "Pendiente",
            "control_id": control['id']
        }
        
        response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=vuln_data)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        created = response.json()
        assert created['control_id'] == control['id']
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/vulnerabilidades/{created['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched['control_id'] == control['id']
        
        print(f"✓ Created vulnerability with control_id: {control['id']}")
    
    def test_create_vulnerabilidad_with_riesgo_id(self):
        """Test creating a vulnerability with riesgo_id"""
        # Get a riesgo
        riesgo = self.riesgos[0] if self.riesgos else None
        assert riesgo is not None, "No riesgos available"
        
        vuln_data = {
            "codigo": "TEST-GRC-002",
            "fecha_hallazgo": "2026-01-27",
            "institucion": "BHD",
            "vulnerabilidad": "Test vulnerability with riesgo_id",
            "severidad": "Alta",
            "estatus": "Pendiente",
            "riesgo_id": riesgo['id']
        }
        
        response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=vuln_data)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        created = response.json()
        assert created['riesgo_id'] == riesgo['id']
        
        # Verify by GET
        get_response = self.session.get(f"{BASE_URL}/api/vulnerabilidades/{created['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched['riesgo_id'] == riesgo['id']
        
        print(f"✓ Created vulnerability with riesgo_id: {riesgo['id']}")
    
    def test_create_vulnerabilidad_with_both_control_and_riesgo(self):
        """Test creating a vulnerability with both control_id and riesgo_id"""
        control = self.controles[0] if self.controles else None
        riesgo = self.riesgos[0] if self.riesgos else None
        
        assert control is not None, "No controls available"
        assert riesgo is not None, "No riesgos available"
        
        vuln_data = {
            "codigo": "TEST-GRC-003",
            "fecha_hallazgo": "2026-01-27",
            "institucion": "BHD",
            "vulnerabilidad": "Test vulnerability with both control_id and riesgo_id",
            "severidad": "Critica",
            "estatus": "Pendiente",
            "control_id": control['id'],
            "riesgo_id": riesgo['id']
        }
        
        response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=vuln_data)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        created = response.json()
        assert created['control_id'] == control['id']
        assert created['riesgo_id'] == riesgo['id']
        
        print(f"✓ Created vulnerability with both control_id and riesgo_id")
    
    def test_update_vulnerabilidad_control_id(self):
        """Test updating a vulnerability's control_id"""
        # Create a vulnerability first
        vuln_data = {
            "codigo": "TEST-GRC-004",
            "fecha_hallazgo": "2026-01-27",
            "institucion": "BHD",
            "vulnerabilidad": "Test vulnerability for update",
            "severidad": "Baja",
            "estatus": "Pendiente"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=vuln_data)
        assert create_response.status_code == 200
        created = create_response.json()
        
        # Update with control_id
        control = self.controles[0] if self.controles else None
        assert control is not None
        
        update_response = self.session.put(
            f"{BASE_URL}/api/vulnerabilidades/{created['id']}",
            json={"control_id": control['id']}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/vulnerabilidades/{created['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched['control_id'] == control['id']
        
        print(f"✓ Updated vulnerability control_id successfully")
    
    def test_update_vulnerabilidad_riesgo_id(self):
        """Test updating a vulnerability's riesgo_id"""
        # Create a vulnerability first
        vuln_data = {
            "codigo": "TEST-GRC-005",
            "fecha_hallazgo": "2026-01-27",
            "institucion": "BHD",
            "vulnerabilidad": "Test vulnerability for riesgo update",
            "severidad": "Media",
            "estatus": "Pendiente"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/vulnerabilidades", json=vuln_data)
        assert create_response.status_code == 200
        created = create_response.json()
        
        # Update with riesgo_id
        riesgo = self.riesgos[0] if self.riesgos else None
        assert riesgo is not None
        
        update_response = self.session.put(
            f"{BASE_URL}/api/vulnerabilidades/{created['id']}",
            json={"riesgo_id": riesgo['id']}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/vulnerabilidades/{created['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched['riesgo_id'] == riesgo['id']
        
        print(f"✓ Updated vulnerability riesgo_id successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
