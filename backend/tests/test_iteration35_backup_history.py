"""Pruebas de historial de backups: paginación, filtros, validaciones y operaciones clave."""

import gzip
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient


FRONTEND_ENV = dotenv_values("/app/frontend/.env")
BACKEND_ENV = dotenv_values("/app/backend/.env")

BASE_URL = FRONTEND_ENV.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = BACKEND_ENV.get("MONGO_URL", "")
DB_NAME = BACKEND_ENV.get("DB_NAME", "")

ADMIN_USER = "admin"
ADMIN_PASSWORD = "admin123"

TEST_PREFIX = "TEST_BACKUP_HISTORY_"
TZ_SD = ZoneInfo("America/Santo_Domingo")


def _iso_local_to_utc(local_dt: datetime) -> str:
    return local_dt.astimezone(timezone.utc).isoformat()


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def mongo_db():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL/DB_NAME no configurados")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="session")
def admin_token(api_client):
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL no configurado")

    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "token" in payload
    assert payload["usuario"]["username"] == ADMIN_USER
    return payload["token"]


@pytest.fixture(scope="session")
def seed_backup_logs(mongo_db):
    """Semilla temporal >60 registros TEST_BACKUP_HISTORY_ con límites de fecha para filtros."""
    docs = []

    base_local = datetime(2026, 2, 1, 8, 0, tzinfo=TZ_SD)
    estados = ["exitoso", "fallido", "en_progreso"]
    destinos = ["local", "google_drive", "ambos"]

    for i in range(66):
        current = base_local + timedelta(hours=i)
        estado = estados[i % len(estados)]
        destino = destinos[i % len(destinos)]
        docs.append(
            {
                "id": f"{TEST_PREFIX}{i:03d}",
                "fecha": _iso_local_to_utc(current),
                "estado": estado,
                "destino": destino,
                "ruta_local": f"/tmp/{TEST_PREFIX}{i:03d}.gz" if destino != "google_drive" else None,
                "google_drive_file_id": f"gdrive_{i}" if destino != "local" else None,
                "tamaño": 1024 + i,
                "tamaño_humano": "1.00 KB",
                "duracion_segundos": round(1.5 + (i / 100), 2),
            }
        )

    # Límite inclusivo (desde) y exclusivo (hasta)
    docs.append(
        {
            "id": f"{TEST_PREFIX}BOUNDARY_START",
            "fecha": _iso_local_to_utc(datetime(2026, 2, 10, 0, 0, tzinfo=TZ_SD)),
            "estado": "exitoso",
            "destino": "local",
            "ruta_local": f"/tmp/{TEST_PREFIX}BOUNDARY_START.gz",
            "tamaño": 2048,
            "tamaño_humano": "2.00 KB",
            "duracion_segundos": 2.0,
        }
    )
    docs.append(
        {
            "id": f"{TEST_PREFIX}BOUNDARY_END",
            "fecha": _iso_local_to_utc(datetime(2026, 2, 11, 0, 0, tzinfo=TZ_SD)),
            "estado": "exitoso",
            "destino": "local",
            "ruta_local": f"/tmp/{TEST_PREFIX}BOUNDARY_END.gz",
            "tamaño": 2048,
            "tamaño_humano": "2.00 KB",
            "duracion_segundos": 2.1,
        }
    )

    # Registro futuro aislado para prueba de eliminar en "última página"
    docs.append(
        {
            "id": f"{TEST_PREFIX}FUTURE_DELETE",
            "fecha": _iso_local_to_utc(datetime(2027, 1, 1, 0, 0, tzinfo=TZ_SD)),
            "estado": "fallido",
            "destino": "ambos",
            "ruta_local": f"/tmp/{TEST_PREFIX}FUTURE_DELETE.gz",
            "google_drive_file_id": "gdrive_future",
            "tamaño": 512,
            "tamaño_humano": "0.50 KB",
            "duracion_segundos": 1.2,
            "error": "TEST future record",
        }
    )

    # Registro descargable con archivo real
    file_path = Path(f"/tmp/{TEST_PREFIX}DOWNLOAD.gz")
    with gzip.open(file_path, "wb") as f:
        f.write(b"backup content test")
    docs.append(
        {
            "id": f"{TEST_PREFIX}DOWNLOAD",
            "fecha": _iso_local_to_utc(datetime(2026, 2, 12, 12, 0, tzinfo=TZ_SD)),
            "estado": "exitoso",
            "destino": "local",
            "ruta_local": str(file_path),
            "tamaño": file_path.stat().st_size,
            "tamaño_humano": "0.10 KB",
            "duracion_segundos": 0.9,
        }
    )

    mongo_db.backup_logs.insert_many(docs)
    yield

    mongo_db.backup_logs.delete_many({"id": {"$regex": f"^{TEST_PREFIX}"}})
    if file_path.exists():
        file_path.unlink()


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_auth_login_and_me(api_client, admin_token):
    response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(admin_token), timeout=30)
    assert response.status_code == 200, response.text
    me = response.json()
    assert me["username"] == ADMIN_USER
    assert me["es_admin"] is True


