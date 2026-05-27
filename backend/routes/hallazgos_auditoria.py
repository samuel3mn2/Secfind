"""
Routes for Hallazgos de Auditoría (Audit Findings)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Callable
from datetime import datetime, timezone

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
        """Generate next codigo for a new hallazgo"""
        year = datetime.now().year
        prefix = f"AUD-{year}-"
        
        # Find the highest existing codigo for this year
        last = await db.hallazgos_auditoria.find_one(
            {"codigo": {"$regex": f"^{prefix}"}},
            {"_id": 0, "codigo": 1},
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
        
        hallazgo = HallazgoAuditoria(
            **data.model_dump(),
            created_by=current_user.id
        )
        hallazgo.calcular_riesgo_inherente()
        
        doc = hallazgo.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.hallazgos_auditoria.insert_one(doc)
        
        # Remove _id if MongoDB added it
        doc.pop('_id', None)
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "crear",
            "entidad": "hallazgo_auditoria",
            "entidad_id": hallazgo.id,
            "detalles": {"codigo": hallazgo.codigo, "brecha": hallazgo.brecha[:100] if hallazgo.brecha else ""}
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
        
        # Track estado change for audit
        estado_changed = "estado" in update_data and update_data["estado"] != existing.get("estado")
        old_estado = existing.get("estado")
        new_estado = update_data.get("estado")
        
        await db.hallazgos_auditoria.update_one({"id": hallazgo_id}, {"$set": update_data})
        
        # Audit log
        audit_details = {"cambios": update_data}
        if estado_changed:
            audit_details["cambio_estado"] = {"anterior": old_estado, "nuevo": new_estado}
        
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "editar",
            "entidad": "hallazgo_auditoria",
            "entidad_id": hallazgo_id,
            "detalles": audit_details
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
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "eliminar",
            "entidad": "hallazgo_auditoria",
            "entidad_id": hallazgo_id,
            "detalles": {"eliminado": existing}
        })
        
        return {"message": "Hallazgo eliminado exitosamente"}

    return router
