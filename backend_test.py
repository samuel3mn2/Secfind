import requests
import sys
from datetime import datetime

class DashboardTester:
    def __init__(self, base_url="https://secfind-board.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Print response data for debugging
                try:
                    response_data = response.json()
                    if method == 'GET' and isinstance(response_data, list):
                        print(f"   📊 Returned {len(response_data)} items")
                    elif method == 'GET' and isinstance(response_data, dict):
                        if 'total_vulnerabilidades' in response_data:
                            print(f"   📊 Stats: Total: {response_data.get('total_vulnerabilidades', 0)}, "
                                f"Críticas: {response_data.get('criticas_abiertas', 0)}, "
                                f"Corregidas: {response_data.get('vulnerabilidades_corregidas', 0)}, "
                                f"Pendientes: {response_data.get('pendientes', 0)}")
                except:
                    pass
                    
                return True, response.json() if response.text else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_tendencias_mensual(self):
        """Test tendencias API with mensual type"""
        success, response = self.run_test(
            "Tendencias API - Mensual",
            "GET",
            "dashboard/tendencias",
            200,
            params={"tipo": "mensual"}
        )
        
        if success and response:
            # Validate structure
            if isinstance(response, list) and len(response) > 0:
                first_item = response[0]
                required_fields = ["periodo", "total", "criticas", "corregidas", "pendientes"]
                if all(field in first_item for field in required_fields):
                    print(f"   ✅ Structure valid: {first_item}")
                    return True
                else:
                    print(f"   ❌ Missing required fields in response")
            else:
                print(f"   ⚠️  Empty response (no data available)")
                return True  # Empty response is valid if no data
        return False

    def test_tendencias_trimestral(self):
        """Test tendencias API with trimestral type"""
        success, response = self.run_test(
            "Tendencias API - Trimestral",
            "GET",
            "dashboard/tendencias",
            200,
            params={"tipo": "trimestral"}
        )
        
        if success and response:
            if isinstance(response, list) and len(response) > 0:
                first_item = response[0]
                # Check for quarterly format (YYYY-Q#)
                periodo = first_item.get("periodo", "")
                if "-Q" in periodo:
                    print(f"   ✅ Quarterly format valid: {periodo}")
                    return True
                else:
                    print(f"   ❌ Invalid quarterly format: {periodo}")
            else:
                print(f"   ⚠️  Empty response (no data available)")
                return True
        return False

    def test_kpi_detail_criticas_abiertas(self):
        """Test KPI detail API for críticas abiertas"""
        success, response = self.run_test(
            "KPI Detail API - Críticas Abiertas",
            "GET",
            "dashboard/kpi-detail",
            200,
            params={"tipo": "criticas_abiertas"}
        )
        
        if success and response:
            if isinstance(response, list):
                print(f"   ✅ Returned {len(response)} critical open vulnerabilities")
                # Validate that all returned items have severity "Critica" and are not closed
                for vuln in response[:3]:  # Check first 3
                    if vuln.get("severidad") == "Critica" and vuln.get("estatus") not in ["Cerrado", "Corregido", "Desestimado"]:
                        print(f"   ✅ Validation passed for: {vuln.get('vulnerabilidad', '')[:50]}")
                    else:
                        print(f"   ❌ Invalid record: Sev={vuln.get('severidad')}, Status={vuln.get('estatus')}")
                        return False
                return True
        return False

    def test_kpi_detail_pendientes(self):
        """Test KPI detail API for pendientes"""
        success, response = self.run_test(
            "KPI Detail API - Pendientes",
            "GET",
            "dashboard/kpi-detail",
            200,
            params={"tipo": "pendientes"}
        )
        
        if success and response:
            if isinstance(response, list):
                print(f"   ✅ Returned {len(response)} pending vulnerabilities")
                # Validate status
                for vuln in response[:3]:
                    if vuln.get("estatus") in ["Pendiente", "En Proceso", "Para Re Test"]:
                        print(f"   ✅ Valid pending status: {vuln.get('estatus')}")
                    else:
                        print(f"   ❌ Invalid status for pending: {vuln.get('estatus')}")
                        return False
                return True
        return False

    def test_kpi_detail_corregidas(self):
        """Test KPI detail API for corregidas"""
        success, response = self.run_test(
            "KPI Detail API - Corregidas",
            "GET",
            "dashboard/kpi-detail",
            200,
            params={"tipo": "corregidas"}
        )
        
        if success and response:
            if isinstance(response, list):
                print(f"   ✅ Returned {len(response)} corrected vulnerabilities")
                # Validate status
                for vuln in response[:3]:
                    if vuln.get("estatus") in ["Corregido", "Cerrado"]:
                        print(f"   ✅ Valid corrected status: {vuln.get('estatus')}")
                    else:
                        print(f"   ❌ Invalid status for corrected: {vuln.get('estatus')}")
                        return False
                return True
        return False

    def test_kpi_detail_with_filters(self):
        """Test KPI detail API with dashboard filters"""
        success, response = self.run_test(
            "KPI Detail API - With Filters",
            "GET",
            "dashboard/kpi-detail",
            200,
            params={
                "tipo": "criticas_abiertas",
                "año": "2024",
                "severidad": "Critica"
            }
        )
        
        if success and response:
            print(f"   ✅ Filtered results returned: {len(response)} items")
            return True
        return False

    def test_dashboard_stats_basic(self):
        """Test basic dashboard stats"""
        success, response = self.run_test(
            "Dashboard Stats - Basic",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success and response:
            required_fields = ["total_vulnerabilidades", "criticas_abiertas", "vulnerabilidades_corregidas", "pendientes"]
            if all(field in response for field in required_fields):
                print(f"   ✅ All required stats present")
                return True
        return False

def main():
    print("🚀 Starting Dashboard API Testing")
    print("=" * 50)
    
    # Setup
    tester = DashboardTester()
    
    # Test basic connectivity
    if not tester.run_test("API Root", "GET", "", 200)[0]:
        print("❌ API not accessible, stopping tests")
        return 1

    # Test new tendencias endpoints
    print("\n📈 Testing Tendencias API:")
    tester.test_tendencias_mensual()
    tester.test_tendencias_trimestral()
    
    # Test KPI detail endpoints
    print("\n📊 Testing KPI Detail API:")
    tester.test_kpi_detail_criticas_abiertas()
    tester.test_kpi_detail_pendientes()
    tester.test_kpi_detail_corregidas()
    tester.test_kpi_detail_with_filters()
    
    # Test dashboard stats (baseline)
    print("\n📋 Testing Dashboard Stats:")
    tester.test_dashboard_stats_basic()

    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("❌ SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())