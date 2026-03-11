#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import uuid

class VulnerabilityAPITester:
    def __init__(self, base_url="https://secfind-board.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.headers = {'Content-Type': 'application/json'}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_vuln_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=self.headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=self.headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.headers, timeout=10)

            success = response.status_code == expected_status
            details = f"(Status: {response.status_code})"
            
            if success and response.status_code != 204:
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'message' in response_data:
                        details += f" - {response_data['message']}"
                except:
                    pass
            elif not success:
                try:
                    error_data = response.json()
                    details += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" - {response.text[:100]}"

            return self.log_test(name, success, details), response

        except Exception as e:
            return self.log_test(name, False, f"Exception: {str(e)[:100]}"), None

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root Endpoint", "GET", "/", 200)

    def test_dropdown_options(self):
        """Test dropdown options endpoint"""
        success, response = self.run_test("Dropdown Options", "GET", "/dropdown-options", 200)
        if success and response:
            try:
                data = response.json()
                required_keys = ['severidades', 'estatus', 'instituciones', 'resultado_retest']
                if all(key in data for key in required_keys):
                    print(f"   📋 Options loaded: {len(data['severidades'])} severidades, {len(data['estatus'])} estatus")
                    return True
                else:
                    print(f"   ⚠️  Missing required keys in dropdown options")
            except Exception as e:
                print(f"   ⚠️  Error parsing dropdown options: {e}")
        return False

    def test_get_vulnerabilidades(self):
        """Test listing vulnerabilidades"""
        success, response = self.run_test("Get Vulnerabilidades", "GET", "/vulnerabilidades", 200)
        if success and response:
            try:
                data = response.json()
                print(f"   📊 Found {len(data)} vulnerabilidades")
                return data
            except Exception as e:
                print(f"   ⚠️  Error parsing vulnerabilidades: {e}")
        return []

    def test_vulnerabilidades_search(self):
        """Test search functionality"""
        params = {'search': 'SQL'}
        success, response = self.run_test("Search Vulnerabilidades", "GET", "/vulnerabilidades", 200, params=params)
        if success and response:
            try:
                data = response.json()
                print(f"   🔍 Search 'SQL' returned {len(data)} results")
                return True
            except Exception as e:
                print(f"   ⚠️  Error parsing search results: {e}")
        return False

    def test_vulnerabilidades_filters(self):
        """Test filter functionality"""
        # Test severidad filter
        params = {'severidad': 'Critica'}
        success, response = self.run_test("Filter by Severidad", "GET", "/vulnerabilidades", 200, params=params)
        if success and response:
            try:
                data = response.json()
                print(f"   🔧 Severidad 'Critica' filter returned {len(data)} results")
            except Exception as e:
                print(f"   ⚠️  Error parsing filter results: {e}")
        
        # Test estatus filter
        params = {'estatus': 'Pendiente'}
        success2, response2 = self.run_test("Filter by Estatus", "GET", "/vulnerabilidades", 200, params=params)
        if success2 and response2:
            try:
                data = response2.json()
                print(f"   🔧 Estatus 'Pendiente' filter returned {len(data)} results")
            except Exception as e:
                print(f"   ⚠️  Error parsing estatus filter results: {e}")

        return success and success2

    def test_create_vulnerabilidad(self):
        """Test creating a vulnerability"""
        test_data = {
            "fecha_hallazgo": "2024-01-15",
            "institucion": "BHD IB",
            "aplicacion": "Test Application",
            "vulnerabilidad": "Test vulnerability for API testing",
            "recomendaciones": "Test recommendations",
            "severidad": "Media",
            "riesgo_asociado": "Test risk",
            "descripcion_riesgo": "Test risk description",
            "responsable": "Test User",
            "fecha_compromiso": "2024-02-15",
            "estatus": "Pendiente",
            "resultado_re_test": "Pendiente",
            "nombre_informe_pentest": "Test Report",
            "proveedor": "Test Provider"
        }

        success, response = self.run_test("Create Vulnerabilidad", "POST", "/vulnerabilidades", 200, data=test_data)
        if success and response:
            try:
                data = response.json()
                self.test_vuln_id = data.get('id')
                print(f"   ➕ Created vulnerability with ID: {self.test_vuln_id}")
                return True
            except Exception as e:
                print(f"   ⚠️  Error parsing created vulnerability: {e}")
        return False

    def test_get_single_vulnerabilidad(self):
        """Test getting a single vulnerability"""
        if not self.test_vuln_id:
            print("❌ Get Single Vulnerabilidad: SKIPPED (No test vulnerability ID)")
            return False

        success, response = self.run_test("Get Single Vulnerabilidad", "GET", f"/vulnerabilidades/{self.test_vuln_id}", 200)
        if success and response:
            try:
                data = response.json()
                print(f"   📄 Retrieved vulnerability: {data.get('vulnerabilidad', 'Unknown')[:50]}...")
                return True
            except Exception as e:
                print(f"   ⚠️  Error parsing single vulnerability: {e}")
        return False

    def test_update_vulnerabilidad(self):
        """Test updating a vulnerability"""
        if not self.test_vuln_id:
            print("❌ Update Vulnerabilidad: SKIPPED (No test vulnerability ID)")
            return False

        update_data = {
            "vulnerabilidad": "Updated test vulnerability",
            "estatus": "Corregido"
        }

        success, response = self.run_test("Update Vulnerabilidad", "PUT", f"/vulnerabilidades/{self.test_vuln_id}", 200, data=update_data)
        if success and response:
            try:
                data = response.json()
                print(f"   ✏️  Updated vulnerability status to: {data.get('estatus')}")
                return True
            except Exception as e:
                print(f"   ⚠️  Error parsing updated vulnerability: {e}")
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test("Dashboard Stats", "GET", "/dashboard/stats", 200)
        if success and response:
            try:
                data = response.json()
                print(f"   📈 Stats - Total: {data.get('total_vulnerabilidades', 0)}, Críticas: {data.get('criticas_abiertas', 0)}, Corregidas: {data.get('vulnerabilidades_corregidas', 0)}")
                return True
            except Exception as e:
                print(f"   ⚠️  Error parsing dashboard stats: {e}")
        return False

    def test_export_excel(self):
        """Test Excel export"""
        try:
            response = requests.get(f"{self.base_url}/export/excel", timeout=15)
            success = response.status_code == 200
            if success:
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'excel' in content_type:
                    print(f"✅ Export Excel: PASSED (Content-Type: {content_type})")
                    self.tests_passed += 1
                else:
                    print(f"❌ Export Excel: FAILED (Wrong Content-Type: {content_type})")
            else:
                print(f"❌ Export Excel: FAILED (Status: {response.status_code})")
            self.tests_run += 1
            return success
        except Exception as e:
            self.tests_run += 1
            print(f"❌ Export Excel: FAILED (Exception: {str(e)[:100]})")
            return False

    def test_export_csv(self):
        """Test CSV export"""
        try:
            response = requests.get(f"{self.base_url}/export/csv", timeout=15)
            success = response.status_code == 200
            if success:
                content_type = response.headers.get('content-type', '')
                if 'csv' in content_type or 'text' in content_type:
                    print(f"✅ Export CSV: PASSED (Content-Type: {content_type})")
                    self.tests_passed += 1
                else:
                    print(f"❌ Export CSV: FAILED (Wrong Content-Type: {content_type})")
            else:
                print(f"❌ Export CSV: FAILED (Status: {response.status_code})")
            self.tests_run += 1
            return success
        except Exception as e:
            self.tests_run += 1
            print(f"❌ Export CSV: FAILED (Exception: {str(e)[:100]})")
            return False

    def test_delete_vulnerabilidad(self):
        """Test deleting the test vulnerability"""
        if not self.test_vuln_id:
            print("❌ Delete Vulnerabilidad: SKIPPED (No test vulnerability ID)")
            return False

        success, response = self.run_test("Delete Vulnerabilidad", "DELETE", f"/vulnerabilidades/{self.test_vuln_id}", 200)
        if success:
            print(f"   🗑️  Deleted test vulnerability: {self.test_vuln_id}")
            return True
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Backend API Tests for Vulnerability Management System")
        print(f"🔗 Base URL: {self.base_url}")
        print("=" * 80)

        # Basic endpoint tests
        self.test_root_endpoint()
        self.test_dropdown_options()

        # Vulnerabilidades CRUD tests
        vulnerabilidades = self.test_get_vulnerabilidades()
        self.test_vulnerabilidades_search()
        self.test_vulnerabilidades_filters()
        self.test_create_vulnerabilidad()
        self.test_get_single_vulnerabilidad()
        self.test_update_vulnerabilidad()

        # Dashboard and export tests
        self.test_dashboard_stats()
        self.test_export_excel()
        self.test_export_csv()

        # Cleanup
        self.test_delete_vulnerabilidad()

        # Final results
        print("=" * 80)
        print(f"📊 BACKEND TEST RESULTS:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL BACKEND TESTS PASSED!")
            return True
        else:
            print("⚠️  SOME BACKEND TESTS FAILED!")
            return False

def main():
    tester = VulnerabilityAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())