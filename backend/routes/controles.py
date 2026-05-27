"""
Routes for Controles (GRC Controls)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Callable
from datetime import datetime, timezone

from models.grc_models import Control, ControlCreate, ControlUpdate


def create_controles_router(db, get_current_user: Callable) -> APIRouter:
    """Factory function to create the router with injected dependencies"""
    
    router = APIRouter(prefix="/config/controles", tags=["Controles"])

    @router.get("", response_model=List[dict])
    async def get_controles(
        dominio_id: Optional[str] = Query(None, description="Filter by dominio ID"),
        current_user = Depends(get_current_user)
    ):
        """Get all controles, optionally filtered by dominio"""
        query = {}
        if dominio_id:
            query["dominio_id"] = dominio_id
        
        controles = await db.config_controles.find(query, {"_id": 0}).sort("nombre_control", 1).to_list(1000)
        
        # Enrich with dominio name
        dominio_ids = list(set(c.get("dominio_id") for c in controles if c.get("dominio_id")))
        dominios = await db.config_dominios.find({"id": {"$in": dominio_ids}}, {"_id": 0}).to_list(500)
        dominio_map = {d["id"]: d["nombre_dominio"] for d in dominios}
        
        for control in controles:
            control["nombre_dominio"] = dominio_map.get(control.get("dominio_id"), "Sin dominio")
        
        return controles

    @router.get("/{control_id}")
    async def get_control(control_id: str, current_user = Depends(get_current_user)):
        """Get a single control by ID"""
        control = await db.config_controles.find_one({"id": control_id}, {"_id": 0})
        if not control:
            raise HTTPException(status_code=404, detail="Control no encontrado")
        
        # Enrich with dominio name
        if control.get("dominio_id"):
            dominio = await db.config_dominios.find_one({"id": control["dominio_id"]}, {"_id": 0})
            control["nombre_dominio"] = dominio["nombre_dominio"] if dominio else "Sin dominio"
        
        return control

    @router.post("")
    async def create_control(data: ControlCreate, current_user = Depends(get_current_user)):
        """Create a new control"""
        if not current_user.es_admin and not current_user.permisos.configuracion.crear:
            raise HTTPException(status_code=403, detail="No tiene permisos para crear controles")
        
        # Verify dominio exists
        dominio = await db.config_dominios.find_one({"id": data.dominio_id}, {"_id": 0})
        if not dominio:
            raise HTTPException(status_code=400, detail="El dominio especificado no existe")
        
        # Check if control name already exists in this dominio
        existing = await db.config_controles.find_one({
            "dominio_id": data.dominio_id,
            "nombre_control": {"$regex": f"^{data.nombre_control}$", "$options": "i"}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un control con ese nombre en este dominio")
        
        control = Control(**data.model_dump())
        doc = control.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.config_controles.insert_one(doc)
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "crear",
            "entidad": "control",
            "entidad_id": control.id,
            "detalles": {"nombre_control": control.nombre_control, "dominio": dominio["nombre_dominio"]}
        })
        
        return {
            "id": control.id,
            "dominio_id": control.dominio_id,
            "nombre_dominio": dominio["nombre_dominio"],
            "codigo_control": control.codigo_control,
            "nombre_control": control.nombre_control
        }

    @router.put("/{control_id}")
    async def update_control(control_id: str, data: ControlUpdate, current_user = Depends(get_current_user)):
        """Update a control"""
        if not current_user.es_admin and not current_user.permisos.configuracion.editar:
            raise HTTPException(status_code=403, detail="No tiene permisos para editar controles")
        
        existing = await db.config_controles.find_one({"id": control_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Control no encontrado")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Verify dominio exists if updating
        if "dominio_id" in update_data:
            dominio = await db.config_dominios.find_one({"id": update_data["dominio_id"]}, {"_id": 0})
            if not dominio:
                raise HTTPException(status_code=400, detail="El dominio especificado no existe")
        
        # Check name uniqueness if updating name
        if "nombre_control" in update_data:
            dominio_id = update_data.get("dominio_id", existing.get("dominio_id"))
            other = await db.config_controles.find_one({
                "dominio_id": dominio_id,
                "nombre_control": {"$regex": f"^{update_data['nombre_control']}$", "$options": "i"},
                "id": {"$ne": control_id}
            })
            if other:
                raise HTTPException(status_code=400, detail="Ya existe otro control con ese nombre en este dominio")
        
        await db.config_controles.update_one({"id": control_id}, {"$set": update_data})
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "editar",
            "entidad": "control",
            "entidad_id": control_id,
            "detalles": {"cambios": update_data, "anterior": existing}
        })
        
        updated = await db.config_controles.find_one({"id": control_id}, {"_id": 0})
        return updated

    @router.delete("/{control_id}")
    async def delete_control(control_id: str, current_user = Depends(get_current_user)):
        """Delete a control"""
        if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
            raise HTTPException(status_code=403, detail="No tiene permisos para eliminar controles")
        
        existing = await db.config_controles.find_one({"id": control_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Control no encontrado")
        
        # Check if there are vulnerabilidades or hallazgos using this control
        vulns_count = await db.vulnerabilidades.count_documents({"control_id": control_id})
        hallazgos_count = await db.hallazgos_auditoria.count_documents({"control_id": control_id})
        
        if vulns_count > 0 or hallazgos_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede eliminar: hay {vulns_count} vulnerabilidades y {hallazgos_count} hallazgos asociados"
            )
        
        await db.config_controles.delete_one({"id": control_id})
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "eliminar",
            "entidad": "control",
            "entidad_id": control_id,
            "detalles": {"eliminado": existing}
        })
        
        return {"message": "Control eliminado exitosamente"}

    return router
