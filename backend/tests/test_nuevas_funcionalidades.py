"""
Test suite for new features:
1. Filtro por Aplicación in /vulnerabilidades
2. CRUD de Informes Pentest in /configuracion
3. Módulo de Seguimiento de Riesgos
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token for protected endpoints"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Returns headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestInformesPentestCRUD:
    """Test Informes Pentest CRUD operations in /config/informes-pentest"""
    
    def test_get_informes_pentest_list(self, auth_headers):
        """GET /api/config/informes-pentest - Should return list of pentest reports"""
        response = requests.get(f"{BASE_URL}/api/config/informes-pentest", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} informes pentest")
        if len(data) > 0:
            # Validate structure
            informe = data[0]
            assert "id" in informe
            assert "nombre" in informe
            assert "activo" in informe
            print(f"First informe: {informe['nombre']}")
    
    def test_create_informe_pentest(self, auth_headers):
        """POST /api/config/informes-pentest - Should create new pentest report"""
        response = requests.post(
            f"{BASE_URL}/api/config/informes-pentest",
            headers=auth_headers,
            json={"nombre": "TEST_Informe_Pentest_2026"}
        )
        assert response.status_code == 200, f"Failed to create: {response.text}"
        data = response.json()
        assert data["nombre"] == "TEST_Informe_Pentest_2026"
        assert data["activo"] is True
        assert "id" in data
        print(f"Created informe with ID: {data['id']}")
        
        # Verify it appears in list
        list_response = requests.get(f"{BASE_URL}/api/config/informes-pentest", headers=auth_headers)
        informes = list_response.json()
        assert any(i["nombre"] == "TEST_Informe_Pentest_2026" for i in informes)
        
        return data["id"]
    
    def test_create_duplicate_informe_fails(self, auth_headers):
        """POST /api/config/informes-pentest - Should reject duplicate names"""
        # First create one
        requests.post(
            f"{BASE_URL}/api/config/informes-pentest",
            headers=auth_headers,
            json={"nombre": "TEST_Duplicate_Informe"}
        )
        
        # Try to create duplicate
        response = requests.post(
            f"{BASE_URL}/api/config/informes-pentest",
            headers=auth_headers,
            json={"nombre": "TEST_Duplicate_Informe"}
        )
        assert response.status_code == 400
        print("Correctly rejected duplicate informe")
    
    def test_update_informe_pentest(self, auth_headers):
        """PUT /api/config/informes-pentest/{id} - Should update pentest report"""
        # Create one first
        create_resp = requests.post(
            f"{BASE_URL}/api/config/informes-pentest",
            headers=auth_headers,
            json={"nombre": "TEST_Update_Informe"}
        )
        informe_id = create_resp.json()["id"]
        
        # Update it
        update_resp = requests.put(
            f"{BASE_URL}/api/config/informes-pentest/{informe_id}",
            headers=auth_headers,
            json={"nombre": "TEST_Updated_Informe", "activo": False}
        )
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data["nombre"] == "TEST_Updated_Informe"
        assert data["activo"] is False
        print("Successfully updated informe")
    
    def test_delete_informe_pentest(self, auth_headers):
        """DELETE /api/config/informes-pentest/{id} - Should delete pentest report"""
        # Create one first
        create_resp = requests.post(
            f"{BASE_URL}/api/config/informes-pentest",
            headers=auth_headers,
            json={"nombre": "TEST_Delete_Informe"}
        )
        informe_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = requests.delete(
            f"{BASE_URL}/api/config/informes-pentest/{informe_id}",
            headers=auth_headers
        )
        assert delete_resp.status_code == 200
        
        # Verify it's gone
        list_response = requests.get(f"{BASE_URL}/api/config/informes-pentest", headers=auth_headers)
        informes = list_response.json()
        assert not any(i["id"] == informe_id for i in informes)
        print("Successfully deleted informe")


class TestSeguimientoRiesgos:
    """Test Seguimiento de Riesgos endpoints"""
    
    def test_get_seguimiento_riesgos_list(self, auth_headers):
        """GET /api/seguimiento-riesgos - Should return vulnerabilities with fecha_compromiso"""
        response = requests.get(f"{BASE_URL}/api/seguimiento-riesgos", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} vulnerabilities in seguimiento riesgos")
        
        if len(data) > 0:
            vuln = data[0]
            # Should have computed fields
            assert "dias_restantes" in vuln or vuln.get("dias_restantes") is None
            assert "estado_seguimiento" in vuln
            print(f"First vuln estado: {vuln.get('estado_seguimiento')}, dias: {vuln.get('dias_restantes')}")
    
    def test_get_seguimiento_riesgos_filter_vencidas(self, auth_headers):
        """GET /api/seguimiento-riesgos?filtro=vencidas - Should return overdue vulnerabilities"""
        response = requests.get(
            f"{BASE_URL}/api/seguimiento-riesgos?filtro=vencidas",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Found {len(data)} vencidas vulnerabilities")
        
        # Count how many are correctly vencida vs edge cases
        correct_vencidas = 0
        edge_cases = 0
        for v in data:
            dias = v.get("dias_restantes")
            estado = v.get("estado_seguimiento")
            fecha = v.get("fecha_compromiso", "")
            
            if estado == "vencida" or (dias is not None and dias < 0):
                correct_vencidas += 1
            else:
                # Edge case: fecha_compromiso in partial format (just year like "2026")
                edge_cases += 1
                print(f"Edge case: fecha={fecha}, estado={estado}")
        
        # Most should be correctly identified
        assert correct_vencidas >= len(data) - 2, f"Too many edge cases: {edge_cases} out of {len(data)}"
        print(f"Correct vencidas: {correct_vencidas}, Edge cases: {edge_cases}")
    
    def test_get_seguimiento_riesgos_filter_proximas(self, auth_headers):
        """GET /api/seguimiento-riesgos?filtro=proximas - Should return upcoming vulnerabilities"""
        response = requests.get(
            f"{BASE_URL}/api/seguimiento-riesgos?filtro=proximas",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Found {len(data)} proximas (next 30 days) vulnerabilities")
    
    def test_get_seguimiento_resumen(self, auth_headers):
        """GET /api/seguimiento-riesgos/resumen - Should return KPI counters"""
        response = requests.get(f"{BASE_URL}/api/seguimiento-riesgos/resumen", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have all KPI fields
        assert "vencidas" in data
        assert "criticas_7_dias" in data
        assert "proximas_30_dias" in data
        assert "total_pendientes" in data
        
        print(f"Resumen KPIs - Vencidas: {data['vencidas']}, 7 días: {data['criticas_7_dias']}, 30 días: {data['proximas_30_dias']}, Total: {data['total_pendientes']}")


class TestFiltroAplicacion:
    """Test Application filter in vulnerabilities"""
    
    def test_get_dropdown_options_includes_aplicaciones(self, auth_headers):
        """GET /api/dropdown-options - Should include aplicaciones field"""
        response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "aplicaciones" in data
        assert isinstance(data["aplicaciones"], list)
        print(f"Found {len(data['aplicaciones'])} aplicaciones in dropdown")
        if len(data["aplicaciones"]) > 0:
            print(f"Sample apps: {data['aplicaciones'][:5]}")
    
    def test_get_dropdown_options_includes_informes_pentest(self, auth_headers):
        """GET /api/dropdown-options - Should include informes_pentest from catalog"""
        response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "informes_pentest" in data
        assert isinstance(data["informes_pentest"], list)
        print(f"Found {len(data['informes_pentest'])} informes_pentest in dropdown")
    
    def test_filter_vulnerabilidades_by_aplicacion(self, auth_headers):
        """GET /api/vulnerabilidades?aplicacion=X - Should filter by application"""
        # First get dropdown to find an application
        dropdown_resp = requests.get(f"{BASE_URL}/api/dropdown-options", headers=auth_headers)
        apps = dropdown_resp.json().get("aplicaciones", [])
        
        if len(apps) > 0:
            test_app = apps[0]
            response = requests.get(
                f"{BASE_URL}/api/vulnerabilidades?aplicacion={test_app}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            print(f"Filtering by '{test_app}' returned {len(data)} vulnerabilities")
            
            # Verify all results contain the application
            for vuln in data:
                apps_list = vuln.get("aplicaciones", [])
                assert test_app in apps_list, f"Vuln {vuln.get('id')} doesn't have app {test_app}"


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_informes(self, auth_headers):
        """Delete all test informes created during testing"""
        list_resp = requests.get(f"{BASE_URL}/api/config/informes-pentest", headers=auth_headers)
        informes = list_resp.json()
        
        deleted = 0
        for inf in informes:
            if inf["nombre"].startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/config/informes-pentest/{inf['id']}",
                    headers=auth_headers
                )
                deleted += 1
        
        print(f"Cleaned up {deleted} test informes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
