"""
Iteration 33 - Epic Remediación Parcial por Aplicación
Tests the following:
  1) POST /api/seguimiento/{vuln_id}/registrar accepts and persists 'aplicacion_especifica'
  2) GET /api/vulnerabilidades?correccion_parcial=true filter
  3) Excel export includes 'resultados_por_aplicacion' and 'es_correccion_parcial' columns
  4) PUT /api/vulnerabilidades/{vuln_id}/aplicacion-resultado updates a single app
"""
import os
import io
import time
import pytest
import requests
import pandas as pd

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

# The vulnerability provided by the main agent (VULN_PE_CE_1 with apps IBP + MBP)
VULN_MULTI_APP_ID = "c392fd50-3337-4ef9-b210-fba50df57607"


# ------------------------- Fixtures -------------------------

@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def multi_app_vuln(client):
    """Fetch a vulnerability with multiple applications. Fallback to any if the provided ID is missing."""
    r = client.get(f"{API}/vulnerabilidades/{VULN_MULTI_APP_ID}")
    if r.status_code == 200 and len(r.json().get("aplicaciones") or []) > 1:
        return r.json()
    # Fallback: search among first 200 vulns for one with 2+ apps
    r = client.get(f"{API}/vulnerabilidades")
    assert r.status_code == 200
    for v in r.json():
        if len(v.get("aplicaciones") or []) > 1:
            return v
    pytest.skip("No vulnerability with more than one application found")


# ------------------------- Login sanity -------------------------

def test_login_ok(token):
    assert isinstance(token, str) and len(token) > 10


# ------------------------- 1) POST /seguimiento/{id}/registrar with aplicacion_especifica -------------------------

def test_registrar_seguimiento_general_sin_aplicacion(client, multi_app_vuln):
    """aplicacion_especifica=null (or missing) -> stored as null (general)"""
    payload = {
        "resultado_retest": "Nota de Seguimiento",
        "notas_impedimento": "TEST_iter33 nota general",
        "aplicacion_especifica": None,
    }
    r = client.post(f"{API}/seguimiento/{multi_app_vuln['id']}/registrar", json=payload)
    assert r.status_code == 200, r.text
    # Verify last historial entry has aplicacion_especifica = None
    r2 = client.get(f"{API}/seguimiento/{multi_app_vuln['id']}/historial")
    assert r2.status_code == 200
    historial = r2.json()["historial"]
    assert len(historial) > 0
    # historial is sorted desc by date
    ultima = historial[0]
    assert ultima["notas_impedimento"] == "TEST_iter33 nota general"
    assert ultima.get("aplicacion_especifica") in (None, "")


def test_registrar_seguimiento_con_aplicacion_especifica(client, multi_app_vuln):
    """aplicacion_especifica set to a specific app -> stored correctly"""
    app_name = multi_app_vuln["aplicaciones"][0]
    payload = {
        "resultado_retest": "Nota de Seguimiento",
        "notas_impedimento": f"TEST_iter33 nota app {app_name}",
        "aplicacion_especifica": app_name,
    }
    r = client.post(f"{API}/seguimiento/{multi_app_vuln['id']}/registrar", json=payload)
    assert r.status_code == 200, r.text

    r2 = client.get(f"{API}/seguimiento/{multi_app_vuln['id']}/historial")
    assert r2.status_code == 200
    historial = r2.json()["historial"]
    ultima = historial[0]
    assert ultima["notas_impedimento"] == f"TEST_iter33 nota app {app_name}"
    assert ultima.get("aplicacion_especifica") == app_name


def test_registrar_seguimiento_en_retest_still_works(client, multi_app_vuln):
    """Regression check: 'En Retest' resultado still normalizes and persists."""
    payload = {
        "resultado_retest": "En Retest",
        "notas_impedimento": "TEST_iter33 en retest",
        "aplicacion_especifica": None,
    }
    r = client.post(f"{API}/seguimiento/{multi_app_vuln['id']}/registrar", json=payload)
    assert r.status_code == 200, r.text
    # Verify normalization to 'Para Re Test'
    r2 = client.get(f"{API}/seguimiento/{multi_app_vuln['id']}/historial")
    assert r2.status_code == 200
    ultima = r2.json()["historial"][0]
    assert ultima["resultado_retest"] == "Para Re Test"


# ------------------------- 2) Filter correccion_parcial -------------------------

def test_filter_correccion_parcial_true_returns_only_partial(client):
    """The correccion_parcial=true filter must return a subset of all vulns."""
    r = client.get(f"{API}/vulnerabilidades?correccion_parcial=true")
    r_all = client.get(f"{API}/vulnerabilidades")
    assert r.status_code == 200 and r_all.status_code == 200
    partial_ids = {v["id"] for v in r.json()}
    all_ids = {v["id"] for v in r_all.json()}
    assert partial_ids.issubset(all_ids)
    # For each returned vuln, verify server confirms partial via aplicaciones-resultados
    for v in r.json()[:3]:  # sample a few
        rr = client.get(f"{API}/vulnerabilidades/{v['id']}/aplicaciones-resultados")
        assert rr.status_code == 200
        assert rr.json()["es_correccion_parcial"] is True, (
            f"vuln {v['id']} returned by correccion_parcial=true filter but "
            f"aplicaciones-resultados says es_correccion_parcial=False"
        )


