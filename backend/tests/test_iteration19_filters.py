"""
Test Iteration 19: Multi-select filters for Vulnerabilidades and Hallazgos de Auditoría

Features tested:
1. Vulnerabilidades: Filtro Año es multi-select (permite seleccionar varios años)
2. Vulnerabilidades: Filtro Dominio funciona correctamente
3. Vulnerabilidades: Filtro Control funciona correctamente
4. Hallazgos: Filtro Año es multi-select
5. Hallazgos: Filtro Responsable es multi-select
6. Hallazgos: Filtro Dominio funciona correctamente
7. Hallazgos: Filtro Control funciona correctamente
8. Backend Vulnerabilidades: Soporta múltiples años en query params
9. Backend Hallazgos: Soporta filtros año, responsable, dominio, control
"""
import pytest
import requests
import os
from urllib.parse import urlencode

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://secfind-board.preview.emergentagent.com')

class TestVulnerabilidadesFilters:
    """Test multi-select filters for Vulnerabilidades"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_vulnerabilidades_single_year_filter(self):
        """Test filtering vulnerabilidades by a single year"""
        # año parameter with URL encoding for ñ
        response = requests.get(
            f"{BASE_URL}/api/vulnerabilidades",
            params={"año": "2024"},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all returned items have fecha_hallazgo starting with 2024
        for vuln in data:
            if vuln.get("fecha_hallazgo"):
                assert vuln["fecha_hallazgo"].startswith("2024"), f"Expected 2024, got {vuln['fecha_hallazgo']}"
        
        print(f"Single year filter (2024): {len(data)} vulnerabilidades")
    
    def test_vulnerabilidades_multi_year_filter(self):
        """Test filtering vulnerabilidades by multiple years (multi-select)"""
        # Test with multiple año parameters
        response = requests.get(
            f"{BASE_URL}/api/vulnerabilidades?año=2024&año=2025",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all returned items have fecha_hallazgo starting with 2024 or 2025
        for vuln in data:
            if vuln.get("fecha_hallazgo"):
                year = vuln["fecha_hallazgo"][:4]
                assert year in ["2024", "2025"], f"Expected 2024 or 2025, got {year}"
        
        # Get counts for individual years to verify multi-select returns union
        resp_2024 = requests.get(f"{BASE_URL}/api/vulnerabilidades?año=2024", headers=self.headers)
        resp_2025 = requests.get(f"{BASE_URL}/api/vulnerabilidades?año=2025", headers=self.headers)
        
        count_2024 = len(resp_2024.json())
        count_2025 = len(resp_2025.json())
        count_combined = len(data)
        
        # Combined should be >= max of individual (union)
        assert count_combined >= max(count_2024, count_2025), "Multi-year filter should return union of results"
        print(f"Multi-year filter: 2024={count_2024}, 2025={count_2025}, combined={count_combined}")
    
    def test_vulnerabilidades_dominio_filter(self):
        """Test filtering vulnerabilidades by dominio"""
        # First get available dominios
        resp_dominios = requests.get(f"{BASE_URL}/api/config/dominios", headers=self.headers)
        assert resp_dominios.status_code == 200
        dominios = resp_dominios.json()
        
        if dominios:
            dominio_name = dominios[0]["nombre_dominio"]
            
            # Filter by dominio
            response = requests.get(
                f"{BASE_URL}/api/vulnerabilidades",
                params={"dominio": dominio_name},
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify all returned items have the specified dominio
            for vuln in data:
                assert vuln.get("nombre_dominio") == dominio_name, f"Expected {dominio_name}, got {vuln.get('nombre_dominio')}"
            
            print(f"Dominio filter ({dominio_name}): {len(data)} vulnerabilidades")
        else:
            pytest.skip("No dominios available for testing")
    
    def test_vulnerabilidades_control_filter(self):
        """Test filtering vulnerabilidades by control"""
        # First get available controles
        resp_controles = requests.get(f"{BASE_URL}/api/config/controles", headers=self.headers)
        assert resp_controles.status_code == 200
        controles = resp_controles.json()
        
        if controles:
            control_code = controles[0].get("codigo_control")
            if control_code:
                # Filter by control
                response = requests.get(
                    f"{BASE_URL}/api/vulnerabilidades",
                    params={"control": control_code},
                    headers=self.headers
                )
                assert response.status_code == 200
                data = response.json()
                
                # Verify all returned items have the specified control
                for vuln in data:
                    assert vuln.get("codigo_control") == control_code, f"Expected {control_code}, got {vuln.get('codigo_control')}"
                
                print(f"Control filter ({control_code}): {len(data)} vulnerabilidades")
            else:
                pytest.skip("No control codes available for testing")
        else:
            pytest.skip("No controles available for testing")
    
    def test_vulnerabilidades_combined_filters(self):
        """Test combining multiple filters"""
        response = requests.get(
            f"{BASE_URL}/api/vulnerabilidades?año=2024&severidad=Alta",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify filters are applied
        for vuln in data:
            if vuln.get("fecha_hallazgo"):
                assert vuln["fecha_hallazgo"].startswith("2024")
            assert vuln.get("severidad") == "Alta"
        
        print(f"Combined filters (2024 + Alta): {len(data)} vulnerabilidades")


class TestHallazgosFilters:
    """Test multi-select filters for Hallazgos de Auditoría"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_hallazgos_single_year_filter(self):
        """Test filtering hallazgos by a single year"""
        response = requests.get(
            f"{BASE_URL}/api/hallazgos-auditoria",
            params={"año": "2026"},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all returned items have fecha_hallazgo starting with 2026
        for hallazgo in data.get("items", []):
            if hallazgo.get("fecha_hallazgo"):
                assert hallazgo["fecha_hallazgo"].startswith("2026"), f"Expected 2026, got {hallazgo['fecha_hallazgo']}"
        
        print(f"Single year filter (2026): {data.get('total', 0)} hallazgos")
    
    def test_hallazgos_multi_year_filter(self):
        """Test filtering hallazgos by multiple years (multi-select)"""
        response = requests.get(
            f"{BASE_URL}/api/hallazgos-auditoria?año=2025&año=2026",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all returned items have fecha_hallazgo starting with 2025 or 2026
        for hallazgo in data.get("items", []):
            if hallazgo.get("fecha_hallazgo"):
                year = hallazgo["fecha_hallazgo"][:4]
                assert year in ["2025", "2026"], f"Expected 2025 or 2026, got {year}"
        
        print(f"Multi-year filter (2025+2026): {data.get('total', 0)} hallazgos")
    
    def test_hallazgos_responsable_filter(self):
        """Test filtering hallazgos by responsable"""
        # First get available responsables
        resp_responsables = requests.get(f"{BASE_URL}/api/config/responsables", headers=self.headers)
        assert resp_responsables.status_code == 200
        responsables = resp_responsables.json()
        
        if responsables:
            responsable_name = responsables[0]["nombre"]
            
            # Filter by responsable
            response = requests.get(
                f"{BASE_URL}/api/hallazgos-auditoria",
                params={"responsable": responsable_name},
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify all returned items have the specified responsable
            for hallazgo in data.get("items", []):
                assert hallazgo.get("responsable") == responsable_name, f"Expected {responsable_name}, got {hallazgo.get('responsable')}"
            
            print(f"Responsable filter ({responsable_name}): {data.get('total', 0)} hallazgos")
        else:
            pytest.skip("No responsables available for testing")
    
    def test_hallazgos_multi_responsable_filter(self):
        """Test filtering hallazgos by multiple responsables (multi-select)"""
        # First get available responsables
        resp_responsables = requests.get(f"{BASE_URL}/api/config/responsables", headers=self.headers)
        assert resp_responsables.status_code == 200
        responsables = resp_responsables.json()
        
        if len(responsables) >= 2:
            resp1 = responsables[0]["nombre"]
            resp2 = responsables[1]["nombre"]
            
            # Filter by multiple responsables
            response = requests.get(
                f"{BASE_URL}/api/hallazgos-auditoria?responsable={resp1}&responsable={resp2}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify all returned items have one of the specified responsables
            for hallazgo in data.get("items", []):
                if hallazgo.get("responsable"):
                    assert hallazgo["responsable"] in [resp1, resp2], f"Expected {resp1} or {resp2}, got {hallazgo['responsable']}"
            
            print(f"Multi-responsable filter ({resp1}, {resp2}): {data.get('total', 0)} hallazgos")
        else:
            pytest.skip("Not enough responsables for multi-select testing")
    
    def test_hallazgos_dominio_filter(self):
        """Test filtering hallazgos by dominio"""
        # First get available dominios
        resp_dominios = requests.get(f"{BASE_URL}/api/config/dominios", headers=self.headers)
        assert resp_dominios.status_code == 200
        dominios = resp_dominios.json()
        
        if dominios:
            dominio_name = dominios[0]["nombre_dominio"]
            
            # Filter by dominio
            response = requests.get(
                f"{BASE_URL}/api/hallazgos-auditoria",
                params={"dominio": dominio_name},
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify all returned items have the specified dominio
            for hallazgo in data.get("items", []):
                if hallazgo.get("nombre_dominio"):
                    assert hallazgo["nombre_dominio"] == dominio_name, f"Expected {dominio_name}, got {hallazgo.get('nombre_dominio')}"
            
            print(f"Dominio filter ({dominio_name}): {data.get('total', 0)} hallazgos")
        else:
            pytest.skip("No dominios available for testing")
    
    def test_hallazgos_control_filter(self):
        """Test filtering hallazgos by control"""
        # First get available controles
        resp_controles = requests.get(f"{BASE_URL}/api/config/controles", headers=self.headers)
        assert resp_controles.status_code == 200
        controles = resp_controles.json()
        
        if controles:
            control_code = controles[0].get("codigo_control")
            if control_code:
                # Filter by control
                response = requests.get(
                    f"{BASE_URL}/api/hallazgos-auditoria",
                    params={"control": control_code},
                    headers=self.headers
                )
                assert response.status_code == 200
                data = response.json()
                
                # Verify all returned items have the specified control
                for hallazgo in data.get("items", []):
                    if hallazgo.get("codigo_control"):
                        assert hallazgo["codigo_control"] == control_code, f"Expected {control_code}, got {hallazgo.get('codigo_control')}"
                
                print(f"Control filter ({control_code}): {data.get('total', 0)} hallazgos")
            else:
                pytest.skip("No control codes available for testing")
        else:
            pytest.skip("No controles available for testing")
    
    def test_hallazgos_combined_filters(self):
        """Test combining multiple filters"""
        response = requests.get(
            f"{BASE_URL}/api/hallazgos-auditoria?estado=Abierto",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify estado filter is applied
        for hallazgo in data.get("items", []):
            assert hallazgo.get("estado") == "Abierto"
        
        print(f"Estado filter (Abierto): {data.get('total', 0)} hallazgos")


class TestDropdownOptions:
    """Test that dropdown options endpoint returns correct data for filters"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dropdown_options_has_years(self):
        """Test that dropdown options includes años for year filter"""
        response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "años" in data, "dropdown-options should include 'años'"
        assert isinstance(data["años"], list), "'años' should be a list"
        assert len(data["años"]) > 0, "'años' should not be empty"
        
        print(f"Available years: {data['años']}")
    
    def test_dropdown_options_has_responsables(self):
        """Test that dropdown options includes responsables"""
        response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "responsables" in data, "dropdown-options should include 'responsables'"
        assert isinstance(data["responsables"], list), "'responsables' should be a list"
        
        print(f"Available responsables: {len(data['responsables'])}")
    
    def test_dominios_endpoint(self):
        """Test that dominios endpoint returns data for dominio filter"""
        response = requests.get(f"{BASE_URL}/api/config/dominios", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "dominios should be a list"
        if data:
            assert "nombre_dominio" in data[0], "dominio should have 'nombre_dominio'"
        
        print(f"Available dominios: {len(data)}")
    
    def test_controles_endpoint(self):
        """Test that controles endpoint returns data for control filter"""
        response = requests.get(f"{BASE_URL}/api/config/controles", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "controles should be a list"
        if data:
            assert "codigo_control" in data[0] or "nombre_control" in data[0], "control should have codigo or nombre"
        
        print(f"Available controles: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
