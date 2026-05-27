"""
Routes for Hallazgos de Auditoría (Audit Findings)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import List, Optional, Callable
from datetime import datetime, timezone
import uuid
import io
import pandas as pd

from models.grc_models import HallazgoAuditoria, HallazgoAuditoriaCreate, HallazgoAuditoriaUpdate, EstadoHallazgo


def create_hallazgos_router(db, get_current_user: Callable) -> APIRouter:
    """Factory function to create the router with injected dependencies"""
    
    router = APIRouter(prefix="/hallazgos-auditoria", tags=["Hallazgos de Auditoría"])

    async def enrich_hallazgo(hallazgo: dict) -> dict:
        """Enrich hallazgo with control and riesgo names"""
        if hallazgo.get("control_id"):
            control = await db.config_controles.find_one({"id": hallazgo["control_id"]}, {"_id": 0})
            if control:
                hallazgo["nombre_control"] = control.get("nombre_control")
                hallazgo["codigo_control"] = control.get("codigo_control")
                if control.get("dominio_id"):
                    dominio = await db.config_dominios.find_one({"id": control["dominio_id"]}, {"_id": 0})
                    hallazgo["nombre_dominio"] = dominio.get("nombre_dominio") if dominio else None
        
        if hallazgo.get("riesgo_id"):
            riesgo = await db.catalogo_riesgos.find_one({"id": hallazgo["riesgo_id"]}, {"_id": 0})
            if riesgo:
                hallazgo["nombre_riesgo"] = riesgo.get("nombre_corto")
                hallazgo["codigo_riesgo"] = riesgo.get("codigo_riesgo")
        
        return hallazgo

    @router.get("")
    async def get_hallazgos(
        estado: Optional[str] = Query(None),
        control_id: Optional[str] = Query(None),
        riesgo_id: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        skip: int = 0,
        limit: int = 50,
        current_user = Depends(get_current_user)
    ):
        """Get all hallazgos with filters"""
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos para ver hallazgos")
        
        query = {}
        
        if estado:
            query["estado"] = estado
        if control_id:
            query["control_id"] = control_id
        if riesgo_id:
            query["riesgo_id"] = riesgo_id
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"codigo": search_regex},
                {"brecha": search_regex},
                {"observaciones": search_regex}
            ]
        
        total = await db.hallazgos_auditoria.count_documents(query)
        hallazgos = await db.hallazgos_auditoria.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich all hallazgos
        enriched = []
        for h in hallazgos:
            enriched.append(await enrich_hallazgo(h))
        
        return {
            "items": enriched,
            "total": total,
            "skip": skip,
            "limit": limit
        }

    @router.get("/stats")
    async def get_hallazgos_stats(current_user = Depends(get_current_user)):
        """Get statistics for hallazgos dashboard"""
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos")
        
        total = await db.hallazgos_auditoria.count_documents({})
        abiertos = await db.hallazgos_auditoria.count_documents({"estado": "Abierto"})
        en_proceso = await db.hallazgos_auditoria.count_documents({"estado": "En Proceso"})
        revision = await db.hallazgos_auditoria.count_documents({"estado": "Listo para Revisión"})
        cerrados = await db.hallazgos_auditoria.count_documents({"estado": "Cerrado"})
        
        # Get high risk hallazgos (riesgo_inherente >= 15)
        alto_riesgo = await db.hallazgos_auditoria.count_documents({
            "riesgo_inherente": {"$gte": 15},
            "estado": {"$ne": "Cerrado"}
        })
        
        return {
            "total": total,
            "por_estado": {
                "Abierto": abiertos,
                "En Proceso": en_proceso,
                "Listo para Revisión": revision,
                "Cerrado": cerrados
            },
            "alto_riesgo_pendientes": alto_riesgo
        }

    @router.get("/next-codigo")
    async def get_next_codigo(current_user = Depends(get_current_user)):
        """Generate the next sequential codigo for a new hallazgo"""
        year = datetime.now().year
        prefix = f"AUD-{year}-"
        
        # Find the highest existing codigo for this year
        last = await db.hallazgos_auditoria.find_one(
            {"codigo": {"$regex": f"^{prefix}"}},
            sort=[("codigo", -1)]
        )
        
        if last:
            try:
                last_num = int(last["codigo"].split("-")[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return {"next_codigo": f"{prefix}{str(next_num).zfill(3)}"}

    @router.get("/plantilla/descargar")
    async def download_template(current_user = Depends(get_current_user)):
        """Generate and return an Excel template for import"""
        from fastapi.responses import StreamingResponse
        
        # Create template DataFrame with user-friendly names
        template_data = {
            'Código': ['AUD-2025-001', 'AUD-2025-002', 'AUD-2025-003'],
            'Brecha': ['Descripción del hallazgo...', 'Otro hallazgo...', 'Tercer hallazgo...'],
            'Dominio': ['Seguridad Endpoints', '', 'Gestión de Identidades'],
            'Control': ['Antivirus actualizado', '', 'Autenticación MFA'],
            'Riesgo': ['Acceso no autorizado', '', 'Fraude de identidad'],
            'Probabilidad': ['Alta', 'Medio', 'Muy Alta'],  # Muy Baja, Baja, Medio, Alta, Muy Alta
            'Impacto': ['Alto', 'Medio', 'Muy Alto'],  # Muy Bajo, Bajo, Medio, Alto, Muy Alto
            'Estado': ['Abierto', 'En Proceso', 'Abierto'],
            'Observaciones': ['Notas...', '', 'Urgente']
        }
        df = pd.DataFrame(template_data)
        
        # Write to BytesIO
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Hallazgos de Auditoría')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename=plantilla_hallazgos_auditoria.xlsx'}
        )

    @router.get("/{hallazgo_id}")
    async def get_hallazgo(hallazgo_id: str, current_user = Depends(get_current_user)):
        """Get a single hallazgo by ID"""
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos")
        
        hallazgo = await db.hallazgos_auditoria.find_one({"id": hallazgo_id}, {"_id": 0})
        if not hallazgo:
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
        
        return await enrich_hallazgo(hallazgo)

    @router.post("")
    async def create_hallazgo(data: HallazgoAuditoriaCreate, current_user = Depends(get_current_user)):
        """Create a new hallazgo de auditoría"""
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
            raise HTTPException(status_code=403, detail="No tiene permisos para crear hallazgos")
        
        # Check codigo uniqueness
        existing = await db.hallazgos_auditoria.find_one({"codigo": data.codigo})
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un hallazgo con ese código")
        
        # Verify control exists if provided
        if data.control_id:
            control = await db.config_controles.find_one({"id": data.control_id})
            if not control:
                raise HTTPException(status_code=400, detail="El control especificado no existe")
        
        # Verify riesgo exists if provided
        if data.riesgo_id:
            riesgo = await db.catalogo_riesgos.find_one({"id": data.riesgo_id})
            if not riesgo:
                raise HTTPException(status_code=400, detail="El riesgo especificado no existe")
        
        hallazgo = HallazgoAuditoria(**data.model_dump())
        doc = hallazgo.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.hallazgos_auditoria.insert_one(doc)
        
        # Remove _id if MongoDB added it
        doc.pop('_id', None)
        
        # Audit log - using standard historial structure
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "crear",
            "entidad": "hallazgo_auditoria",
            "entidad_id": hallazgo.id,
            "entidad_nombre": hallazgo.codigo,
            "descripcion": f"Hallazgo creado: {hallazgo.codigo} - {hallazgo.brecha[:50] if hallazgo.brecha else ''}...",
            "cambios": []
        })
        
        return await enrich_hallazgo(doc)

    @router.put("/{hallazgo_id}")
    async def update_hallazgo(hallazgo_id: str, data: HallazgoAuditoriaUpdate, current_user = Depends(get_current_user)):
        """Update a hallazgo"""
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.editar:
            raise HTTPException(status_code=403, detail="No tiene permisos para editar hallazgos")
        
        existing = await db.hallazgos_auditoria.find_one({"id": hallazgo_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Check codigo uniqueness if updating
        if "codigo" in update_data:
            other = await db.hallazgos_auditoria.find_one({
                "codigo": update_data["codigo"],
                "id": {"$ne": hallazgo_id}
            })
            if other:
                raise HTTPException(status_code=400, detail="Ya existe otro hallazgo con ese código")
        
        # Verify control exists if updating
        if "control_id" in update_data and update_data["control_id"]:
            control = await db.config_controles.find_one({"id": update_data["control_id"]})
            if not control:
                raise HTTPException(status_code=400, detail="El control especificado no existe")
        
        # Verify riesgo exists if updating
        if "riesgo_id" in update_data and update_data["riesgo_id"]:
            riesgo = await db.catalogo_riesgos.find_one({"id": update_data["riesgo_id"]})
            if not riesgo:
                raise HTTPException(status_code=400, detail="El riesgo especificado no existe")
        
        # Recalculate riesgo_inherente if probabilidad or impacto changed
        prob = update_data.get("probabilidad", existing.get("probabilidad", 1))
        impact = update_data.get("impacto", existing.get("impacto", 1))
        update_data["riesgo_inherente"] = prob * impact
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Calculate changes for audit
        cambios = []
        estado_changed = False
        old_estado = existing.get("estado")
        new_estado = update_data.get("estado", old_estado)
        
        for campo, valor_nuevo in update_data.items():
            if campo in ["updated_at"]:
                continue
            valor_anterior = existing.get(campo)
            if valor_anterior != valor_nuevo:
                cambios.append({
                    "campo": campo,
                    "valor_anterior": valor_anterior,
                    "valor_nuevo": valor_nuevo
                })
                if campo == "estado":
                    estado_changed = True
        
        await db.hallazgos_auditoria.update_one({"id": hallazgo_id}, {"$set": update_data})
        
        # Audit log
        descripcion = f"Hallazgo actualizado: {existing.get('codigo')}"
        if estado_changed:
            descripcion += f" (Estado: {old_estado} → {new_estado})"
        
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "actualizar",
            "entidad": "hallazgo_auditoria",
            "entidad_id": hallazgo_id,
            "entidad_nombre": existing.get("codigo"),
            "descripcion": descripcion,
            "cambios": cambios
        })
        
        updated = await db.hallazgos_auditoria.find_one({"id": hallazgo_id}, {"_id": 0})
        return await enrich_hallazgo(updated)

    @router.delete("/{hallazgo_id}")
    async def delete_hallazgo(hallazgo_id: str, current_user = Depends(get_current_user)):
        """Delete a hallazgo"""
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.eliminar:
            raise HTTPException(status_code=403, detail="No tiene permisos para eliminar hallazgos")
        
        existing = await db.hallazgos_auditoria.find_one({"id": hallazgo_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado")
        
        await db.hallazgos_auditoria.delete_one({"id": hallazgo_id})
        
        # Audit log
        await db.historial_cambios.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario_id": current_user.id,
            "usuario_nombre": current_user.username,
            "accion": "eliminar",
            "entidad": "hallazgo_auditoria",
            "entidad_id": hallazgo_id,
            "entidad_nombre": existing.get("codigo"),
            "descripcion": f"Hallazgo eliminado: {existing.get('codigo')}",
            "cambios": []
        })
        
        return {"message": "Hallazgo eliminado exitosamente"}

    @router.post("/import/excel")
    async def import_hallazgos_excel(
        file: UploadFile = File(...),
        current_user = Depends(get_current_user)
    ):
        """
        Import hallazgos from Excel file.
        Expected columns: Código, Brecha, Dominio, Control (nombre), Riesgo (nombre corto), Probabilidad, Impacto, Estado, Observaciones
        """
        if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
            raise HTTPException(status_code=403, detail="No tiene permisos para importar hallazgos")
        
        if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")
        
        try:
            contents = await file.read()
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al leer el archivo: {str(e)}")
        
        # Column mapping (Spanish to internal field names)
        column_mapping = {
            'Código': 'codigo',
            'Codigo': 'codigo',
            'código': 'codigo',
            'Brecha': 'brecha',
            'Hallazgo': 'brecha',
            'Descripción': 'brecha',
            'Dominio': 'nombre_dominio',
            'Control': 'nombre_control',
            'Nombre Control': 'nombre_control',
            'Control Asociado': 'nombre_control',
            'Riesgo': 'nombre_riesgo',
            'Nombre Riesgo': 'nombre_riesgo',
            'Riesgo Asociado': 'nombre_riesgo',
            'Probabilidad': 'probabilidad',
            'Impacto': 'impacto',
            'Estado': 'estado',
            'Estatus': 'estado',
            'Observaciones': 'observaciones',
            'Notas': 'observaciones',
        }
        df = df.rename(columns=column_mapping)
        
        # Validate required columns
        required_cols = ['codigo', 'brecha']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400, 
                detail=f"Columnas requeridas faltantes: {', '.join(missing_cols)}. Se esperan: Código, Brecha"
            )
        
        # Pre-load dominio, control and riesgo mappings by name (case-insensitive)
        dominios = await db.config_dominios.find({}, {"_id": 0}).to_list(500)
        dominio_map = {d.get("nombre_dominio", "").lower(): d["id"] for d in dominios if d.get("nombre_dominio")}
        
        controles = await db.config_controles.find({}, {"_id": 0}).to_list(1000)
        # Map by nombre_control (case-insensitive)
        control_map = {c.get("nombre_control", "").lower(): c["id"] for c in controles if c.get("nombre_control")}
        # Also map controls by dominio for validation
        control_by_dominio = {}
        for c in controles:
            dom_id = c.get("dominio_id")
            if dom_id not in control_by_dominio:
                control_by_dominio[dom_id] = {}
            control_by_dominio[dom_id][c.get("nombre_control", "").lower()] = c["id"]
        
        riesgos = await db.catalogo_riesgos.find({}, {"_id": 0}).to_list(1000)
        # Map by nombre_corto (case-insensitive)
        riesgo_map = {r.get("nombre_corto", "").lower(): r["id"] for r in riesgos if r.get("nombre_corto")}
        
        valid_estados = ["Abierto", "En Proceso", "Listo para Revisión", "Cerrado"]
        
        # Mapping for text-based probabilidad/impacto values
        prob_imp_text_map = {
            # Probabilidad
            "muy baja": 1, "muy bajo": 1,
            "baja": 2, "bajo": 2,
            "media": 3, "medio": 3,
            "alta": 4, "alto": 4,
            "muy alta": 5, "muy alto": 5,
            # Also accept numbers as strings
            "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
        }
        
        def parse_prob_imp(value, default=3):
            """Convert text or number to 1-5 scale"""
            if value is None:
                return default
            if isinstance(value, (int, float)):
                return max(1, min(5, int(value)))
            if isinstance(value, str):
                val_lower = value.strip().lower()
                if val_lower in prob_imp_text_map:
                    return prob_imp_text_map[val_lower]
                # Try to parse as int
                try:
                    return max(1, min(5, int(value)))
                except:
                    return default
            return default
        
        records = df.to_dict('records')
        inserted_count = 0
        skipped_count = 0
        errors = []
        
        for idx, record in enumerate(records, start=2):  # Start from 2 to account for header row
            try:
                # Clean record
                cleaned_record = {}
                for k, v in record.items():
                    if pd.isna(v):
                        cleaned_record[k] = None
                    elif isinstance(v, (int, float)):
                        cleaned_record[k] = int(v) if k in ['probabilidad', 'impacto'] else str(v).strip()
                    else:
                        cleaned_record[k] = str(v).strip()
                
                # Skip if codigo or brecha is empty
                if not cleaned_record.get('codigo') or not cleaned_record.get('brecha'):
                    skipped_count += 1
                    continue
                
                # Check if codigo already exists
                existing = await db.hallazgos_auditoria.find_one({"codigo": cleaned_record['codigo']})
                if existing:
                    skipped_count += 1
                    errors.append(f"Fila {idx}: Código '{cleaned_record['codigo']}' ya existe")
                    continue
                
                # Resolve dominio_id from nombre_dominio (for context/validation)
                dominio_id = None
                if cleaned_record.get('nombre_dominio'):
                    dominio_id = dominio_map.get(cleaned_record['nombre_dominio'].lower())
                    if not dominio_id:
                        errors.append(f"Fila {idx}: Dominio '{cleaned_record['nombre_dominio']}' no encontrado")
                
                # Resolve control_id from nombre_control
                control_id = None
                if cleaned_record.get('nombre_control'):
                    nombre_control_lower = cleaned_record['nombre_control'].lower()
                    # If dominio is specified, search within that dominio first
                    if dominio_id and dominio_id in control_by_dominio:
                        control_id = control_by_dominio[dominio_id].get(nombre_control_lower)
                    # If not found or no dominio specified, search globally
                    if not control_id:
                        control_id = control_map.get(nombre_control_lower)
                    if not control_id:
                        errors.append(f"Fila {idx}: Control '{cleaned_record['nombre_control']}' no encontrado")
                
                # Resolve riesgo_id from nombre_riesgo (nombre_corto)
                riesgo_id = None
                if cleaned_record.get('nombre_riesgo'):
                    riesgo_id = riesgo_map.get(cleaned_record['nombre_riesgo'].lower())
                    if not riesgo_id:
                        errors.append(f"Fila {idx}: Riesgo '{cleaned_record['nombre_riesgo']}' no encontrado")
                
                # Parse probabilidad and impacto (supports text like "Medio", "Alto" or numbers 1-5)
                probabilidad = parse_prob_imp(cleaned_record.get('probabilidad'), default=3)
                impacto = parse_prob_imp(cleaned_record.get('impacto'), default=3)
                
                # Validate estado
                estado = cleaned_record.get('estado', 'Abierto')
                if estado not in valid_estados:
                    estado = 'Abierto'
                
                # Create hallazgo
                hallazgo = HallazgoAuditoria(
                    codigo=cleaned_record['codigo'].upper(),
                    brecha=cleaned_record['brecha'],
                    control_id=control_id,
                    riesgo_id=riesgo_id,
                    probabilidad=probabilidad,
                    impacto=impacto,
                    estado=estado,
                    observaciones=cleaned_record.get('observaciones', '')
                )
                doc = hallazgo.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                if doc.get('updated_at'):
                    doc['updated_at'] = doc['updated_at'].isoformat()
                
                await db.hallazgos_auditoria.insert_one(doc)
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
            "entidad": "hallazgo_auditoria",
            "entidad_id": None,
            "entidad_nombre": f"Importación masiva: {inserted_count} hallazgos",
            "descripcion": f"Importación Excel: {inserted_count} hallazgos insertados, {skipped_count} omitidos",
            "cambios": []
        })
        
        return {
            "message": f"Importación completada: {inserted_count} hallazgos insertados, {skipped_count} omitidos",
            "inserted": inserted_count,
            "skipped": skipped_count,
            "errors": errors[:10] if errors else []  # Return first 10 errors
        }

    return router
