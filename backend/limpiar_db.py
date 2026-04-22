"""
Script para limpiar la base de datos de SecFind.
Ejecutar desde la carpeta backend: python limpiar_db.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Configuración
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

async def limpiar_base_datos():
    print("\n" + "="*60)
    print("  SecFind - Limpieza de Base de Datos")
    print("="*60)
    print(f"\nConectando a: {MONGO_URL}")
    print(f"Base de datos: {DB_NAME}\n")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Show all collections first
    print("Colecciones encontradas en la base de datos:")
    collections = await db.list_collection_names()
    for c in sorted(collections):
        count = await db[c].count_documents({})
        print(f"  - {c}: {count} documentos")
    print()
    
    # Preguntar qué limpiar
    print("¿Qué deseas limpiar?\n")
    print("  1. Solo vulnerabilidades y auditoría (mantiene catálogos)")
    print("  2. Vulnerabilidades + Aplicaciones + Auditoría")
    print("  3. TODO (reset completo, excepto usuarios)")
    print("  4. Solo logs de Auditoría")
    print("  5. Cancelar\n")
    
    opcion = input("Selecciona una opción (1-5): ").strip()
    
    if opcion == "5" or opcion == "":
        print("\n❌ Operación cancelada.")
        client.close()
        return
    
    print("\n" + "-"*40)
    
    # Opción 4: Solo auditoría
    if opcion == "4":
        # Try all possible collection names for audit logs
        result1 = await db.historial_cambios.delete_many({})
        result2 = await db.auditoria.delete_many({})
        result3 = await db.historial.delete_many({})
        total = result1.deleted_count + result2.deleted_count + result3.deleted_count
        print(f"✓ Logs de auditoría eliminados: {total}")
        print(f"  - historial_cambios: {result1.deleted_count}")
        print(f"  - auditoria: {result2.deleted_count}")
        print(f"  - historial: {result3.deleted_count}")
    
    # Opciones 1, 2, 3: Vulnerabilidades y auditoría
    if opcion in ["1", "2", "3"]:
        result = await db.vulnerabilidades.delete_many({})
        print(f"✓ Vulnerabilidades eliminadas: {result.deleted_count}")
        
        # Delete from all possible audit collection names
        result1 = await db.historial_cambios.delete_many({})
        result2 = await db.auditoria.delete_many({})
        result3 = await db.historial.delete_many({})
        total = result1.deleted_count + result2.deleted_count + result3.deleted_count
        print(f"✓ Logs de auditoría eliminados: {total}")
    
    # Opción 2 y 3: También aplicaciones
    if opcion in ["2", "3"]:
        result = await db.aplicaciones.delete_many({})
        print(f"✓ Aplicaciones eliminadas: {result.deleted_count}")
    
    # Opción 3: Todo excepto usuarios
    if opcion == "3":
        result = await db.instituciones.delete_many({})
        print(f"✓ Instituciones eliminadas: {result.deleted_count}")
        
        result = await db.proveedores.delete_many({})
        print(f"✓ Proveedores eliminados: {result.deleted_count}")
        
        result = await db.informes_pentest.delete_many({})
        print(f"✓ Informes Pentest eliminados: {result.deleted_count}")
        
        result = await db.responsables.delete_many({})
        print(f"✓ Responsables eliminados: {result.deleted_count}")
        
        # Preguntar si borrar config de notificaciones
        borrar_config = input("\n¿Borrar también la configuración de notificaciones? (s/n): ").strip().lower()
        if borrar_config == "s":
            result = await db.configuracion.delete_many({})
            print(f"✓ Configuración eliminada: {result.deleted_count}")
    
    print("-"*40)
    print("\n✅ Limpieza completada exitosamente!\n")
    
    # Mostrar conteo final
    print("Estado actual de la base de datos:")
    collections = await db.list_collection_names()
    for c in sorted(collections):
        count = await db[c].count_documents({})
        print(f"  - {c}: {count} documentos")
    print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(limpiar_base_datos())
