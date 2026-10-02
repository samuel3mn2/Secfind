"""Cobertura backend adicional iteración 39: filtros de apps/estatus con fixtures temporales aislados."""

import os
import uuid
from collections import Counter

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient


# Módulo: contratos API /api/dashboard/vulnerabilidades para casos edge de filtros.
FRONTEND_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FRONTEND_ENV.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

APP_A = "TEST39_EDGE_Nómina, pagos & API"
APP_B = "TEST39_EDGE_B"
APP_LEGACY = "TEST39_EDGE_LEGACY_APP"
APP_UNICODE_LARGO = "TEST39_EDGE_ユニコード_应用_🚀_" + ("LARGO_" * 30)


@pytest.fixture(scope="module")
def settings():
    assert BASE_URL, "Falta REACT_APP_BACKEND_URL"
    backend_env = dotenv_values("/app/backend/.env")
    mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
    assert mongo_url, "Falta MONGO_URL"
    assert db_name, "Falta DB_NAME"
    return {
        "base_url": BASE_URL,
        "mongo_url": mongo_url,
        "db_name": db_name,
    }


@pytest.fixture(scope="module")
def auth_session(settings):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    login = session.post(
        f"{settings['base_url']}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=30,
    )
    assert login.status_code == 200, f"Login falló: {login.status_code}"
    payload = login.json()
    token = payload.get("token")
    assert isinstance(token, str) and token
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def mongo_db(settings):
    client = MongoClient(settings["mongo_url"])
    db = client[settings["db_name"]]
    yield db
    client.close()


