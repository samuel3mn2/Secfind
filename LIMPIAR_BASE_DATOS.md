# Guía de Limpieza de Base de Datos - SecFind

Esta guía explica cómo limpiar la base de datos de SecFind en instalaciones locales.

---

## Requisitos

- MongoDB instalado y corriendo
- Acceso a la terminal/CMD

---

## Opción 1: Usando MongoDB Shell (mongosh)

### Abrir MongoDB Shell

```bash
# Windows (CMD o PowerShell)
mongosh

# Linux/Mac
mongosh
```

### Conectar a la base de datos

```javascript
use test_database
```

### Comandos de Limpieza

#### Limpiar SOLO vulnerabilidades (mantiene catálogos)
```javascript
db.vulnerabilidades.deleteMany({})
db.historial_cambios.deleteMany({})
```

#### Limpiar vulnerabilidades + aplicaciones
```javascript
db.vulnerabilidades.deleteMany({})
db.aplicaciones.deleteMany({})
db.historial_cambios.deleteMany({})
```

#### Limpiar TODO (reset completo)
```javascript
// Vulnerabilidades y auditoría
db.vulnerabilidades.deleteMany({})
db.historial_cambios.deleteMany({})

// Catálogos
db.instituciones.deleteMany({})
db.aplicaciones.deleteMany({})
db.proveedores.deleteMany({})
db.informes_pentest.deleteMany({})
db.responsables.deleteMany({})

// Configuración (opcional - borra config de notificaciones)
db.configuracion.deleteMany({})
```

#### Verificar que se limpió
```javascript
db.vulnerabilidades.countDocuments()
db.aplicaciones.countDocuments()
```

### Salir de MongoDB Shell
```javascript
exit
```

---

## Opción 2: Usando Python (Script)

Crea un archivo `limpiar_db.py` en la carpeta `backend/`:

```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def limpiar_base_datos():
    # Conectar a MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    print("Limpiando base de datos SecFind...")
    print("="*50)
    
    # Limpiar vulnerabilidades
    result = await db.vulnerabilidades.delete_many({})
    print(f"✓ Vulnerabilidades eliminadas: {result.deleted_count}")
    
    # Limpiar auditoría
    result = await db.historial_cambios.delete_many({})
    print(f"✓ Registros de auditoría eliminados: {result.deleted_count}")
    
    # Limpiar aplicaciones (descomentar si es necesario)
    # result = await db.aplicaciones.delete_many({})
    # print(f"✓ Aplicaciones eliminadas: {result.deleted_count}")
    
    # Limpiar instituciones (descomentar si es necesario)
    # result = await db.instituciones.delete_many({})
    # print(f"✓ Instituciones eliminadas: {result.deleted_count}")
    
    # Limpiar proveedores (descomentar si es necesario)
    # result = await db.proveedores.delete_many({})
    # print(f"✓ Proveedores eliminados: {result.deleted_count}")
    
    # Limpiar informes pentest (descomentar si es necesario)
    # result = await db.informes_pentest.delete_many({})
    # print(f"✓ Informes eliminados: {result.deleted_count}")
    
    # Limpiar responsables (descomentar si es necesario)
    # result = await db.responsables.delete_many({})
    # print(f"✓ Responsables eliminados: {result.deleted_count}")
    
    print("="*50)
    print("✅ Limpieza completada!")
    
    client.close()

# Ejecutar
asyncio.run(limpiar_base_datos())
```

### Ejecutar el script

```bash
# Windows
cd C:\SecFind\backend
python limpiar_db.py

# Linux/Mac
cd /ruta/a/secfind/backend
python3 limpiar_db.py
```

---

## Opción 3: Usando CMD de Windows (Una línea)

Abre CMD y ejecuta:

```cmd
mongosh --eval "use test_database; db.vulnerabilidades.deleteMany({}); db.historial_cambios.deleteMany({}); db.aplicaciones.deleteMany({});"
```

---

## Opción 4: Reset Completo con Docker

Si usas Docker:

```bash
# Detener contenedores
docker compose down

# Eliminar volumen de MongoDB (¡BORRA TODO!)
docker volume rm secfind_mongo_data

# Volver a iniciar
docker compose up -d
```

---

## Verificar Limpieza

### En MongoDB Shell
```javascript
use test_database
db.vulnerabilidades.countDocuments()  // Debe mostrar 0
db.aplicaciones.countDocuments()      // Debe mostrar 0
```

### En la Aplicación Web
1. Ve al Dashboard
2. Debe mostrar "0 vulnerabilidades"
3. Ve a Configuración > (cualquier catálogo)
4. Debe estar vacío

---

## Notas Importantes

1. **Backup antes de limpiar**: Si tienes datos importantes, exporta primero a Excel desde la aplicación.

2. **Usuario admin se mantiene**: La limpieza NO borra usuarios. El usuario `admin` seguirá funcionando.

3. **Configuración de notificaciones**: Si quieres mantener tu config SMTP, no elimines la colección `configuracion`.

4. **Nombre de la base de datos**: El nombre por defecto es `test_database`. Si cambiaste el `DB_NAME` en tu `.env`, usa ese nombre.

---

## Comandos Útiles de MongoDB

```javascript
// Ver todas las colecciones
show collections

// Contar documentos en una colección
db.vulnerabilidades.countDocuments()

// Ver primeros 5 documentos
db.vulnerabilidades.find().limit(5).pretty()

// Buscar por campo específico
db.vulnerabilidades.find({severidad: "Critica"})

// Eliminar por filtro (ejemplo: solo de una institución)
db.vulnerabilidades.deleteMany({institucion: "Banco X"})
```

---

## Solución de Problemas

### "mongosh no se reconoce como comando"
- Asegúrate de que MongoDB está instalado
- Agrega MongoDB al PATH de Windows
- O usa la ruta completa: `"C:\Program Files\MongoDB\Server\7.0\bin\mongosh.exe"`

### "Error de conexión"
- Verifica que MongoDB esté corriendo: `net start MongoDB` (Windows)
- Verifica el puerto: por defecto es 27017

### "Base de datos no existe"
- La base de datos se crea automáticamente cuando importas datos
- Verifica el nombre en `backend/.env` (variable `DB_NAME`)
