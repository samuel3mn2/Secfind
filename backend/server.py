from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, date, timedelta
import pandas as pd
import io
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'secfind-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Default predefined values (fallback)
DEFAULT_SEVERIDADES = ["Critica", "Alta", "Media", "Baja"]
DEFAULT_ESTATUS = ["En Proceso", "Cerrado", "Pendiente", "Para Re Test", "Corregido", "Desestimado"]
DEFAULT_RESULTADO_RETEST = ["Corregido", "Pendiente", "Impedimento", "Vulnerable", "Desestimado"]

# ============ PERMISSION MODELS ============

class ModulePermissions(BaseModel):
    ver: bool = False
    crear: bool = False
    editar: bool = False
    eliminar: bool = False

class UserPermissions(BaseModel):
    dashboard: ModulePermissions = ModulePermissions(ver=True)
    vulnerabilidades: ModulePermissions = ModulePermissions()
    configuracion: ModulePermissions = ModulePermissions()

class Usuario(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str = ""
    nombre: str
    email: Optional[str] = None
    activo: bool = True
    es_admin: bool = False
    permisos: UserPermissions = UserPermissions()
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UsuarioCreate(BaseModel):
    username: str
    password: str
    nombre: str
    email: Optional[str] = None
    es_admin: bool = False
    permisos: Optional[UserPermissions] = None

class UsuarioUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    nombre: Optional[str] = None
    email: Optional[str] = None
    activo: Optional[bool] = None
    es_admin: Optional[bool] = None
    permisos: Optional[UserPermissions] = None

class UsuarioResponse(BaseModel):
    id: str
    username: str
    nombre: str
    email: Optional[str]
    activo: bool
    es_admin: bool
    permisos: UserPermissions
    created_at: datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    usuario: UsuarioResponse

class CurrentUser(BaseModel):
    id: str
    username: str
    nombre: str
    es_admin: bool
    permisos: UserPermissions

# ============ VULNERABILITY MODELS ============

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

# ============ CONFIGURATION MODELS ============

class Institucion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    activo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InstitucionCreate(BaseModel):
    nombre: str

class InstitucionUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None

class DropdownOptions(BaseModel):
    severidades: List[str]
    estatus: List[str]
    instituciones: List[str]
    resultado_retest: List[str]
    informes_pentest: List[str]
    años: List[int]
    proveedores: List[str]

class DashboardStats(BaseModel):
    total_vulnerabilidades: int
    criticas_abiertas: int
    vulnerabilidades_corregidas: int
    pendientes: int
    por_severidad: dict
    por_estatus: dict
    por_institucion: dict

class TendenciaItem(BaseModel):
    periodo: str
    total: int
    criticas: int
    corregidas: int
    pendientes: int

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_token(user_id: str, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def get_current_user(authorization: Optional[str] = Header(None)) -> CurrentUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="No autorizado")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
        user = await db.usuarios.find_one({"id": payload["user_id"]}, {"_id": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        if not user.get("activo", False):
            raise HTTPException(status_code=401, detail="Usuario desactivado")
        
        permisos = user.get("permisos", {})
        return CurrentUser(
            id=user["id"],
            username=user["username"],
            nombre=user["nombre"],
            es_admin=user.get("es_admin", False),
            permisos=UserPermissions(**permisos) if permisos else UserPermissions()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="No autorizado")

async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[CurrentUser]:
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except:
        return None

# ============ AUTH ROUTES ============

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    user = await db.usuarios.find_one({"username": credentials.username}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    if not user.get("activo", False):
        raise HTTPException(status_code=401, detail="Usuario desactivado")
    
    token = create_token(user["id"], user["username"])
    
    permisos = user.get("permisos", {})
    return LoginResponse(
        token=token,
        usuario=UsuarioResponse(
            id=user["id"],
            username=user["username"],
            nombre=user["nombre"],
            email=user.get("email"),
            activo=user["activo"],
            es_admin=user.get("es_admin", False),
            permisos=UserPermissions(**permisos) if permisos else UserPermissions(),
            created_at=user.get("created_at", datetime.now(timezone.utc))
        )
    )

@api_router.get("/auth/me", response_model=UsuarioResponse)
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    user = await db.usuarios.find_one({"id": current_user.id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    permisos = user.get("permisos", {})
    return UsuarioResponse(
        id=user["id"],
        username=user["username"],
        nombre=user["nombre"],
        email=user.get("email"),
        activo=user["activo"],
        es_admin=user.get("es_admin", False),
        permisos=UserPermissions(**permisos) if permisos else UserPermissions(),
        created_at=user.get("created_at", datetime.now(timezone.utc))
    )

# ============ USER MANAGEMENT ROUTES ============

@api_router.get("/config/usuarios", response_model=List[UsuarioResponse])
async def get_usuarios(current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver usuarios")
    
    usuarios = await db.usuarios.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    result = []
    for u in usuarios:
        permisos = u.get("permisos", {})
        result.append(UsuarioResponse(
            id=u["id"],
            username=u["username"],
            nombre=u["nombre"],
            email=u.get("email"),
            activo=u.get("activo", True),
            es_admin=u.get("es_admin", False),
            permisos=UserPermissions(**permisos) if permisos else UserPermissions(),
            created_at=u.get("created_at", datetime.now(timezone.utc))
        ))
    return result

@api_router.post("/config/usuarios", response_model=UsuarioResponse)
async def create_usuario(data: UsuarioCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear usuarios")
    
    # Check if username already exists
    existing = await db.usuarios.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    
    # Create default permissions if not provided
    permisos = data.permisos if data.permisos else UserPermissions(
        dashboard=ModulePermissions(ver=True),
        vulnerabilidades=ModulePermissions(ver=True),
        configuracion=ModulePermissions()
    )
    
    usuario = Usuario(
        username=data.username,
        password_hash=hash_password(data.password),
        nombre=data.nombre,
        email=data.email,
        es_admin=data.es_admin,
        permisos=permisos
    )
    
    doc = usuario.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['permisos'] = permisos.model_dump()
    
    await db.usuarios.insert_one(doc)
    
    return UsuarioResponse(
        id=usuario.id,
        username=usuario.username,
        nombre=usuario.nombre,
        email=usuario.email,
        activo=usuario.activo,
        es_admin=usuario.es_admin,
        permisos=permisos,
        created_at=usuario.created_at
    )

@api_router.put("/config/usuarios/{user_id}", response_model=UsuarioResponse)
async def update_usuario(user_id: str, data: UsuarioUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar usuarios")
    
    existing = await db.usuarios.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_dict = {}
    
    if data.username is not None:
        # Check if new username already exists
        if data.username != existing["username"]:
            existing_username = await db.usuarios.find_one({"username": data.username})
            if existing_username:
                raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
        update_dict["username"] = data.username
    
    if data.password is not None:
        update_dict["password_hash"] = hash_password(data.password)
    
    if data.nombre is not None:
        update_dict["nombre"] = data.nombre
    
    if data.email is not None:
        update_dict["email"] = data.email
    
    if data.activo is not None:
        update_dict["activo"] = data.activo
    
    if data.es_admin is not None:
        update_dict["es_admin"] = data.es_admin
    
    if data.permisos is not None:
        update_dict["permisos"] = data.permisos.model_dump()
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.usuarios.update_one({"id": user_id}, {"$set": update_dict})
    
    updated = await db.usuarios.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    permisos = updated.get("permisos", {})
    
    return UsuarioResponse(
        id=updated["id"],
        username=updated["username"],
        nombre=updated["nombre"],
        email=updated.get("email"),
        activo=updated.get("activo", True),
        es_admin=updated.get("es_admin", False),
        permisos=UserPermissions(**permisos) if permisos else UserPermissions(),
        created_at=updated.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/config/usuarios/{user_id}")
async def delete_usuario(user_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar usuarios")
    
    # Prevent deleting yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puede eliminarse a sí mismo")
    
    result = await db.usuarios.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario eliminado exitosamente"}

# ============ GENERAL ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "Gestión de Vulnerabilidades API"}

# ============ INSTITUTION CONFIGURATION ROUTES ============

@api_router.get("/config/instituciones", response_model=List[Institucion])
async def get_instituciones(current_user: CurrentUser = Depends(get_current_user)):
    instituciones = await db.instituciones.find({}, {"_id": 0}).to_list(1000)
    return instituciones

@api_router.post("/config/instituciones", response_model=Institucion)
async def create_institucion(data: InstitucionCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear instituciones")
    
    existing = await db.instituciones.find_one({"nombre": data.nombre})
    if existing:
        raise HTTPException(status_code=400, detail="La institución ya existe")
    
    inst = Institucion(nombre=data.nombre)
    doc = inst.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.instituciones.insert_one(doc)
    return inst

@api_router.put("/config/instituciones/{inst_id}", response_model=Institucion)
async def update_institucion(inst_id: str, data: InstitucionUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar instituciones")
    
    existing = await db.instituciones.find_one({"id": inst_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        await db.instituciones.update_one({"id": inst_id}, {"$set": update_dict})
    
    updated = await db.instituciones.find_one({"id": inst_id}, {"_id": 0})
    return updated

@api_router.delete("/config/instituciones/{inst_id}")
async def delete_institucion(inst_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar instituciones")
    
    result = await db.instituciones.delete_one({"id": inst_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    return {"message": "Institución eliminada exitosamente"}

# Initialize default institutions if none exist
async def init_instituciones():
    count = await db.instituciones.count_documents({})
    if count == 0:
        unique_inst = await db.vulnerabilidades.distinct("institucion")
        for nombre in unique_inst:
            if nombre:
                inst = Institucion(nombre=nombre)
                doc = inst.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.instituciones.insert_one(doc)

# Initialize admin user
async def init_admin_user():
    admin = await db.usuarios.find_one({"username": "admin"})
    if not admin:
        admin_permisos = UserPermissions(
            dashboard=ModulePermissions(ver=True),
            vulnerabilidades=ModulePermissions(ver=True, crear=True, editar=True, eliminar=True),
            configuracion=ModulePermissions(ver=True, crear=True, editar=True, eliminar=True)
        )
        
        admin_user = Usuario(
            username="admin",
            password_hash=hash_password("admin123"),
            nombre="Administrador",
            email="admin@secfind.local",
            es_admin=True,
            permisos=admin_permisos
        )
        
        doc = admin_user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        doc['permisos'] = admin_permisos.model_dump()
        
        await db.usuarios.insert_one(doc)
        logging.info("Admin user created: admin / admin123")

@api_router.get("/dropdown-options", response_model=DropdownOptions)
async def get_dropdown_options():
    instituciones_docs = await db.instituciones.find({"activo": True}, {"_id": 0}).to_list(1000)
    instituciones = [i["nombre"] for i in instituciones_docs] if instituciones_docs else []
    
    if not instituciones:
        instituciones = await db.vulnerabilidades.distinct("institucion")
        instituciones = [i for i in instituciones if i]
    
    informes = await db.vulnerabilidades.distinct("nombre_informe_pentest")
    informes = sorted([i for i in informes if i])
    
    años = set()
    vulns = await db.vulnerabilidades.find({}, {"fecha_hallazgo": 1, "_id": 0}).to_list(10000)
    for v in vulns:
        fecha = v.get("fecha_hallazgo")
        if fecha:
            try:
                year = int(fecha[:4])
                if 2000 <= year <= 2100:
                    años.add(year)
            except:
                pass
    
    proveedores = await db.vulnerabilidades.distinct("proveedor")
    proveedores = sorted([p for p in proveedores if p])
    
    return DropdownOptions(
        severidades=DEFAULT_SEVERIDADES,
        estatus=DEFAULT_ESTATUS,
        instituciones=sorted(instituciones),
        resultado_retest=DEFAULT_RESULTADO_RETEST,
        informes_pentest=informes,
        años=sorted(list(años), reverse=True),
        proveedores=proveedores
    )

# ============ VULNERABILIDADES ENDPOINTS ============

@api_router.get("/vulnerabilidades", response_model=List[Vulnerabilidad])
async def get_vulnerabilidades(
    severidad: Optional[str] = None,
    estatus: Optional[str] = None,
    institucion: Optional[str] = None,
    search: Optional[str] = None,
    año: Optional[int] = None,
    informe_pentest: Optional[str] = None,
    proveedor: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver vulnerabilidades")
    
    query = {}
    if severidad:
        query["severidad"] = severidad
    if estatus:
        query["estatus"] = estatus
    if institucion:
        query["institucion"] = institucion
    if proveedor:
        query["proveedor"] = proveedor
    if informe_pentest:
        query["nombre_informe_pentest"] = informe_pentest
    if año:
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
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
async def get_vulnerabilidad(vuln_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver vulnerabilidades")
    
    vuln = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    return vuln

@api_router.post("/vulnerabilidades", response_model=Vulnerabilidad)
async def create_vulnerabilidad(vuln_data: VulnerabilidadCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear vulnerabilidades")
    
    vuln_dict = vuln_data.model_dump()
    vuln_obj = Vulnerabilidad(**vuln_dict)
    
    doc = vuln_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.vulnerabilidades.insert_one(doc)
    return vuln_obj

@api_router.put("/vulnerabilidades/{vuln_id}", response_model=Vulnerabilidad)
async def update_vulnerabilidad(vuln_id: str, vuln_data: VulnerabilidadUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar vulnerabilidades")
    
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
async def delete_vulnerabilidad(vuln_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar vulnerabilidades")
    
    result = await db.vulnerabilidades.delete_one({"id": vuln_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    return {"message": "Vulnerabilidad eliminada exitosamente"}

# ============ DASHBOARD ENDPOINTS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    año: Optional[int] = None,
    institucion: Optional[str] = None,
    informe_pentest: Optional[str] = None,
    severidad: Optional[str] = None,
    proveedor: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.dashboard.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
    
    base_query = {}
    if año:
        base_query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if institucion:
        base_query["institucion"] = institucion
    if informe_pentest:
        base_query["nombre_informe_pentest"] = informe_pentest
    if severidad:
        base_query["severidad"] = severidad
    if proveedor:
        base_query["proveedor"] = proveedor
    
    total = await db.vulnerabilidades.count_documents(base_query)
    
    criticas_query = {**base_query, "severidad": "Critica", "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}}
    criticas_abiertas = await db.vulnerabilidades.count_documents(criticas_query)
    
    corregidas_query = {**base_query, "estatus": {"$in": ["Corregido", "Cerrado"]}}
    corregidas = await db.vulnerabilidades.count_documents(corregidas_query)
    
    pendientes_query = {**base_query, "estatus": {"$in": ["Pendiente", "En Proceso", "Para Re Test"]}}
    pendientes = await db.vulnerabilidades.count_documents(pendientes_query)
    
    severidad_pipeline = [
        {"$match": base_query} if base_query else {"$match": {}},
        {"$group": {"_id": "$severidad", "count": {"$sum": 1}}}
    ]
    if not base_query:
        severidad_pipeline = [{"$group": {"_id": "$severidad", "count": {"$sum": 1}}}]
    
    severidad_cursor = db.vulnerabilidades.aggregate(severidad_pipeline)
    por_severidad = {}
    async for doc in severidad_cursor:
        if doc["_id"]:
            por_severidad[doc["_id"]] = doc["count"]
    
    estatus_pipeline = [
        {"$match": base_query} if base_query else {"$match": {}},
        {"$group": {"_id": "$estatus", "count": {"$sum": 1}}}
    ]
    if not base_query:
        estatus_pipeline = [{"$group": {"_id": "$estatus", "count": {"$sum": 1}}}]
    
    estatus_cursor = db.vulnerabilidades.aggregate(estatus_pipeline)
    por_estatus = {}
    async for doc in estatus_cursor:
        if doc["_id"]:
            por_estatus[doc["_id"]] = doc["count"]
    
    institucion_pipeline = [
        {"$match": base_query} if base_query else {"$match": {}},
        {"$group": {"_id": "$institucion", "count": {"$sum": 1}}}
    ]
    if not base_query:
        institucion_pipeline = [{"$group": {"_id": "$institucion", "count": {"$sum": 1}}}]
    
    institucion_cursor = db.vulnerabilidades.aggregate(institucion_pipeline)
    por_institucion = {}
    async for doc in institucion_cursor:
        if doc["_id"]:
            por_institucion[doc["_id"]] = doc["count"]
    
    return {
        "total_vulnerabilidades": total,
        "criticas_abiertas": criticas_abiertas,
        "vulnerabilidades_corregidas": corregidas,
        "pendientes": pendientes,
        "por_severidad": por_severidad,
        "por_estatus": por_estatus,
        "por_institucion": por_institucion
    }

@api_router.get("/dashboard/tendencias")
async def get_dashboard_tendencias(
    tipo: str = "mensual",
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.dashboard.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
    
    from collections import defaultdict
    
    vulns = await db.vulnerabilidades.find({}, {"fecha_hallazgo": 1, "severidad": 1, "estatus": 1, "_id": 0}).to_list(10000)
    
    tendencias = defaultdict(lambda: {"total": 0, "criticas": 0, "corregidas": 0, "pendientes": 0})
    
    for v in vulns:
        fecha = v.get("fecha_hallazgo")
        if not fecha:
            continue
        
        try:
            year = fecha[:4]
            month = fecha[5:7] if len(fecha) >= 7 else "01"
            
            if tipo == "trimestral":
                quarter = (int(month) - 1) // 3 + 1
                periodo = f"{year}-Q{quarter}"
            else:
                periodo = f"{year}-{month}"
            
            tendencias[periodo]["total"] += 1
            
            if v.get("severidad") == "Critica":
                tendencias[periodo]["criticas"] += 1
            
            estatus = v.get("estatus", "")
            if estatus in ["Corregido", "Cerrado"]:
                tendencias[periodo]["corregidas"] += 1
            elif estatus in ["Pendiente", "En Proceso", "Para Re Test"]:
                tendencias[periodo]["pendientes"] += 1
                
        except:
            continue
    
    result = []
    for periodo in sorted(tendencias.keys()):
        data = tendencias[periodo]
        result.append({
            "periodo": periodo,
            "total": data["total"],
            "criticas": data["criticas"],
            "corregidas": data["corregidas"],
            "pendientes": data["pendientes"]
        })
    
    return result

@api_router.get("/dashboard/kpi-detail")
async def get_kpi_detail(
    tipo: str,
    año: Optional[int] = None,
    institucion: Optional[str] = None,
    informe_pentest: Optional[str] = None,
    severidad: Optional[str] = None,
    proveedor: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.dashboard.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
    
    query = {}
    
    if año:
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if institucion:
        query["institucion"] = institucion
    if informe_pentest:
        query["nombre_informe_pentest"] = informe_pentest
    if severidad:
        query["severidad"] = severidad
    if proveedor:
        query["proveedor"] = proveedor
    
    if tipo == "criticas_abiertas":
        query["severidad"] = "Critica"
        query["estatus"] = {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    elif tipo == "pendientes":
        query["estatus"] = {"$in": ["Pendiente", "En Proceso", "Para Re Test"]}
    elif tipo == "corregidas":
        query["estatus"] = {"$in": ["Corregido", "Cerrado"]}
    
    vulnerabilidades = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    return vulnerabilidades

# ============ EXPORT/IMPORT ENDPOINTS ============

@api_router.get("/export/csv")
async def export_csv(current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para exportar")
    
    vulnerabilidades = await db.vulnerabilidades.find({}, {"_id": 0}).to_list(10000)
    
    if not vulnerabilidades:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")
    
    df = pd.DataFrame(vulnerabilidades)
    
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
async def export_excel(current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para exportar")
    
    vulnerabilidades = await db.vulnerabilidades.find({}, {"_id": 0}).to_list(10000)
    
    if not vulnerabilidades:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")
    
    df = pd.DataFrame(vulnerabilidades)
    
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
async def import_csv(file: UploadFile = File(...), current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para importar")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
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
        cleaned_record = {k: (None if pd.isna(v) else str(v)) for k, v in record.items()}
        vuln = Vulnerabilidad(**cleaned_record)
        doc = vuln.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.vulnerabilidades.insert_one(doc)
        inserted_count += 1
    
    return {"message": f"Se importaron {inserted_count} registros exitosamente"}

@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para importar")
    
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")
    
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents))
    
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
async def delete_all_vulnerabilidades(current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar todos los registros")
    
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

@app.on_event("startup")
async def startup_event():
    await init_instituciones()
    await init_admin_user()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
