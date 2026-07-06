"""
Tests for Pivot Analysis endpoint (Dashboard GRC)
Verifies GET /api/dashboard/data returns:
- datos_vulnerabilidades: array with pentest-specific fields
- datos_hallazgos: array with audit-specific fields
- Fields must be separate (not mixed)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://secfind-board.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token returned: {data}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestDashboardDataPivot:
    """Tests for /api/dashboard/data endpoint - Pivot Analysis data."""

    def test_dashboard_data_status(self, headers):
        r = requests.get(f"{API}/dashboard/data", headers=headers, timeout=60)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"

    def test_dashboard_data_has_pivot_keys(self, headers):
        r = requests.get(f"{API}/dashboard/data", headers=headers, timeout=60)
        data = r.json()
        # Must contain BOTH separate arrays
        assert "datos_vulnerabilidades" in data, "Missing 'datos_vulnerabilidades' key"
        assert "datos_hallazgos" in data, "Missing 'datos_hallazgos' key"
        assert isinstance(data["datos_vulnerabilidades"], list), "datos_vulnerabilidades must be a list"
        assert isinstance(data["datos_hallazgos"], list), "datos_hallazgos must be a list"

    def test_datos_vulnerabilidades_has_pentest_fields(self, headers):
        r = requests.get(f"{API}/dashboard/data", headers=headers, timeout=60)
        data = r.json()
        vulns = data["datos_vulnerabilidades"]
        if len(vulns) == 0:
            pytest.skip("No vulnerabilities in DB to validate field schema")

        sample = vulns[0]
        expected_pentest_fields = [
            "codigo", "vulnerabilidad", "severidad", "nivel_riesgo", "estatus",
            "responsable", "institucion", "aplicacion", "informe_pentest",
            "proveedor", "dominio", "mes_deteccion", "resultado_retest", "veces_retest"
        ]
        for f in expected_pentest_fields:
            assert f in sample, f"Missing pentest field '{f}' in datos_vulnerabilidades[0]. Sample: {list(sample.keys())}"

        # Fields that belong ONLY to hallazgos MUST NOT be present in vulnerabilidades
        forbidden = ["brecha", "control", "probabilidad", "impacto", "riesgo_inherente"]
        for f in forbidden:
            assert f not in sample, f"Field '{f}' is audit-only and should NOT be in datos_vulnerabilidades"

    def test_datos_hallazgos_has_audit_fields(self, headers):
        r = requests.get(f"{API}/dashboard/data", headers=headers, timeout=60)
        data = r.json()
        halls = data["datos_hallazgos"]
        if len(halls) == 0:
            pytest.skip("No hallazgos in DB to validate field schema")

        sample = halls[0]
        expected_audit_fields = [
            "codigo", "brecha", "nivel_riesgo", "estado", "responsable",
            "dominio", "control", "mes_deteccion", "probabilidad", "impacto",
            "riesgo_inherente"
        ]
        for f in expected_audit_fields:
            assert f in sample, f"Missing audit field '{f}' in datos_hallazgos[0]. Sample: {list(sample.keys())}"

        # Fields that are pentest-only MUST NOT be in hallazgos
        forbidden = ["vulnerabilidad", "severidad", "estatus", "informe_pentest",
                     "proveedor", "aplicacion", "resultado_retest", "veces_retest"]
        for f in forbidden:
            assert f not in sample, f"Field '{f}' is pentest-only and should NOT be in datos_hallazgos"

    def test_datos_are_separate_not_mixed(self, headers):
        """Ensure the two arrays are independent (schemas do not intersect on unique fields)."""
        r = requests.get(f"{API}/dashboard/data", headers=headers, timeout=60)
        data = r.json()
        vulns = data["datos_vulnerabilidades"]
        halls = data["datos_hallazgos"]

        if not vulns or not halls:
            pytest.skip("Need both vulnerabilidades and hallazgos data to compare schemas")

        # A vuln item should NOT look like a hallazgo item
        assert "vulnerabilidad" in vulns[0]
        assert "brecha" not in vulns[0]
        assert "brecha" in halls[0]
        assert "vulnerabilidad" not in halls[0]

    def test_dashboard_data_other_keys_present(self, headers):
        """Sanity: dashboard response still contains its regular sections."""
        r = requests.get(f"{API}/dashboard/data", headers=headers, timeout=60)
        data = r.json()
        for k in ["kpis", "matriz_4x4", "mapa_calor_grc", "panel_severidad", "top_dominios", "opciones_filtros"]:
            assert k in data, f"Missing key '{k}' in dashboard/data response"
