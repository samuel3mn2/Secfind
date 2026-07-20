"""
Iteration 32 - Test backend features:
1. Normalization 'En Retest' <-> 'Para Re Test' (bidirectional)
2. Filter resultado_retest on /api/vulnerabilidades (accepts 'En Retest')
3. Reopening logic: closed vuln -> reopened generates automatic note
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://secfind-board.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def _create_vuln(client, suffix, extra=None):
    payload = {
        "vulnerabilidad": f"TEST_Iter32_{suffix}_{uuid.uuid4().hex[:6]}",
        "descripcion": "Test iter 32",
        "severidad": "Alto",
        "estatus": "Pendiente",
        "institucion": "TEST_INST",
        "fecha_hallazgo": "2025-01-01",
    }
    if extra:
        payload.update(extra)
    r = client.post(f"{API}/vulnerabilidades", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _delete_vuln(client, vid):
    try:
        client.delete(f"{API}/vulnerabilidades/{vid}", timeout=15)
    except Exception:
        pass


class TestNormalizationEnRetest:
    """Backend normalization: 'En Retest' from frontend -> 'Para Re Test' in DB"""

    def test_registrar_seguimiento_en_retest_stored_as_para_re_test(self, client):
        """
        BUG CHECK: The POST /api/seguimiento/{id}/registrar endpoint MUST accept
        'En Retest' from the frontend and normalize it to 'Para Re Test' in DB.
        Frontend SeguimientoForm.jsx sends 'En Retest' string.
        """
        v = _create_vuln(client, "NormRegistrar")
        vid = v["id"]
        try:
            r = client.post(
                f"{API}/seguimiento/{vid}/registrar",
                json={
                    "resultado_retest": "En Retest",
                    "notas_impedimento": "Prueba normalización",
                },
                timeout=30,
            )
            # Expected: 200 (with normalization). Actual observed: 422 (Pydantic Literal rejects "En Retest")
            assert r.status_code == 200, f"CRITICAL: POST /seguimiento/{{id}}/registrar rejects 'En Retest': {r.status_code} {r.text}"
            g = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15)
            assert g.status_code == 200
            data = g.json()
            # DB stores 'Para Re Test' internally
            assert data.get("resultado_re_test") == "Para Re Test", data.get("resultado_re_test")
        finally:
            _delete_vuln(client, vid)

    def test_registrar_seguimiento_para_re_test_still_works(self, client):
        """Sanity: raw 'Para Re Test' still accepted by the POST endpoint."""
        v = _create_vuln(client, "RawParaReTest")
        vid = v["id"]
        try:
            r = client.post(
                f"{API}/seguimiento/{vid}/registrar",
                json={"resultado_retest": "Para Re Test", "notas_impedimento": "raw"},
                timeout=30,
            )
            assert r.status_code == 200, r.text
            g = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15).json()
            assert g.get("resultado_re_test") == "Para Re Test"
        finally:
            _delete_vuln(client, vid)

    def test_update_vuln_en_retest_normalizes_to_para_re_test(self, client):
        v = _create_vuln(client, "NormUpdate")
        vid = v["id"]
        try:
            r = client.put(
                f"{API}/vulnerabilidades/{vid}",
                json={"resultado_re_test": "En Retest"},
                timeout=30,
            )
            assert r.status_code == 200, r.text
            g = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15)
            assert g.json().get("resultado_re_test") == "Para Re Test"
        finally:
            _delete_vuln(client, vid)


class TestFilterResultadoRetest:
    """Filter resultado_retest on /api/vulnerabilidades accepts 'En Retest'"""

    def test_filter_en_retest_returns_para_re_test_records(self, client):
        v = _create_vuln(client, "FilterEnRetest")
        vid = v["id"]
        try:
            # Put it in "Para Re Test" via PUT (which does normalize)
            r = client.put(
                f"{API}/vulnerabilidades/{vid}",
                json={"resultado_re_test": "En Retest"},
                timeout=30,
            )
            assert r.status_code == 200, r.text

            # Filter using 'En Retest' from frontend
            resp = client.get(f"{API}/vulnerabilidades?resultado_retest=En Retest&per_page=500", timeout=30)
            assert resp.status_code == 200, resp.text
            body = resp.json()
            items = body if isinstance(body, list) else (body.get("items") or body.get("vulnerabilidades") or [])
            ids = [x.get("id") for x in items]
            assert vid in ids, f"Expected {vid} in filtered list. items count={len(items)}"
            # All returned must have resultado_re_test = 'Para Re Test'
            for x in items:
                assert x.get("resultado_re_test") == "Para Re Test", x.get("resultado_re_test")
        finally:
            _delete_vuln(client, vid)

    def test_filter_para_re_test_still_works(self, client):
        """Backwards compat: filter accepts raw 'Para Re Test' too"""
        v = _create_vuln(client, "FilterParaReTest")
        vid = v["id"]
        try:
            r = client.put(f"{API}/vulnerabilidades/{vid}", json={"resultado_re_test": "En Retest"}, timeout=30)
            assert r.status_code == 200
            resp = client.get(f"{API}/vulnerabilidades?resultado_retest=Para Re Test&per_page=500", timeout=30)
            assert resp.status_code == 200
            body = resp.json()
            items = body if isinstance(body, list) else (body.get("items") or body.get("vulnerabilidades") or [])
            ids = [x.get("id") for x in items]
            assert vid in ids
        finally:
            _delete_vuln(client, vid)


class TestReaperturaAutomatica:
    """Reopening a closed vuln generates automatic note in historial"""

    def test_reabrir_vuln_cerrada_agrega_nota_automatica(self, client):
        v = _create_vuln(client, "Reapertura")
        vid = v["id"]
        try:
            # 1) Cerrar la vuln (resultado Corregido -> estatus Cerrado + fecha_cierre)
            r = client.put(
                f"{API}/vulnerabilidades/{vid}",
                json={"resultado_re_test": "Corregido"},
                timeout=30,
            )
            assert r.status_code == 200, r.text
            g = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15).json()
            assert g.get("estatus") == "Cerrado"
            fecha_cierre_prev = g.get("fecha_cierre")
            assert fecha_cierre_prev is not None, "fecha_cierre debería ser establecida al cerrar"

            hist_before = len(g.get("historial_impedimentos_seguimiento") or [])

            # 2) Reabrir cambiando a Vulnerable
            r2 = client.put(
                f"{API}/vulnerabilidades/{vid}",
                json={"resultado_re_test": "Vulnerable"},
                timeout=30,
            )
            assert r2.status_code == 200, r2.text

            g2 = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15).json()
            assert g2.get("estatus") == "Pendiente"
            assert g2.get("fecha_cierre") in (None, "", "null"), f"fecha_cierre debe limpiarse: {g2.get('fecha_cierre')}"

            hist_after = g2.get("historial_impedimentos_seguimiento") or []
            assert len(hist_after) >= hist_before + 1, "Debería existir nota automática nueva en el historial"

            # verificar la nota de reapertura
            notas_reapertura = [
                h for h in hist_after
                if (h.get("resultado_retest") == "Nota de Seguimiento"
                    and "reabierta" in (h.get("notas_impedimento") or "").lower())
            ]
            assert len(notas_reapertura) >= 1, f"No se encontró nota automática de reapertura. hist={hist_after}"
        finally:
            _delete_vuln(client, vid)

    def test_reabrir_con_en_retest_tambien_agrega_nota(self, client):
        v = _create_vuln(client, "ReaperturaEnRetest")
        vid = v["id"]
        try:
            # Cerrar
            r = client.put(f"{API}/vulnerabilidades/{vid}", json={"resultado_re_test": "Desestimado"}, timeout=30)
            assert r.status_code == 200
            g = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15).json()
            assert g.get("estatus") == "Cerrado"

            # Reabrir con En Retest (frontend)
            r2 = client.put(f"{API}/vulnerabilidades/{vid}", json={"resultado_re_test": "En Retest"}, timeout=30)
            assert r2.status_code == 200

            g2 = client.get(f"{API}/vulnerabilidades/{vid}", timeout=15).json()
            assert g2.get("estatus") == "Pendiente"
            assert g2.get("resultado_re_test") == "Para Re Test"  # normalizado
            assert g2.get("fecha_cierre") in (None, "", "null")

            hist = g2.get("historial_impedimentos_seguimiento") or []
            notas_reapertura = [
                h for h in hist
                if (h.get("resultado_retest") == "Nota de Seguimiento"
                    and "reabierta" in (h.get("notas_impedimento") or "").lower())
            ]
            assert len(notas_reapertura) >= 1
        finally:
            _delete_vuln(client, vid)


class TestDashboardStatsPaRetest:
    """Dashboard stats includes Para Re Test count (frontend labels as 'En Retest')"""

    def test_dashboard_stats_endpoint_works(self, client):
        r = client.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Basic sanity - just ensure endpoint returns dict
        assert isinstance(data, dict)
