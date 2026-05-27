"""
Routes for Dominios (GRC Domains)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Callable
from datetime import datetime, timezone

from models.grc_models import Dominio, DominioCreate, DominioUpdate


def create_dominios_router(db, get_current_user: Callable) -> APIRouter:
    """Factory function to create the router with injected dependencies"""
    
    router = APIRouter(prefix="/config/dominios", tags=["Dominios"])

    @router.get("", response_model=List[dict])
    async def get_dominios(current_user = Depends(get_current_user)):
        """Get all dominios"""
        dominios = await db.config_dominios.find({}, {"_id": 0}).sort("nombre_dominio", 1).to_list(500)
        return dominios

    @router.get("/{dominio_id}")
    async def get_dominio(dominio_id: str, current_user = Depends(get_current_user)):
        """Get a single dominio by ID"""
        dominio = await db.config_dominios.find_one({"id": dominio_id}, {"_id": 0})
        if not dominio:
            raise HTTPException(status_code=404, detail="Dominio no encontrado")
        return dominio

    @router.post("")
    async def create_dominio(data: DominioCreate, current_user = Depends(get_current_user)):
        """Create a new dominio"""
        if not current_user.es_admin and not current_user.permisos.configuracion.crear:
            raise HTTPException(status_code=403, detail="No tiene permisos para crear dominios")
        
        # Check if name already exists
        existing = await db.config_dominios.find_one(
            {"nombre_dominio": {"$regex": f"^{data.nombre_dominio}$", "$options": "i"}}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un dominio con ese nombre")
        
        dominio = Dominio(**data.model_dump())
        doc = dominio.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.config_dominios.insert_one(doc)
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "crear",
            "entidad": "dominio",
            "entidad_id": dominio.id,
            "detalles": {"nombre_dominio": dominio.nombre_dominio}
        })
        
        return {"id": dominio.id, "nombre_dominio": dominio.nombre_dominio, "codigo_referencia": dominio.codigo_referencia}

    @router.put("/{dominio_id}")
    async def update_dominio(dominio_id: str, data: DominioUpdate, current_user = Depends(get_current_user)):
        """Update a dominio"""
        if not current_user.es_admin and not current_user.permisos.configuracion.editar:
            raise HTTPException(status_code=403, detail="No tiene permisos para editar dominios")
        
        existing = await db.config_dominios.find_one({"id": dominio_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Dominio no encontrado")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # Check name uniqueness if updating name
        if "nombre_dominio" in update_data:
            other = await db.config_dominios.find_one({
                "nombre_dominio": {"$regex": f"^{update_data['nombre_dominio']}$", "$options": "i"},
                "id": {"$ne": dominio_id}
            })
            if other:
                raise HTTPException(status_code=400, detail="Ya existe otro dominio con ese nombre")
        
        await db.config_dominios.update_one({"id": dominio_id}, {"$set": update_data})
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "editar",
            "entidad": "dominio",
            "entidad_id": dominio_id,
            "detalles": {"cambios": update_data, "anterior": existing}
        })
        
        updated = await db.config_dominios.find_one({"id": dominio_id}, {"_id": 0})
        return updated

    @router.delete("/{dominio_id}")
    async def delete_dominio(dominio_id: str, current_user = Depends(get_current_user)):
        """Delete a dominio"""
        if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
            raise HTTPException(status_code=403, detail="No tiene permisos para eliminar dominios")
        
        existing = await db.config_dominios.find_one({"id": dominio_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Dominio no encontrado")
        
        # Check if there are controls using this dominio
        controls_count = await db.config_controles.count_documents({"dominio_id": dominio_id})
        if controls_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"No se puede eliminar: hay {controls_count} controles asociados a este dominio"
            )
        
        await db.config_dominios.delete_one({"id": dominio_id})
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "eliminar",
            "entidad": "dominio",
            "entidad_id": dominio_id,
            "detalles": {"eliminado": existing}
        })
        
        return {"message": "Dominio eliminado exitosamente"}

    return router
