"""
Tests for POST /api/import/pdf/extract-rules using the Pentraze BHD PDF
Verifies:
 - endpoint returns 200 with success=true
 - metadata (nombre_informe, fecha_informe, institucion, proveedor)
 - 5 vulnerabilidades extracted with expected fields
 - severidad/nivel_riesgo mapping (Critica->Alto, Media->Medio)
 - each vulnerability has descripcion_riesgo, recomendaciones, aplicaciones list
"""

import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://secfind-board.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PDF_URL = (
    "https://customer-assets-jai6qajn.emergentagent.net/job_secfind-board/"
    "artifacts/4030ohx5_BHD%20-%20Prueba%20de%20Penetraci%C3%B3n%20Web%20a%20Fondos%20BHD.pdf"
)


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tk = data.get("token") or data.get("access_token")
    assert tk, f"no token in login response: {data}"
    return tk


@pytest.fixture(scope="module")
def pdf_bytes():
    r = requests.get(PDF_URL, timeout=60)
    assert r.status_code == 200, f"failed to download PDF: {r.status_code}"
    assert r.content.startswith(b"%PDF"), "downloaded content is not a PDF"
    return r.content


@pytest.fixture(scope="module")
def extract_result(token, pdf_bytes):
    files = {"file": ("bhd_pentraze.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"parser_type": "pentraze"}
    r = requests.post(
        f"{API}/import/pdf/extract-rules",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        data=data,
        timeout=120,
    )
    assert r.status_code == 200, f"extract-rules failed: {r.status_code} {r.text[:500]}"
    return r.json()


class TestExtractRulesEndpoint:
    def test_success_flag(self, extract_result):
        assert extract_result.get("success") is True
        assert extract_result.get("parser_used")

    def test_total_five_vulnerabilities(self, extract_result):
        assert extract_result.get("total") == 5, f"expected 5 vulnerabilidades, got {extract_result.get('total')}"
        assert len(extract_result.get("vulnerabilities", [])) == 5

    def test_metadata_fields(self, extract_result):
        md = extract_result.get("metadata") or {}
        assert md.get("nombre_informe"), f"missing nombre_informe. metadata={md}"
        # Fecha may be optional but for this PDF it should be present
        assert md.get("fecha_informe"), f"missing fecha_informe. metadata={md}"
        assert md.get("institucion"), f"missing institucion. metadata={md}"
        # BHD detection
        assert "BHD" in md.get("institucion", ""), f"institucion should contain BHD: {md.get('institucion')}"
        assert md.get("proveedor"), f"missing proveedor. metadata={md}"
        assert "pentraze" in md.get("proveedor", "").lower()

    def test_vulnerabilities_have_required_fields(self, extract_result):
        vulns = extract_result["vulnerabilities"]
        required = [
            "vulnerabilidad", "severidad", "nivel_riesgo",
            "aplicaciones", "descripcion_riesgo", "recomendaciones",
            "nombre_informe_pentest", "proveedor",
        ]
        for i, v in enumerate(vulns):
            for f in required:
                assert f in v, f"vuln #{i} missing field '{f}': keys={list(v.keys())}"
            assert v["severidad"] in {"Critica", "Alta", "Media", "Baja"}, f"invalid severidad: {v['severidad']}"
            assert v["nivel_riesgo"] in {"Alto", "Medio Alto", "Medio", "Bajo"}, f"invalid nivel_riesgo: {v['nivel_riesgo']}"
            assert isinstance(v["aplicaciones"], list)

    def test_severity_and_nivel_riesgo_mapping(self, extract_result):
        vulns = extract_result["vulnerabilities"]
        severities = [v["severidad"] for v in vulns]
        # PDF has 1 Critica + 4 Media
        assert severities.count("Critica") == 1, f"expected 1 Critica, got {severities.count('Critica')}. all={severities}"
        assert severities.count("Media") == 4, f"expected 4 Media, got {severities.count('Media')}. all={severities}"
        # Mapping severidad -> nivel_riesgo (Critica->Alto, Media->Medio)
        for v in vulns:
            if v["severidad"] == "Critica":
                assert v["nivel_riesgo"] == "Alto"
            elif v["severidad"] == "Media":
                assert v["nivel_riesgo"] == "Medio"

    def test_zero_day_vulnerability_present(self, extract_result):
        vulns = extract_result["vulnerabilities"]
        titles = " || ".join([v.get("vulnerabilidad", "") for v in vulns])
        # The critical vuln references a 0-DAY / 0 DAY
        assert "0" in titles and ("DAY" in titles.upper() or "day" in titles.lower()), \
            f"expected a 0-day title among: {titles}"

    def test_descripcion_and_recomendaciones_non_empty(self, extract_result):
        vulns = extract_result["vulnerabilities"]
        # At least 4 out of 5 should have non-trivial descripcion + recomendaciones
        non_empty_desc = sum(1 for v in vulns if len(v.get("descripcion_riesgo") or "") > 30)
        non_empty_rec = sum(1 for v in vulns if len(v.get("recomendaciones") or "") > 20)
        assert non_empty_desc >= 4, f"only {non_empty_desc}/5 vulns have descripcion_riesgo"
        assert non_empty_rec >= 4, f"only {non_empty_rec}/5 vulns have recomendaciones"


class TestExtractRulesErrorCases:
    def test_requires_auth(self, pdf_bytes):
        files = {"file": ("bhd.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        r = requests.post(f"{API}/import/pdf/extract-rules", files=files, timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403 without auth, got {r.status_code}"

    def test_rejects_non_pdf(self, token):
        files = {"file": ("notes.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(
            f"{API}/import/pdf/extract-rules",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            data={"parser_type": "pentraze"},
            timeout=30,
        )
        assert r.status_code == 400
