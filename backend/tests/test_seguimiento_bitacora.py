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

    def test_registrar_pendiente_same_date_increments_retest(self, headers, test_vuln):
        """Pendiente with SAME fecha => CASO B: retest fallido, incrementa veces_en_retest"""
        payload = {
            "resultado_retest": "Pendiente",
            "fecha_compromiso_asignada": "2026-03-15",  # Same as initial
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
        # CASO B: misma fecha => SÍ incrementa veces_en_retest
        assert vuln.get("veces_en_retest", 0) == 1, "Pendiente + same date should increment veces_en_retest"
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
        """Corregido: estatus=Cerrado, fecha ignorada (estado de cierre)"""
        payload = {
            "resultado_retest": "Corregido",
            "fecha_compromiso_asignada": "2026-05-10",  # Should be ignored for cierre
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
        # Corregido es estado de cierre: fecha_compromiso_asignada se ignora
        assert data["fecha_cambiada"] is False, "Corregido should not change fecha (estado de cierre)"
        assert data["veces_cambiada_fecha"] == 1  # unchanged from Impedimento test
        vuln = data["vulnerabilidad"]
        assert vuln["estatus"] == "Cerrado"
        assert vuln["resultado_re_test"] == "Corregido"
        # Bitacora entry should have fecha_compromiso_asignada as None
        entry = data.get("entrada_bitacora", {})
        assert entry.get("fecha_compromiso_asignada") is None, "Corregido bitacora should have null date"

    def test_historial_ordered_desc_and_counters(self, headers, test_vuln):
        r = requests.get(f"{API}/seguimiento/{test_vuln}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # 4 entries by now: Pendiente, Impedimento, Vulnerable, Corregido
        assert data["total_registros"] == 4
        # veces_cambiada_fecha: only Impedimento changed date (Corregido ignores date)
        assert data["veces_cambiada_fecha"] == 1, f"Expected 1, got {data.get('veces_cambiada_fecha')}"
        # veces_en_retest: Pendiente(same date=1) + Impedimento(0) + Vulnerable(1) + Corregido(1) = 3
        assert data["veces_en_retest"] == 3, f"Expected 3, got {data.get('veces_en_retest')}"
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
        """Desestimado: estatus=Cerrado, fecha ignorada (estado de cierre)"""
        payload = {
            "resultado_retest": "Desestimado",
            "fecha_compromiso_asignada": "2026-05-10",  # Should be ignored
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
        assert data["fecha_cambiada"] is False, "Desestimado should not change fecha"
        assert data["veces_cambiada_fecha"] == 1  # unchanged
        assert data["vulnerabilidad"]["estatus"] == "Cerrado"

    def test_get_after_no_changes_persists(self, headers, test_vuln):
        # Final verification via GET
        r = requests.get(f"{API}/seguimiento/{test_vuln}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total_registros"] == 5
        assert data["veces_cambiada_fecha"] == 1  # Only Impedimento changed date
        # veces_en_retest: Pendiente(1) + Impedimento(0) + Vulnerable(1) + Corregido(1) + Desestimado(1) = 4
        assert data["veces_en_retest"] == 4, f"Expected 4, got {data.get('veces_en_retest')}"


# ---------- Known bug regression: null array (NOW FIXED) ----------
class TestSeguimientoNullArrayBug:
    """These tests documented a known backend bug that has been FIXED:
    When a vulnerability is created without explicitly providing 
    historial_impedimentos_seguimiento=[], the field was stored as null in MongoDB.
    
    The fix normalizes null to [] before $push operations.
    """
    def test_get_historial_returns_200_with_null_array(self, headers, fresh_vuln_null_array):
        r = requests.get(
            f"{API}/seguimiento/{fresh_vuln_null_array}/historial",
            headers=headers, timeout=15,
        )
        # BUG FIXED: Now returns 200 with empty historial
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["historial"] == []
        assert data["total_registros"] == 0

    def test_post_registrar_returns_200_with_null_array(self, headers, fresh_vuln_null_array):
        r = requests.post(
            f"{API}/seguimiento/{fresh_vuln_null_array}/registrar",
            headers=headers,
            json={"resultado_retest": "Pendiente", "fecha_compromiso_asignada": "2026-04-01"},
            timeout=15,
        )
        # BUG FIXED: Now returns 200 and initializes array
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert len(data["vulnerabilidad"]["historial_impedimentos_seguimiento"]) == 1


# ---------- NEW: Pendiente Exclusion Logic Tests ----------
class TestPendienteExclusionLogic:
    """Tests for the mutual exclusion rule for 'Pendiente' state:
    
    CASO A (Prórroga/Reprogramación): fecha_nueva != fecha_actual
      → SÍ incrementa veces_cambiada_fecha
      → NO incrementa veces_en_retest
    
    CASO B (Retest fallido): fecha_nueva == fecha_actual
      → SÍ incrementa veces_en_retest
      → NO incrementa veces_cambiada_fecha
    """
    
    @pytest.fixture
    def vuln_for_pendiente_tests(self, headers):
        """Create a vulnerability specifically for Pendiente exclusion tests."""
        payload = {
            "codigo": f"TEST_PEND_{int(time.time())}",
            "vulnerabilidad": "TEST vuln for Pendiente exclusion logic",
            "severidad": "Alta",
            "estatus": "Pendiente",
            "fecha_compromiso": "2026-06-15",
            "resultado_re_test": "Pendiente",
            "veces_en_retest": 0,
            "veces_cambiada_fecha": 0,
            "historial_impedimentos_seguimiento": [],
        }
        r = requests.post(f"{API}/vulnerabilidades", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Create vuln failed: {r.status_code} {r.text}"
        vuln_id = r.json().get("id")
        yield vuln_id
        try:
            requests.delete(f"{API}/vulnerabilidades/{vuln_id}", headers=headers, timeout=15)
        except Exception:
            pass

    def test_pendiente_with_new_date_increments_only_fecha_counter(self, headers, vuln_for_pendiente_tests):
        """CASO A: Prórroga - fecha cambia, NO debe incrementar veces_en_retest"""
        vuln_id = vuln_for_pendiente_tests
        
        # First, get initial state
        r = requests.get(f"{API}/seguimiento/{vuln_id}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        initial = r.json()
        initial_retest = initial.get("veces_en_retest", 0)
        initial_fecha = initial.get("veces_cambiada_fecha", 0)
        
        # Register Pendiente with NEW date (prórroga)
        payload = {
            "resultado_retest": "Pendiente",
            "fecha_compromiso_asignada": "2026-07-30",  # DIFFERENT from 2026-06-15
            "notas_impedimento": "Prórroga solicitada por área responsable",
        }
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        
        # ASSERTIONS for CASO A
        assert data["fecha_cambiada"] is True, "fecha_cambiada should be True"
        vuln = data["vulnerabilidad"]
        
        # veces_cambiada_fecha SHOULD increment
        assert vuln.get("veces_cambiada_fecha", 0) == initial_fecha + 1, \
            f"veces_cambiada_fecha should be {initial_fecha + 1}, got {vuln.get('veces_cambiada_fecha')}"
        
        # veces_en_retest should NOT increment (prórroga != retest técnico)
        assert vuln.get("veces_en_retest", 0) == initial_retest, \
            f"veces_en_retest should stay at {initial_retest} (prórroga), got {vuln.get('veces_en_retest')}"
        
        # Verify fecha_compromiso was updated
        assert vuln["fecha_compromiso"] == "2026-07-30"

    def test_pendiente_with_same_date_increments_only_retest_counter(self, headers, vuln_for_pendiente_tests):
        """CASO B: Retest fallido - misma fecha, SÍ debe incrementar veces_en_retest"""
        vuln_id = vuln_for_pendiente_tests
        
        # Get current state (after previous test may have run)
        r = requests.get(f"{API}/seguimiento/{vuln_id}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        current = r.json()
        current_retest = current.get("veces_en_retest", 0)
        current_fecha = current.get("veces_cambiada_fecha", 0)
        current_fecha_compromiso = current.get("fecha_compromiso_actual", "2026-07-30")
        
        # Register Pendiente with SAME date (retest fallido)
        payload = {
            "resultado_retest": "Pendiente",
            "fecha_compromiso_asignada": current_fecha_compromiso,  # SAME date
            "notas_impedimento": "Retest ejecutado pero vulnerabilidad persiste",
        }
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        
        # ASSERTIONS for CASO B
        assert data["fecha_cambiada"] is False, "fecha_cambiada should be False"
        vuln = data["vulnerabilidad"]
        
        # veces_en_retest SHOULD increment (retest técnico ejecutado)
        assert vuln.get("veces_en_retest", 0) == current_retest + 1, \
            f"veces_en_retest should be {current_retest + 1}, got {vuln.get('veces_en_retest')}"
        
        # veces_cambiada_fecha should NOT increment
        assert vuln.get("veces_cambiada_fecha", 0) == current_fecha, \
            f"veces_cambiada_fecha should stay at {current_fecha}, got {vuln.get('veces_cambiada_fecha')}"

    def test_pendiente_without_date_increments_retest_counter(self, headers, vuln_for_pendiente_tests):
        """CASO B variant: No fecha enviada = retest fallido"""
        vuln_id = vuln_for_pendiente_tests
        
        # Get current state
        r = requests.get(f"{API}/seguimiento/{vuln_id}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        current = r.json()
        current_retest = current.get("veces_en_retest", 0)
        current_fecha = current.get("veces_cambiada_fecha", 0)
        
        # Register Pendiente WITHOUT date
        payload = {
            "resultado_retest": "Pendiente",
            "notas_impedimento": "Retest sin cambio de fecha",
        }
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        vuln = data["vulnerabilidad"]
        
        # veces_en_retest SHOULD increment
        assert vuln.get("veces_en_retest", 0) == current_retest + 1, \
            f"veces_en_retest should increment when no date change"
        
        # veces_cambiada_fecha should NOT increment
        assert vuln.get("veces_cambiada_fecha", 0) == current_fecha

    def test_impedimento_with_new_date_does_not_increment_retest(self, headers, vuln_for_pendiente_tests):
        """Impedimento: fecha cambia but veces_en_retest stays frozen"""
        vuln_id = vuln_for_pendiente_tests
        
        # Get current state
        r = requests.get(f"{API}/seguimiento/{vuln_id}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        current = r.json()
        current_retest = current.get("veces_en_retest", 0)
        current_fecha = current.get("veces_cambiada_fecha", 0)
        
        # Register Impedimento with NEW date
        payload = {
            "resultado_retest": "Impedimento",
            "fecha_compromiso_asignada": "2026-09-01",  # New date
            "notas_impedimento": "Bloqueo por falta de ambiente",
        }
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        vuln = data["vulnerabilidad"]
        
        # veces_en_retest should NOT increment (Impedimento)
        assert vuln.get("veces_en_retest", 0) == current_retest, \
            f"veces_en_retest should stay frozen for Impedimento"
        
        # veces_cambiada_fecha SHOULD increment
        assert vuln.get("veces_cambiada_fecha", 0) == current_fecha + 1

    def test_vulnerable_always_increments_retest(self, headers, vuln_for_pendiente_tests):
        """Vulnerable: ALWAYS increments veces_en_retest regardless of date"""
        vuln_id = vuln_for_pendiente_tests
        
        # Get current state
        r = requests.get(f"{API}/seguimiento/{vuln_id}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        current = r.json()
        current_retest = current.get("veces_en_retest", 0)
        
        # Register Vulnerable
        payload = {
            "resultado_retest": "Vulnerable",
            "notas_impedimento": "Validación técnica confirma vulnerabilidad activa",
        }
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        vuln = r.json()["vulnerabilidad"]
        
        # veces_en_retest MUST increment
        assert vuln.get("veces_en_retest", 0) == current_retest + 1, \
            f"veces_en_retest MUST increment for Vulnerable"

    def test_corregido_always_increments_retest_and_ignores_date(self, headers, vuln_for_pendiente_tests):
        """Corregido: ALWAYS increments veces_en_retest, date forced to null"""
        vuln_id = vuln_for_pendiente_tests
        
        # Get current state
        r = requests.get(f"{API}/seguimiento/{vuln_id}/historial", headers=headers, timeout=15)
        assert r.status_code == 200
        current = r.json()
        current_retest = current.get("veces_en_retest", 0)
        current_fecha = current.get("veces_cambiada_fecha", 0)
        
        # Register Corregido (with date that should be ignored)
        payload = {
            "resultado_retest": "Corregido",
            "fecha_compromiso_asignada": "2099-12-31",  # Should be ignored
            "notas_impedimento": "Vulnerabilidad remediada exitosamente",
        }
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            headers=headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        vuln = data["vulnerabilidad"]
        entry = data["entrada_bitacora"]
        
        # veces_en_retest MUST increment
        assert vuln.get("veces_en_retest", 0) == current_retest + 1, \
            f"veces_en_retest MUST increment for Corregido"
        
        # veces_cambiada_fecha should NOT increment (date ignored for cierre)
        assert vuln.get("veces_cambiada_fecha", 0) == current_fecha, \
            f"veces_cambiada_fecha should not change for Corregido"
        
        # fecha_compromiso_asignada in bitacora should be null
        assert entry["fecha_compromiso_asignada"] is None, \
            f"fecha_compromiso_asignada should be null for Corregido, got {entry['fecha_compromiso_asignada']}"
        
        # estatus should be Cerrado
        assert vuln["estatus"] == "Cerrado"
