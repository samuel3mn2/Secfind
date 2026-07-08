"""
Script para corregir vulnerabilidades que fueron afectadas por el bug donde
'Nota de Seguimiento' sobrescribía el resultado_re_test.

Este script busca vulnerabilidades que:
1. Tienen historial con entrada "Para Re Test"
2. Pero su resultado_re_test actual NO es "Para Re Test"
3. No están cerradas

Y las restaura a resultado_re_test = "Para Re Test"

Uso:
    python fix_retest_vulnerabilities.py [--dry-run]
    
    --dry-run: Solo muestra qué se corregiría sin hacer cambios
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def fix_affected_vulnerabilities(dry_run=True):
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client["secfind"]
    
    print("=" * 60)
    print("Script de corrección de vulnerabilidades 'En Retest'")
    print("=" * 60)
    print(f"Modo: {'DRY RUN (sin cambios)' if dry_run else 'EJECUCIÓN REAL'}")
    print()
    
    # Caso 1: Vulnerabilidades con resultado_re_test = "Nota de Seguimiento"
    # que deberían estar en "Para Re Test"
    query_nota = {
        "resultado_re_test": "Nota de Seguimiento",
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]},
        "historial_impedimentos_seguimiento.resultado_retest": "Para Re Test"
    }
    
    affected_nota = await db.vulnerabilidades.find(query_nota, {"_id": 0, "id": 1, "codigo": 1, "vulnerabilidad": 1}).to_list(length=1000)
    
    print(f"Caso 1: Vulnerabilidades con resultado_re_test='Nota de Seguimiento' que tuvieron 'Para Re Test': {len(affected_nota)}")
    
    for v in affected_nota:
        print(f"  - {v.get('codigo')}: {v.get('vulnerabilidad', 'N/A')[:50]}...")
    
    # Caso 2: Vulnerabilidades cuyo último estado NO es cierre pero resultado_re_test no coincide
    # Buscar todas las que tienen historial con "Para Re Test" como última entrada relevante
    query_historial = {
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]},
        "resultado_re_test": {"$ne": "Para Re Test"},
        "historial_impedimentos_seguimiento": {"$exists": True, "$ne": []}
    }
    
    candidates = await db.vulnerabilidades.find(query_historial, {"_id": 0}).to_list(length=1000)
    
    affected_historial = []
    for v in candidates:
        historial = v.get('historial_impedimentos_seguimiento', [])
        # Buscar la última entrada que NO sea "Nota de Seguimiento"
        last_non_note = None
        for h in reversed(historial):
            if h.get('resultado_retest') != 'Nota de Seguimiento':
                last_non_note = h.get('resultado_retest')
                break
        
        if last_non_note == 'Para Re Test':
            affected_historial.append(v)
    
    print(f"\nCaso 2: Vulnerabilidades cuya última acción relevante fue 'Para Re Test': {len(affected_historial)}")
    
    for v in affected_historial:
        print(f"  - {v.get('codigo')}: {v.get('vulnerabilidad', 'N/A')[:50]}...")
        print(f"    resultado_re_test actual: {v.get('resultado_re_test')}")
    
    # Combinar listas (sin duplicados)
    all_affected_ids = set([v['id'] for v in affected_nota] + [v['id'] for v in affected_historial])
    
    print(f"\n{'='*60}")
    print(f"TOTAL VULNERABILIDADES A CORREGIR: {len(all_affected_ids)}")
    print("="*60)
    
    if not dry_run and all_affected_ids:
        # Aplicar corrección
        result = await db.vulnerabilidades.update_many(
            {"id": {"$in": list(all_affected_ids)}},
            {"$set": {"resultado_re_test": "Para Re Test"}}
        )
        print(f"\n✅ Corregidas {result.modified_count} vulnerabilidades")
        print("   resultado_re_test establecido a 'Para Re Test'")
    elif all_affected_ids:
        print("\n⚠️  Ejecuta sin --dry-run para aplicar las correcciones")
    else:
        print("\n✅ No se encontraron vulnerabilidades que necesiten corrección")
    
    client.close()

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv or len(sys.argv) == 1
    asyncio.run(fix_affected_vulnerabilities(dry_run=dry_run))