@pytest.fixture(scope="module")
def edge_report_data(mongo_db):
    report = f"TEST39_EDGE_REPORT_{uuid.uuid4().hex[:8]}"

    docs = [
        {
            "id": "TEST39_EDGE_A",
            "codigo": "TEST39_EDGE_COD_A",
            "vulnerabilidad": "Vuln A apps repetidas + espacios",
            "severidad": "Alta",
            "nivel_riesgo": "Alto",
            "nivel_riesgo_computed": "alto",
            "estatus": "Pendiente",
            "aplicaciones": [f" {APP_A} ", APP_B, APP_B, ""],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-31",
            "created_at": "2026-10-02T10:00:00Z",
            "updated_at": "2026-10-02T10:10:00Z",
        },
        {
            "id": "TEST39_EDGE_B_DOC",
            "codigo": "TEST39_EDGE_COD_B",
            "vulnerabilidad": "Vuln B app B",
            "severidad": "Media",
            "nivel_riesgo": "Medio",
            "nivel_riesgo_computed": "medio",
            "estatus": "Pendiente",
            "aplicaciones": [APP_B],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-20",
            "created_at": "2026-10-02T10:20:00Z",
            "updated_at": "2026-10-02T10:30:00Z",
        },
        {
            "id": "TEST39_EDGE_K_DOC",
            "codigo": "TEST39_EDGE_COD_K",
            "vulnerabilidad": "Vuln K en proceso app B",
            "severidad": "Alta",
            "nivel_riesgo": "Alto",
            "nivel_riesgo_computed": "alto",
            "estatus": "En Proceso",
            "aplicaciones": [APP_B],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-25",
            "created_at": "2026-10-02T10:40:00Z",
            "updated_at": "2026-10-02T10:50:00Z",
        },
        {
            "id": "TEST39_EDGE_D_NULLAPP",
            "codigo": "TEST39_EDGE_COD_D",
            "vulnerabilidad": "Vuln D sin app null",
            "severidad": "Baja",
            "nivel_riesgo": "Bajo",
            "nivel_riesgo_computed": "bajo",
            "estatus": None,
            "aplicaciones": None,
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-10",
            "created_at": "2026-10-02T11:00:00Z",
            "updated_at": "2026-10-02T11:10:00Z",
        },
        {
            "id": "TEST39_EDGE_E_EMPTYAPP",
            "codigo": "TEST39_EDGE_COD_E",
            "vulnerabilidad": "Vuln E sin app []",
            "severidad": "Baja",
            "nivel_riesgo": "Bajo",
            "nivel_riesgo_computed": "bajo",
            "estatus": "",
            "aplicaciones": [],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-09",
            "created_at": "2026-10-02T11:20:00Z",
            "updated_at": "2026-10-02T11:30:00Z",
        },
        {
            "id": "TEST39_EDGE_F_LEGACY",
            "codigo": "TEST39_EDGE_COD_F",
            "vulnerabilidad": "Vuln F app legacy string",
            "severidad": "Alta",
            "nivel_riesgo": "Medio Alto",
            "nivel_riesgo_computed": "medio alto",
            "estatus": "   ",
            "aplicaciones": APP_LEGACY,
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-08",
            "created_at": "2026-10-02T11:40:00Z",
            "updated_at": "2026-10-02T11:50:00Z",
        },
        {
            "id": "TEST39_EDGE_G_LEGACY",
            "codigo": "TEST39_EDGE_COD_G",
            "vulnerabilidad": "Vuln G app legacy pendiente",
            "severidad": "Alta",
            "nivel_riesgo": "Alto",
            "nivel_riesgo_computed": "alto",
            "estatus": "Pendiente",
            "aplicaciones": APP_LEGACY,
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-07",
            "created_at": "2026-10-02T12:00:00Z",
            "updated_at": "2026-10-02T12:10:00Z",
        },
        {
            "id": "TEST39_EDGE_H_CERRADO",
            "codigo": "TEST39_EDGE_COD_H",
            "vulnerabilidad": "Vuln H cerrada",
            "severidad": "Critica",
            "nivel_riesgo": "Alto",
            "nivel_riesgo_computed": "alto",
            "estatus": "Cerrado",
            "aplicaciones": [APP_A],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-06",
            "created_at": "2026-10-02T12:20:00Z",
            "updated_at": "2026-10-02T12:30:00Z",
        },
        {
            "id": "TEST39_EDGE_I_CORREGIDO",
            "codigo": "TEST39_EDGE_COD_I",
            "vulnerabilidad": "Vuln I corregida",
            "severidad": "Alta",
            "nivel_riesgo": "Medio",
            "nivel_riesgo_computed": "medio",
            "estatus": "Corregido",
            "aplicaciones": [APP_B],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-05",
            "created_at": "2026-10-02T12:40:00Z",
            "updated_at": "2026-10-02T12:50:00Z",
        },
        {
            "id": "TEST39_EDGE_J_DESESTIMADO",
            "codigo": "TEST39_EDGE_COD_J",
            "vulnerabilidad": "Vuln J desestimada",
            "severidad": "Media",
            "nivel_riesgo": "Bajo",
            "nivel_riesgo_computed": "bajo",
            "estatus": "Desestimado",
            "aplicaciones": [APP_B],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-04",
            "created_at": "2026-10-02T13:00:00Z",
            "updated_at": "2026-10-02T13:10:00Z",
        },
        {
            "id": "TEST39_EDGE_M_SINESTADO_B",
            "codigo": "TEST39_EDGE_COD_M",
            "vulnerabilidad": "Vuln M sin estado en B",
            "severidad": "Alta",
            "nivel_riesgo": "Alto",
            "nivel_riesgo_computed": "alto",
            "estatus": "",
            "aplicaciones": [APP_B],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-03",
            "created_at": "2026-10-02T13:20:00Z",
            "updated_at": "2026-10-02T13:30:00Z",
        },
        {
            "id": "TEST39_EDGE_U_UNICODE",
            "codigo": "TEST39_EDGE_COD_U",
            "vulnerabilidad": "Descripción " + ("非常長い説明🚀" * 40),
            "severidad": "Critica",
            "nivel_riesgo": "Medio Alto",
            "nivel_riesgo_computed": "medio alto",
            "estatus": "Pendiente",
            "aplicaciones": [APP_UNICODE_LARGO],
            "nombre_informe_pentest": report,
            "fecha_hallazgo": "2026-10-02",
            "fecha_compromiso": "2026-12-02",
            "created_at": "2026-10-02T13:40:00Z",
            "updated_at": "2026-10-02T13:50:00Z",
        },
    ]

    ids_by_name = {doc["id"]: f"{doc['id']}_{uuid.uuid4().hex}" for doc in docs}
    for doc in docs:
        doc["id"] = ids_by_name[doc["id"]]
    ids = list(ids_by_name.values())
    try:
        mongo_db.vulnerabilidades.insert_many(docs)
        yield {"report": report, "ids": ids, "ids_by_name": ids_by_name}
    finally:
        mongo_db.vulnerabilidades.delete_many({"id": {"$in": ids}, "nombre_informe_pentest": report})


def _paneles(auth_session, report, extra_params=None):
    params = [("informes", report)]
    if extra_params:
        params.extend(extra_params)
    response = auth_session.get(f"{BASE_URL}/api/dashboard/vulnerabilidades/paneles", params=params, timeout=40)
    assert response.status_code == 200, response.text
    return response.json()


def _detalle(auth_session, report, extra_params=None):
    params = [("informes", report), ("pagina", 1), ("limite", 100)]
    if extra_params:
        params.extend(extra_params)
    response = auth_session.get(f"{BASE_URL}/api/dashboard/vulnerabilidades/detalle", params=params, timeout=40)
    assert response.status_code == 200, response.text
    return response.json()


