"""
Test suite for Grupos de Informes (Report Groups) feature
Tests CRUD operations for /api/config/grupos-informes endpoints
and /api/vista-comite with agrupar_por=grupo parameter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = "admin"
TEST_PASSWORD = "admin123"


class TestGruposInformesAuth:
    """Test authentication requirements for grupos-informes endpoints"""
    
    def test_get_grupos_requires_auth(self):
        """GET /api/config/grupos-informes requires authentication"""
        response = requests.get(f"{BASE_URL}/api/config/grupos-informes")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/config/grupos-informes requires authentication (401)")
    
    def test_post_grupos_requires_auth(self):
        """POST /api/config/grupos-informes requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            json={"nombre": "Test Group", "informes": []}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/config/grupos-informes requires authentication (401)")
    
    def test_informes_sin_grupo_requires_auth(self):
        """GET /api/config/informes-sin-grupo requires authentication"""
        response = requests.get(f"{BASE_URL}/api/config/informes-sin-grupo")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/config/informes-sin-grupo requires authentication (401)")


class TestGruposInformesCRUD:
    """Test CRUD operations for grupos-informes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": TEST_USER, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_grupo_ids = []
        yield
        # Cleanup: delete any test groups created
        for grupo_id in self.created_grupo_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/config/grupos-informes/{grupo_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_get_grupos_informes(self):
        """GET /api/config/grupos-informes returns list of groups"""
        response = requests.get(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/config/grupos-informes returns {len(data)} groups")
    
    def test_create_grupo_informes(self):
        """POST /api/config/grupos-informes creates a new group"""
        payload = {
            "nombre": "TEST_Grupo_Pytest",
            "descripcion": "Test group created by pytest",
            "informes": []
        }
        response = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["nombre"] == payload["nombre"], "Name should match"
        self.created_grupo_ids.append(data["id"])
        print(f"✓ POST /api/config/grupos-informes creates group with id={data['id']}")
    
    def test_create_grupo_with_informes(self):
        """POST /api/config/grupos-informes creates group with assigned reports"""
        # First get available reports without group
        sin_grupo_response = requests.get(
            f"{BASE_URL}/api/config/informes-sin-grupo",
            headers=self.headers
        )
        assert sin_grupo_response.status_code == 200
        informes_sin_grupo = sin_grupo_response.json()
        
        # Use first available report if any
        informes_to_assign = informes_sin_grupo[:1] if informes_sin_grupo else []
        
        payload = {
            "nombre": "TEST_Grupo_Con_Informes",
            "descripcion": "Test group with reports",
            "informes": informes_to_assign
        }
        response = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["informes"] == informes_to_assign, "Informes should match"
        self.created_grupo_ids.append(data["id"])
        print(f"✓ POST /api/config/grupos-informes creates group with {len(informes_to_assign)} informes")
    
    def test_create_duplicate_grupo_fails(self):
        """POST /api/config/grupos-informes rejects duplicate names"""
        payload = {"nombre": "TEST_Duplicate_Group", "informes": []}
        
        # Create first group
        response1 = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json=payload
        )
        assert response1.status_code == 200
        self.created_grupo_ids.append(response1.json()["id"])
        
        # Try to create duplicate
        response2 = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json=payload
        )
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        print("✓ POST /api/config/grupos-informes rejects duplicate names (400)")
    
    def test_update_grupo_informes(self):
        """PUT /api/config/grupos-informes/{id} updates a group"""
        # Create a group first
        create_response = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json={"nombre": "TEST_Update_Group", "informes": []}
        )
        assert create_response.status_code == 200
        grupo_id = create_response.json()["id"]
        self.created_grupo_ids.append(grupo_id)
        
        # Update the group
        update_payload = {
            "nombre": "TEST_Updated_Group_Name",
            "descripcion": "Updated description"
        }
        update_response = requests.put(
            f"{BASE_URL}/api/config/grupos-informes/{grupo_id}",
            headers=self.headers,
            json=update_payload
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        data = update_response.json()
        assert data["nombre"] == update_payload["nombre"], "Name should be updated"
        assert data["descripcion"] == update_payload["descripcion"], "Description should be updated"
        print("✓ PUT /api/config/grupos-informes/{id} updates group successfully")
    
    def test_update_nonexistent_grupo_fails(self):
        """PUT /api/config/grupos-informes/{id} returns 404 for non-existent group"""
        response = requests.put(
            f"{BASE_URL}/api/config/grupos-informes/nonexistent-id-12345",
            headers=self.headers,
            json={"nombre": "Test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT /api/config/grupos-informes/{id} returns 404 for non-existent group")
    
    def test_delete_grupo_informes(self):
        """DELETE /api/config/grupos-informes/{id} deletes a group"""
        # Create a group first
        create_response = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json={"nombre": "TEST_Delete_Group", "informes": []}
        )
        assert create_response.status_code == 200
        grupo_id = create_response.json()["id"]
        
        # Delete the group
        delete_response = requests.delete(
            f"{BASE_URL}/api/config/grupos-informes/{grupo_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify it's deleted
        get_response = requests.get(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers
        )
        grupos = get_response.json()
        assert not any(g["id"] == grupo_id for g in grupos), "Group should be deleted"
        print("✓ DELETE /api/config/grupos-informes/{id} deletes group successfully")
    
    def test_delete_nonexistent_grupo_fails(self):
        """DELETE /api/config/grupos-informes/{id} returns 404 for non-existent group"""
        response = requests.delete(
            f"{BASE_URL}/api/config/grupos-informes/nonexistent-id-12345",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE /api/config/grupos-informes/{id} returns 404 for non-existent group")


class TestInformesSinGrupo:
    """Test /api/config/informes-sin-grupo endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": TEST_USER, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_informes_sin_grupo(self):
        """GET /api/config/informes-sin-grupo returns unassigned reports"""
        response = requests.get(
            f"{BASE_URL}/api/config/informes-sin-grupo",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/config/informes-sin-grupo returns {len(data)} unassigned reports")


class TestVistaComiteGrouping:
    """Test /api/vista-comite with agrupar_por parameter"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": TEST_USER, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_vista_comite_individual_mode(self):
        """GET /api/vista-comite with agrupar_por=informe returns individual reports"""
        # First get some informes
        options_response = requests.get(
            f"{BASE_URL}/api/dropdown-options",
            headers=self.headers
        )
        assert options_response.status_code == 200
        informes = options_response.json().get("informes_pentest", [])[:3]
        
        if not informes:
            pytest.skip("No informes available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            headers=self.headers,
            params={
                "informes": ",".join(informes),
                "agrupar_por": "informe",
                "severidades": "Critica,Alta,Media,Baja"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # In individual mode, es_grupo should be False
        for item in data:
            assert item.get("es_grupo") == False, "es_grupo should be False in individual mode"
        
        print(f"✓ GET /api/vista-comite with agrupar_por=informe returns {len(data)} items (es_grupo=False)")
    
    def test_vista_comite_group_mode(self):
        """GET /api/vista-comite with agrupar_por=grupo returns grouped data"""
        # First get existing groups
        grupos_response = requests.get(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers
        )
        assert grupos_response.status_code == 200
        grupos = grupos_response.json()
        
        if not grupos:
            pytest.skip("No grupos available for testing")
        
        # Use first group
        grupo_ids = [grupos[0]["id"]]
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            headers=self.headers,
            params={
                "grupos": ",".join(grupo_ids),
                "agrupar_por": "grupo",
                "severidades": "Critica,Alta,Media,Baja"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check that grouped items have es_grupo=True and informes_incluidos
        for item in data:
            if item.get("es_grupo"):
                assert "informes_incluidos" in item, "Grouped items should have informes_incluidos"
                assert isinstance(item["informes_incluidos"], list), "informes_incluidos should be a list"
        
        print(f"✓ GET /api/vista-comite with agrupar_por=grupo returns {len(data)} items")
    
    def test_vista_comite_group_mode_has_es_grupo_true(self):
        """GET /api/vista-comite with agrupar_por=grupo sets es_grupo=true for groups"""
        # Get existing groups with informes
        grupos_response = requests.get(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers
        )
        assert grupos_response.status_code == 200
        grupos = grupos_response.json()
        
        # Find a group with informes
        grupo_with_informes = next((g for g in grupos if g.get("informes")), None)
        
        if not grupo_with_informes:
            pytest.skip("No grupos with informes available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            headers=self.headers,
            params={
                "grupos": grupo_with_informes["id"],
                "agrupar_por": "grupo",
                "severidades": "Critica,Alta,Media,Baja"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find the group in response
        group_item = next((item for item in data if item["informe"] == grupo_with_informes["nombre"]), None)
        
        if group_item:
            assert group_item.get("es_grupo") == True, "es_grupo should be True for group items"
            assert len(group_item.get("informes_incluidos", [])) > 0, "informes_incluidos should not be empty"
            print(f"✓ Group '{grupo_with_informes['nombre']}' has es_grupo=True and {len(group_item['informes_incluidos'])} informes_incluidos")
        else:
            print(f"✓ Vista comite returned {len(data)} items (group may have no vulnerabilities)")
    
    def test_vista_comite_empty_params(self):
        """GET /api/vista-comite with no informes returns empty list"""
        response = requests.get(
            f"{BASE_URL}/api/vista-comite",
            headers=self.headers,
            params={
                "informes": "",
                "agrupar_por": "informe",
                "severidades": "Critica,Alta,Media,Baja"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data == [], "Empty informes should return empty list"
        print("✓ GET /api/vista-comite with empty informes returns empty list")


class TestGruposInformesValidation:
    """Test validation rules for grupos-informes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": TEST_USER, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_grupo_ids = []
        yield
        # Cleanup
        for grupo_id in self.created_grupo_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/config/grupos-informes/{grupo_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_informe_cannot_be_in_multiple_groups(self):
        """An informe cannot be assigned to multiple groups"""
        # Get an available informe
        sin_grupo_response = requests.get(
            f"{BASE_URL}/api/config/informes-sin-grupo",
            headers=self.headers
        )
        assert sin_grupo_response.status_code == 200
        informes_sin_grupo = sin_grupo_response.json()
        
        if not informes_sin_grupo:
            pytest.skip("No unassigned informes available for testing")
        
        test_informe = informes_sin_grupo[0]
        
        # Create first group with the informe
        response1 = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json={"nombre": "TEST_Group_1", "informes": [test_informe]}
        )
        assert response1.status_code == 200
        self.created_grupo_ids.append(response1.json()["id"])
        
        # Try to create second group with same informe
        response2 = requests.post(
            f"{BASE_URL}/api/config/grupos-informes",
            headers=self.headers,
            json={"nombre": "TEST_Group_2", "informes": [test_informe]}
        )
        assert response2.status_code == 400, f"Expected 400, got {response2.status_code}"
        assert "ya pertenece" in response2.json().get("detail", "").lower() or "already" in response2.json().get("detail", "").lower()
        print(f"✓ Informe '{test_informe}' cannot be assigned to multiple groups (400)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
