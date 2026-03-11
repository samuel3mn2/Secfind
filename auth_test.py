import requests
import sys
from datetime import datetime

class VulnerabilityManagementTester:
    def __init__(self, base_url="https://secfind-board.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if available
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
            
        # Add any additional headers
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Print response data for debugging
                try:
                    if response.text:
                        response_data = response.json()
                        if method == 'GET' and isinstance(response_data, list):
                            print(f"   📊 Returned {len(response_data)} items")
                        elif 'token' in response_data:
                            print(f"   🔑 Token received")
                        elif 'id' in response_data:
                            print(f"   🆔 ID: {response_data.get('id')}")
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

    def test_login(self, username="admin", password="admin123"):
        """Test login with admin credentials"""
        success, response = self.run_test(
            "Login with admin credentials",
            "POST",
            "auth/login",
            200,
            data={"username": username, "password": password}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['usuario']['id']
            print(f"   ✅ Login successful - Admin: {response['usuario'].get('es_admin', False)}")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Login with invalid credentials",
            "POST",
            "auth/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )
        return success

    def test_get_me(self):
        """Test get current user endpoint"""
        success, response = self.run_test(
            "Get current user info",
            "GET",
            "auth/me",
            200
        )
        
        if success and response:
            required_fields = ["id", "username", "nombre", "es_admin", "permisos"]
            if all(field in response for field in required_fields):
                print(f"   ✅ User: {response['username']} - Admin: {response['es_admin']}")
                print(f"   ✅ Permissions: Dashboard({response['permisos']['dashboard']['ver']}), "
                      f"Vulns({response['permisos']['vulnerabilidades']['ver']}), "
                      f"Config({response['permisos']['configuracion']['ver']})")
                return True
        return False

    def test_protected_route_without_auth(self):
        """Test protected route without authentication"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Access protected route without auth",
            "GET",
            "config/usuarios",
            401
        )
        
        # Restore token
        self.token = temp_token
        return success

    def test_get_usuarios(self):
        """Test get users list"""
        success, response = self.run_test(
            "Get users list",
            "GET",
            "config/usuarios",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} users")
            for user in response[:3]:  # Show first 3 users
                print(f"   👤 {user['username']} - {user['nombre']} (Admin: {user['es_admin']})")
            return True
        return False

    def test_create_user(self):
        """Test creating a new user with specific permissions"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_user_data = {
            "username": f"testuser_{timestamp}",
            "password": "TestPass123!",
            "nombre": f"Test User {timestamp}",
            "email": f"test_{timestamp}@example.com",
            "es_admin": False,
            "permisos": {
                "dashboard": {"ver": True, "crear": False, "editar": False, "eliminar": False},
                "vulnerabilidades": {"ver": True, "crear": False, "editar": False, "eliminar": False},
                "configuracion": {"ver": False, "crear": False, "editar": False, "eliminar": False}
            }
        }
        
        success, response = self.run_test(
            "Create new user with limited permissions",
            "POST",
            "config/usuarios",
            200,
            data=test_user_data
        )
        
        if success and response:
            self.created_user_id = response.get('id')
            print(f"   ✅ Created user: {response['username']} with ID: {self.created_user_id}")
            return True
        return False

    def test_update_user(self):
        """Test updating user permissions"""
        if not self.created_user_id:
            print("   ⚠️ No user ID available for update test")
            return False
            
        update_data = {
            "nombre": "Updated Test User",
            "permisos": {
                "dashboard": {"ver": True, "crear": False, "editar": False, "eliminar": False},
                "vulnerabilidades": {"ver": True, "crear": True, "editar": True, "eliminar": False},
                "configuracion": {"ver": True, "crear": False, "editar": False, "eliminar": False}
            }
        }
        
        success, response = self.run_test(
            "Update user permissions",
            "PUT",
            f"config/usuarios/{self.created_user_id}",
            200,
            data=update_data
        )
        
        if success and response:
            print(f"   ✅ Updated user permissions - Vulns create: {response['permisos']['vulnerabilidades']['crear']}")
            return True
        return False

    def test_toggle_user_active(self):
        """Test activating/deactivating user"""
        if not self.created_user_id:
            print("   ⚠️ No user ID available for activation test")
            return False
            
        success, response = self.run_test(
            "Deactivate user",
            "PUT",
            f"config/usuarios/{self.created_user_id}",
            200,
            data={"activo": False}
        )
        
        if success and response:
            print(f"   ✅ User active status: {response['activo']}")
            return True
        return False

    def test_delete_user(self):
        """Test deleting user"""
        if not self.created_user_id:
            print("   ⚠️ No user ID available for deletion test")
            return False
            
        success, response = self.run_test(
            "Delete test user",
            "DELETE",
            f"config/usuarios/{self.created_user_id}",
            200
        )
        
        if success:
            print(f"   ✅ User deleted successfully")
            return True
        return False

    def test_vulnerabilities_permissions(self):
        """Test vulnerabilities access with proper permissions"""
        success, response = self.run_test(
            "Get vulnerabilities list",
            "GET",
            "vulnerabilidades",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} vulnerabilities")
            return True
        return False

    def test_create_vulnerability(self):
        """Test creating a vulnerability"""
        vuln_data = {
            "fecha_hallazgo": "2024-01-15",
            "institucion": "Test Institution",
            "aplicacion": "Test App",
            "vulnerabilidad": "Test SQL Injection vulnerability for testing",
            "recomendaciones": "Fix the SQL injection by using parameterized queries",
            "severidad": "Alta",
            "riesgo_asociado": "Data breach",
            "descripcion_riesgo": "Potential unauthorized access to database",
            "responsable": "Test Developer",
            "fecha_compromiso": "2024-02-15",
            "estatus": "Pendiente",
            "resultado_re_test": "",
            "nombre_informe_pentest": "Test Pentest Report 2024",
            "proveedor": "Test Security Co"
        }
        
        success, response = self.run_test(
            "Create new vulnerability",
            "POST",
            "vulnerabilidades",
            200,
            data=vuln_data
        )
        
        if success and response:
            vuln_id = response.get('id')
            print(f"   ✅ Created vulnerability with ID: {vuln_id}")
            
            # Test viewing the created vulnerability
            view_success, view_response = self.run_test(
                "View created vulnerability",
                "GET",
                f"vulnerabilidades/{vuln_id}",
                200
            )
            
            if view_success:
                print(f"   ✅ Retrieved vulnerability: {view_response.get('vulnerabilidad', '')[:50]}...")
                return True
        return False

    def test_instituciones_crud(self):
        """Test institutions CRUD operations"""
        # Create institution
        inst_data = {"nombre": f"Test Institution {datetime.now().strftime('%H%M%S')}"}
        
        success, response = self.run_test(
            "Create new institution",
            "POST",
            "config/instituciones",
            200,
            data=inst_data
        )
        
        if success and response:
            inst_id = response.get('id')
            print(f"   ✅ Created institution with ID: {inst_id}")
            
            # Get institutions list
            list_success, list_response = self.run_test(
                "Get institutions list",
                "GET",
                "config/instituciones",
                200
            )
            
            if list_success:
                print(f"   ✅ Found {len(list_response)} institutions total")
                return True
        return False

    def test_dropdown_options(self):
        """Test dropdown options endpoint"""
        success, response = self.run_test(
            "Get dropdown options",
            "GET",
            "dropdown-options",
            200
        )
        
        if success and response:
            required_fields = ["severidades", "estatus", "instituciones", "resultado_retest", "años", "proveedores"]
            if all(field in response for field in required_fields):
                print(f"   ✅ Severidades: {len(response['severidades'])}")
                print(f"   ✅ Estatus: {len(response['estatus'])}")
                print(f"   ✅ Instituciones: {len(response['instituciones'])}")
                print(f"   ✅ Años: {len(response['años'])}")
                return True
        return False


def main():
    print("🚀 Starting Vulnerability Management System Testing")
    print("=" * 60)
    
    # Setup
    tester = VulnerabilityManagementTester()
    
    # Test basic connectivity
    if not tester.run_test("API Root", "GET", "", 200)[0]:
        print("❌ API not accessible, stopping tests")
        return 1

    # Test Authentication System
    print("\n🔐 Testing Authentication System:")
    if not tester.test_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    tester.test_invalid_login()
    tester.test_get_me()
    tester.test_protected_route_without_auth()

    # Test User Management System
    print("\n👥 Testing User Management System:")
    tester.test_get_usuarios()
    tester.test_create_user()
    tester.test_update_user()
    tester.test_toggle_user_active()
    tester.test_delete_user()

    # Test Vulnerabilities with Permissions
    print("\n🔍 Testing Vulnerabilities System:")
    tester.test_vulnerabilities_permissions()
    tester.test_create_vulnerability()

    # Test Configuration System
    print("\n⚙️ Testing Configuration System:")
    tester.test_instituciones_crud()
    tester.test_dropdown_options()

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("❌ SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())