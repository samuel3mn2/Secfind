from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
import pandas as pd
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Predefined values for dropdowns
SEVERIDADES = ["Critica", "Alta", "Media", "Baja"]
ESTATUS_OPTIONS = ["En Proceso", "Cerrado", "Pendiente", "Para Re Test", "Corregido", "Desestimado"]
INSTITUCIONES = ["BHD IB", "Fondo", "Puesto de bolsa", "Fiduciaria", "BHD"]
RESULTADO_RETEST = ["Corregido", "Pendiente", "Impedimento", "Vulnerable", "Desestimado"]

# Define Models
class VulnerabilidadBase(BaseModel):
    fecha_hallazgo: Optional[str] = None
    institucion: Optional[str] = None
    aplicacion: Optional[str] = None
    vulnerabilidad: Optional[str] = None
    recomendaciones: Optional[str] = None
    severidad: Optional[str] = None
    riesgo_asociado: Optional[str] = None
    descripcion_riesgo: Optional[str] = None
    responsable: Optional[str] = None
    fecha_compromiso: Optional[str] = None
    estatus: Optional[str] = None
    resultado_re_test: Optional[str] = None
    nombre_informe_pentest: Optional[str] = None
    proveedor: Optional[str] = None

class VulnerabilidadCreate(VulnerabilidadBase):
    pass

class VulnerabilidadUpdate(VulnerabilidadBase):
    pass