def test_case1_apps_repetidas_con_coma_ampersand_sin_csv(auth_session, edge_report_data):
    report = edge_report_data["report"]

    solo_a = _paneles(auth_session, report, [("aplicaciones", APP_A)])
    assert solo_a["total"] == 1

    detalle_a = _detalle(auth_session, report, [("aplicacion", APP_A)])
    assert detalle_a["total"] == 1
    assert detalle_a["items"][0]["id"] == edge_report_data["ids_by_name"]["TEST39_EDGE_A"]

    a_y_b = _paneles(auth_session, report, [("aplicaciones", APP_A), ("aplicaciones", APP_B)])
    assert a_y_b["total"] == 4  # A, B_DOC, K_DOC, M_SINESTADO_B (sin duplicar por overlap)

    apps_totales = {item.get("aplicacion"): item.get("total") for item in a_y_b.get("aplicaciones", [])}
    assert apps_totales.get(APP_A) == 1
    assert apps_totales.get(APP_B) == 4
    assert sum(value for value in apps_totales.values() if isinstance(value, int)) >= a_y_b["total"]

    opciones = {item.get("aplicacion"): item.get("total") for item in solo_a.get("opciones_aplicaciones", [])}
    assert APP_B in opciones


def test_case2_sin_estado_y_apps_null_array_legacy(auth_session, edge_report_data):
    report = edge_report_data["report"]

    sin_app = _paneles(auth_session, report, [("incluir_sin_aplicacion", "true")])
    assert sin_app["total"] == 2
    estatus_map = {item["valor"]: item["total"] for item in sin_app["estatus"]}
    assert estatus_map.get("Sin estado") == 2

    detalle_sin_app = _detalle(auth_session, report, [("sin_aplicacion", "true"), ("estatus", "Sin estado")])
    assert detalle_sin_app["total"] == 2
    for row in detalle_sin_app["items"]:
        assert row.get("estatus") == "Sin estado"
        assert row.get("aplicaciones") == []

    legacy = _paneles(auth_session, report, [("aplicaciones", APP_LEGACY)])
    assert legacy["total"] == 2
    legacy_status = {item["valor"]: item["total"] for item in legacy["estatus"]}
    assert legacy_status == {"Pendiente": 1, "Sin estado": 1}


def test_case3_estados_cierre_excluidos_por_default_e_incluidos_explicitos(auth_session, edge_report_data):
    report = edge_report_data["report"]

    default_panel = _paneles(auth_session, report)
    assert default_panel["total"] == 9
    default_labels = {item["valor"] for item in default_panel["estatus"]}
    assert {"Cerrado", "Corregido", "Desestimado"}.isdisjoint(default_labels)

    explicit = _paneles(auth_session, report, [("estados_vuln", "Cerrado,Corregido,Desestimado")])
    assert explicit["total"] == 3
    explicit_status = Counter({item["valor"]: item["total"] for item in explicit["estatus"]})
    assert explicit_status == Counter({"Cerrado": 1, "Corregido": 1, "Desestimado": 1})

    interseccion = _paneles(
        auth_session,
        report,
        [("estados_vuln", "Cerrado,Corregido"), ("estatus", "Cerrado")],
    )
    assert interseccion["total"] == 1
    det = _detalle(
        auth_session,
        report,
        [("estados_vuln", "Cerrado,Corregido"), ("estatus", "Cerrado")],
    )
    assert det["total"] == 1
    assert det["items"][0]["estatus"] == "Cerrado"


def test_case4_estatus_or_con_and_de_filtros_y_facet_ignora_propia_seleccion(auth_session, edge_report_data):
    report = edge_report_data["report"]
    params = [
        ("aplicaciones", APP_A),
        ("aplicaciones", APP_B),
        ("riesgos", "Alto"),
        ("severidades", "Alta"),
        ("estatus", "Pendiente"),
        ("estatus", "En Proceso"),
    ]

    panel = _paneles(auth_session, report, params)
    assert panel["total"] == 2

    detalle = _detalle(auth_session, report, params)
    assert detalle["total"] == 2
    ids = {item["id"] for item in detalle["items"]}
    assert ids == {edge_report_data["ids_by_name"][key] for key in ["TEST39_EDGE_A", "TEST39_EDGE_K_DOC"]}

    status_map = {item["valor"]: item["total"] for item in panel["estatus"]}
    assert status_map.get("Pendiente") == 1
    assert status_map.get("En Proceso") == 1
    assert status_map.get("Sin estado") == 1  # Debe aparecer por M_SINESTADO_B


def test_case5_nombres_largos_unicode_no500_sin_objectid(auth_session, edge_report_data):
    report = edge_report_data["report"]

    panel = _paneles(auth_session, report, [("aplicaciones", APP_UNICODE_LARGO)])
    assert panel["total"] == 1
    opciones = [item.get("aplicacion") for item in panel.get("opciones_aplicaciones", [])]
    assert APP_UNICODE_LARGO in opciones

    detalle = _detalle(auth_session, report, [("aplicaciones", APP_UNICODE_LARGO)])
    assert detalle["total"] == 1
    item = detalle["items"][0]
    assert "_id" not in item
    assert isinstance(item.get("id"), str)
    assert isinstance(item.get("codigo"), str)
    assert item.get("fecha_hallazgo") == "2026-10-02"
