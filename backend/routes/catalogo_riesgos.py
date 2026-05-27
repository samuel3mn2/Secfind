"""
Routes for Catálogo de Riesgos (Global Risk Catalog)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Callable
from datetime import datetime, timezone

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
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "crear",
            "entidad": "riesgo_catalogo",
            "entidad_id": riesgo.id,
            "detalles": {"codigo": riesgo.codigo_riesgo, "nombre": riesgo.nombre_corto}
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
        
        await db.catalogo_riesgos.update_one({"id": riesgo_id}, {"$set": update_data})
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "editar",
            "entidad": "riesgo_catalogo",
            "entidad_id": riesgo_id,
            "detalles": {"cambios": update_data, "anterior": existing}
        })
        
        updated = await db.catalogo_riesgos.find_one({"id": riesgo_id}, {"_id": 0})
        return updated

    @router.delete("/{riesgo_id}")
    async def delete_riesgo(riesgo_id: str, current_user = Depends(get_current_user)):
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
        
        # Audit log
        await db.auditoria.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "usuario": current_user.username,
            "accion": "eliminar",
            "entidad": "riesgo_catalogo",
            "entidad_id": riesgo_id,
            "detalles": {"eliminado": existing}
        })
        
        return {"message": "Riesgo eliminado exitosamente del catálogo"}

    return router
