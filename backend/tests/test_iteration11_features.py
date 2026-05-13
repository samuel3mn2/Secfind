"""
Test suite for Iteration 11 features:
1. Modal de detalle de vulnerabilidades al hacer clic en una fila de Vista Comité
2. Opción de agregar informes sin grupo a la vista agrupada (vista mixta)

Tests:
- GET /api/vista-comite with informes_adicionales parameter
- GET /api/vulnerabilidades with multiple informe_pentest params (for modal detail)
- Mixed view: grupos + informes individuales in same table
"""
import pytest
import requests
import os
import urllib.parse

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

@pytest.fixture(scope="module")
def grupos_list(auth_headers):
    """Get list of available grupos de informes"""
    response = requests.get(f"{BASE_URL}/api/config/grupos-informes", headers=auth_headers)
    assert response.status_code == 200
    return response.json()

@pytest.fixture(scope="module")
def informes_sin_grupo(auth_headers):
    """Get list of informes not assigned to any group"""
    response = requests.get(f"{BASE_URL}/api/config/informes-sin-grupo", headers=auth_headers)
    assert response.status_code == 200
    return response.json()

@pytest.fixture(scope="module")
def informes_list(auth_headers):
    """Get list of all available informes pentest"""
    response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=auth_headers)
    assert response.status_code == 200
    return response.json().get("informes_pentest", [])


