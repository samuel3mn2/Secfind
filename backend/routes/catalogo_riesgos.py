"""
Routes for Catálogo de Riesgos (Global Risk Catalog)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import List, Optional, Callable
from datetime import datetime, timezone
import uuid
import io
import pandas as pd

from models.grc_models import RiesgoCatalogo, RiesgoCatalogoCreate, RiesgoCatalogoUpdate


def create_catalogo_riesgos_router(db, get_current_user: Callable) -> APIRouter:
    """Factory function to create the router with injected dependencies"""
    
    router = APIRouter(prefix="/catalogo-riesgos", tags=["Catálogo de Riesgos"])

    @router.get("")
    async def get_riesgos(
        search: Optional[str] = Query(None, description="Search in codigo, nombre_corto or descripcion"),
        skip: int = 0,
        limit: int = 100,
        current_user = Depends(get_current_user)
    ):
        """Get all riesgos from the catalog with optional search"""
        query = {}
        
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"codigo_riesgo": search_regex},
                {"nombre_corto": search_regex},
                {"descripcion_completa": search_regex}
            ]
        
        total = await db.catalogo_riesgos.count_documents(query)
        riesgos = await db.catalogo_riesgos.find(query, {"_id": 0}).sort("codigo_riesgo", 1).skip(skip).limit(limit).to_list(limit)
        
        return {
            "items": riesgos,
            "total": total,
            "skip": skip,
            "limit": limit
        }

    @router.get("/all")
    async def get_all_riesgos(current_user = Depends(get_current_user)):
        """Get all riesgos without pagination (for selectors)"""
        riesgos = await db.catalogo_riesgos.find({}, {"_id": 0}).sort("codigo_riesgo", 1).to_list(1000)
        return riesgos

    @router.get("/plantilla/descargar")
    async def download_template(current_user = Depends(get_current_user)):
        """Generate and return an Excel template for import"""
        from fastapi.responses import StreamingResponse
        
        # Create template DataFrame
        template_data = {
            'Código': ['R-001', 'R-002'],
            'Riesgo': ['Acceso no autorizado', 'Fuga de datos'],
            'Descripción Completa': ['Descripción detallada del riesgo...', 'Otra descripción...']
        }
        df = pd.DataFrame(template_data)
        
        # Write to BytesIO
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Catálogo de Riesgos')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename=plantilla_catalogo_riesgos.xlsx'}
        )

    @router.get("/{riesgo_id}")
    async def get_riesgo(riesgo_id: str, current_user = Depends(get_current_user)):
        """Get a single riesgo by ID"""
        riesgo = await db.catalogo_riesgos.find_one({"id": riesgo_id}, {"_id": 0})
        if not riesgo:
            raise HTTPException(status_code=404, detail="Riesgo no encontrado")
        return riesgo

    @router.post("")
    async def create_riesgo(data: RiesgoCatalogoCreate, current_user = Depends(get_current_user)):
        """Create a new riesgo in the catalog"""
        if not current_user.es_admin:
            raise HTTPException(status_code=403, detail="Solo administradores pueden crear riesgos en el catálogo")
        
        # Check if codigo already exists
        existing = await db.catalogo_riesgos.find_one(
            {"codigo_riesgo": {"$regex": f"^{data.codigo_riesgo}$", "$options": "i"}}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un riesgo con ese código")
        
        riesgo = RiesgoCatalogo(**data.model_dump())
        doc = riesgo.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.catalogo_riesgos.insert_one(doc)
        
        # Audit log - using standard historial structure
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "crear",
            "entidad": "catalogo_riesgo",
            "entidad_id": riesgo.id,
            "entidad_nombre": f"{riesgo.codigo_riesgo} - {riesgo.nombre_corto}",
            "descripcion": f"Riesgo creado en catálogo: {riesgo.codigo_riesgo} - {riesgo.nombre_corto}",
            "cambios": []
        })
        
        return {
            "id": riesgo.id,
            "codigo_riesgo": riesgo.codigo_riesgo,
            "nombre_corto": riesgo.nombre_corto,
            "descripcion_completa": riesgo.descripcion_completa
        }

    @router.put("/{riesgo_id}")
    async def update_riesgo(riesgo_id: str, data: RiesgoCatalogoUpdate, current_user = Depends(get_current_user)):
        """Update a riesgo in the catalog"""
        if not current_user.es_admin:
            raise HTTPException(status_code=403, detail="Solo administradores pueden editar riesgos del catálogo")
        
        existing = await db.catalogo_riesgos.find_one({"id": riesgo_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Riesgo no encontrado")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Check codigo uniqueness if updating
        if "codigo_riesgo" in update_data:
            other = await db.catalogo_riesgos.find_one({
                "codigo_riesgo": {"$regex": f"^{update_data['codigo_riesgo']}$", "$options": "i"},
                "id": {"$ne": riesgo_id}
            })
            if other:
                raise HTTPException(status_code=400, detail="Ya existe otro riesgo con ese código")
        
        # Calculate changes for audit
        cambios = []
        for campo, valor_nuevo in update_data.items():
            valor_anterior = existing.get(campo)
            if valor_anterior != valor_nuevo:
                cambios.append({
                    "campo": campo,
                    "valor_anterior": valor_anterior,
                    "valor_nuevo": valor_nuevo
                })
        
        await db.catalogo_riesgos.update_one({"id": riesgo_id}, {"$set": update_data})
        
        # Audit log
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "actualizar",
            "entidad": "catalogo_riesgo",
            "entidad_id": riesgo_id,
            "entidad_nombre": f"{existing.get('codigo_riesgo')} - {existing.get('nombre_corto')}",
            "descripcion": f"Riesgo actualizado: {existing.get('codigo_riesgo')} - {existing.get('nombre_corto')}",
            "cambios": cambios
        })
        
        updated = await db.catalogo_riesgos.find_one({"id": riesgo_id}, {"_id": 0})
        return updated

    @router.delete("/{riesgo_id}")
    async def delete_riesgo(
        riesgo_id: str, 
        justificacion: str = Query(..., min_length=10, description="Justificación obligatoria para la eliminación"),
        current_user = Depends(get_current_user)
    ):
        """Delete a riesgo from the catalog"""
        if not current_user.es_admin:
            raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar riesgos del catálogo")
        
        existing = await db.catalogo_riesgos.find_one({"id": riesgo_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Riesgo no encontrado")
        
        # Check if riesgo is being used
        vulns_count = await db.vulnerabilidades.count_documents({"riesgo_id": riesgo_id})
        hallazgos_count = await db.hallazgos_auditoria.count_documents({"riesgo_id": riesgo_id})
        
        if vulns_count > 0 or hallazgos_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar: hay {vulns_count} vulnerabilidades y {hallazgos_count} hallazgos asociados"
            )
        
        await db.catalogo_riesgos.delete_one({"id": riesgo_id})
        
        # Audit log con justificación
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "ELIMINAR",
            "entidad": "catalogo_riesgo",
            "entidad_id": riesgo_id,
            "entidad_nombre": f"{existing.get('codigo_riesgo')} - {existing.get('nombre_corto')}",
            "descripcion": f"Riesgo eliminado del catálogo: {existing.get('codigo_riesgo')} - {existing.get('nombre_corto')}",
            "justificacion_borrado": justificacion.strip(),
            "cambios": []
        })
        
        return {"message": "Riesgo eliminado exitosamente del catálogo"}

    @router.post("/import/excel")
    async def import_riesgos_excel(
        file: UploadFile = File(...),
        current_user = Depends(get_current_user)
    ):
        """
        Import riesgos from Excel file.
        Expected columns: Código, Riesgo, Descripción Completa
        """
        if not current_user.es_admin:
            raise HTTPException(status_code=403, detail="Solo administradores pueden importar riesgos")
        
        if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")
        
        try:
            contents = await file.read()
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al leer el archivo: {str(e)}")
        
        # Column mapping (Spanish to internal field names)
        column_mapping = {
            'Código': 'codigo_riesgo',
            'Codigo': 'codigo_riesgo',
            'Código Riesgo': 'codigo_riesgo',
            'codigo_riesgo': 'codigo_riesgo',
            'Riesgo': 'nombre_corto',
            'Nombre Corto': 'nombre_corto',
            'Nombre': 'nombre_corto',
            'nombre_corto': 'nombre_corto',
            'Descripción Completa': 'descripcion_completa',
            'Descripción': 'descripcion_completa',
            'Descripcion': 'descripcion_completa',
            'descripcion_completa': 'descripcion_completa',
        }
        df = df.rename(columns=column_mapping)
        
        # Validate required columns
        required_cols = ['codigo_riesgo', 'nombre_corto']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400, 
                detail=f"Columnas requeridas faltantes: {', '.join(missing_cols)}. Se esperan: Código, Riesgo"
            )
        
        records = df.to_dict('records')
        inserted_count = 0
        skipped_count = 0
        errors = []
        
        for idx, record in enumerate(records, start=2):  # Start from 2 to account for header row
            try:
                # Clean record
                cleaned_record = {}
                for k, v in record.items():
                    if k in ['codigo_riesgo', 'nombre_corto', 'descripcion_completa']:
                        if pd.isna(v):
                            cleaned_record[k] = None if k == 'descripcion_completa' else ''
                        else:
                            cleaned_record[k] = str(v).strip()
                
                # Skip if codigo is empty
                if not cleaned_record.get('codigo_riesgo'):
                    skipped_count += 1
                    continue
                
                # Check if codigo already exists
                existing = await db.catalogo_riesgos.find_one(
                    {"codigo_riesgo": {"$regex": f"^{cleaned_record['codigo_riesgo']}$", "$options": "i"}}
                )
                if existing:
                    skipped_count += 1
                    errors.append(f"Fila {idx}: Código '{cleaned_record['codigo_riesgo']}' ya existe")
                    continue
                
                # Create riesgo
                riesgo = RiesgoCatalogo(
                    codigo_riesgo=cleaned_record['codigo_riesgo'].upper(),
                    nombre_corto=cleaned_record.get('nombre_corto', ''),
                    descripcion_completa=cleaned_record.get('descripcion_completa', '')
                )
                doc = riesgo.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                
                await db.catalogo_riesgos.insert_one(doc)
                inserted_count += 1
                
            except Exception as e:
                errors.append(f"Fila {idx}: {str(e)}")
                continue
        
        # Audit log
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "importar",
            "entidad": "catalogo_riesgo",
            "entidad_id": None,
            "entidad_nombre": f"Importación masiva: {inserted_count} riesgos",
            "descripcion": f"Importación Excel: {inserted_count} riesgos insertados, {skipped_count} omitidos",
            "cambios": []
        })
        
        return {
            "message": f"Importación completada: {inserted_count} riesgos insertados, {skipped_count} omitidos",
            "inserted": inserted_count,
            "skipped": skipped_count,
            "errors": errors[:10] if errors else []  # Return first 10 errors
        }

    return router
