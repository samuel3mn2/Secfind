"""
Routes for Dashboard GRC (Unified Command Dashboard)
Implementado como función factory para inyección de dependencias
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Callable
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid


# ============================================================
# MODELOS PYDANTIC
# ============================================================

class FiltrosVista(BaseModel):
    dominios: List[str] = Field(default_factory=list)
    responsables: List[str] = Field(default_factory=list)
    estados_vulnerabilidad: List[str] = Field(default_factory=list)
    estados_hallazgo: List[str] = Field(default_factory=list)


class DashboardVistaCreate(BaseModel):
    nombre: str
    es_publica: bool = False
    informes_seleccionados: List[str] = Field(default_factory=list)
    filtros: FiltrosVista = Field(default_factory=FiltrosVista)


class DashboardVistaUpdate(BaseModel):
    id: str
    nombre: str
    es_publica: bool = False
    informes_seleccionados: List[str] = Field(default_factory=list)
    filtros: FiltrosVista = Field(default_factory=FiltrosVista)


class DashboardVista(BaseModel):
    id: str
    nombre: str
    creado_por: str
    creado_por_nombre: Optional[str] = None
    es_publica: bool = False
    informes_seleccionados: List[str] = Field(default_factory=list)
    filtros: FiltrosVista = Field(default_factory=FiltrosVista)
    created_at: str


# ============================================================
# FACTORY FUNCTION
# ============================================================

def create_dashboard_router(db, get_current_user: Callable) -> APIRouter:
    """
    Factory function para crear el router del Dashboard GRC.
    Sigue el patrón de los otros módulos GRC.
    """
    router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

    # ============================================================
    # ENDPOINTS DE VISTAS GUARDADAS
    # ============================================================

    @router.get("/vistas", response_model=List[DashboardVista])
    async def get_vistas(current_user=Depends(get_current_user)):
        """
        Obtiene vistas del usuario actual + vistas públicas.
        """
        if not current_user.es_admin and not current_user.permisos.dashboard.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
        
        # Buscar vistas propias O públicas
        query = {
            "$or": [
                {"creado_por": current_user.id},
                {"es_publica": True}
            ]
        }
        
        vistas = await db.dashboard_vistas.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        # Enriquecer con nombre del creador
        user_ids = list(set(v.get("creado_por") for v in vistas if v.get("creado_por")))
        users_map = {}
        if user_ids:
            users = await db.usuarios.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "nombre": 1, "username": 1}).to_list(100)
            users_map = {u["id"]: u.get("nombre") or u.get("username", "Usuario") for u in users}
        
        for v in vistas:
            v["creado_por_nombre"] = users_map.get(v.get("creado_por"), "Usuario")
            # Asegurar estructura de filtros
            if "filtros" not in v or v["filtros"] is None:
                v["filtros"] = {"dominios": [], "responsables": [], "estados_vulnerabilidad": [], "estados_hallazgo": []}
        
        return vistas

    @router.post("/vistas")
    async def create_or_update_vista(data: dict, current_user=Depends(get_current_user)):
        """
        Crea una nueva vista o actualiza una existente.
        - Si hay 'id' en el body: actualiza (solo el creador puede)
        - Si no hay 'id': crea nueva
        
        Validaciones:
        - Nombre único por usuario
        - Si es pública, nombre único entre todas las públicas
        """
        if not current_user.es_admin and not current_user.permisos.dashboard.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos")
        
        vista_id = data.get("id")
        nombre = data.get("nombre", "").strip()
        es_publica = data.get("es_publica", False)
        informes = data.get("informes_seleccionados", [])
        filtros = data.get("filtros", {})
        
        if not nombre:
            raise HTTPException(status_code=400, detail="El nombre de la vista es requerido")
        
        # Asegurar estructura de filtros
        filtros_clean = {
            "dominios": filtros.get("dominios", []),
            "responsables": filtros.get("responsables", []),
            "estados_vulnerabilidad": filtros.get("estados_vulnerabilidad", []),
            "estados_hallazgo": filtros.get("estados_hallazgo", [])
        }
        
        if vista_id:
            # === ACTUALIZAR VISTA EXISTENTE ===
            existing = await db.dashboard_vistas.find_one({"id": vista_id}, {"_id": 0})
            if not existing:
                raise HTTPException(status_code=404, detail="Vista no encontrada")
            
            # Solo el creador puede actualizar
            if existing["creado_por"] != current_user.id and not current_user.es_admin:
                raise HTTPException(status_code=403, detail="Solo el creador puede modificar esta vista")
            
            # Validar nombre único por usuario (excluyendo la vista actual)
            duplicate = await db.dashboard_vistas.find_one({
                "nombre": nombre,
                "creado_por": current_user.id,
                "id": {"$ne": vista_id}
            })
            if duplicate:
                raise HTTPException(status_code=400, detail="Ya tienes una vista con ese nombre")
            
            # Validar nombre único entre públicas si se marca como pública
            if es_publica:
                public_duplicate = await db.dashboard_vistas.find_one({
                    "nombre": nombre,
                    "es_publica": True,
                    "id": {"$ne": vista_id}
                })
                if public_duplicate:
                    raise HTTPException(status_code=400, detail="Ya existe una vista pública con ese nombre")
            
            # Actualizar
            await db.dashboard_vistas.update_one(
                {"id": vista_id},
                {"$set": {
                    "nombre": nombre,
                    "es_publica": es_publica,
                    "informes_seleccionados": informes,
                    "filtros": filtros_clean
                }}
            )
            
            return {"message": "Vista actualizada exitosamente", "id": vista_id}
        
        else:
            # === CREAR NUEVA VISTA ===
            # Validar nombre único por usuario
            duplicate = await db.dashboard_vistas.find_one({
                "nombre": nombre,
                "creado_por": current_user.id
            })
            if duplicate:
                raise HTTPException(status_code=400, detail="Ya tienes una vista con ese nombre")
            
            # Validar nombre único entre públicas si se marca como pública
            if es_publica:
                public_duplicate = await db.dashboard_vistas.find_one({
                    "nombre": nombre,
                    "es_publica": True
                })
                if public_duplicate:
                    raise HTTPException(status_code=400, detail="Ya existe una vista pública con ese nombre")
            
            new_vista = {
                "id": str(uuid.uuid4()),
                "nombre": nombre,
                "creado_por": current_user.id,
                "es_publica": es_publica,
                "informes_seleccionados": informes,
                "filtros": filtros_clean,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.dashboard_vistas.insert_one(new_vista)
            
            return {"message": "Vista creada exitosamente", "id": new_vista["id"]}

    @router.delete("/vistas/{vista_id}")
    async def delete_vista(vista_id: str, current_user=Depends(get_current_user)):
        """
        Elimina una vista. Solo el creador puede eliminarla.
        """
        if not current_user.es_admin and not current_user.permisos.dashboard.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos")
        
        existing = await db.dashboard_vistas.find_one({"id": vista_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Vista no encontrada")
        
        # Solo el creador o admin puede eliminar
        if existing["creado_por"] != current_user.id and not current_user.es_admin:
            raise HTTPException(status_code=403, detail="Solo el creador puede eliminar esta vista")
        
        await db.dashboard_vistas.delete_one({"id": vista_id})
        
        return {"message": "Vista eliminada exitosamente"}

    # ============================================================
    # ENDPOINT PRINCIPAL DE DATOS
    # ============================================================

    @router.get("/data")
    async def get_dashboard_data(
        informes: Optional[str] = Query(None, description="Informes separados por coma"),
        dominios: Optional[str] = Query(None, description="Dominios separados por coma"),
        responsables: Optional[str] = Query(None, description="Responsables separados por coma"),
        estados_vuln: Optional[str] = Query(None, description="Estados de vulnerabilidad separados por coma"),
        estados_hall: Optional[str] = Query(None, description="Estados de hallazgo separados por coma"),
        current_user=Depends(get_current_user)
    ):
        """
        Endpoint principal que devuelve todos los datasets del dashboard en una sola respuesta.
        Los filtros se pasan como query params separados por coma.
        """
        if not current_user.es_admin and not current_user.permisos.dashboard.ver:
            raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
        
        # Parsear filtros
        filtros = {
            "informes_seleccionados": [i.strip() for i in informes.split(",") if i.strip()] if informes else [],
            "dominios": [d.strip() for d in dominios.split(",") if d.strip()] if dominios else [],
            "responsables": [r.strip() for r in responsables.split(",") if r.strip()] if responsables else [],
            "estados_vulnerabilidad": [e.strip() for e in estados_vuln.split(",") if e.strip()] if estados_vuln else [],
            "estados_hallazgo": [e.strip() for e in estados_hall.split(",") if e.strip()] if estados_hall else []
        }
        
        # Ejecutar todas las agregaciones
        kpis = await _get_kpis(db, filtros)
        matriz = await _get_matriz_5x5(db, filtros)
        panel_severidad = await _get_panel_severidad(db, filtros)
        top_dominios = await _get_top_dominios(db, filtros)
        
        # Obtener opciones para filtros
        opciones = await _get_filter_options(db)
        
        return {
            "kpis": kpis,
            "matriz_5x5": matriz,
            "panel_severidad": panel_severidad,
            "top_dominios": top_dominios,
            "filtros_aplicados": filtros,
            "opciones_filtros": opciones
        }

    # ============================================================
    # FUNCIONES AUXILIARES DE AGREGACIÓN
    # ============================================================

    async def _get_kpis(db, filtros: dict) -> dict:
        """Calcula los KPIs principales del dashboard."""
        
        # === Filtro base vulnerabilidades activas ===
        vuln_match = {"estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}}
        
        if filtros.get("informes_seleccionados"):
            vuln_match["nombre_informe_pentest"] = {"$in": filtros["informes_seleccionados"]}
        if filtros.get("responsables"):
            vuln_match["responsable"] = {"$in": filtros["responsables"]}
        if filtros.get("estados_vulnerabilidad"):
            vuln_match["estatus"] = {"$in": filtros["estados_vulnerabilidad"]}
        
        # Pipeline para vulns con lookup de dominio si hay filtro
        vuln_pipeline = [{"$match": vuln_match}]
        
        if filtros.get("dominios"):
            vuln_pipeline.extend([
                {
                    "$lookup": {
                        "from": "config_controles",
                        "localField": "control_id",
                        "foreignField": "id",
                        "as": "control"
                    }
                },
                {"$unwind": {"path": "$control", "preserveNullAndEmptyArrays": True}},
                {
                    "$lookup": {
                        "from": "config_dominios",
                        "localField": "control.dominio_id",
                        "foreignField": "id",
                        "as": "dominio"
                    }
                },
                {"$unwind": {"path": "$dominio", "preserveNullAndEmptyArrays": True}},
                {
                    "$match": {
                        "$or": [
                            {"dominio.nombre_dominio": {"$in": filtros["dominios"]}},
                            {"$and": [
                                {"dominio": None},
                                {"$expr": {"$in": ["Sin Dominio", filtros["dominios"]]}}
                            ]}
                        ]
                    }
                }
            ])
        
        # Agregar cálculo de índice
        vuln_pipeline.append({
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "criticas": {"$sum": {"$cond": [{"$eq": ["$severidad", "Critica"]}, 1, 0]}},
                "altas": {"$sum": {"$cond": [{"$eq": ["$severidad", "Alta"]}, 1, 0]}},
                "medias": {"$sum": {"$cond": [{"$eq": ["$severidad", "Media"]}, 1, 0]}},
                "bajas": {"$sum": {"$cond": [{"$eq": ["$severidad", "Baja"]}, 1, 0]}}
            }
        })
        
        vuln_pipeline.append({
            "$project": {
                "_id": 0,
                "total": 1,
                "criticas": 1,
                "altas": 1,
                "medias": 1,
                "bajas": 1,
                "score_actual": {
                    "$add": [
                        {"$multiply": ["$criticas", 10]},
                        {"$multiply": ["$altas", 7]},
                        {"$multiply": ["$medias", 4]},
                        {"$multiply": ["$bajas", 1]}
                    ]
                },
                "score_maximo": {"$multiply": ["$total", 10]}
            }
        })
        
        vuln_pipeline.append({
            "$project": {
                "total": 1,
                "criticas": 1,
                "altas": 1,
                "medias": 1,
                "bajas": 1,
                "score_actual": 1,
                "score_maximo": 1,
                "indice_exposicion": {
                    "$cond": {
                        "if": {"$eq": ["$score_maximo", 0]},
                        "then": 0.0,
                        "else": {
                            "$round": [
                                {"$multiply": [
                                    {"$divide": ["$score_actual", "$score_maximo"]},
                                    100
                                ]},
                                1
                            ]
                        }
                    }
                }
            }
        })
        
        vuln_result = await db.vulnerabilidades.aggregate(vuln_pipeline).to_list(1)
        vuln_data = vuln_result[0] if vuln_result else {
            "total": 0, "criticas": 0, "altas": 0, "medias": 0, "bajas": 0,
            "indice_exposicion": 0.0
        }
        
        # === Filtro base hallazgos abiertos ===
        hallazgo_match = {"estado": {"$nin": ["Cerrado"]}}
        
        if filtros.get("responsables"):
            hallazgo_match["responsable"] = {"$in": filtros["responsables"]}
        if filtros.get("estados_hallazgo"):
            hallazgo_match["estado"] = {"$in": filtros["estados_hallazgo"]}
        
        # Pipeline hallazgos con lookup de dominio si hay filtro
        hall_pipeline = [{"$match": hallazgo_match}]
        
        if filtros.get("dominios"):
            hall_pipeline.extend([
                {
                    "$lookup": {
                        "from": "config_controles",
                        "localField": "control_id",
                        "foreignField": "id",
                        "as": "control"
                    }
                },
                {"$unwind": {"path": "$control", "preserveNullAndEmptyArrays": True}},
                {
                    "$lookup": {
                        "from": "config_dominios",
                        "localField": "control.dominio_id",
                        "foreignField": "id",
                        "as": "dominio"
                    }
                },
                {"$unwind": {"path": "$dominio", "preserveNullAndEmptyArrays": True}},
                {
                    "$match": {
                        "$or": [
                            {"dominio.nombre_dominio": {"$in": filtros["dominios"]}},
                            {"$and": [
                                {"dominio": None},
                                {"$expr": {"$in": ["Sin Dominio", filtros["dominios"]]}}
                            ]}
                        ]
                    }
                }
            ])
        
        hall_pipeline.append({
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "riesgo_promedio": {"$avg": "$riesgo_inherente"},
                "riesgo_max": {"$max": "$riesgo_inherente"},
                "riesgo_total": {"$sum": "$riesgo_inherente"}
            }
        })
        
        hall_result = await db.hallazgos_auditoria.aggregate(hall_pipeline).to_list(1)
        hall_data = hall_result[0] if hall_result else {
            "total": 0, "riesgo_promedio": 0, "riesgo_max": 0, "riesgo_total": 0
        }
        
        return {
            "vulnerabilidades_activas": vuln_data.get("total", 0),
            "hallazgos_abiertos": hall_data.get("total", 0),
            "indice_exposicion": vuln_data.get("indice_exposicion", 0.0),
            "desglose_severidad": {
                "Critica": vuln_data.get("criticas", 0),
                "Alta": vuln_data.get("altas", 0),
                "Media": vuln_data.get("medias", 0),
                "Baja": vuln_data.get("bajas", 0)
            },
            # KPI principal: Riesgo Promedio de Hallazgos (más metodológico que la suma total)
            "riesgo_promedio_hallazgos": round(hall_data.get("riesgo_promedio") or 0, 1),
            "riesgo_max_hallazgos": hall_data.get("riesgo_max") or 0
        }

    async def _get_matriz_5x5(db, filtros: dict) -> dict:
        """
        Agrupa hallazgos por probabilidad × impacto.
        Retorna datos para pintar matriz 5×5.
        """
        match_stage = {"estado": {"$nin": ["Cerrado"]}}
        
        if filtros.get("estados_hallazgo"):
            match_stage["estado"] = {"$in": filtros["estados_hallazgo"]}
        if filtros.get("responsables"):
            match_stage["responsable"] = {"$in": filtros["responsables"]}
        
        pipeline = [{"$match": match_stage}]
        
        # Lookup dominio si hay filtro
        if filtros.get("dominios"):
            pipeline.extend([
                {
                    "$lookup": {
                        "from": "config_controles",
                        "localField": "control_id",
                        "foreignField": "id",
                        "as": "control"
                    }
                },
                {"$unwind": {"path": "$control", "preserveNullAndEmptyArrays": True}},
                {
                    "$lookup": {
                        "from": "config_dominios",
                        "localField": "control.dominio_id",
                        "foreignField": "id",
                        "as": "dominio"
                    }
                },
                {"$unwind": {"path": "$dominio", "preserveNullAndEmptyArrays": True}},
                {
                    "$match": {
                        "$or": [
                            {"dominio.nombre_dominio": {"$in": filtros["dominios"]}},
                            {"$and": [
                                {"dominio": None},
                                {"$expr": {"$in": ["Sin Dominio", filtros["dominios"]]}}
                            ]}
                        ]
                    }
                }
            ])
        
        # Agrupar por probabilidad e impacto
        pipeline.append({
            "$group": {
                "_id": {
                    "probabilidad": "$probabilidad",
                    "impacto": "$impacto"
                },
                "count": {"$sum": 1},
                "riesgo_total": {"$sum": "$riesgo_inherente"},
                "hallazgos": {
                    "$push": {
                        "id": "$id",
                        "codigo": "$codigo",
                        "brecha": {"$substrCP": ["$brecha", 0, 100]},
                        "riesgo_inherente": "$riesgo_inherente",
                        "estado": "$estado",
                        "responsable": "$responsable"
                    }
                }
            }
        })
        
        pipeline.append({
            "$project": {
                "_id": 0,
                "probabilidad": "$_id.probabilidad",
                "impacto": "$_id.impacto",
                "count": 1,
                "riesgo_total": 1,
                "hallazgos": {"$slice": ["$hallazgos", 15]}  # Limitar para drill-down
            }
        })
        
        results = await db.hallazgos_auditoria.aggregate(pipeline).to_list(25)
        
        # Calcular total
        total = sum(r.get("count", 0) for r in results)
        
        return {
            "celdas": results,
            "total_hallazgos": total
        }

    async def _get_panel_severidad(db, filtros: dict) -> dict:
        """
        Agrupa vulnerabilidades activas por severidad.
        """
        match_stage = {"estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}}
        
        if filtros.get("informes_seleccionados"):
            match_stage["nombre_informe_pentest"] = {"$in": filtros["informes_seleccionados"]}
        if filtros.get("estados_vulnerabilidad"):
            match_stage["estatus"] = {"$in": filtros["estados_vulnerabilidad"]}
        if filtros.get("responsables"):
            match_stage["responsable"] = {"$in": filtros["responsables"]}
        
        pipeline = [{"$match": match_stage}]
        
        # Lookup dominio si hay filtro
        if filtros.get("dominios"):
            pipeline.extend([
                {
                    "$lookup": {
                        "from": "config_controles",
                        "localField": "control_id",
                        "foreignField": "id",
                        "as": "control"
                    }
                },
                {"$unwind": {"path": "$control", "preserveNullAndEmptyArrays": True}},
                {
                    "$lookup": {
                        "from": "config_dominios",
                        "localField": "control.dominio_id",
                        "foreignField": "id",
                        "as": "dominio"
                    }
                },
                {"$unwind": {"path": "$dominio", "preserveNullAndEmptyArrays": True}},
                {
                    "$match": {
                        "$or": [
                            {"dominio.nombre_dominio": {"$in": filtros["dominios"]}},
                            {"$and": [
                                {"dominio": None},
                                {"$expr": {"$in": ["Sin Dominio", filtros["dominios"]]}}
                            ]}
                        ]
                    }
                }
            ])
        
        # Agrupar por severidad
        pipeline.append({
            "$group": {
                "_id": "$severidad",
                "count": {"$sum": 1},
                "vulnerabilidades": {
                    "$push": {
                        "id": "$id",
                        "codigo": "$codigo",
                        "vulnerabilidad": {"$substrCP": ["$vulnerabilidad", 0, 100]},
                        "institucion": "$institucion",
                        "aplicaciones": "$aplicaciones",
                        "responsable": "$responsable",
                        "estatus": "$estatus"
                    }
                }
            }
        })
        
        pipeline.append({
            "$project": {
                "_id": 0,
                "severidad": "$_id",
                "count": 1,
                "vulnerabilidades": {"$slice": ["$vulnerabilidades", 20]}
            }
        })
        
        results = await db.vulnerabilidades.aggregate(pipeline).to_list(4)
        
        # Asegurar todas las severidades
        severidades_map = {"Critica": 0, "Alta": 0, "Media": 0, "Baja": 0}
        por_severidad = []
        
        for sev in ["Critica", "Alta", "Media", "Baja"]:
            found = next((r for r in results if r.get("severidad") == sev), None)
            if found:
                severidades_map[sev] = found["count"]
                por_severidad.append(found)
            else:
                por_severidad.append({"severidad": sev, "count": 0, "vulnerabilidades": []})
        
        return {
            "por_severidad": por_severidad,
            "resumen": severidades_map,
            "total": sum(severidades_map.values())
        }

    async def _get_top_dominios(db, filtros: dict) -> list:
        """
        Top 5 dominios por carga combinada de vulnerabilidades + hallazgos.
        """
        # === Pipeline Vulnerabilidades por Dominio ===
        vuln_match = {"estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}}
        if filtros.get("informes_seleccionados"):
            vuln_match["nombre_informe_pentest"] = {"$in": filtros["informes_seleccionados"]}
        if filtros.get("responsables"):
            vuln_match["responsable"] = {"$in": filtros["responsables"]}
        if filtros.get("estados_vulnerabilidad"):
            vuln_match["estatus"] = {"$in": filtros["estados_vulnerabilidad"]}
        
        vuln_pipeline = [
            {"$match": vuln_match},
            {
                "$lookup": {
                    "from": "config_controles",
                    "localField": "control_id",
                    "foreignField": "id",
                    "as": "control"
                }
            },
            {"$unwind": {"path": "$control", "preserveNullAndEmptyArrays": True}},
            {
                "$lookup": {
                    "from": "config_dominios",
                    "localField": "control.dominio_id",
                    "foreignField": "id",
                    "as": "dominio"
                }
            },
            {"$unwind": {"path": "$dominio", "preserveNullAndEmptyArrays": True}},
            {
                "$group": {
                    "_id": {"$ifNull": ["$dominio.nombre_dominio", "Sin Dominio"]},
                    "vuln_count": {"$sum": 1},
                    "vuln_criticas": {"$sum": {"$cond": [{"$eq": ["$severidad", "Critica"]}, 1, 0]}},
                    "vuln_altas": {"$sum": {"$cond": [{"$eq": ["$severidad", "Alta"]}, 1, 0]}},
                    "vuln_medias": {"$sum": {"$cond": [{"$eq": ["$severidad", "Media"]}, 1, 0]}},
                    "vuln_bajas": {"$sum": {"$cond": [{"$eq": ["$severidad", "Baja"]}, 1, 0]}}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "dominio": "$_id",
                    "vuln_count": 1,
                    "vuln_criticas": 1,
                    "vuln_altas": 1,
                    "vuln_medias": 1,
                    "vuln_bajas": 1
                }
            }
        ]
        
        # Filtrar por dominio si está especificado
        if filtros.get("dominios"):
            vuln_pipeline.insert(5, {
                "$match": {
                    "$or": [
                        {"dominio.nombre_dominio": {"$in": filtros["dominios"]}},
                        {"$and": [
                            {"dominio": None},
                            {"$expr": {"$in": ["Sin Dominio", filtros["dominios"]]}}
                        ]}
                    ]
                }
            })
        
        vuln_por_dominio = await db.vulnerabilidades.aggregate(vuln_pipeline).to_list(100)
        
        # === Pipeline Hallazgos por Dominio ===
        hall_match = {"estado": {"$nin": ["Cerrado"]}}
        if filtros.get("responsables"):
            hall_match["responsable"] = {"$in": filtros["responsables"]}
        if filtros.get("estados_hallazgo"):
            hall_match["estado"] = {"$in": filtros["estados_hallazgo"]}
        
        hall_pipeline = [
            {"$match": hall_match},
            {
                "$lookup": {
                    "from": "config_controles",
                    "localField": "control_id",
                    "foreignField": "id",
                    "as": "control"
                }
            },
            {"$unwind": {"path": "$control", "preserveNullAndEmptyArrays": True}},
            {
                "$lookup": {
                    "from": "config_dominios",
                    "localField": "control.dominio_id",
                    "foreignField": "id",
                    "as": "dominio"
                }
            },
            {"$unwind": {"path": "$dominio", "preserveNullAndEmptyArrays": True}},
            {
                "$group": {
                    "_id": {"$ifNull": ["$dominio.nombre_dominio", "Sin Dominio"]},
                    "hall_count": {"$sum": 1},
                    "riesgo_total": {"$sum": "$riesgo_inherente"},
                    "riesgo_promedio": {"$avg": "$riesgo_inherente"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "dominio": "$_id",
                    "hall_count": 1,
                    "riesgo_total": 1,
                    "riesgo_promedio": {"$round": ["$riesgo_promedio", 1]}
                }
            }
        ]
        
        # Filtrar por dominio si está especificado
        if filtros.get("dominios"):
            hall_pipeline.insert(5, {
                "$match": {
                    "$or": [
                        {"dominio.nombre_dominio": {"$in": filtros["dominios"]}},
                        {"$and": [
                            {"dominio": None},
                            {"$expr": {"$in": ["Sin Dominio", filtros["dominios"]]}}
                        ]}
                    ]
                }
            })
        
        hall_por_dominio = await db.hallazgos_auditoria.aggregate(hall_pipeline).to_list(100)
        
        # === Combinar resultados ===
        dominios_map = {}
        
        for v in vuln_por_dominio:
            dom = v["dominio"]
            dominios_map[dom] = {
                "dominio": dom,
                "vulnerabilidades": v["vuln_count"],
                "vuln_criticas": v.get("vuln_criticas", 0),
                "vuln_altas": v.get("vuln_altas", 0),
                "vuln_medias": v.get("vuln_medias", 0),
                "vuln_bajas": v.get("vuln_bajas", 0),
                "hallazgos": 0,
                "riesgo_total_hallazgos": 0,
                "riesgo_promedio_hallazgos": 0
            }
        
        for h in hall_por_dominio:
            dom = h["dominio"]
            if dom not in dominios_map:
                dominios_map[dom] = {
                    "dominio": dom,
                    "vulnerabilidades": 0,
                    "vuln_criticas": 0,
                    "vuln_altas": 0,
                    "vuln_medias": 0,
                    "vuln_bajas": 0,
                    "hallazgos": 0,
                    "riesgo_total_hallazgos": 0,
                    "riesgo_promedio_hallazgos": 0
                }
            dominios_map[dom]["hallazgos"] = h["hall_count"]
            dominios_map[dom]["riesgo_total_hallazgos"] = h.get("riesgo_total", 0)
            dominios_map[dom]["riesgo_promedio_hallazgos"] = h.get("riesgo_promedio", 0)
        
        # Calcular score combinado
        for dom_data in dominios_map.values():
            score_vulns = (
                dom_data["vuln_criticas"] * 10 +
                dom_data["vuln_altas"] * 7 +
                dom_data["vuln_medias"] * 4 +
                dom_data["vuln_bajas"] * 1
            )
            score_hallazgos = dom_data["riesgo_total_hallazgos"]
            dom_data["score_combinado"] = score_vulns + score_hallazgos
        
        # Ordenar y tomar top 5
        sorted_dominios = sorted(
            dominios_map.values(),
            key=lambda x: x["score_combinado"],
            reverse=True
        )[:5]
        
        return sorted_dominios

    async def _get_filter_options(db) -> dict:
        """Obtiene las opciones disponibles para los filtros."""
        
        # Informes únicos
        informes = await db.vulnerabilidades.distinct("nombre_informe_pentest")
        informes = [i for i in informes if i]  # Filtrar nulos
        
        # Dominios
        dominios_cursor = await db.config_dominios.find({}, {"_id": 0, "nombre_dominio": 1}).to_list(100)
        dominios = [d["nombre_dominio"] for d in dominios_cursor]
        dominios.append("Sin Dominio")
        
        # Responsables
        responsables_cursor = await db.config_responsables.find(
            {"activo": True}, 
            {"_id": 0, "nombre": 1}
        ).to_list(100)
        responsables = [r["nombre"] for r in responsables_cursor]
        
        # Estados de vulnerabilidad
        estados_vuln = ["Pendiente", "En Proceso", "Para Re Test"]
        
        # Estados de hallazgo
        estados_hall = ["Abierto", "En Proceso", "Listo para Revisión"]
        
        return {
            "informes": sorted(informes),
            "dominios": sorted(dominios),
            "responsables": sorted(responsables),
            "estados_vulnerabilidad": estados_vuln,
            "estados_hallazgo": estados_hall
        }

    return router
