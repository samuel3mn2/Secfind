"""Regresión UI Pivot GRC: ciclo de apertura/cierre de filtros y unicidad global.

Uso esperado:
- Este archivo documenta un flujo reusable para Playwright Python async.
- Mantiene cobertura del bug de reapertura de pvtFilterBox en Vulnerabilidades/Hallazgos.
"""

import asyncio


BASE_URL = "https://secfind-board.preview.emergentagent.com"


async def run(page):
    await page.set_viewport_size({"width": 1920, "height": 800})
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await page.fill('[data-testid="login-username"]', "admin")
    await page.fill('[data-testid="login-password"]', "admin123")
    await page.click('[data-testid="login-submit"]', force=True)
    await page.wait_for_timeout(1200)

    await page.goto(f"{BASE_URL}/dashboard-grc", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="dashboard-grc"]', timeout=20000)
    await page.click('[data-testid="tab-pivot"]', force=True)
    await page.wait_for_selector('[data-testid="pivot-analysis"]', timeout=20000)

    async def box_count():
        return await page.locator(".pvtFilterBox").count()

    # Ciclos de regresión en Vulnerabilidades
    for _ in range(5):
        await page.click('[data-testid="pivot-vuln-table-filter-nivel-riesgo-trigger"]', force=True)
        await page.wait_for_timeout(350)
        assert await box_count() == 1
        await page.click('[data-testid="pivot-vuln-table-filter-nivel-riesgo-close"]', force=True)
        await page.wait_for_timeout(350)
        assert await box_count() == 0

        await page.click('[data-testid="pivot-vuln-table-filter-estatus-trigger"]', force=True)
        await page.wait_for_timeout(350)
        assert await box_count() == 1
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(350)
        assert await box_count() == 0

    # Unicidad global en modo paralelo
    await page.click('[data-testid="module-hallazgos"]', force=True)
    await page.click('[data-testid="pivot-layout-split"]', force=True)
    await page.wait_for_timeout(900)
    await page.click('[data-testid="pivot-hall-table-filter-estado-trigger"]', force=True)
    await page.wait_for_timeout(350)
    await page.click('[data-testid="pivot-hall-chart-filter-estado-trigger"]', force=True)
    await page.wait_for_timeout(350)
    assert await box_count() == 1


if __name__ == "__main__":
    print("Este script está diseñado para ejecutarse dentro del runner Playwright async del entorno.")