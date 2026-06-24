"""
Tests for Seguimiento Bitácora & Impedimentos submodule (Iteration 23).
- POST /api/seguimiento/{vuln_id}/registrar
- GET  /api/seguimiento/{vuln_id}/historial
Covers: bitácora push, veces_cambiada_fecha counter, estatus sync,
ordering desc by fecha_registro_nota, 404 / 403 / auth.
"""
import os
import time
import pytest
import requests
from pathlib import Path


def _read_env_url() -> str:
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env_url()).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token in response: {r.json()}"
    return token


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_vuln(headers):
    """Create a fresh vulnerability and PRE-INITIALIZE the bitacora array to bypass the
    known backend bug where $push fails when historial_impedimentos_seguimiento is null.
    This way we can validate the core POST/GET seguimiento logic.
    """
    payload = {
        "codigo": f"TEST_SEG_{int(time.time())}",
        "vulnerabilidad": "TEST_SEG vulnerability for bitacora module",
        "severidad": "Alta",
        "estatus": "Pendiente",
        "fecha_compromiso": "2026-03-15",
        "resultado_re_test": "Pendiente",
        "historial_impedimentos_seguimiento": [],  # workaround for null-array bug
    }
    r = requests.post(f"{API}/vulnerabilidades", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"Create vuln failed: {r.status_code} {r.text}"
    body = r.json()
    vuln_id = body.get("id") or body.get("_id")
    assert vuln_id
    yield vuln_id
    # Teardown
    try:
        requests.delete(f"{API}/vulnerabilidades/{vuln_id}", headers=headers, timeout=15)
    except Exception:
        pass


@pytest.fixture(scope="module")
def fresh_vuln_null_array(headers):
    """Vulnerability WITHOUT pre-initialized array - to demonstrate the null-array bug."""
    payload = {
        "codigo": f"TEST_SEG_NULL_{int(time.time())}",
        "vulnerabilidad": "TEST_SEG_NULL vuln no array init",
        "severidad": "Media",
        "estatus": "Pendiente",
        "fecha_compromiso": "2026-03-15",
    }
    r = requests.post(f"{API}/vulnerabilidades", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201)
    vuln_id = r.json().get("id")
    yield vuln_id
    try:
        requests.delete(f"{API}/vulnerabilidades/{vuln_id}", headers=headers, timeout=15)
    except Exception:
        pass


# ---------- Auth / 404 ----------
class TestSeguimientoAuth:
    def test_registrar_requires_auth(self, test_vuln):
        r = requests.post(
            f"{API}/seguimiento/{test_vuln}/registrar",
            json={"resultado_retest": "Pendiente"},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code}"

    def test_historial_requires_auth(self, test_vuln):
        r = requests.get(f"{API}/seguimiento/{test_vuln}/historial", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code}"

    def test_registrar_404_missing_vuln(self, headers):
        r = requests.post(
            f"{API}/seguimiento/non-existent-id/registrar",
            headers=headers,
            json={"resultado_retest": "Pendiente"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_historial_404_missing_vuln(self, headers):
        r = requests.get(
            f"{API}/seguimiento/non-existent-id/historial",
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 404


# ---------- Functional flow ----------
class TestSeguimientoFlow:
    def test_initial_historial_empty(self, headers, test_vuln):
        r = requests.get(f"{API}/seguimiento/{test_vuln}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["vulnerabilidad_id"] == test_vuln
        assert data["total_registros"] == 0
        assert data["veces_cambiada_fecha"] == 0
        assert data["historial"] == []

    def test_registrar_pendiente_does_not_change_estatus_to_cerrado(self, headers, test_vuln):
        # Same fecha => counter must NOT increment
        payload = {
            "resultado_retest": "Pendiente",
            "fecha_compromiso_asignada": "2026-03-15",
            "notas_impedimento": "TEST_SEG nota inicial",
        }
        r = requests.post(
            f"{API}/seguimiento/{test_vuln}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["fecha_cambiada"] is False
        assert data["veces_cambiada_fecha"] == 0
        vuln = data["vulnerabilidad"]
        # Pendiente => estatus Pendiente
        assert vuln["estatus"] == "Pendiente"
        assert vuln["resultado_re_test"] == "Pendiente"
        assert len(vuln["historial_impedimentos_seguimiento"]) == 1
        entry = vuln["historial_impedimentos_seguimiento"][0]
        assert "id_accion" in entry and len(entry["id_accion"]) >= 8
        assert entry["resultado_retest"] == "Pendiente"
        assert entry["notas_impedimento"] == "TEST_SEG nota inicial"
        assert entry["usuario_registro"]

    def test_registrar_with_new_date_increments_counter(self, headers, test_vuln):
        payload = {
            "resultado_retest": "Impedimento",
            "fecha_compromiso_asignada": "2026-04-20",  # different
            "notas_impedimento": "TEST_SEG bloqueo recurso",
        }
        r = requests.post(
            f"{API}/seguimiento/{test_vuln}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["fecha_cambiada"] is True
        assert data["veces_cambiada_fecha"] == 1
        vuln = data["vulnerabilidad"]
        assert vuln["fecha_compromiso"] == "2026-04-20"
        # Impedimento => estatus Pendiente
        assert vuln["estatus"] == "Pendiente"
        assert len(vuln["historial_impedimentos_seguimiento"]) == 2

    def test_registrar_same_date_does_not_increment(self, headers, test_vuln):
        payload = {
            "resultado_retest": "Vulnerable",
            "fecha_compromiso_asignada": "2026-04-20",  # SAME as previous => no inc
            "notas_impedimento": "TEST_SEG sigue vulnerable",
        }
        r = requests.post(
            f"{API}/seguimiento/{test_vuln}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["fecha_cambiada"] is False
        assert data["veces_cambiada_fecha"] == 1  # unchanged
        # Vulnerable => Pendiente
        assert data["vulnerabilidad"]["estatus"] == "Pendiente"

    def test_registrar_corregido_sets_cerrado(self, headers, test_vuln):
        payload = {
            "resultado_retest": "Corregido",
            "fecha_compromiso_asignada": "2026-05-10",
            "notas_impedimento": "TEST_SEG remediado",
        }
        r = requests.post(
            f"{API}/seguimiento/{test_vuln}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["fecha_cambiada"] is True
        assert data["veces_cambiada_fecha"] == 2  # new date again
        vuln = data["vulnerabilidad"]
        assert vuln["estatus"] == "Cerrado"
        assert vuln["resultado_re_test"] == "Corregido"

    def test_historial_ordered_desc_and_counters(self, headers, test_vuln):
        r = requests.get(f"{API}/seguimiento/{test_vuln}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # 4 entries by now: Pendiente, Impedimento, Vulnerable, Corregido
        assert data["total_registros"] == 4
        assert data["veces_cambiada_fecha"] == 2
        assert data["estatus_actual"] == "Cerrado"
        assert data["resultado_retest_actual"] == "Corregido"
        # Validate ordering: fecha_registro_nota descending
        dates = [h["fecha_registro_nota"] for h in data["historial"]]
        assert dates == sorted(dates, reverse=True), "Historial must be sorted desc by fecha_registro_nota"
        # Latest should be the Corregido entry
        assert data["historial"][0]["resultado_retest"] == "Corregido"
        # Validate required keys in every entry
        required = {
            "id_accion",
            "fecha_registro_nota",
            "resultado_retest",
            "fecha_compromiso_asignada",
            "notas_impedimento",
            "usuario_registro",
        }
        for h in data["historial"]:
            assert required.issubset(h.keys()), f"Missing keys: {required - set(h.keys())}"

    def test_registrar_desestimado_sets_cerrado(self, headers, test_vuln):
        payload = {
            "resultado_retest": "Desestimado",
            "fecha_compromiso_asignada": "2026-05-10",  # same as previous => no inc
            "notas_impedimento": "TEST_SEG falso positivo",
        }
        r = requests.post(
            f"{API}/seguimiento/{test_vuln}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["fecha_cambiada"] is False
        assert data["veces_cambiada_fecha"] == 2
        assert data["vulnerabilidad"]["estatus"] == "Cerrado"

    def test_get_after_no_changes_persists(self, headers, test_vuln):
        # Final verification via GET
        r = requests.get(f"{API}/seguimiento/{test_vuln}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total_registros"] == 5
        assert data["veces_cambiada_fecha"] == 2


# ---------- Known bug regression: null array ----------
class TestSeguimientoNullArrayBug:
    """These tests document a known backend bug: when a vulnerability is created without
    explicitly providing historial_impedimentos_seguimiento=[], the field is stored as
    null in MongoDB. Then:
      - GET /historial returns 500 (sorted(None) raises TypeError)
      - POST /registrar returns 500 (Mongo $push on null field fails)
    """
    def test_get_historial_returns_500_when_array_is_null(self, headers, fresh_vuln_null_array):
        r = requests.get(
            f"{API}/seguimiento/{fresh_vuln_null_array}/historial",
            headers=headers, timeout=15,
        )
        # BUG: should be 200 with empty historial, currently returns 500
        assert r.status_code == 500, (
            f"Expected 500 (documented bug). If this fails with 200 the bug is fixed."
        )

    def test_post_registrar_returns_500_when_array_is_null(self, headers, fresh_vuln_null_array):
        r = requests.post(
            f"{API}/seguimiento/{fresh_vuln_null_array}/registrar",
            headers=headers,
            json={"resultado_retest": "Pendiente", "fecha_compromiso_asignada": "2026-04-01"},
            timeout=15,
        )
        # BUG: should be 200, currently returns 500
        assert r.status_code == 500, (
            f"Expected 500 (documented bug). If this fails with 200 the bug is fixed."
        )
