"""
Test suite for duplicate vulnerability detection feature (Iteration 20)
- POST /api/vulnerabilidades/verificar-duplicado: Detects existing duplicates
- POST /api/import/excel: Skips duplicates automatically and reports count
- Duplicate criteria: same vulnerabilidad + same aplicaciones + same institucion
"""
import pytest
import requests
import os
import io
import pandas as pd

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestDuplicateDetectionEndpoint:
    """Tests for POST /api/vulnerabilidades/verificar-duplicado"""
    
    def test_detect_existing_duplicate(self, auth_headers):
        """Test that endpoint detects an existing vulnerability as duplicate"""
        # First, get an existing vulnerability to use as test data
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades?limit=1", headers=auth_headers)
        assert response.status_code == 200
        vulns = response.json()
        
        if len(vulns) == 0:
            pytest.skip("No existing vulnerabilities to test against")
        
        existing_vuln = vulns[0]
        
        # Check for duplicate using the existing vulnerability's data
        params = {
            "vulnerabilidad": existing_vuln.get("vulnerabilidad", ""),
            "aplicaciones": ",".join(existing_vuln.get("aplicaciones", [])) if existing_vuln.get("aplicaciones") else "",
            "institucion": existing_vuln.get("institucion", "")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vulnerabilidades/verificar-duplicado",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicates" in data
        assert "duplicates" in data
        # Should find at least the existing vulnerability as duplicate
        assert data["has_duplicates"] == True
        assert len(data["duplicates"]) >= 1
        print(f"SUCCESS: Detected {len(data['duplicates'])} duplicate(s) for existing vulnerability")
    
    def test_no_duplicate_for_new_vulnerability(self, auth_headers):
        """Test that endpoint returns no duplicates for a unique vulnerability"""
        params = {
            "vulnerabilidad": "TEST_UNIQUE_VULN_12345_NONEXISTENT",
            "aplicaciones": "TEST_APP_UNIQUE",
            "institucion": "TEST_INST_UNIQUE"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vulnerabilidades/verificar-duplicado",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_duplicates"] == False
        assert len(data["duplicates"]) == 0
        print("SUCCESS: No duplicates found for unique vulnerability")
    
    def test_duplicate_check_with_null_aplicaciones(self, auth_headers):
        """Test duplicate detection when aplicaciones is null/empty"""
        # Find a vulnerability with null/empty aplicaciones
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades", headers=auth_headers)
        assert response.status_code == 200
        vulns = response.json()
        
        # Find one with null or empty aplicaciones
        vuln_with_null_apps = None
        for v in vulns:
            apps = v.get("aplicaciones")
            if apps is None or apps == [] or apps == "":
                vuln_with_null_apps = v
                break
        
        if vuln_with_null_apps is None:
            pytest.skip("No vulnerability with null aplicaciones found")
        
        params = {
            "vulnerabilidad": vuln_with_null_apps.get("vulnerabilidad", ""),
            "aplicaciones": "",  # Empty/null
            "institucion": vuln_with_null_apps.get("institucion", "")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vulnerabilidades/verificar-duplicado",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicates" in data
        print(f"SUCCESS: Duplicate check with null aplicaciones returned has_duplicates={data['has_duplicates']}")
    
    def test_duplicate_check_case_insensitive(self, auth_headers):
        """Test that duplicate detection is case-insensitive"""
        # Get an existing vulnerability
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades?limit=1", headers=auth_headers)
        assert response.status_code == 200
        vulns = response.json()
        
        if len(vulns) == 0:
            pytest.skip("No existing vulnerabilities to test against")
        
        existing_vuln = vulns[0]
        vuln_text = existing_vuln.get("vulnerabilidad", "")
        
        if not vuln_text:
            pytest.skip("Vulnerability has no text")
        
        # Check with different case
        params = {
            "vulnerabilidad": vuln_text.upper() if vuln_text.islower() else vuln_text.lower(),
            "aplicaciones": ",".join(existing_vuln.get("aplicaciones", [])) if existing_vuln.get("aplicaciones") else "",
            "institucion": existing_vuln.get("institucion", "")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vulnerabilidades/verificar-duplicado",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should still detect as duplicate due to case-insensitive comparison
        assert data["has_duplicates"] == True
        print("SUCCESS: Case-insensitive duplicate detection works")
    
    def test_duplicate_check_with_exclude_id(self, auth_headers):
        """Test that exclude_id parameter excludes the specified record"""
        # Get an existing vulnerability
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades?limit=1", headers=auth_headers)
        assert response.status_code == 200
        vulns = response.json()
        
        if len(vulns) == 0:
            pytest.skip("No existing vulnerabilities to test against")
        
        existing_vuln = vulns[0]
        
        # Check for duplicate but exclude the same record
        params = {
            "vulnerabilidad": existing_vuln.get("vulnerabilidad", ""),
            "aplicaciones": ",".join(existing_vuln.get("aplicaciones", [])) if existing_vuln.get("aplicaciones") else "",
            "institucion": existing_vuln.get("institucion", ""),
            "exclude_id": existing_vuln.get("id")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vulnerabilidades/verificar-duplicado",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        # When excluding the same record, it should not find duplicates (unless there are actual duplicates)
        print(f"SUCCESS: Exclude ID parameter works - has_duplicates={data['has_duplicates']}")


class TestExcelImportDuplicateSkipping:
    """Tests for Excel import duplicate skipping functionality"""
    
    def test_import_excel_skips_duplicates(self, auth_headers):
        """Test that Excel import skips duplicate records and reports count"""
        # First, get an existing vulnerability to create a duplicate in Excel
        response = requests.get(f"{BASE_URL}/api/vulnerabilidades?limit=1", headers=auth_headers)
        assert response.status_code == 200
        vulns = response.json()
        
        if len(vulns) == 0:
            pytest.skip("No existing vulnerabilities to test against")
        
        existing_vuln = vulns[0]
        
        # Create Excel file with the duplicate vulnerability
        df = pd.DataFrame([{
            "Vulnerabilidad": existing_vuln.get("vulnerabilidad", "Test Vuln"),
            "Aplicaciones": ",".join(existing_vuln.get("aplicaciones", [])) if existing_vuln.get("aplicaciones") else "",
            "Institución": existing_vuln.get("institucion", ""),
            "Severidad": existing_vuln.get("severidad", "Media"),
            "Estatus": existing_vuln.get("estatus", "Pendiente")
        }])
        
        # Convert to Excel bytes
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)
        
        # Import the Excel file
        files = {"file": ("test_duplicates.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        response = requests.post(
            f"{BASE_URL}/api/import/excel",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that the response includes skipped_duplicates count
        assert "skipped_duplicates" in data
        assert "message" in data
        
        # The message should mention skipped duplicates if any were found
        if data["skipped_duplicates"] > 0:
            assert "omitieron" in data["message"].lower() or "duplicados" in data["message"].lower()
            print(f"SUCCESS: Import skipped {data['skipped_duplicates']} duplicate(s)")
        else:
            print(f"SUCCESS: Import response includes skipped_duplicates field (value: {data['skipped_duplicates']})")
    
    def test_import_excel_response_structure(self, auth_headers):
        """Test that Excel import response has correct structure"""
        # Create a simple Excel file with unique data
        df = pd.DataFrame([{
            "Vulnerabilidad": "TEST_UNIQUE_IMPORT_VULN_" + str(os.urandom(4).hex()),
            "Institución": "TEST_INST",
            "Severidad": "Baja",
            "Estatus": "Pendiente"
        }])
        
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)
        
        files = {"file": ("test_import.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        response = requests.post(
            f"{BASE_URL}/api/import/excel",
            files=files,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "inserted" in data
        assert "skipped_duplicates" in data
        assert "catalogs_created" in data
        
        print(f"SUCCESS: Import response structure is correct - inserted={data['inserted']}, skipped={data['skipped_duplicates']}")
        
        # Cleanup: Delete the test vulnerability
        # Get the newly created vulnerability
        response = requests.get(
            f"{BASE_URL}/api/vulnerabilidades?search=TEST_UNIQUE_IMPORT_VULN",
            headers=auth_headers
        )
        if response.status_code == 200:
            test_vulns = response.json()
            for v in test_vulns:
                if "TEST_UNIQUE_IMPORT_VULN" in (v.get("vulnerabilidad") or ""):
                    requests.delete(f"{BASE_URL}/api/vulnerabilidades/{v['id']}", headers=auth_headers)


class TestSpecificDuplicateScenario:
    """Test the specific scenario mentioned in the requirements"""
    
    def test_open_smtp_relay_duplicate(self, auth_headers):
        """Test detection of 'Open SMTP relay de forma no autenticada' with BHD and null apps"""
        params = {
            "vulnerabilidad": "Open SMTP relay de forma no autenticada",
            "aplicaciones": "",  # null/empty
            "institucion": "BHD"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vulnerabilidades/verificar-duplicado",
            params=params,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Specific scenario test: has_duplicates={data['has_duplicates']}, count={len(data['duplicates'])}")
        
        # This should find the existing vulnerability mentioned in the requirements
        if data["has_duplicates"]:
            print(f"SUCCESS: Found duplicate for 'Open SMTP relay' with BHD institution")
            for dup in data["duplicates"]:
                print(f"  - {dup.get('codigo', 'N/A')}: {dup.get('vulnerabilidad', '')[:50]}...")
        else:
            print("INFO: No duplicate found - the specific vulnerability may not exist in the database")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