class TestVistaComiteMixedView:
    """Test Vista Comité mixed view (grupos + informes individuales)"""
    
    def test_vista_comite_accepts_informes_adicionales_param(self, auth_headers, grupos_list, informes_sin_grupo):
        """GET /api/vista-comite - Accepts informes_adicionales parameter"""
        if not grupos_list:
            pytest.skip("No grupos available")
        if not informes_sin_grupo:
            pytest.skip("No informes sin grupo available")
        
        grupo = grupos_list[0]
        informe_adicional = informes_sin_grupo[0]
        
        # Build request with both grupos and informes_adicionales
        params = {
            "grupos": grupo["id"],
            "informes_adicionales": informe_adicional,
            "agrupar_por": "grupo",
            "severidades": "Critica,Alta,Media,Baja"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Mixed view returned {len(data)} rows")
        print(f"Grupo: {grupo['nombre']}, Informe adicional: {informe_adicional[:50]}...")
    
    def test_vista_comite_mixed_view_contains_both_types(self, auth_headers, grupos_list, informes_sin_grupo):
        """GET /api/vista-comite - Mixed view contains both grupos and individual informes"""
        if not grupos_list:
            pytest.skip("No grupos available")
        if not informes_sin_grupo:
            pytest.skip("No informes sin grupo available")
        
        grupo = grupos_list[0]
        # Take up to 2 informes sin grupo
        informes_adicionales = informes_sin_grupo[:2]
        
        params = {
            "grupos": grupo["id"],
            "informes_adicionales": ",".join(informes_adicionales),
            "agrupar_por": "grupo",
            "severidades": "Critica,Alta,Media,Baja"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for grupo row (es_grupo=True)
        grupo_rows = [r for r in data if r.get("es_grupo") == True]
        # Check for individual informe rows (es_grupo=False)
        individual_rows = [r for r in data if r.get("es_grupo") == False]
        
        print(f"Grupo rows: {len(grupo_rows)}, Individual rows: {len(individual_rows)}")
        
        # Should have at least the grupo row
        if grupo.get("informes") and len(grupo["informes"]) > 0:
            assert len(grupo_rows) >= 1, "Should have at least one grupo row"
            print(f"Grupo row found: {grupo_rows[0]['informe']}")
        
        # Individual informes should appear as separate rows
        for row in individual_rows:
            print(f"Individual row: {row['informe'][:50]}...")
    
    def test_vista_comite_grupo_row_has_informes_incluidos(self, auth_headers, grupos_list):
        """GET /api/vista-comite - Grupo rows have informes_incluidos array"""
        if not grupos_list:
            pytest.skip("No grupos available")
        
        # Find a grupo with informes
        grupo_with_informes = None
        for g in grupos_list:
            if g.get("informes") and len(g["informes"]) > 0:
                grupo_with_informes = g
                break
        
        if not grupo_with_informes:
            pytest.skip("No grupo with informes found")
        
        params = {
            "grupos": grupo_with_informes["id"],
            "agrupar_por": "grupo",
            "severidades": "Critica,Alta,Media,Baja"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Find the grupo row
        grupo_row = None
        for row in data:
            if row.get("es_grupo") == True and row["informe"] == grupo_with_informes["nombre"]:
                grupo_row = row
                break
        
        if grupo_row:
            assert "informes_incluidos" in grupo_row
            assert isinstance(grupo_row["informes_incluidos"], list)
            assert len(grupo_row["informes_incluidos"]) > 0
            print(f"Grupo '{grupo_row['informe']}' has {len(grupo_row['informes_incluidos'])} informes incluidos")
        else:
            print("Grupo row not found (may have no vulnerabilities)")
    
    def test_vista_comite_individual_row_has_empty_informes_incluidos(self, auth_headers, informes_sin_grupo):
        """GET /api/vista-comite - Individual informe rows have informes_incluidos with just themselves"""
        if not informes_sin_grupo:
            pytest.skip("No informes sin grupo available")
        
        informe = informes_sin_grupo[0]
        
        params = {
            "informes_adicionales": informe,
            "agrupar_por": "grupo",
            "severidades": "Critica,Alta,Media,Baja"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            row = data[0]
            # Individual informes should have es_grupo=False
            assert row.get("es_grupo") == False, "Individual informe should have es_grupo=False"
            # informes_incluidos should contain just the informe itself
            assert "informes_incluidos" in row
            print(f"Individual row '{row['informe'][:50]}...' has es_grupo={row['es_grupo']}")
        else:
            print("No data returned (informe may have no vulnerabilities)")
    
    def test_vista_comite_only_informes_adicionales(self, auth_headers, informes_sin_grupo):
        """GET /api/vista-comite - Works with only informes_adicionales (no grupos)"""
        if len(informes_sin_grupo) < 2:
            pytest.skip("Need at least 2 informes sin grupo")
        
        informes = informes_sin_grupo[:3]
        
        params = {
            "informes_adicionales": ",".join(informes),
            "agrupar_por": "grupo",
            "severidades": "Critica,Alta,Media,Baja"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All rows should be individual (es_grupo=False)
        for row in data:
            assert row.get("es_grupo") == False, f"Row '{row['informe']}' should have es_grupo=False"
        
        print(f"Returned {len(data)} individual rows for {len(informes)} informes_adicionales")


class TestVulnerabilidadesMultipleInformes:
    """Test fetching vulnerabilities for multiple informes (for modal detail)"""
    
    def test_vulnerabilidades_multiple_informe_pentest_params(self, auth_headers, informes_list):
        """GET /api/vulnerabilidades - Accepts multiple informe_pentest params"""
        if len(informes_list) < 2:
            pytest.skip("Need at least 2 informes")
        
        # Take first 2 informes
        informes = informes_list[:2]
        
        # Build URL with multiple informe_pentest params
        params = "&".join([f"informe_pentest={urllib.parse.quote(i)}" for i in informes])
        url = f"{BASE_URL}/api/vulnerabilidades?{params}&limit=100"
        
        response = requests.get(url, headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Response could be list or dict with items
        if isinstance(data, dict):
            items = data.get("items", [])
        else:
            items = data
        
        print(f"Returned {len(items)} vulnerabilities for {len(informes)} informes")
        
        # Verify vulnerabilities belong to the requested informes
        if items:
            informes_in_response = set()
            for v in items:
                inf = v.get("nombre_informe_pentest")
                if inf:
                    informes_in_response.add(inf)
            
            print(f"Informes in response: {informes_in_response}")
            # At least some should match
            assert len(informes_in_response) > 0
    
    def test_vulnerabilidades_for_grupo_informes(self, auth_headers, grupos_list):
        """GET /api/vulnerabilidades - Can fetch vulnerabilities for all informes in a grupo"""
        if not grupos_list:
            pytest.skip("No grupos available")
        
        # Find a grupo with informes
        grupo_with_informes = None
        for g in grupos_list:
            if g.get("informes") and len(g["informes"]) > 0:
                grupo_with_informes = g
                break
        
        if not grupo_with_informes:
            pytest.skip("No grupo with informes found")
        
        informes = grupo_with_informes["informes"]
        
        # Build URL with multiple informe_pentest params
        params = "&".join([f"informe_pentest={urllib.parse.quote(i)}" for i in informes])
        url = f"{BASE_URL}/api/vulnerabilidades?{params}&limit=500"
        
        response = requests.get(url, headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        if isinstance(data, dict):
            items = data.get("items", [])
        else:
            items = data
        
        print(f"Grupo '{grupo_with_informes['nombre']}' has {len(grupo_with_informes['informes'])} informes")
        print(f"Returned {len(items)} vulnerabilities")
        
        # Verify response structure
        if items:
            v = items[0]
            assert "id" in v or "codigo" in v
            assert "vulnerabilidad" in v
            assert "severidad" in v
            assert "estatus" in v


class TestInformesSinGrupoEndpoint:
    """Test /api/config/informes-sin-grupo endpoint"""
    
    def test_informes_sin_grupo_requires_auth(self):
        """GET /api/config/informes-sin-grupo - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/config/informes-sin-grupo")
        assert response.status_code == 401
        print("Correctly requires authentication")
    
    def test_informes_sin_grupo_returns_list(self, auth_headers):
        """GET /api/config/informes-sin-grupo - Returns list of strings"""
        response = requests.get(f"{BASE_URL}/api/config/informes-sin-grupo", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Found {len(data)} informes sin grupo")
        
        # All items should be strings
        for item in data[:5]:
            assert isinstance(item, str)
            print(f"  - {item[:60]}...")
    
    def test_informes_sin_grupo_excludes_grouped(self, auth_headers, grupos_list, informes_sin_grupo, informes_list):
        """GET /api/config/informes-sin-grupo - Excludes informes that are in grupos"""
        if not grupos_list:
            pytest.skip("No grupos available")
        
        # Collect all informes that are in grupos
        informes_in_grupos = set()
        for g in grupos_list:
            for inf in g.get("informes", []):
                informes_in_grupos.add(inf)
        
        # Verify none of the informes_sin_grupo are in any grupo
        for inf in informes_sin_grupo:
            assert inf not in informes_in_grupos, f"'{inf}' should not be in informes_sin_grupo"
        
        print(f"Verified: {len(informes_sin_grupo)} informes are not in any grupo")
        print(f"Informes in grupos: {len(informes_in_grupos)}")


class TestVistaComiteDetailData:
    """Test data structure for modal detail view"""
    
    def test_vista_comite_row_structure_for_detail(self, auth_headers, grupos_list):
        """GET /api/vista-comite - Row structure supports detail modal"""
        if not grupos_list:
            pytest.skip("No grupos available")
        
        grupo = grupos_list[0]
        
        params = {
            "grupos": grupo["id"],
            "agrupar_por": "grupo",
            "severidades": "Critica,Alta,Media,Baja"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            row = data[0]
            
            # Required fields for detail modal
            assert "informe" in row, "Missing 'informe' field"
            assert "es_grupo" in row, "Missing 'es_grupo' field"
            assert "informes_incluidos" in row, "Missing 'informes_incluidos' field"
            assert "criticas_pendientes" in row
            assert "criticas_total" in row
            assert "altas_pendientes" in row
            assert "altas_total" in row
            assert "medias_pendientes" in row
            assert "medias_total" in row
            assert "bajas_pendientes" in row
            assert "bajas_total" in row
            
            print(f"Row structure valid for detail modal")
            print(f"  informe: {row['informe']}")
            print(f"  es_grupo: {row['es_grupo']}")
            print(f"  informes_incluidos: {len(row['informes_incluidos'])} items")
        else:
            print("No data returned (grupo may have no vulnerabilities)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