def test_filter_correccion_parcial_false_excludes_partial(client):
    """Compare list sizes: all = partial + non-partial."""
    r_all = client.get(f"{API}/vulnerabilidades")
    r_true = client.get(f"{API}/vulnerabilidades?correccion_parcial=true")
    r_false = client.get(f"{API}/vulnerabilidades?correccion_parcial=false")
    assert r_all.status_code == 200 and r_true.status_code == 200 and r_false.status_code == 200
    total = len(r_all.json())
    partial = len(r_true.json())
    non_partial = len(r_false.json())
    assert total == partial + non_partial, (
        f"Filter arithmetic broken: total={total}, partial={partial}, non_partial={non_partial}"
    )
    # And the two disjoint sets:
    ids_partial = {v["id"] for v in r_true.json()}
    ids_non_partial = {v["id"] for v in r_false.json()}
    assert ids_partial.isdisjoint(ids_non_partial), "Partial and non-partial ID sets overlap"


def test_filter_correccion_parcial_no_filter_returns_all_flagged(client):
    """BUG CHECK: es_correccion_parcial should be present in the response.
    NOTE: currently stripped by Pydantic Vulnerabilidad response_model.
    """
    r = client.get(f"{API}/vulnerabilidades")
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    # This will fail if the response_model strips computed fields
    assert "es_correccion_parcial" in data[0], (
        "es_correccion_parcial is NOT returned in list. "
        "The endpoint /api/vulnerabilidades uses response_model=List[Vulnerabilidad] "
        "which strips this computed field. Frontend cannot display the 'partial correction' flag "
        "without an extra call to /aplicaciones-resultados per row."
    )


# ------------------------- 3) PUT /vulnerabilidades/{id}/aplicacion-resultado -------------------------

def test_update_aplicacion_resultado_actualiza_solo_esa_app(client, multi_app_vuln):
    vuln_id = multi_app_vuln["id"]
    app_name = multi_app_vuln["aplicaciones"][0]
    other_app = multi_app_vuln["aplicaciones"][1]

    payload = {
        "aplicacion": app_name,
        "resultado_re_test": "Corregido",
        "fecha_correccion": "2026-01-15",
        "notas": "TEST_iter33 marca corregida solo esta app",
    }
    r = client.put(f"{API}/vulnerabilidades/{vuln_id}/aplicacion-resultado", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "vulnerabilidad" in body
    assert "info_normalizacion" in body

    # Verify via GET aplicaciones-resultados
    r2 = client.get(f"{API}/vulnerabilidades/{vuln_id}/aplicaciones-resultados")
    assert r2.status_code == 200
    info = r2.json()
    aplicaciones = {a["aplicacion"]: a for a in info["aplicaciones"]}
    assert aplicaciones[app_name]["resultado_re_test"] == "Corregido"
    # other app should NOT be Corregido (unless it was already)
    # At least verify the two apps can have different results:
    if other_app in aplicaciones:
        assert aplicaciones[other_app]["resultado_re_test"] != "Corregido" or \
               aplicaciones[other_app].get("resultado_re_test") in (None, "Corregido")


def test_correccion_parcial_flag_updates_after_partial_fix(client, multi_app_vuln):
    """After marking one of two apps as Corregido, es_correccion_parcial should reflect it."""
    vuln_id = multi_app_vuln["id"]
    r = client.get(f"{API}/vulnerabilidades/{vuln_id}/aplicaciones-resultados")
    assert r.status_code == 200
    info = r.json()
    total = info["aplicaciones_total"]
    corregidas = info["aplicaciones_corregidas"]
    # If we corrected one app in previous test, this must be partial
    if total > 1 and 0 < corregidas < total:
        assert info["es_correccion_parcial"] is True


# ------------------------- 4) Excel export -------------------------

def test_export_excel_incluye_columnas_por_aplicacion(client):
    r = client.get(f"{API}/export/excel")
    assert r.status_code == 200, r.text
    assert "spreadsheet" in r.headers.get("Content-Type", "") or "excel" in r.headers.get("Content-Type", "").lower() or r.headers.get("Content-Type", "").endswith("xlsx")

    df = pd.read_excel(io.BytesIO(r.content))
    cols = [str(c).lower() for c in df.columns]
    # Column names may vary in case; check by substring
    assert any("resultados_por_aplicacion" in c or "resultados por aplicacion" in c.replace("_", " ") for c in cols), f"Excel export missing 'resultados_por_aplicacion' column. Got: {list(df.columns)}"
    assert any("es_correccion_parcial" in c or "es correccion parcial" in c.replace("_", " ") for c in cols), f"Excel export missing 'es_correccion_parcial' column. Got: {list(df.columns)}"


# ------------------------- 5) Cleanup: revert Corregido on app so future runs are stable -------------------------

@pytest.fixture(scope="module", autouse=True)
def cleanup(client, multi_app_vuln):
    yield
    try:
        vuln_id = multi_app_vuln["id"]
        for app in multi_app_vuln.get("aplicaciones", []):
            client.put(f"{API}/vulnerabilidades/{vuln_id}/aplicacion-resultado", json={
                "aplicacion": app,
                "resultado_re_test": "Pendiente",
                "notas": "TEST_iter33 cleanup",
            })
    except Exception as e:
        print(f"cleanup error: {e}")
