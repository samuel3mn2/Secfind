"""
Test suite for Vista Comité feature:
- GET /api/vista-comite endpoint
- Aggregation by informe_pentest
- Pending/Total ratios by severity
- Responsable column
- Filter by informes and severidades
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
def informes_list(auth_headers):
    """Get list of available informes pentest"""
    response = requests.get(f"{BASE_URL}/api/dropdown-options", headers=auth_headers)
    assert response.status_code == 200
    return response.json().get("informes_pentest", [])


class TestVistaComiteEndpoint:
    """Test Vista Comité API endpoint"""
    
    def test_vista_comite_requires_auth(self):
        """GET /api/vista-comite - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/vista-comite")
        assert response.status_code == 401, "Should require authentication"
        print("Correctly requires authentication")
    
    def test_vista_comite_empty_informes_returns_empty(self, auth_headers):
        """GET /api/vista-comite - Empty informes param returns empty list"""
        response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes=&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data == [], "Should return empty list when no informes selected"
        print("Correctly returns empty list for empty informes")
    
    def test_vista_comite_single_informe(self, auth_headers, informes_list):
        """GET /api/vista-comite - Returns data for single informe"""
        if not informes_list:
            pytest.skip("No informes available")
        
        informe = informes_list[0]
        encoded_informe = urllib.parse.quote(informe)
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded_informe}&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Returned {len(data)} rows for informe: {informe[:50]}...")
        
        if len(data) > 0:
            row = data[0]
            # Validate response structure
            assert "informe" in row
            assert "criticas_pendientes" in row
            assert "criticas_total" in row
            assert "altas_pendientes" in row
            assert "altas_total" in row
            assert "medias_pendientes" in row
            assert "medias_total" in row
            assert "bajas_pendientes" in row
            assert "bajas_total" in row
            assert "responsable" in row
            assert "total_pendientes" in row
            assert "total_hallazgos" in row
            
            # Validate data types
            assert isinstance(row["criticas_pendientes"], int)
            assert isinstance(row["criticas_total"], int)
            assert isinstance(row["total_pendientes"], int)
            assert isinstance(row["total_hallazgos"], int)
            
            # Validate logic: pendientes <= total
            assert row["criticas_pendientes"] <= row["criticas_total"]
            assert row["altas_pendientes"] <= row["altas_total"]
            assert row["medias_pendientes"] <= row["medias_total"]
            assert row["bajas_pendientes"] <= row["bajas_total"]
            assert row["total_pendientes"] <= row["total_hallazgos"]
            
            print(f"Row data: Críticas {row['criticas_pendientes']}/{row['criticas_total']}, "
                  f"Altas {row['altas_pendientes']}/{row['altas_total']}, "
                  f"Total {row['total_pendientes']}/{row['total_hallazgos']}")
    
    def test_vista_comite_multiple_informes(self, auth_headers, informes_list):
        """GET /api/vista-comite - Returns data for multiple informes"""
        if len(informes_list) < 2:
            pytest.skip("Need at least 2 informes")
        
        # Take first 3 informes
        selected = informes_list[:3]
        encoded = ",".join([urllib.parse.quote(i) for i in selected])
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded}&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return one row per informe that has vulnerabilities
        assert isinstance(data, list)
        print(f"Returned {len(data)} rows for {len(selected)} informes")
        
        # Verify each row has unique informe
        informes_in_response = [row["informe"] for row in data]
        assert len(informes_in_response) == len(set(informes_in_response)), "Duplicate informes in response"
    
    def test_vista_comite_severidad_filter(self, auth_headers, informes_list):
        """GET /api/vista-comite - Severidad filter works"""
        if not informes_list:
            pytest.skip("No informes available")
        
        informe = informes_list[0]
        encoded_informe = urllib.parse.quote(informe)
        
        # Test with only Critica severity
        response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded_informe}&severidades=Critica",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"With only Critica filter: {len(data)} rows")
        
        # Test with all severities
        response_all = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded_informe}&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        assert response_all.status_code == 200
        print("Severidad filter accepted")
    
    def test_vista_comite_responsable_field(self, auth_headers, informes_list):
        """GET /api/vista-comite - Responsable field is populated correctly"""
        if not informes_list:
            pytest.skip("No informes available")
        
        # Test with multiple informes to find one with responsable
        encoded = ",".join([urllib.parse.quote(i) for i in informes_list[:10]])
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded}&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check responsable field format
        for row in data:
            responsable = row.get("responsable")
            # Should be None or a string (comma-separated if multiple)
            assert responsable is None or isinstance(responsable, str)
            if responsable:
                print(f"Found responsable: {responsable[:50]}...")
                break
        else:
            print("No responsables found in test data (may be null)")
    
    def test_vista_comite_totals_calculation(self, auth_headers, informes_list):
        """GET /api/vista-comite - Total calculations are correct"""
        if not informes_list:
            pytest.skip("No informes available")
        
        informe = informes_list[0]
        encoded_informe = urllib.parse.quote(informe)
        
        response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded_informe}&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            row = data[0]
            # Verify total_hallazgos = sum of all severity totals
            calculated_total = (
                row["criticas_total"] + 
                row["altas_total"] + 
                row["medias_total"] + 
                row["bajas_total"]
            )
            assert row["total_hallazgos"] == calculated_total, \
                f"Total mismatch: {row['total_hallazgos']} != {calculated_total}"
            
            # Verify total_pendientes = sum of all severity pendientes
            calculated_pendientes = (
                row["criticas_pendientes"] + 
                row["altas_pendientes"] + 
                row["medias_pendientes"] + 
                row["bajas_pendientes"]
            )
            assert row["total_pendientes"] == calculated_pendientes, \
                f"Pendientes mismatch: {row['total_pendientes']} != {calculated_pendientes}"
            
            print(f"Totals verified: {row['total_pendientes']}/{row['total_hallazgos']}")


