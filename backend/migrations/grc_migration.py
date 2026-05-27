"""
Migration and Seed Data Script for GRC Module
Run this script to:
1. Rename riesgo_asociado -> riesgo_id in vulnerabilidades
2. Create initial dominios and controles
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import uuid

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "secfind")

# Seed data
DOMINIOS = [
    {"nombre_dominio": "Gestión de Identidades", "codigo_referencia": "DOM-ID"},
    {"nombre_dominio": "Seguridad EndPoints", "codigo_referencia": "DOM-EP"},
    {"nombre_dominio": "Seguridad de Red y Perímetro", "codigo_referencia": "DOM-NET"},
    {"nombre_dominio": "Seguridad de Aplicaciones", "codigo_referencia": "DOM-APP"},
    {"nombre_dominio": "Seguridad de Datos", "codigo_referencia": "DOM-DAT"},
    {"nombre_dominio": "Gestión de Monitoreo & Respuesta", "codigo_referencia": "DOM-MON"},
]

CONTROLES_ENDPOINTS = [
    {"codigo_control": "CTRL-EP-01", "nombre_control": "Protección del endpoint (EDR/EPP + postura)"},
    {"codigo_control": "CTRL-EP-02", "nombre_control": "Gestión de vulnerabilidades y parches (endpoints)"},
    {"codigo_control": "CTRL-EP-03", "nombre_control": "Configuración segura (Baseline/Hardening)"},
    {"codigo_control": "CTRL-EP-04", "nombre_control": "Protección de datos (Cifrado)"},
]


async def run_migration():
    """Run all migrations and seed data"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("GRC Migration & Seed Data Script")
    print("=" * 60)
    
    # Migration 1: Rename riesgo_asociado -> riesgo_id in vulnerabilidades
    print("\n[1/3] Renaming riesgo_asociado -> riesgo_id in vulnerabilidades...")
    
    # Check if any documents have riesgo_asociado
    count_with_old = await db.vulnerabilidades.count_documents({"riesgo_asociado": {"$exists": True}})
    print(f"    Found {count_with_old} documents with 'riesgo_asociado' field")
    
    if count_with_old > 0:
        result = await db.vulnerabilidades.update_many(
            {"riesgo_asociado": {"$exists": True}},
            {"$rename": {"riesgo_asociado": "riesgo_id"}}
        )
        print(f"    Renamed {result.modified_count} documents")
    else:
        print("    No migration needed - field already renamed or doesn't exist")
    
    # Migration 2: Seed Dominios
    print("\n[2/3] Seeding dominios...")
    
    existing_dominios = await db.config_dominios.count_documents({})
    if existing_dominios > 0:
        print(f"    Skipping - {existing_dominios} dominios already exist")
    else:
        dominio_docs = []
        for d in DOMINIOS:
            dominio_docs.append({
                "id": str(uuid.uuid4()),
                "nombre_dominio": d["nombre_dominio"],
                "codigo_referencia": d["codigo_referencia"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        await db.config_dominios.insert_many(dominio_docs)
        print(f"    Created {len(dominio_docs)} dominios")
    
    # Migration 3: Seed Controles for "Seguridad EndPoints"
    print("\n[3/3] Seeding controles for 'Seguridad EndPoints'...")
    
    existing_controles = await db.config_controles.count_documents({})
    if existing_controles > 0:
        print(f"    Skipping - {existing_controles} controles already exist")
    else:
        # Find the Seguridad EndPoints dominio
        dominio_ep = await db.config_dominios.find_one({"nombre_dominio": "Seguridad EndPoints"}, {"_id": 0})
        
        if dominio_ep:
            control_docs = []
            for c in CONTROLES_ENDPOINTS:
                control_docs.append({
                    "id": str(uuid.uuid4()),
                    "dominio_id": dominio_ep["id"],
                    "codigo_control": c["codigo_control"],
                    "nombre_control": c["nombre_control"],
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            await db.config_controles.insert_many(control_docs)
            print(f"    Created {len(control_docs)} controles for 'Seguridad EndPoints'")
        else:
            print("    ERROR: Could not find 'Seguridad EndPoints' dominio")
    
    # Create indexes
    print("\n[+] Creating indexes...")
    await db.config_dominios.create_index("id", unique=True)
    await db.config_dominios.create_index("nombre_dominio")
    await db.config_controles.create_index("id", unique=True)
    await db.config_controles.create_index("dominio_id")
    await db.catalogo_riesgos.create_index("id", unique=True)
    await db.catalogo_riesgos.create_index("codigo_riesgo", unique=True)
    await db.hallazgos_auditoria.create_index("id", unique=True)
    await db.hallazgos_auditoria.create_index("codigo", unique=True)
    await db.hallazgos_auditoria.create_index("estado")
    await db.hallazgos_auditoria.create_index("control_id")
    await db.hallazgos_auditoria.create_index("riesgo_id")
    print("    Indexes created successfully")
    
    print("\n" + "=" * 60)
    print("Migration completed successfully!")
    print("=" * 60)
    
    # Summary
    print("\nSummary:")
    print(f"  - Dominios: {await db.config_dominios.count_documents({})}")
    print(f"  - Controles: {await db.config_controles.count_documents({})}")
    print(f"  - Catálogo Riesgos: {await db.catalogo_riesgos.count_documents({})}")
    print(f"  - Hallazgos Auditoría: {await db.hallazgos_auditoria.count_documents({})}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
