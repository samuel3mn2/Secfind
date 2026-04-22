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
    
    # Preguntar qué limpiar
    print("¿Qué deseas limpiar?\n")
    print("  1. Solo vulnerabilidades (mantiene catálogos)")
    print("  2. Vulnerabilidades + Aplicaciones")
    print("  3. TODO (reset completo, excepto usuarios)")
    print("  4. Cancelar\n")
    
    opcion = input("Selecciona una opción (1-4): ").strip()
    
    if opcion == "4" or opcion == "":
        print("\n❌ Operación cancelada.")
        client.close()
        return
    
    print("\n" + "-"*40)
    
    # Siempre limpiar vulnerabilidades y auditoría
    if opcion in ["1", "2", "3"]:
        result = await db.vulnerabilidades.delete_many({})
        print(f"✓ Vulnerabilidades eliminadas: {result.deleted_count}")
        
        result = await db.historial_cambios.delete_many({})
        print(f"✓ Registros de auditoría eliminados: {result.deleted_count}")
    
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
    print(f"  - Vulnerabilidades: {await db.vulnerabilidades.count_documents({})}")
    print(f"  - Aplicaciones: {await db.aplicaciones.count_documents({})}")
    print(f"  - Instituciones: {await db.instituciones.count_documents({})}")
    print(f"  - Proveedores: {await db.proveedores.count_documents({})}")
    print(f"  - Informes: {await db.informes_pentest.count_documents({})}")
    print(f"  - Usuarios: {await db.usuarios.count_documents({})}")
    print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(limpiar_base_datos())