def test_auth_me_without_token_returns_401(api_client):
    response = api_client.get(f"{BASE_URL}/api/auth/me", timeout=30)
    assert response.status_code == 401


def test_auth_me_invalid_token_returns_401(api_client):
    response = api_client.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": "Bearer token_invalido"},
        timeout=30,
    )
    assert response.status_code == 401


def test_historial_requires_auth_401(api_client):
    response = api_client.get(f"{BASE_URL}/api/backup/historial?pagina=1&limite=10", timeout=30)
    assert response.status_code == 401


def test_historial_paginado_shape_and_counts(api_client, admin_token, seed_backup_logs):
    response = api_client.get(
        f"{BASE_URL}/api/backup/historial",
        headers=auth_headers(admin_token),
        params={"pagina": 1, "limite": 10},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert set(payload.keys()) == {"items", "total", "pagina", "limite", "total_paginas"}
    assert payload["pagina"] == 1
    assert payload["limite"] == 10
    assert isinstance(payload["items"], list)
    assert len(payload["items"]) == 10
    assert payload["total"] >= 70


def test_historial_legacy_without_pagina_returns_list(api_client, admin_token, seed_backup_logs):
    response = api_client.get(
        f"{BASE_URL}/api/backup/historial",
        headers=auth_headers(admin_token),
        params={"limite": 10},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) <= 10


def test_historial_order_and_no_duplicates_between_pages(api_client, admin_token, seed_backup_logs):
    pages = []
    for page in [1, 2, 3]:
        response = api_client.get(
            f"{BASE_URL}/api/backup/historial",
            headers=auth_headers(admin_token),
            params={"pagina": page, "limite": 10},
            timeout=30,
        )
        assert response.status_code == 200, response.text
        pages.append(response.json()["items"])

    ids = [item["id"] for page_items in pages for item in page_items]
    assert len(ids) == len(set(ids))

    flat = [item for page_items in pages for item in page_items]
    sorted_flat = sorted(flat, key=lambda x: (x["fecha"], x["id"]), reverse=True)
    assert [x["id"] for x in flat] == [x["id"] for x in sorted_flat]


@pytest.mark.parametrize(
    "params",
    [
        {"pagina": 0, "limite": 10},
        {"pagina": 1, "limite": 0},
        {"pagina": 1, "limite": 201},
        {"pagina": 1, "limite": 10, "estado": "otro"},
        {"pagina": 1, "limite": 10, "destino": "dropbox"},
        {"pagina": 1, "limite": 10, "fecha_desde": "fecha-no-valida"},
        {
            "pagina": 1,
            "limite": 10,
            "fecha_desde": "2026-02-12T00:00:00Z",
            "fecha_hasta": "2026-02-11T00:00:00Z",
        },
    ],
)
def test_historial_validation_422(api_client, admin_token, params):
    response = api_client.get(
        f"{BASE_URL}/api/backup/historial",
        headers=auth_headers(admin_token),
        params=params,
        timeout=30,
    )
    assert response.status_code == 422


def test_historial_filter_estado_destino_fechas_boundaries(api_client, admin_token, seed_backup_logs):
    desde = _iso_local_to_utc(datetime(2026, 2, 10, 0, 0, tzinfo=TZ_SD))
    hasta_exclusivo = _iso_local_to_utc(datetime(2026, 2, 11, 0, 0, tzinfo=TZ_SD))

    response = api_client.get(
        f"{BASE_URL}/api/backup/historial",
        headers=auth_headers(admin_token),
        params={
            "pagina": 1,
            "limite": 50,
            "estado": "exitoso",
            "destino": "local",
            "fecha_desde": desde,
            "fecha_hasta": hasta_exclusivo,
        },
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    ids = [item["id"] for item in payload["items"]]
    assert f"{TEST_PREFIX}BOUNDARY_START" in ids
    assert f"{TEST_PREFIX}BOUNDARY_END" not in ids

    for item in payload["items"]:
        if not item["id"].startswith(TEST_PREFIX):
            continue
        assert item["estado"] == "exitoso"
        assert item["destino"] == "local"
        assert item["fecha"] >= desde
        assert item["fecha"] < hasta_exclusivo


def test_historial_page_size_10_25_50(api_client, admin_token, seed_backup_logs):
    totals = []
    for limit in [10, 25, 50]:
        response = api_client.get(
            f"{BASE_URL}/api/backup/historial",
            headers=auth_headers(admin_token),
            params={"pagina": 1, "limite": limit},
            timeout=30,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["limite"] == limit
        assert len(data["items"]) <= limit
        totals.append(data["total"])

    assert len(set(totals)) == 1


def test_download_test_backup(api_client, admin_token, seed_backup_logs):
    backup_id = f"{TEST_PREFIX}DOWNLOAD"
    response = api_client.get(
        f"{BASE_URL}/api/backup/{backup_id}/descargar",
        headers=auth_headers(admin_token),
        timeout=30,
    )
    assert response.status_code == 200, response.text
    assert response.headers.get("content-type", "").startswith("application/gzip")
    assert len(response.content) > 0


def test_delete_only_test_record_and_page_adjust(api_client, admin_token, seed_backup_logs):
    future_id = f"{TEST_PREFIX}FUTURE_DELETE"

    # Verificamos que exista con filtro aislado por fecha futura
    before = api_client.get(
        f"{BASE_URL}/api/backup/historial",
        headers=auth_headers(admin_token),
        params={
            "pagina": 1,
            "limite": 10,
            "fecha_desde": "2026-12-31T00:00:00Z",
            "fecha_hasta": "2027-12-31T00:00:00Z",
        },
        timeout=30,
    )
    assert before.status_code == 200, before.text
    ids_before = [item["id"] for item in before.json()["items"]]
    assert future_id in ids_before

    delete_resp = api_client.delete(
        f"{BASE_URL}/api/backup/{future_id}",
        headers=auth_headers(admin_token),
        timeout=30,
    )
    assert delete_resp.status_code == 200, delete_resp.text

    after = api_client.get(
        f"{BASE_URL}/api/backup/historial",
        headers=auth_headers(admin_token),
        params={
            "pagina": 2,
            "limite": 10,
            "fecha_desde": "2026-12-31T00:00:00Z",
            "fecha_hasta": "2027-12-31T00:00:00Z",
        },
        timeout=30,
    )
    assert after.status_code == 200, after.text
    payload_after = after.json()
    ids_after = [item["id"] for item in payload_after["items"]]
    assert future_id not in ids_after
    assert payload_after["pagina"] == 1


def test_no_http_only_cookie_in_login_contract(api_client):
    """Contrato actual usa token Bearer en body, no cookie httpOnly."""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    assert "set-cookie" not in {k.lower(): v for k, v in response.headers.items()}


def test_admin_hash_is_bcrypt_2b_prefix(mongo_db):
    admin = mongo_db.usuarios.find_one({"username": ADMIN_USER})
    assert admin is not None
    assert isinstance(admin.get("password_hash"), str)
    assert admin["password_hash"].startswith("$2b$")
