"""
Tests for Dashboard GRC (Unified Command Dashboard)
- GET /api/dashboard/data  (with and without filters)
- GET /api/dashboard/vistas
- POST /api/dashboard/vistas (create + update + uniqueness validations)
- DELETE /api/dashboard/vistas/{id}
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://secfind-board.preview.emergentagent.com').rstrip('/')
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ===================== /api/dashboard/data =====================

class TestDashboardData:

    def test_data_structure_no_filters(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/data", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Structure
        for key in ["kpis", "matriz_5x5", "panel_severidad", "top_dominios", "filtros_aplicados", "opciones_filtros"]:
            assert key in data, f"missing key: {key}"

        # KPIs
        kpis = data["kpis"]
        for k in ["vulnerabilidades_activas", "hallazgos_abiertos", "indice_exposicion",
                  "desglose_severidad", "riesgo_promedio_hallazgos",
                  "riesgo_max_hallazgos", "riesgo_total_hallazgos"]:
            assert k in kpis, f"missing kpi: {k}"
        for sev in ["Critica", "Alta", "Media", "Baja"]:
            assert sev in kpis["desglose_severidad"]
            assert isinstance(kpis["desglose_severidad"][sev], int)

        # Matriz 5x5
        m = data["matriz_5x5"]
        assert "celdas" in m and isinstance(m["celdas"], list)
        assert "total_hallazgos" in m and isinstance(m["total_hallazgos"], int)

        # Panel severidad
        ps = data["panel_severidad"]
        assert "por_severidad" in ps and isinstance(ps["por_severidad"], list)
        assert "resumen" in ps
        assert "total" in ps
        assert len(ps["por_severidad"]) == 4

        # Top dominios
        assert isinstance(data["top_dominios"], list)
        assert len(data["top_dominios"]) <= 5
        if data["top_dominios"]:
            d0 = data["top_dominios"][0]
            for k in ["dominio", "vulnerabilidades", "hallazgos", "score_combinado"]:
                assert k in d0

        # Opciones filtros
        opts = data["opciones_filtros"]
        for k in ["informes", "dominios", "responsables", "estados_vulnerabilidad", "estados_hallazgo"]:
            assert k in opts and isinstance(opts[k], list)
        assert "Pendiente" in opts["estados_vulnerabilidad"]
        assert "Abierto" in opts["estados_hallazgo"]

    def test_data_with_filters_query_params(self, auth_headers):
        # Use safe filter values that should not break and should parse correctly
        params = {
            "estados_vuln": "Pendiente,En Proceso",
            "estados_hall": "Abierto",
        }
        r = requests.get(f"{BASE_URL}/api/dashboard/data", headers=auth_headers, params=params, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        applied = data["filtros_aplicados"]
        assert applied["estados_vulnerabilidad"] == ["Pendiente", "En Proceso"]
        assert applied["estados_hallazgo"] == ["Abierto"]

    def test_data_with_dominio_filter(self, auth_headers):
        # Get an existing dominio from options
        r = requests.get(f"{BASE_URL}/api/dashboard/data", headers=auth_headers, timeout=30)
        opts = r.json()["opciones_filtros"]
        dominio = opts["dominios"][0] if opts["dominios"] else "Sin Dominio"

        r2 = requests.get(f"{BASE_URL}/api/dashboard/data",
                          headers=auth_headers, params={"dominios": dominio}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["filtros_aplicados"]["dominios"] == [dominio]

    def test_data_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/data", timeout=20)
        assert r.status_code in (401, 403)


# ===================== /api/dashboard/vistas =====================

class TestDashboardVistas:

    def test_list_vistas_returns_array(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_vista_success(self, auth_headers):
        nombre = f"TEST_vista_{uuid.uuid4().hex[:8]}"
        payload = {
            "nombre": nombre,
            "es_publica": False,
            "informes_seleccionados": [],
            "filtros": {"dominios": [], "responsables": [],
                        "estados_vulnerabilidad": [], "estados_hallazgo": []}
        }
        r = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        vista_id = data["id"]

        # GET to verify it appears in list
        r2 = requests.get(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers, timeout=20)
        ids = [v["id"] for v in r2.json()]
        assert vista_id in ids
        found = next(v for v in r2.json() if v["id"] == vista_id)
        assert found["nombre"] == nombre
        assert found["es_publica"] is False
        assert "creado_por_nombre" in found

        # Cleanup
        requests.delete(f"{BASE_URL}/api/dashboard/vistas/{vista_id}", headers=auth_headers, timeout=20)

    def test_create_vista_duplicate_name_fails(self, auth_headers):
        nombre = f"TEST_dup_{uuid.uuid4().hex[:8]}"
        payload = {"nombre": nombre, "es_publica": False}
        r1 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers, json=payload, timeout=20)
        assert r1.status_code == 200
        vista_id = r1.json()["id"]
        try:
            r2 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers, json=payload, timeout=20)
            assert r2.status_code == 400
            assert "nombre" in r2.text.lower()
        finally:
            requests.delete(f"{BASE_URL}/api/dashboard/vistas/{vista_id}", headers=auth_headers, timeout=20)

    def test_create_vista_empty_name_fails(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                          json={"nombre": "   "}, timeout=20)
        assert r.status_code == 400

    def test_update_vista_via_post_with_id(self, auth_headers):
        nombre = f"TEST_upd_{uuid.uuid4().hex[:8]}"
        r1 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                           json={"nombre": nombre}, timeout=20)
        assert r1.status_code == 200
        vista_id = r1.json()["id"]
        try:
            new_name = nombre + "_v2"
            update = {
                "id": vista_id, "nombre": new_name, "es_publica": False,
                "informes_seleccionados": ["informeX"],
                "filtros": {"dominios": ["Sin Dominio"], "responsables": [],
                            "estados_vulnerabilidad": [], "estados_hallazgo": []}
            }
            r2 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                               json=update, timeout=20)
            assert r2.status_code == 200, r2.text

            # Verify persistence
            r3 = requests.get(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers, timeout=20)
            v = next(x for x in r3.json() if x["id"] == vista_id)
            assert v["nombre"] == new_name
            assert v["informes_seleccionados"] == ["informeX"]
            assert v["filtros"]["dominios"] == ["Sin Dominio"]
        finally:
            requests.delete(f"{BASE_URL}/api/dashboard/vistas/{vista_id}", headers=auth_headers, timeout=20)

    def test_create_public_vista_and_duplicate_public_fails(self, auth_headers):
        nombre = f"TEST_pub_{uuid.uuid4().hex[:8]}"
        r1 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                           json={"nombre": nombre, "es_publica": True}, timeout=20)
        assert r1.status_code == 200
        vid = r1.json()["id"]
        try:
            # Different user-side scenario not testable here, but same admin creating same public
            # name should still fail by user duplicate rule
            r2 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                               json={"nombre": nombre, "es_publica": True}, timeout=20)
            assert r2.status_code == 400
        finally:
            requests.delete(f"{BASE_URL}/api/dashboard/vistas/{vid}", headers=auth_headers, timeout=20)

    def test_delete_vista_and_verify_removed(self, auth_headers):
        nombre = f"TEST_del_{uuid.uuid4().hex[:8]}"
        r1 = requests.post(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers,
                           json={"nombre": nombre}, timeout=20)
        vid = r1.json()["id"]
        r2 = requests.delete(f"{BASE_URL}/api/dashboard/vistas/{vid}", headers=auth_headers, timeout=20)
        assert r2.status_code == 200
        # Verify removed
        r3 = requests.get(f"{BASE_URL}/api/dashboard/vistas", headers=auth_headers, timeout=20)
        ids = [v["id"] for v in r3.json()]
        assert vid not in ids

    def test_delete_nonexistent_vista_returns_404(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/dashboard/vistas/{uuid.uuid4()}",
                            headers=auth_headers, timeout=20)
        assert r.status_code == 404
