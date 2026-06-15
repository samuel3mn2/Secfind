"""
Script para limpiar la base de datos de SecFind.
Ejecutar desde la carpeta backend: python limpiar_db.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path

# Cargar variables del archivo .env si existe
def load_env():
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    # Remove quotes if present
                    value = value.strip().strip('"').strip("'")
                    os.environ[key] = value

load_env()

# Configuración
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "secfind_db")

async def limpiar_base_datos():
    print("\n" + "="*60)
    print("  SecFind - Limpieza de Base de Datos")
    print("="*60)
    print(f"\nConectando a: {MONGO_URL}")
    print(f"Base de datos: {DB_NAME}")
    
    # Preguntar si quiere usar otra base de datos
    otra_db = input(f"\n¿Usar otra base de datos? (Enter para usar '{DB_NAME}'): ").strip()
    db_name = otra_db if otra_db else DB_NAME
    
    print(f"\nUsando base de datos: {db_name}\n")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[db_name]
    
    # Show all collections first
    print("Colecciones encontradas:")
    print("-" * 40)
    collections = await db.list_collection_names()
    if not collections:
        print("  (No se encontraron colecciones)")
        print("\n¿Estás seguro de que el nombre de la base de datos es correcto?")
        client.close()
        return
    
    for c in sorted(collections):
        count = await db[c].count_documents({})
        print(f"  {c}: {count} documentos")
    print("-" * 40)
    
    # Preguntar qué limpiar
    print("\n¿Qué deseas limpiar?\n")
    print("  1. Solo vulnerabilidades y auditoría (mantiene catálogos)")
    print("  2. Vulnerabilidades + Aplicaciones + Auditoría")
    print("  3. TODO (reset completo, excepto usuarios)")
    print("  4. Solo logs de Auditoría")
    print("  5. Solo catálogo de riesgos (riesgos creados por mapeo GRC)")
    print("  6. Cancelar\n")
    
    opcion = input("Selecciona una opción (1-6): ").strip()
    
    if opcion == "6" or opcion == "":
        print("\n❌ Operación cancelada.")
        client.close()
        return
    
    print("\n" + "-"*40)
    print("Eliminando registros...")
    print("-"*40)
    
    # Opción 4: Solo auditoría
    if opcion == "4":
        # Try all possible collection names for audit logs
        total = 0
        for col_name in ["historial_cambios", "auditoria", "historial"]:
            if col_name in collections:
                result = await db[col_name].delete_many({})
                if result.deleted_count > 0:
                    print(f"  ✓ {col_name}: {result.deleted_count} eliminados")
                    total += result.deleted_count
        if total == 0:
            print("  No se encontraron registros de auditoría")
        else:
            print(f"\n  Total logs de auditoría eliminados: {total}")
    
    # Opción 5: Solo catálogo de riesgos
    if opcion == "5":
        print("\n¿Qué riesgos deseas eliminar?\n")
        print("  a. Solo riesgos creados por mapeo GRC (categoria='Operativo')")
        print("  b. TODOS los riesgos del catálogo")
        print("  c. Cancelar\n")
        
        sub_opcion = input("Selecciona (a/b/c): ").strip().lower()
        
        if sub_opcion == "a":
            result = await db.catalogo_riesgos.delete_many({"categoria": "Operativo"})
            print(f"  ✓ catalogo_riesgos (Operativo): {result.deleted_count} eliminados")
        elif sub_opcion == "b":
            confirmar = input("\n⚠️  ¿Estás seguro de eliminar TODOS los riesgos? (escribir 'SI'): ").strip()
            if confirmar == "SI":
                result = await db.catalogo_riesgos.delete_many({})
                print(f"  ✓ catalogo_riesgos: {result.deleted_count} eliminados")
            else:
                print("  ❌ Operación cancelada")
        else:
            print("  ❌ Operación cancelada")
    
    # Opciones 1, 2, 3: Vulnerabilidades y auditoría
    if opcion in ["1", "2", "3"]:
        result = await db.vulnerabilidades.delete_many({})
        print(f"  ✓ vulnerabilidades: {result.deleted_count} eliminadas")
        
        # Delete from all possible audit collection names
        total = 0
        for col_name in ["historial_cambios", "auditoria", "historial"]:
            if col_name in collections:
                result = await db[col_name].delete_many({})
                if result.deleted_count > 0:
                    print(f"  ✓ {col_name}: {result.deleted_count} eliminados")
                    total += result.deleted_count
    
    # Opción 2 y 3: También aplicaciones
    if opcion in ["2", "3"]:
        result = await db.aplicaciones.delete_many({})
        print(f"  ✓ aplicaciones: {result.deleted_count} eliminadas")
    
    # Opción 3: Todo excepto usuarios
    if opcion == "3":
        result = await db.instituciones.delete_many({})
        print(f"  ✓ instituciones: {result.deleted_count} eliminadas")
        
        result = await db.proveedores.delete_many({})
        print(f"  ✓ proveedores: {result.deleted_count} eliminados")
        
        result = await db.informes_pentest.delete_many({})
        print(f"  ✓ informes_pentest: {result.deleted_count} eliminados")
        
        result = await db.responsables.delete_many({})
        print(f"  ✓ responsables: {result.deleted_count} eliminados")
        
        # Preguntar si borrar config de notificaciones
        borrar_config = input("\n¿Borrar también la configuración de notificaciones? (s/n): ").strip().lower()
        if borrar_config == "s":
            result = await db.configuracion.delete_many({})
            print(f"  ✓ configuracion: {result.deleted_count} eliminados")
    
    print("\n" + "="*60)
    print("  ✅ LIMPIEZA COMPLETADA")
    print("="*60)
    
    # Mostrar conteo final
    print("\nEstado actual de la base de datos:")
    print("-" * 40)
    collections = await db.list_collection_names()
    for c in sorted(collections):
        count = await db[c].count_documents({})
        print(f"  {c}: {count} documentos")
    print("-" * 40)
    print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(limpiar_base_datos())