class Vulnerabilidad(VulnerabilidadBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DropdownOptions(BaseModel):
    severidades: List[str]
    estatus: List[str]
    instituciones: List[str]
    resultado_retest: List[str]

class DashboardStats(BaseModel):
    total_vulnerabilidades: int
    criticas_abiertas: int
    vulnerabilidades_corregidas: int
    pendientes: int
    por_severidad: dict
    por_estatus: dict
    por_institucion: dict

# Routes
@api_router.get("/")
async def root():
    return {"message": "Gestión de Vulnerabilidades API"}

@api_router.get("/dropdown-options", response_model=DropdownOptions)
async def get_dropdown_options():
    return DropdownOptions(
        severidades=SEVERIDADES,
        estatus=ESTATUS_OPTIONS,
        instituciones=INSTITUCIONES,
        resultado_retest=RESULTADO_RETEST
    )

@api_router.get("/vulnerabilidades", response_model=List[Vulnerabilidad])
async def get_vulnerabilidades(
    severidad: Optional[str] = None,
    estatus: Optional[str] = None,
    institucion: Optional[str] = None,
    search: Optional[str] = None
):
    query = {}
    if severidad:
        query["severidad"] = severidad
    if estatus:
        query["estatus"] = estatus
    if institucion:
        query["institucion"] = institucion
    if search:
        query["$or"] = [
            {"vulnerabilidad": {"$regex": search, "$options": "i"}},
            {"aplicacion": {"$regex": search, "$options": "i"}},
            {"responsable": {"$regex": search, "$options": "i"}},
            {"nombre_informe_pentest": {"$regex": search, "$options": "i"}}
        ]
    
    vulnerabilidades = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    return vulnerabilidades

@api_router.get("/vulnerabilidades/{vuln_id}", response_model=Vulnerabilidad)
async def get_vulnerabilidad(vuln_id: str):
    vuln = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    return vuln

@api_router.post("/vulnerabilidades", response_model=Vulnerabilidad)
async def create_vulnerabilidad(vuln_data: VulnerabilidadCreate):
    vuln_dict = vuln_data.model_dump()
    vuln_obj = Vulnerabilidad(**vuln_dict)
    
    doc = vuln_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.vulnerabilidades.insert_one(doc)
    return vuln_obj

@api_router.put("/vulnerabilidades/{vuln_id}", response_model=Vulnerabilidad)
async def update_vulnerabilidad(vuln_id: str, vuln_data: VulnerabilidadUpdate):
    existing = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    
    update_dict = vuln_data.model_dump(exclude_unset=True)
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.vulnerabilidades.update_one(
        {"id": vuln_id},
        {"$set": update_dict}
    )
    
    updated = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    return updated

@api_router.delete("/vulnerabilidades/{vuln_id}")
async def delete_vulnerabilidad(vuln_id: str):
    result = await db.vulnerabilidades.delete_one({"id": vuln_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    return {"message": "Vulnerabilidad eliminada exitosamente"}

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    total = await db.vulnerabilidades.count_documents({})
    
    criticas_abiertas = await db.vulnerabilidades.count_documents({
        "severidad": "Critica",
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    })
    
    corregidas = await db.vulnerabilidades.count_documents({
        "estatus": {"$in": ["Corregido", "Cerrado"]}
    })
    
    pendientes = await db.vulnerabilidades.count_documents({
        "estatus": {"$in": ["Pendiente", "En Proceso", "Para Re Test"]}
    })
    
    # Aggregate by severidad
    severidad_pipeline = [
        {"$group": {"_id": "$severidad", "count": {"$sum": 1}}}
    ]
    severidad_cursor = db.vulnerabilidades.aggregate(severidad_pipeline)
    por_severidad = {}
    async for doc in severidad_cursor:
        if doc["_id"]:
            por_severidad[doc["_id"]] = doc["count"]
    
    # Aggregate by estatus
    estatus_pipeline = [
        {"$group": {"_id": "$estatus", "count": {"$sum": 1}}}
    ]
    estatus_cursor = db.vulnerabilidades.aggregate(estatus_pipeline)
    por_estatus = {}
    async for doc in estatus_cursor:
        if doc["_id"]:
            por_estatus[doc["_id"]] = doc["count"]
    
    # Aggregate by institucion
    institucion_pipeline = [
        {"$group": {"_id": "$institucion", "count": {"$sum": 1}}}
    ]
    institucion_cursor = db.vulnerabilidades.aggregate(institucion_pipeline)
    por_institucion = {}
    async for doc in institucion_cursor:
        if doc["_id"]:
            por_institucion[doc["_id"]] = doc["count"]
    
    return DashboardStats(
        total_vulnerabilidades=total,
        criticas_abiertas=criticas_abiertas,
        vulnerabilidades_corregidas=corregidas,
        pendientes=pendientes,
        por_severidad=por_severidad,
        por_estatus=por_estatus,
        por_institucion=por_institucion
    )

@api_router.get("/export/csv")
async def export_csv():
    vulnerabilidades = await db.vulnerabilidades.find({}, {"_id": 0}).to_list(10000)
    
    if not vulnerabilidades:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")
    
    df = pd.DataFrame(vulnerabilidades)
    
    # Remove internal fields
    columns_to_remove = ['id', 'created_at', 'updated_at']
    for col in columns_to_remove:
        if col in df.columns:
            df = df.drop(columns=[col])
    
    output = io.StringIO()
    df.to_csv(output, index=False, encoding='utf-8')
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vulnerabilidades.csv"}
    )

@api_router.get("/export/excel")
async def export_excel():
    vulnerabilidades = await db.vulnerabilidades.find({}, {"_id": 0}).to_list(10000)
    
    if not vulnerabilidades:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")
    
    df = pd.DataFrame(vulnerabilidades)
    
    # Remove internal fields
    columns_to_remove = ['id', 'created_at', 'updated_at']
    for col in columns_to_remove:
        if col in df.columns:
            df = df.drop(columns=[col])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Vulnerabilidades')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=vulnerabilidades.xlsx"}
    )

@api_router.post("/import/csv")
async def import_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    # Map column names if needed
    column_mapping = {
        'Fecha Hallazgo': 'fecha_hallazgo',
        'Institución': 'institucion',
        'Aplicación': 'aplicacion',
        'Vulnerabilidad': 'vulnerabilidad',
        'Recomendaciones': 'recomendaciones',
        'Severidad': 'severidad',
        'Riesgo Asociado': 'riesgo_asociado',
        'Descripción Riesgo': 'descripcion_riesgo',
        'Responsable': 'responsable',
        'Fecha Compromiso': 'fecha_compromiso',
        'Estatus': 'estatus',
        'Resultado Re Test': 'resultado_re_test',
        'Nombre Informe Pentest': 'nombre_informe_pentest',
        'Proveedor': 'proveedor'
    }
    df = df.rename(columns=column_mapping)
    
    records = df.to_dict('records')
    inserted_count = 0
    
    for record in records:
        # Clean NaN values
        cleaned_record = {k: (None if pd.isna(v) else str(v)) for k, v in record.items()}
        vuln = Vulnerabilidad(**cleaned_record)
        doc = vuln.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.vulnerabilidades.insert_one(doc)
        inserted_count += 1
    
    return {"message": f"Se importaron {inserted_count} registros exitosamente"}

@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")
    
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents))
    
    # Map column names
    column_mapping = {
        'Fecha Hallazgo': 'fecha_hallazgo',
        'Institución': 'institucion',
        'Aplicación': 'aplicacion',
        'Vulnerabilidad': 'vulnerabilidad',
        'Recomendaciones': 'recomendaciones',
        'Severidad': 'severidad',
        'Riesgo Asociado': 'riesgo_asociado',
        'Descripción Riesgo': 'descripcion_riesgo',
        'Responsable': 'responsable',
        'Fecha Compromiso': 'fecha_compromiso',
        'Estatus': 'estatus',
        'Resultado Re Test': 'resultado_re_test',
        'Nombre Informe Pentest': 'nombre_informe_pentest',
        'Proveedor': 'proveedor'
    }
    df = df.rename(columns=column_mapping)
    
    records = df.to_dict('records')
    inserted_count = 0
    
    for record in records:
        # Clean NaN values and convert to string
        cleaned_record = {}
        for k, v in record.items():
            if pd.isna(v):
                cleaned_record[k] = None
            elif isinstance(v, (datetime, date)):
                cleaned_record[k] = v.strftime('%Y-%m-%d')
            else:
                cleaned_record[k] = str(v)
        
        vuln = Vulnerabilidad(**cleaned_record)
        doc = vuln.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.vulnerabilidades.insert_one(doc)
        inserted_count += 1
    
    return {"message": f"Se importaron {inserted_count} registros exitosamente"}

@api_router.delete("/vulnerabilidades")
async def delete_all_vulnerabilidades():
    result = await db.vulnerabilidades.delete_many({})
    return {"message": f"Se eliminaron {result.deleted_count} registros"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
