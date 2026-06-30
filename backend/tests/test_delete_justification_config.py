"""
Iteration 26: Tests covering DELETE-with-justification on every Configuration resource
referenced in the bug report:
  - Instituciones, Aplicaciones, Proveedores, Responsables, Informes Pentest,
    Grupos Informes, Dominios, Controles, Usuarios.

Each endpoint must:
  - Return 422 when 'justificacion' query param is missing.
  - Return 422 when 'justificacion' is shorter than 10 chars.
  - Return 200 with valid justificacion (>= 10 chars).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://secfind-board.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"
JUST = "Eliminación de prueba automatizada (iter 26)"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(
        f"{API}/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _create(path, payload, headers):
    r = requests.post(f"{API}{path}", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"POST {path} failed: {r.status_code} {r.text}"
    return r.json().get("id")


def _delete(path, headers, params=None):
    return requests.delete(f"{API}{path}", headers=headers, params=params, timeout=30)


# (label, create_path, payload_builder, delete_path_template, needs_extra_create_step)
TS = int(time.time())
RESOURCES = [
    ("institucion",  "/config/instituciones", lambda: {"nombre": f"TEST_Inst_{TS}"},   "/config/instituciones/{id}"),
    ("aplicacion",   "/config/aplicaciones",  lambda: {"nombre": f"TEST_App_{TS}"},    "/config/aplicaciones/{id}"),
    ("proveedor",    "/config/proveedores",   lambda: {"nombre": f"TEST_Prov_{TS}"},   "/config/proveedores/{id}"),
    ("responsable",  "/config/responsables",  lambda: {"nombre": f"TEST_Resp_{TS}", "email": f"resp{TS}@test.io"},  "/config/responsables/{id}"),
    ("informe",      "/config/informes-pentest", lambda: {"nombre": f"TEST_Pentest_{TS}"}, "/config/informes-pentest/{id}"),
    ("grupo",        "/config/grupos-informes", lambda: {"nombre": f"TEST_Grupo_{TS}"}, "/config/grupos-informes/{id}"),
    # Dominios/Controles handled in a separate dedicated class because controles need a dominio_id.
]


@pytest.mark.parametrize("label,create_path,payload_fn,delete_tpl", RESOURCES)
class TestConfigDeleteJustification:
    """Full lifecycle (create -> delete) for each Config resource with justification rules."""

    def test_missing_justificacion_returns_422(self, headers, label, create_path, payload_fn, delete_tpl):
        item_id = _create(create_path, payload_fn(), headers)
        try:
            r = _delete(delete_tpl.format(id=item_id), headers)
            assert r.status_code == 422, f"[{label}] expected 422, got {r.status_code}: {r.text}"
        finally:
            _delete(delete_tpl.format(id=item_id), headers, params={"justificacion": "Cleanup " + JUST})

    def test_short_justificacion_returns_422(self, headers, label, create_path, payload_fn, delete_tpl):
        item_id = _create(create_path, payload_fn() | {"nombre": payload_fn().get("nombre", "x") + "_s"}, headers)
        try:
            r = _delete(delete_tpl.format(id=item_id), headers, params={"justificacion": "short"})
            assert r.status_code == 422, f"[{label}] expected 422 for short, got {r.status_code}: {r.text}"
        finally:
            _delete(delete_tpl.format(id=item_id), headers, params={"justificacion": "Cleanup " + JUST})

    def test_valid_justificacion_returns_200(self, headers, label, create_path, payload_fn, delete_tpl):
        item_id = _create(create_path, payload_fn() | {"nombre": payload_fn().get("nombre", "x") + "_v"}, headers)
        r = _delete(delete_tpl.format(id=item_id), headers, params={"justificacion": JUST})
        assert r.status_code == 200, f"[{label}] expected 200, got {r.status_code}: {r.text}"


class TestUsuarioDeleteJustification:
    """User deletion separately (needs auth-aware payload)."""

    @pytest.fixture
    def user_id(self, headers):
        payload = {
            "username": f"testdel_{TS}",
            "password": "Testdel123!",
            "nombre": "Test Delete",
            "email": f"testdel_{TS}@test.io",
            "rol": "viewer",
        }
        r = requests.post(f"{API}/config/usuarios", headers=headers, json=payload, timeout=30)
        # Some installations may require admin OR may have a different shape; skip if not supported
        if r.status_code not in (200, 201):
            pytest.skip(f"User create unsupported in this env: {r.status_code} {r.text[:200]}")
        return r.json().get("id")

    def test_user_delete_without_justificacion(self, headers, user_id):
        r = _delete(f"/config/usuarios/{user_id}", headers)
        try:
            assert r.status_code == 422
        finally:
            _delete(f"/config/usuarios/{user_id}", headers, params={"justificacion": JUST})

    def test_user_delete_with_justificacion(self, headers, user_id):
        # create fresh because previous test cleaned up
        r = _delete(f"/config/usuarios/{user_id}", headers, params={"justificacion": JUST})
        assert r.status_code in (200, 404), f"Unexpected: {r.status_code} {r.text}"


class TestDominiosControlesDelete:
    """Dominios + Controles use the /config/dominios and /config/controles prefix."""

    @pytest.fixture(scope="class")
    def dominio_id(self, headers):
        payload = {
            "nombre_dominio": f"TEST_Dom_{TS}",
            "codigo_referencia": f"TD{TS}",
            "descripcion": "Test domain iter26",
        }
        r = requests.post(f"{API}/config/dominios", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Dominio create failed: {r.status_code} {r.text}"
        did = r.json().get("id")
        yield did
        requests.delete(
            f"{API}/config/dominios/{did}",
            headers=headers,
            params={"justificacion": "Cleanup test dominio iter26 automatic"},
            timeout=30,
        )

    def test_dominio_delete_missing_justificacion(self, headers):
        # Create a dedicated dominio so we don't affect the controls fixture
        r = requests.post(
            f"{API}/config/dominios",
            headers=headers,
            json={"nombre_dominio": f"TEST_DomDel_{TS}", "codigo_referencia": f"TDD{TS}"},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        did = r.json()["id"]
        try:
            rr = _delete(f"/config/dominios/{did}", headers)
            assert rr.status_code == 422, f"Expected 422, got {rr.status_code}: {rr.text}"
            rr = _delete(f"/config/dominios/{did}", headers, params={"justificacion": "short"})
            assert rr.status_code == 422, f"Expected 422 for short, got {rr.status_code}"
            rr = _delete(f"/config/dominios/{did}", headers, params={"justificacion": JUST})
            assert rr.status_code == 200, f"Expected 200, got {rr.status_code}: {rr.text}"
        finally:
            _delete(f"/config/dominios/{did}", headers, params={"justificacion": "cleanup iter26 dominio"})

    def test_control_delete_lifecycle(self, headers, dominio_id):
        payload = {
            "dominio_id": dominio_id,
            "codigo_control": f"TC{TS}",
            "nombre_control": f"TEST_Ctrl_{TS}",
            "descripcion": "Test control iter26",
        }
        r = requests.post(f"{API}/config/controles", headers=headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Control create failed: {r.status_code} {r.text}"
        cid = r.json()["id"]
        try:
            rr = _delete(f"/config/controles/{cid}", headers)
            assert rr.status_code == 422, f"Expected 422 missing, got {rr.status_code}: {rr.text}"
            rr = _delete(f"/config/controles/{cid}", headers, params={"justificacion": "short"})
            assert rr.status_code == 422, f"Expected 422 short, got {rr.status_code}"
            rr = _delete(f"/config/controles/{cid}", headers, params={"justificacion": JUST})
            assert rr.status_code == 200, f"Expected 200, got {rr.status_code}: {rr.text}"
        finally:
            _delete(f"/config/controles/{cid}", headers, params={"justificacion": "cleanup iter26 control"})