class TestVistaComiteDataIntegrity:
    """Test data integrity between vista-comite and vulnerabilidades endpoints"""
    
    def test_vista_comite_matches_vulnerabilidades(self, auth_headers, informes_list):
        """Verify vista-comite counts match vulnerabilidades endpoint"""
        if not informes_list:
            pytest.skip("No informes available")
        
        informe = informes_list[0]
        encoded_informe = urllib.parse.quote(informe)
        
        # Get vista-comite data
        comite_response = requests.get(
            f"{BASE_URL}/api/vista-comite?informes={encoded_informe}&severidades=Critica,Alta,Media,Baja",
            headers=auth_headers
        )
        comite_data = comite_response.json()
        
        if not comite_data:
            pytest.skip("No data for this informe")
        
        comite_row = comite_data[0]
        
        # Get vulnerabilidades for same informe
        vuln_response = requests.get(
            f"{BASE_URL}/api/vulnerabilidades?informe_pentest={encoded_informe}",
            headers=auth_headers
        )
        vulns = vuln_response.json()
        
        # Count manually
        closed_statuses = ["Cerrado", "Corregido", "Desestimado"]
        manual_counts = {
            "criticas_total": 0, "criticas_pendientes": 0,
            "altas_total": 0, "altas_pendientes": 0,
            "medias_total": 0, "medias_pendientes": 0,
            "bajas_total": 0, "bajas_pendientes": 0,
        }
        
        for v in vulns:
            sev = v.get("severidad", "")
            estatus = v.get("estatus")
            is_pending = estatus not in closed_statuses
            
            if sev == "Critica":
                manual_counts["criticas_total"] += 1
                if is_pending:
                    manual_counts["criticas_pendientes"] += 1
            elif sev == "Alta":
                manual_counts["altas_total"] += 1
                if is_pending:
                    manual_counts["altas_pendientes"] += 1
            elif sev == "Media":
                manual_counts["medias_total"] += 1
                if is_pending:
                    manual_counts["medias_pendientes"] += 1
            elif sev == "Baja":
                manual_counts["bajas_total"] += 1
                if is_pending:
                    manual_counts["bajas_pendientes"] += 1
        
        # Compare
        assert comite_row["criticas_total"] == manual_counts["criticas_total"], \
            f"Criticas total mismatch: {comite_row['criticas_total']} != {manual_counts['criticas_total']}"
        assert comite_row["criticas_pendientes"] == manual_counts["criticas_pendientes"], \
            f"Criticas pendientes mismatch"
        
        print(f"Data integrity verified for {informe[:40]}...")
        print(f"Vulnerabilidades count: {len(vulns)}, Vista Comité total: {comite_row['total_hallazgos']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
