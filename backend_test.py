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

    def test_dashboard_filters(self):
        """Test dashboard stats with filters"""
        # Test with año filter
        params = {'año': 2024}
        success1, response1 = self.run_test("Dashboard Stats with Año Filter", "GET", "/dashboard/stats", 200, params=params)
        
        # Test with institución filter
        params = {'institucion': 'BHD IB'}
        success2, response2 = self.run_test("Dashboard Stats with Institución Filter", "GET", "/dashboard/stats", 200, params=params)
        
        # Test with multiple filters
        params = {'año': 2024, 'severidad': 'Critica', 'institucion': 'BHD IB'}
        success3, response3 = self.run_test("Dashboard Stats with Multiple Filters", "GET", "/dashboard/stats", 200, params=params)
        
        if success1 and response1:
            try:
                data = response1.json()
                print(f"   📊 Filtered by año 2024 - Total: {data.get('total_vulnerabilidades', 0)}")
            except Exception as e:
                print(f"   ⚠️  Error parsing filtered stats: {e}")
                
        if success3 and response3:
            try:
                data = response3.json()
                print(f"   📊 Multi-filter result - Total: {data.get('total_vulnerabilidades', 0)}")
            except Exception as e:
                print(f"   ⚠️  Error parsing multi-filter stats: {e}")

        return success1 and success2 and success3

    def test_instituciones_config(self):
        """Test institutions configuration CRUD"""
        # Get all institutions
        success1, response1 = self.run_test("Get Instituciones", "GET", "/config/instituciones", 200)
        
        # Create a new institution
        test_inst_data = {
            "nombre": f"Test Institution {uuid.uuid4().hex[:8]}"
        }
        success2, response2 = self.run_test("Create Institución", "POST", "/config/instituciones", 200, data=test_inst_data)
        
        institution_id = None
        if success2 and response2:
            try:
                data = response2.json()
                institution_id = data.get('id')
                print(f"   ➕ Created institution with ID: {institution_id}")
            except Exception as e:
                print(f"   ⚠️  Error parsing created institution: {e}")
        
        # Update institution if created successfully
        success3 = False
        if institution_id:
            update_data = {"nombre": "Updated Test Institution", "activo": False}
            success3, response3 = self.run_test("Update Institución", "PUT", f"/config/instituciones/{institution_id}", 200, data=update_data)
            if success3:
                print(f"   ✏️  Updated institution status to inactive")
        
        # Delete the test institution
        success4 = False
        if institution_id:
            success4, response4 = self.run_test("Delete Institución", "DELETE", f"/config/instituciones/{institution_id}", 200)
            if success4:
                print(f"   🗑️  Deleted test institution: {institution_id}")
        
        return success1 and success2 and success3 and success4

    def test_dropdown_options_enhanced(self):
        """Test enhanced dropdown options with new fields"""
        success, response = self.run_test("Enhanced Dropdown Options", "GET", "/dropdown-options", 200)
        if success and response:
            try:
                data = response.json()
                required_keys = ['severidades', 'estatus', 'instituciones', 'resultado_retest', 'informes_pentest', 'años', 'proveedores']
                missing_keys = [key for key in required_keys if key not in data]
                
                if not missing_keys:
                    print(f"   📋 Enhanced options loaded:")
                    print(f"       - {len(data['severidades'])} severidades")
                    print(f"       - {len(data['estatus'])} estatus")  
                    print(f"       - {len(data['instituciones'])} instituciones")
                    print(f"       - {len(data.get('informes_pentest', []))} informes pentest")
                    print(f"       - {len(data.get('años', []))} años available")
                    print(f"       - {len(data.get('proveedores', []))} proveedores")
                    return True
                else:
                    print(f"   ⚠️  Missing required keys: {missing_keys}")
            except Exception as e:
                print(f"   ⚠️  Error parsing enhanced dropdown options: {e}")
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
        self.test_dropdown_options_enhanced()

        # Configuration module tests (NEW FEATURES)
        self.test_instituciones_config()

        # Vulnerabilidades CRUD tests
        vulnerabilidades = self.test_get_vulnerabilidades()
        self.test_vulnerabilidades_search()
        self.test_vulnerabilidades_filters()
        self.test_create_vulnerabilidad()
        self.test_get_single_vulnerabilidad()
        self.test_update_vulnerabilidad()

        # Dashboard and export tests (ENHANCED)
        self.test_dashboard_stats()
        self.test_dashboard_filters()
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