"""
Regression test for bug: Vulnerabilities in 'Para Re Test' disappearing from
the 'en_retest' view after adding a 'Nota de Seguimiento'.

Root cause: POST /api/seguimiento/{id}/registrar with resultado_retest='Nota de Seguimiento'
was overwriting the vulnerability's resultado_re_test field with 'Nota de Seguimiento',
causing the vuln to no longer match the en_retest view filter (resultado_re_test='Para Re Test').

Fix (server.py lines 3492-3495): only update resultado_re_test when the incoming
resultado is NOT 'Nota de Seguimiento'.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://secfind-board.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_vuln(headers):
    """Create a vulnerability, put it in 'Para Re Test' state."""
    marker = f"TEST_NotaSeguimiento_{uuid.uuid4().hex[:8]}"
    payload = {
        "codigo": marker,
        "vulnerabilidad": marker,
        "institucion": "Test Corp",
        "aplicaciones": ["Test App"],
        "severidad": "Alta",
        "responsable": "Admin",
        "estatus": "Para Re Test",
        "resultado_re_test": "Para Re Test",
        "fecha_hallazgo": "2026-01-01",
        "nombre_informe_pentest": "TEST Informe",
        "proveedor": "TEST Proveedor",
    }
    r = requests.post(f"{API}/vulnerabilidades", json=payload, headers=headers, timeout=30)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    vuln = r.json()
    vuln_id = vuln["id"]

    # Ensure the vuln has resultado_re_test='Para Re Test' via registrar_seguimiento
    r2 = requests.post(
        f"{API}/seguimiento/{vuln_id}/registrar",
        json={"resultado_retest": "Para Re Test", "notas_impedimento": "Puesto en re test para pruebas"},
        headers=headers,
        timeout=30,
    )
    assert r2.status_code in (200, 201), f"initial seguimiento failed: {r2.status_code} {r2.text}"

    yield vuln_id, marker

    # Cleanup
    try:
        requests.delete(
            f"{API}/vulnerabilidades/{vuln_id}",
            params={"justificacion": "cleanup automated test data"},
            headers=headers,
            timeout=30,
        )
    except Exception:
        pass


def _get_vuln(vuln_id, headers):
    r = requests.get(f"{API}/vulnerabilidades/{vuln_id}", headers=headers, timeout=30)
    assert r.status_code == 200, f"get failed: {r.status_code} {r.text}"
    return r.json()


def _fetch_en_retest_ids(headers):
    r = requests.get(
        f"{API}/vulnerabilidades/seguimiento",
        params={"vista": "en_retest"},
        headers=headers,
        timeout=60,
    )
    # If the endpoint is /seguimiento not /vulnerabilidades/seguimiento, try alt
    if r.status_code == 404:
        r = requests.get(
            f"{API}/seguimiento-riesgos",
            params={"vista": "en_retest"},
            headers=headers,
            timeout=60,
        )
    assert r.status_code == 200, f"en_retest fetch failed: {r.status_code} {r.text}"
    data = r.json()
    return [v["id"] for v in data], data


class TestNotaSeguimientoRetestBug:
    """Regression tests for the 'Nota de Seguimiento' bug."""

    def test_1_vuln_starts_in_en_retest_view(self, created_vuln, headers):
        vuln_id, _ = created_vuln
        vuln = _get_vuln(vuln_id, headers)
        assert vuln["resultado_re_test"] == "Para Re Test", (
            f"expected resultado_re_test='Para Re Test' after initial seguimiento, got {vuln.get('resultado_re_test')!r}"
        )
        ids, _ = _fetch_en_retest_ids(headers)
        assert vuln_id in ids, "vulnerability should appear in en_retest view before adding note"

    def test_2_adding_nota_seguimiento_does_not_change_resultado_re_test(self, created_vuln, headers):
        vuln_id, _ = created_vuln
        # Add a Nota de Seguimiento
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            json={
                "resultado_retest": "Nota de Seguimiento",
                "notas_impedimento": "Nota de prueba para verificar que no cambia resultado_re_test",
            },
            headers=headers,
            timeout=30,
        )
        assert r.status_code in (200, 201), f"nota seguimiento POST failed: {r.status_code} {r.text}"

        # Verify DB state
        vuln = _get_vuln(vuln_id, headers)
        assert vuln["resultado_re_test"] == "Para Re Test", (
            f"BUG: resultado_re_test was overwritten to {vuln.get('resultado_re_test')!r} "
            f"after Nota de Seguimiento (should stay 'Para Re Test')"
        )
        # Verify the entry was added to the historial
        historial = vuln.get("historial_impedimentos_seguimiento", [])
        assert any(e.get("resultado_retest") == "Nota de Seguimiento" for e in historial), (
            "Nota de Seguimiento entry not found in historial_impedimentos_seguimiento"
        )

    def test_3_vuln_still_appears_in_en_retest_view(self, created_vuln, headers):
        vuln_id, _ = created_vuln
        ids, data = _fetch_en_retest_ids(headers)
        assert vuln_id in ids, (
            f"BUG: vulnerability {vuln_id} DISAPPEARED from en_retest view after Nota de Seguimiento."
        )

    def test_4_multiple_notes_still_keep_vuln_in_en_retest(self, created_vuln, headers):
        vuln_id, _ = created_vuln
        # Add 2 more notes
        for i in range(2):
            r = requests.post(
                f"{API}/seguimiento/{vuln_id}/registrar",
                json={
                    "resultado_retest": "Nota de Seguimiento",
                    "notas_impedimento": f"Segunda nota #{i+1}",
                },
                headers=headers,
                timeout=30,
            )
            assert r.status_code in (200, 201), f"nota #{i} failed: {r.status_code} {r.text}"

        vuln = _get_vuln(vuln_id, headers)
        assert vuln["resultado_re_test"] == "Para Re Test"
        ids, _ = _fetch_en_retest_ids(headers)
        assert vuln_id in ids, "vulnerability disappeared from en_retest after multiple notes"

    def test_5_changing_to_vulnerable_does_update_resultado_re_test(self, created_vuln, headers):
        """Sanity: non-note resultado still updates resultado_re_test."""
        vuln_id, _ = created_vuln
        r = requests.post(
            f"{API}/seguimiento/{vuln_id}/registrar",
            json={
                "resultado_retest": "Vulnerable",
                "notas_impedimento": "Cambio a Vulnerable",
            },
            headers=headers,
            timeout=30,
        )
        assert r.status_code in (200, 201)
        vuln = _get_vuln(vuln_id, headers)
        assert vuln["resultado_re_test"] == "Vulnerable", (
            f"non-note resultado should update resultado_re_test, got {vuln.get('resultado_re_test')!r}"
        )
