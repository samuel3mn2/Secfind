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
from pdf_reports import generate_executive_report, generate_institution_report, generate_vista_comite_report

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
    aplicaciones: Optional[List[str]] = None  # Changed to list
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

# Application model
class Aplicacion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    activo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AplicacionCreate(BaseModel):
    nombre: str

class AplicacionUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None

# Provider model
class Proveedor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    activo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProveedorCreate(BaseModel):
    nombre: str

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None

# Informe Pentest model
class InformePentest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    activo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InformePentestCreate(BaseModel):
    nombre: str

class InformePentestUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None

class DropdownOptions(BaseModel):
    severidades: List[str]
    estatus: List[str]
    instituciones: List[str]
    aplicaciones: List[str]
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

# ============ HISTORIAL DE CAMBIOS MODEL ============

class HistorialCambio(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entidad: str  # "vulnerabilidad", "institucion", "aplicacion", etc.
    entidad_id: str
    entidad_nombre: Optional[str] = None  # Para mostrar nombre descriptivo
    accion: str  # "crear", "actualizar", "eliminar"
    usuario_id: str
    usuario_nombre: str
    cambios: List[dict] = []  # [{campo: "estatus", valor_anterior: "Pendiente", valor_nuevo: "Corregido"}]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

async def registrar_cambio(
    entidad: str,
    entidad_id: str,
    accion: str,
    usuario_id: str,
    usuario_nombre: str,
    cambios: List[dict] = None,
    entidad_nombre: str = None
):
    """Helper function to log changes to the historial collection"""
    historial = HistorialCambio(
        entidad=entidad,
        entidad_id=entidad_id,
        entidad_nombre=entidad_nombre,
        accion=accion,
        usuario_id=usuario_id,
        usuario_nombre=usuario_nombre,
        cambios=cambios or []
    )
    doc = historial.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.historial_cambios.insert_one(doc)
    return historial

def calcular_cambios(original: dict, actualizado: dict, campos_excluir: list = None) -> List[dict]:
    """Calculate differences between original and updated dictionaries"""
    cambios = []
    campos_excluir = campos_excluir or ['_id', 'id', 'created_at', 'updated_at']
    
    for campo, valor_nuevo in actualizado.items():
        if campo in campos_excluir:
            continue
        valor_anterior = original.get(campo)
        if valor_anterior != valor_nuevo:
            cambios.append({
                "campo": campo,
                "valor_anterior": valor_anterior,
                "valor_nuevo": valor_nuevo
            })
    return cambios

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
        # Cascade update: if name changed, update all vulnerabilities
        if "nombre" in update_dict and update_dict["nombre"] != existing.get("nombre"):
            old_name = existing.get("nombre")
            new_name = update_dict["nombre"]
            await db.vulnerabilidades.update_many(
                {"institucion": old_name},
                {"$set": {"institucion": new_name}}
            )
            logging.info(f"Cascade update: Institución '{old_name}' -> '{new_name}' in vulnerabilities")
        
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

# ============ APPLICATION CONFIGURATION ROUTES ============

@api_router.get("/config/aplicaciones", response_model=List[Aplicacion])
async def get_aplicaciones(current_user: CurrentUser = Depends(get_current_user)):
    aplicaciones = await db.aplicaciones.find({}, {"_id": 0}).to_list(1000)
    return aplicaciones

@api_router.post("/config/aplicaciones", response_model=Aplicacion)
async def create_aplicacion(data: AplicacionCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear aplicaciones")
    
    existing = await db.aplicaciones.find_one({"nombre": data.nombre})
    if existing:
        raise HTTPException(status_code=400, detail="La aplicación ya existe")
    
    app = Aplicacion(nombre=data.nombre)
    doc = app.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.aplicaciones.insert_one(doc)
    return app

@api_router.put("/config/aplicaciones/{app_id}", response_model=Aplicacion)
async def update_aplicacion(app_id: str, data: AplicacionUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar aplicaciones")
    
    existing = await db.aplicaciones.find_one({"id": app_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Aplicación no encontrada")
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        # Cascade update: if name changed, update all vulnerabilities (aplicaciones is an array)
        if "nombre" in update_dict and update_dict["nombre"] != existing.get("nombre"):
            old_name = existing.get("nombre")
            new_name = update_dict["nombre"]
            # Update in array field 'aplicaciones'
            await db.vulnerabilidades.update_many(
                {"aplicaciones": old_name},
                {"$set": {"aplicaciones.$": new_name}}
            )
            logging.info(f"Cascade update: Aplicación '{old_name}' -> '{new_name}' in vulnerabilities")
        
        await db.aplicaciones.update_one({"id": app_id}, {"$set": update_dict})
    
    updated = await db.aplicaciones.find_one({"id": app_id}, {"_id": 0})
    return updated

@api_router.delete("/config/aplicaciones/{app_id}")
async def delete_aplicacion(app_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar aplicaciones")
    
    result = await db.aplicaciones.delete_one({"id": app_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Aplicación no encontrada")
    return {"message": "Aplicación eliminada exitosamente"}

# ============ PROVIDER CONFIGURATION ROUTES ============

@api_router.get("/config/proveedores", response_model=List[Proveedor])
async def get_proveedores(current_user: CurrentUser = Depends(get_current_user)):
    proveedores = await db.proveedores.find({}, {"_id": 0}).to_list(1000)
    return proveedores

@api_router.post("/config/proveedores", response_model=Proveedor)
async def create_proveedor(data: ProveedorCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear proveedores")
    
    existing = await db.proveedores.find_one({"nombre": data.nombre})
    if existing:
        raise HTTPException(status_code=400, detail="El proveedor ya existe")
    
    prov = Proveedor(nombre=data.nombre)
    doc = prov.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.proveedores.insert_one(doc)
    return prov

@api_router.put("/config/proveedores/{prov_id}", response_model=Proveedor)
async def update_proveedor(prov_id: str, data: ProveedorUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar proveedores")
    
    existing = await db.proveedores.find_one({"id": prov_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        # Cascade update: if name changed, update all vulnerabilities
        if "nombre" in update_dict and update_dict["nombre"] != existing.get("nombre"):
            old_name = existing.get("nombre")
            new_name = update_dict["nombre"]
            await db.vulnerabilidades.update_many(
                {"proveedor": old_name},
                {"$set": {"proveedor": new_name}}
            )
            logging.info(f"Cascade update: Proveedor '{old_name}' -> '{new_name}' in vulnerabilities")
        
        await db.proveedores.update_one({"id": prov_id}, {"$set": update_dict})
    
    updated = await db.proveedores.find_one({"id": prov_id}, {"_id": 0})
    return updated

@api_router.delete("/config/proveedores/{prov_id}")
async def delete_proveedor(prov_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar proveedores")
    
    result = await db.proveedores.delete_one({"id": prov_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return {"message": "Proveedor eliminado exitosamente"}

# ============ INFORME PENTEST CONFIGURATION ROUTES ============

@api_router.get("/config/informes-pentest", response_model=List[InformePentest])
async def get_informes_pentest(current_user: CurrentUser = Depends(get_current_user)):
    informes = await db.informes_pentest.find({}, {"_id": 0}).to_list(1000)
    return informes

@api_router.post("/config/informes-pentest", response_model=InformePentest)
async def create_informe_pentest(data: InformePentestCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear informes")
    
    existing = await db.informes_pentest.find_one({"nombre": data.nombre})
    if existing:
        raise HTTPException(status_code=400, detail="El informe ya existe")
    
    informe = InformePentest(nombre=data.nombre)
    doc = informe.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.informes_pentest.insert_one(doc)
    return informe

@api_router.put("/config/informes-pentest/{informe_id}", response_model=InformePentest)
async def update_informe_pentest(informe_id: str, data: InformePentestUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar informes")
    
    existing = await db.informes_pentest.find_one({"id": informe_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Informe no encontrado")
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        # Cascade update: if name changed, update all vulnerabilities
        if "nombre" in update_dict and update_dict["nombre"] != existing.get("nombre"):
            old_name = existing.get("nombre")
            new_name = update_dict["nombre"]
            await db.vulnerabilidades.update_many(
                {"nombre_informe_pentest": old_name},
                {"$set": {"nombre_informe_pentest": new_name}}
            )
            logging.info(f"Cascade update: Informe Pentest '{old_name}' -> '{new_name}' in vulnerabilities")
        
        await db.informes_pentest.update_one({"id": informe_id}, {"$set": update_dict})
    
    updated = await db.informes_pentest.find_one({"id": informe_id}, {"_id": 0})
    return updated

@api_router.delete("/config/informes-pentest/{informe_id}")
async def delete_informe_pentest(informe_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar informes")
    
    result = await db.informes_pentest.delete_one({"id": informe_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Informe no encontrado")
    return {"message": "Informe eliminado exitosamente"}

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

# Initialize applications from existing vulnerabilities
async def init_aplicaciones():
    count = await db.aplicaciones.count_documents({})
    if count == 0:
        # Get all unique application strings from vulnerabilities
        vulns = await db.vulnerabilidades.find({}, {"aplicacion": 1, "aplicaciones": 1, "_id": 0}).to_list(10000)
        
        unique_apps = set()
        for v in vulns:
            # Check old 'aplicacion' field (string)
            app_str = v.get("aplicacion")
            if app_str:
                # Split by _ and /
                import re
                parts = re.split(r'[_/]', app_str)
                for part in parts:
                    part = part.strip()
                    if part and len(part) > 0:
                        unique_apps.add(part)
            
            # Check new 'aplicaciones' field (list)
            apps_list = v.get("aplicaciones")
            if apps_list and isinstance(apps_list, list):
                for app in apps_list:
                    if app and len(app.strip()) > 0:
                        unique_apps.add(app.strip())
        
        # Insert unique applications
        for nombre in sorted(unique_apps):
            if nombre:
                app = Aplicacion(nombre=nombre)
                doc = app.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.aplicaciones.insert_one(doc)
        
        logging.info(f"Initialized {len(unique_apps)} applications from vulnerabilities")

# Initialize providers from existing vulnerabilities
async def init_proveedores():
    count = await db.proveedores.count_documents({})
    if count == 0:
        unique_proveedores = await db.vulnerabilidades.distinct("proveedor")
        for nombre in unique_proveedores:
            if nombre and nombre.strip():
                prov = Proveedor(nombre=nombre.strip())
                doc = prov.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.proveedores.insert_one(doc)
        
        logging.info(f"Initialized {len([p for p in unique_proveedores if p])} providers from vulnerabilities")

# Initialize informes pentest from existing vulnerabilities
async def init_informes_pentest():
    count = await db.informes_pentest.count_documents({})
    if count == 0:
        unique_informes = await db.vulnerabilidades.distinct("nombre_informe_pentest")
        for nombre in unique_informes:
            if nombre and nombre.strip():
                informe = InformePentest(nombre=nombre.strip())
                doc = informe.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.informes_pentest.insert_one(doc)
        
        logging.info(f"Initialized {len([i for i in unique_informes if i])} informes pentest from vulnerabilities")

# Migrate old 'aplicacion' field to new 'aplicaciones' array
async def migrate_aplicaciones():
    # Find vulnerabilities with old 'aplicacion' field but no 'aplicaciones'
    vulns = await db.vulnerabilidades.find(
        {"aplicacion": {"$exists": True, "$ne": None}, "aplicaciones": {"$exists": False}},
        {"_id": 0, "id": 1, "aplicacion": 1}
    ).to_list(10000)
    
    import re
    for v in vulns:
        app_str = v.get("aplicacion", "")
        if app_str:
            # Split by _ and /
            parts = re.split(r'[_/]', app_str)
            apps_list = [p.strip() for p in parts if p.strip()]
            
            if apps_list:
                await db.vulnerabilidades.update_one(
                    {"id": v["id"]},
                    {"$set": {"aplicaciones": apps_list}}
                )
    
    if vulns:
        logging.info(f"Migrated {len(vulns)} vulnerabilities to new aplicaciones format")

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
    
    # Get applications from catalog
    aplicaciones_docs = await db.aplicaciones.find({"activo": True}, {"_id": 0}).to_list(1000)
    aplicaciones = [a["nombre"] for a in aplicaciones_docs] if aplicaciones_docs else []
    
    # Get providers from catalog
    proveedores_docs = await db.proveedores.find({"activo": True}, {"_id": 0}).to_list(1000)
    proveedores = [p["nombre"] for p in proveedores_docs] if proveedores_docs else []
    
    # Fallback to distinct values from vulnerabilities if no catalog exists
    if not proveedores:
        proveedores = await db.vulnerabilidades.distinct("proveedor")
        proveedores = [p for p in proveedores if p]
    
    # Get informes pentest from catalog
    informes_docs = await db.informes_pentest.find({"activo": True}, {"_id": 0}).to_list(1000)
    informes = [i["nombre"] for i in informes_docs] if informes_docs else []
    
    # Fallback to distinct values
    if not informes:
        informes = await db.vulnerabilidades.distinct("nombre_informe_pentest")
        informes = [i for i in informes if i]
    
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
    
    return DropdownOptions(
        severidades=DEFAULT_SEVERIDADES,
        estatus=DEFAULT_ESTATUS,
        instituciones=sorted(instituciones),
        aplicaciones=sorted(aplicaciones),
        resultado_retest=DEFAULT_RESULTADO_RETEST,
        informes_pentest=sorted(informes),
        años=sorted(list(años), reverse=True),
        proveedores=sorted(proveedores)
    )

# ============ VULNERABILIDADES ENDPOINTS ============

@api_router.get("/vulnerabilidades", response_model=List[Vulnerabilidad])
async def get_vulnerabilidades(
    severidad: Optional[str] = None,
    estatus: Optional[str] = None,
    institucion: Optional[str] = None,
    aplicacion: Optional[str] = None,
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
    if aplicacion:
        query["aplicaciones"] = aplicacion  # Search in array
    if proveedor:
        query["proveedor"] = proveedor
    if informe_pentest:
        query["nombre_informe_pentest"] = informe_pentest
    if año:
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if search:
        query["$or"] = [
            {"vulnerabilidad": {"$regex": search, "$options": "i"}},
            {"aplicaciones": {"$regex": search, "$options": "i"}},
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
    
    # Registrar en historial
    await registrar_cambio(
        entidad="vulnerabilidad",
        entidad_id=vuln_obj.id,
        entidad_nombre=vuln_obj.vulnerabilidad[:50] if vuln_obj.vulnerabilidad else None,
        accion="crear",
        usuario_id=current_user.id,
        usuario_nombre=current_user.username
    )
    
    return vuln_obj

@api_router.put("/vulnerabilidades/{vuln_id}", response_model=Vulnerabilidad)
async def update_vulnerabilidad(vuln_id: str, vuln_data: VulnerabilidadUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar vulnerabilidades")
    
    existing = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    
    update_dict = vuln_data.model_dump(exclude_unset=True)
    
    # Calcular cambios antes de actualizar
    cambios = calcular_cambios(existing, update_dict)
    
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.vulnerabilidades.update_one(
        {"id": vuln_id},
        {"$set": update_dict}
    )
    
    # Registrar en historial solo si hay cambios
    if cambios:
        await registrar_cambio(
            entidad="vulnerabilidad",
            entidad_id=vuln_id,
            entidad_nombre=existing.get("vulnerabilidad", "")[:50],
            accion="actualizar",
            usuario_id=current_user.id,
            usuario_nombre=current_user.username,
            cambios=cambios
        )
    
    updated = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    return updated

@api_router.delete("/vulnerabilidades/{vuln_id}")
async def delete_vulnerabilidad(vuln_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar vulnerabilidades")
    
    # Obtener datos antes de eliminar para el historial
    existing = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    
    result = await db.vulnerabilidades.delete_one({"id": vuln_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    
    # Registrar en historial
    if existing:
        await registrar_cambio(
            entidad="vulnerabilidad",
            entidad_id=vuln_id,
            entidad_nombre=existing.get("vulnerabilidad", "")[:50],
            accion="eliminar",
            usuario_id=current_user.id,
            usuario_nombre=current_user.username
        )
    
    return {"message": "Vulnerabilidad eliminada exitosamente"}

# ============ BULK ACTIONS ENDPOINT ============

class BulkUpdateRequest(BaseModel):
    ids: List[str]
    estatus: Optional[str] = None
    responsable: Optional[str] = None
    fecha_compromiso: Optional[str] = None

@api_router.post("/vulnerabilidades/bulk-update")
async def bulk_update_vulnerabilidades(
    data: BulkUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update multiple vulnerabilities at once"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar vulnerabilidades")
    
    if not data.ids:
        raise HTTPException(status_code=400, detail="No se especificaron vulnerabilidades")
    
    # Build update dict with only non-null fields
    update_dict = {}
    if data.estatus:
        update_dict["estatus"] = data.estatus
    if data.responsable is not None:  # Allow empty string to clear
        update_dict["responsable"] = data.responsable
    if data.fecha_compromiso is not None:  # Allow empty string to clear
        update_dict["fecha_compromiso"] = data.fecha_compromiso
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No se especificaron campos para actualizar")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update all matching documents
    result = await db.vulnerabilidades.update_many(
        {"id": {"$in": data.ids}},
        {"$set": update_dict}
    )
    
    # Build change description for audit log
    cambios = []
    if data.estatus:
        cambios.append({"campo": "estatus", "valor_anterior": "(múltiple)", "valor_nuevo": data.estatus})
    if data.responsable is not None:
        cambios.append({"campo": "responsable", "valor_anterior": "(múltiple)", "valor_nuevo": data.responsable or "(vacío)"})
    if data.fecha_compromiso is not None:
        cambios.append({"campo": "fecha_compromiso", "valor_anterior": "(múltiple)", "valor_nuevo": data.fecha_compromiso or "(vacío)"})
    
    # Register in audit log
    await registrar_cambio(
        entidad="vulnerabilidad",
        entidad_id=f"bulk-{len(data.ids)}",
        entidad_nombre=f"Actualización masiva de {len(data.ids)} vulnerabilidades",
        accion="actualizar",
        usuario_id=current_user.id,
        usuario_nombre=current_user.username,
        cambios=cambios
    )
    
    return {
        "message": f"Se actualizaron {result.modified_count} vulnerabilidades",
        "modified_count": result.modified_count
    }

# ============ DASHBOARD ENDPOINTS ============

# ============ HISTORIAL DE CAMBIOS ENDPOINT ============

@api_router.get("/historial")
async def get_historial(
    entidad: Optional[str] = None,
    accion: Optional[str] = None,
    usuario: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get audit log of all changes in the system"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver el historial")
    
    query = {}
    if entidad:
        query["entidad"] = entidad
    if accion:
        query["accion"] = accion
    if usuario:
        query["usuario_nombre"] = {"$regex": usuario, "$options": "i"}
    if fecha_desde:
        query["timestamp"] = {"$gte": fecha_desde}
    if fecha_hasta:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = fecha_hasta
        else:
            query["timestamp"] = {"$lte": fecha_hasta}
    
    total = await db.historial_cambios.count_documents(query)
    
    historial = await db.historial_cambios.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "historial": historial
    }

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
    
    # Pendientes: incluye estatus explícitos + sin estatus (null/vacío) - excluye cerradas y desestimadas
    pendientes_query = {
        **base_query, 
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    }
    pendientes = await db.vulnerabilidades.count_documents(pendientes_query)
    
    # En Proceso
    en_proceso_query = {**base_query, "estatus": "En Proceso"}
    en_proceso = await db.vulnerabilidades.count_documents(en_proceso_query)
    
    # Para Re Test
    para_retest_query = {**base_query, "estatus": "Para Re Test"}
    para_retest = await db.vulnerabilidades.count_documents(para_retest_query)
    
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
        estatus_name = doc["_id"] if doc["_id"] else "Sin clasificar"
        por_estatus[estatus_name] = doc["count"]
    
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
        "en_proceso": en_proceso,
        "para_retest": para_retest,
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

# ============ VISTA COMITÉ ENDPOINT ============

@api_router.get("/vista-comite")
async def get_vista_comite(
    informes: str = "",
    severidades: str = "Critica,Alta,Media,Baja",
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Agregación de vulnerabilidades por informe de pentest para vista de comité.
    Retorna pendientes/total por severidad, responsables, y porcentaje de pendientes.
    """
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver este módulo")
    
    # Parse filters
    informes_list = [i.strip() for i in informes.split(",") if i.strip()] if informes else []
    severidades_list = [s.strip() for s in severidades.split(",") if s.strip()] if severidades else []
    
    if not informes_list:
        return []
    
    # Build query
    query = {"nombre_informe_pentest": {"$in": informes_list}}
    
    # Statuses considered as "not pending" (completed/resolved)
    closed_statuses = ["Cerrado", "Corregido", "Desestimado"]
    
    # Get all vulnerabilities matching the filter
    vulns = await db.vulnerabilidades.find(
        query,
        {"_id": 0, "nombre_informe_pentest": 1, "severidad": 1, "estatus": 1, "responsable": 1, "fecha_hallazgo": 1}
    ).to_list(50000)
    
    # Aggregate by informe
    from collections import defaultdict
    
    informe_data = defaultdict(lambda: {
        "criticas_pendientes": 0, "criticas_total": 0,
        "altas_pendientes": 0, "altas_total": 0,
        "medias_pendientes": 0, "medias_total": 0,
        "bajas_pendientes": 0, "bajas_total": 0,
        "total_pendientes": 0, "total_hallazgos": 0,
        "responsables": set(),
        "fecha_mas_antigua": None
    })
    
    for v in vulns:
        informe = v.get("nombre_informe_pentest", "Sin informe")
        severidad = v.get("severidad", "")
        estatus = v.get("estatus")
        responsable = v.get("responsable")
        fecha_hallazgo = v.get("fecha_hallazgo")
        
        if responsable:
            informe_data[informe]["responsables"].add(responsable)
        
        # Track oldest date for this informe
        if fecha_hallazgo:
            try:
                current_oldest = informe_data[informe]["fecha_mas_antigua"]
                if current_oldest is None or fecha_hallazgo < current_oldest:
                    informe_data[informe]["fecha_mas_antigua"] = fecha_hallazgo
            except:
                pass
        
        # Check if pending (not in closed statuses)
        is_pending = estatus not in closed_statuses
        
        # Map severidad to field name
        if severidad == "Critica":
            informe_data[informe]["criticas_total"] += 1
            if is_pending:
                informe_data[informe]["criticas_pendientes"] += 1
        elif severidad == "Alta":
            informe_data[informe]["altas_total"] += 1
            if is_pending:
                informe_data[informe]["altas_pendientes"] += 1
        elif severidad == "Media":
            informe_data[informe]["medias_total"] += 1
            if is_pending:
                informe_data[informe]["medias_pendientes"] += 1
        elif severidad == "Baja":
            informe_data[informe]["bajas_total"] += 1
            if is_pending:
                informe_data[informe]["bajas_pendientes"] += 1
        
        # Totals (only count if severidad is in the selected list)
        if severidad in ["Critica", "Alta", "Media", "Baja"]:
            informe_data[informe]["total_hallazgos"] += 1
            if is_pending:
                informe_data[informe]["total_pendientes"] += 1
    
    # Build response
    result = []
    today = datetime.now(timezone.utc).date()
    
    for informe in sorted(informe_data.keys()):
        data = informe_data[informe]
        responsables_list = sorted(data["responsables"])
        
        # Calculate tiempo activo in months
        tiempo_activo_meses = None
        if data["fecha_mas_antigua"]:
            try:
                fecha_str = data["fecha_mas_antigua"]
                # Parse date string (format: YYYY-MM-DD)
                fecha_date = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
                # Calculate months difference
                months_diff = (today.year - fecha_date.year) * 12 + (today.month - fecha_date.month)
                tiempo_activo_meses = max(0, months_diff)
            except:
                tiempo_activo_meses = None
        
        result.append({
            "informe": informe,
            "criticas_pendientes": data["criticas_pendientes"],
            "criticas_total": data["criticas_total"],
            "altas_pendientes": data["altas_pendientes"],
            "altas_total": data["altas_total"],
            "medias_pendientes": data["medias_pendientes"],
            "medias_total": data["medias_total"],
            "bajas_pendientes": data["bajas_pendientes"],
            "bajas_total": data["bajas_total"],
            "responsable": ", ".join(responsables_list) if responsables_list else None,
            "total_pendientes": data["total_pendientes"],
            "total_hallazgos": data["total_hallazgos"],
            "tiempo_activo_meses": tiempo_activo_meses
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
        query["estatus"] = {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    elif tipo == "corregidas":
        query["estatus"] = {"$in": ["Corregido", "Cerrado"]}
    elif tipo == "en_proceso":
        query["estatus"] = "En Proceso"
    elif tipo == "para_retest":
        query["estatus"] = "Para Re Test"
    
    vulnerabilidades = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    return vulnerabilidades

# ============ RISK TRACKING ENDPOINTS ============

@api_router.get("/seguimiento-riesgos")
async def get_seguimiento_riesgos(
    filtro: Optional[str] = None,  # "vencidas", "proximas", "todas"
    severidad: Optional[str] = None,
    institucion: Optional[str] = None,
    informe_pentest: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get vulnerabilities with fecha_compromiso for risk tracking.
    - vencidas: past due date, not resolved
    - proximas: due within next 30 days
    - todas: all with fecha_compromiso
    """
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el seguimiento de riesgos")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_30 = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Base query: has fecha_compromiso and not resolved
    query = {
        "fecha_compromiso": {"$exists": True, "$ne": None, "$ne": ""},
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    }
    
    if filtro == "vencidas":
        query["fecha_compromiso"] = {"$lt": today, "$ne": None, "$ne": ""}
    elif filtro == "proximas":
        query["$and"] = [
            {"fecha_compromiso": {"$gte": today}},
            {"fecha_compromiso": {"$lte": future_30}}
        ]
    
    if severidad:
        query["severidad"] = severidad
    if institucion:
        query["institucion"] = institucion
    if informe_pentest:
        query["nombre_informe_pentest"] = informe_pentest
    
    vulns = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    
    # Add computed status for each vulnerability
    result = []
    for v in vulns:
        fecha_comp = v.get("fecha_compromiso", "")
        dias_restantes = None
        estado_seguimiento = "sin_fecha"
        
        if fecha_comp:
            try:
                fecha_dt = datetime.strptime(fecha_comp, "%Y-%m-%d")
                today_dt = datetime.now(timezone.utc).replace(tzinfo=None)
                dias_restantes = (fecha_dt - today_dt).days
                
                if dias_restantes < 0:
                    estado_seguimiento = "vencida"
                elif dias_restantes <= 7:
                    estado_seguimiento = "critico"
                elif dias_restantes <= 30:
                    estado_seguimiento = "proximo"
                else:
                    estado_seguimiento = "ok"
            except:
                pass
        
        result.append({
            **v,
            "dias_restantes": dias_restantes,
            "estado_seguimiento": estado_seguimiento
        })
    
    # Sort by dias_restantes (most urgent first)
    result.sort(key=lambda x: (x["dias_restantes"] is None, x["dias_restantes"] or 9999))
    
    return result

@api_router.get("/seguimiento-riesgos/resumen")
async def get_seguimiento_resumen(current_user: CurrentUser = Depends(get_current_user)):
    """Get summary statistics for risk tracking dashboard"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_7 = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    future_30 = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    
    base_query = {
        "fecha_compromiso": {"$exists": True, "$ne": None, "$ne": ""},
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    }
    
    # Count overdue
    vencidas = await db.vulnerabilidades.count_documents({
        **base_query,
        "fecha_compromiso": {"$lt": today, "$ne": None, "$ne": ""}
    })
    
    # Count critical (due within 7 days)
    criticas_query = {
        "fecha_compromiso": {"$exists": True, "$ne": None, "$ne": ""},
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]},
        "$and": [
            {"fecha_compromiso": {"$gte": today}},
            {"fecha_compromiso": {"$lte": future_7}}
        ]
    }
    criticas = await db.vulnerabilidades.count_documents(criticas_query)
    
    # Count upcoming (due within 30 days)
    proximas_query = {
        "fecha_compromiso": {"$exists": True, "$ne": None, "$ne": ""},
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]},
        "$and": [
            {"fecha_compromiso": {"$gt": future_7}},
            {"fecha_compromiso": {"$lte": future_30}}
        ]
    }
    proximas = await db.vulnerabilidades.count_documents(proximas_query)
    
    # Total with fecha_compromiso pending
    total_pendientes = await db.vulnerabilidades.count_documents(base_query)
    
    return {
        "vencidas": vencidas,
        "criticas_7_dias": criticas,
        "proximas_30_dias": proximas,
        "total_pendientes": total_pendientes
    }

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

# ============ PDF IMPORT ENDPOINTS ============

class ExtractedVulnerability(BaseModel):
    titulo: str
    severidad: str
    activos_afectados: List[str] = []
    descripcion: str
    impacto: str = ""
    recomendaciones: str
    
class PDFExtractionResult(BaseModel):
    nombre_informe: str
    fecha_informe: str
    institucion: str
    proveedor: str
    vulnerabilidades: List[ExtractedVulnerability]
    aplicaciones_nuevas: List[str] = []
    informes_nuevos: List[str] = []
    proveedores_nuevos: List[str] = []

class VulnerabilidadParaAgregar(BaseModel):
    fecha_hallazgo: str
    institucion: str
    aplicaciones: List[str] = []
    vulnerabilidad: str
    descripcion_riesgo: str
    recomendaciones: str
    severidad: str
    estatus: str = "Pendiente"
    nombre_informe_pentest: str
    proveedor: str
    riesgo_asociado: Optional[str] = None
    responsable: Optional[str] = None
    fecha_compromiso: Optional[str] = None

@api_router.post("/import/pdf/extract")
async def extract_vulnerabilities_from_pdf(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Extract vulnerabilities from a PDF pentest report using AI"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para importar")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser PDF")
    
    try:
        import fitz  # PyMuPDF
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Read PDF content
        contents = await file.read()
        pdf_document = fitz.open(stream=contents, filetype="pdf")
        
        # Extract text from all pages
        full_text = ""
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            full_text += f"\n--- Página {page_num + 1} ---\n"
            full_text += page.get_text()
        
        pdf_document.close()
        
        # Limit text length for LLM
        if len(full_text) > 50000:
            full_text = full_text[:50000]
        
        # Use LLM to extract structured data
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"pdf-extract-{uuid.uuid4()}",
            system_message="""Eres un experto en ciberseguridad que analiza informes de pruebas de penetración (pentest).
Tu tarea es extraer información estructurada de informes de pentest en español.

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional ni markdown.

El JSON debe tener esta estructura exacta:
{
    "nombre_informe": "nombre completo del informe de la portada",
    "fecha_informe": "YYYY-MM-DD",
    "institucion": "nombre de la institución/cliente",
    "proveedor": "empresa que realizó el pentest",
    "aplicacion_evaluada": "nombre de la aplicación/sistema principal evaluado (ej: SWIFT, IBP, Active Directory)",
    "vulnerabilidades": [
        {
            "titulo": "título de la vulnerabilidad",
            "severidad": "Critica|Alta|Media|Baja",
            "activos_tecnicos": ["servidores", "IPs", "URLs afectados"],
            "descripcion": "descripción detallada de la vulnerabilidad",
            "impacto": "impacto de la vulnerabilidad",
            "recomendaciones": "recomendaciones para remediar"
        }
    ]
}

Reglas IMPORTANTES:
- La fecha debe estar en formato YYYY-MM-DD
- La severidad debe ser exactamente: Critica, Alta, Media o Baja
- Extrae TODAS las vulnerabilidades del informe
- "aplicacion_evaluada" es el SISTEMA o APLICACIÓN principal que se evaluó en el pentest (ej: SWIFT, SAP, Active Directory, Portal Web, etc.)
- "activos_tecnicos" son los SERVIDORES, IPs, URLs o hosts específicos donde se encontró la vulnerabilidad. NO son aplicaciones.
- NO confundas servidores (SERTERPRD05.cfbhd.com) con aplicaciones (SWIFT). Los servidores van en activos_tecnicos."""
        ).with_model("openai", "gpt-4.1-mini")
        
        user_message = UserMessage(
            text=f"Analiza el siguiente informe de pentest y extrae la información en formato JSON:\n\n{full_text}"
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        import re
        
        # Clean response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r'^```\w*\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)
        
        try:
            extracted_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.error(f"JSON parse error: {e}. Response: {response_text[:500]}")
            raise HTTPException(status_code=500, detail=f"Error al parsear respuesta del LLM: {str(e)}")
        
        # Get existing catalogs
        existing_apps = await db.aplicaciones.distinct("nombre")
        existing_informes = await db.informes_pentest.distinct("nombre")
        existing_proveedores = await db.proveedores.distinct("nombre")
        existing_instituciones = await db.instituciones.distinct("nombre")
        
        # Check for new application (the main evaluated application)
        aplicaciones_nuevas = set()
        aplicacion_evaluada = extracted_data.get("aplicacion_evaluada", "")
        if aplicacion_evaluada and aplicacion_evaluada not in existing_apps:
            aplicaciones_nuevas.add(aplicacion_evaluada)
        
        informes_nuevos = []
        nombre_informe = extracted_data.get("nombre_informe", "")
        if nombre_informe and nombre_informe not in existing_informes:
            informes_nuevos.append(nombre_informe)
        
        proveedores_nuevos = []
        proveedor = extracted_data.get("proveedor", "")
        if proveedor and proveedor not in existing_proveedores:
            proveedores_nuevos.append(proveedor)
        
        institucion = extracted_data.get("institucion", "")
        instituciones_nuevas = []
        if institucion and institucion not in existing_instituciones:
            instituciones_nuevas.append(institucion)
        
        return {
            "nombre_informe": extracted_data.get("nombre_informe", ""),
            "fecha_informe": extracted_data.get("fecha_informe", ""),
            "institucion": extracted_data.get("institucion", ""),
            "proveedor": extracted_data.get("proveedor", ""),
            "aplicacion_evaluada": aplicacion_evaluada,
            "vulnerabilidades": extracted_data.get("vulnerabilidades", []),
            "aplicaciones_nuevas": list(aplicaciones_nuevas),
            "informes_nuevos": informes_nuevos,
            "proveedores_nuevos": proveedores_nuevos,
            "instituciones_nuevas": instituciones_nuevas
        }
        
    except ImportError as e:
        logging.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail="Dependencias no instaladas para procesar PDF")
    except Exception as e:
        logging.error(f"PDF extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el PDF: {str(e)}")

@api_router.post("/import/pdf/add-vulnerability")
async def add_vulnerability_from_pdf(
    data: VulnerabilidadParaAgregar,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Add a single vulnerability extracted from PDF and auto-create catalog items if missing"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear vulnerabilidades")
    
    import re
    
    # Auto-create catalog items if they don't exist (case-insensitive check)
    # Institution - use existing name if found (case-insensitive)
    final_institucion = data.institucion
    if data.institucion:
        existing_inst = await db.instituciones.find_one(
            {"nombre": {"$regex": f"^{re.escape(data.institucion)}$", "$options": "i"}}
        )
        if existing_inst:
            final_institucion = existing_inst["nombre"]  # Use the existing name
        else:
            inst = Institucion(nombre=data.institucion)
            doc = inst.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.instituciones.insert_one(doc)
            logging.info(f"Auto-created institution: {data.institucion}")
    
    # Applications (list) - use existing name if found (case-insensitive)
    final_aplicaciones = []
    if data.aplicaciones:
        for app_name in data.aplicaciones:
            if app_name:
                existing_app = await db.aplicaciones.find_one(
                    {"nombre": {"$regex": f"^{re.escape(app_name)}$", "$options": "i"}}
                )
                if existing_app:
                    final_aplicaciones.append(existing_app["nombre"])  # Use existing name
                else:
                    app = Aplicacion(nombre=app_name)
                    doc = app.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    await db.aplicaciones.insert_one(doc)
                    final_aplicaciones.append(app_name)
                    logging.info(f"Auto-created application: {app_name}")
    
    # Provider - use existing name if found (case-insensitive)
    final_proveedor = data.proveedor
    if data.proveedor:
        existing_prov = await db.proveedores.find_one(
            {"nombre": {"$regex": f"^{re.escape(data.proveedor)}$", "$options": "i"}}
        )
        if existing_prov:
            final_proveedor = existing_prov["nombre"]  # Use existing name
        else:
            prov = Proveedor(nombre=data.proveedor)
            doc = prov.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.proveedores.insert_one(doc)
            logging.info(f"Auto-created provider: {data.proveedor}")
    
    # Informe Pentest - use existing name if found (case-insensitive)
    final_informe = data.nombre_informe_pentest
    if data.nombre_informe_pentest:
        existing_informe = await db.informes_pentest.find_one(
            {"nombre": {"$regex": f"^{re.escape(data.nombre_informe_pentest)}$", "$options": "i"}}
        )
        if existing_informe:
            final_informe = existing_informe["nombre"]  # Use existing name
        else:
            informe = InformePentest(nombre=data.nombre_informe_pentest)
            doc = informe.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.informes_pentest.insert_one(doc)
            logging.info(f"Auto-created informe pentest: {data.nombre_informe_pentest}")
    
    vuln = Vulnerabilidad(
        fecha_hallazgo=data.fecha_hallazgo,
        institucion=final_institucion,
        aplicaciones=final_aplicaciones if final_aplicaciones else data.aplicaciones,
        vulnerabilidad=data.vulnerabilidad,
        descripcion_riesgo=data.descripcion_riesgo,
        recomendaciones=data.recomendaciones,
        severidad=data.severidad,
        estatus=data.estatus,
        nombre_informe_pentest=final_informe,
        proveedor=final_proveedor,
        riesgo_asociado=data.riesgo_asociado,
        responsable=data.responsable,
        fecha_compromiso=data.fecha_compromiso
    )
    
    doc = vuln.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.vulnerabilidades.insert_one(doc)
    
    return {"message": "Vulnerabilidad agregada exitosamente", "id": vuln.id}

@api_router.post("/import/pdf/add-catalog-items")
async def add_catalog_items_from_pdf(
    aplicaciones: List[str] = [],
    informes: List[str] = [],
    proveedores: List[str] = [],
    instituciones: List[str] = [],
    current_user: CurrentUser = Depends(get_current_user)
):
    """Add missing catalog items (applications, reports, providers, institutions)"""
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear elementos de catálogo")
    
    import re
    added = {"aplicaciones": 0, "informes": 0, "proveedores": 0, "instituciones": 0}
    
    for nombre in aplicaciones:
        if nombre:
            # Case-insensitive check
            existing = await db.aplicaciones.find_one(
                {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
            )
            if not existing:
                app = Aplicacion(nombre=nombre)
                doc = app.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.aplicaciones.insert_one(doc)
                added["aplicaciones"] += 1
    
    for nombre in informes:
        if nombre:
            # Case-insensitive check
            existing = await db.informes_pentest.find_one(
                {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
            )
            if not existing:
                informe = InformePentest(nombre=nombre)
                doc = informe.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.informes_pentest.insert_one(doc)
                added["informes"] += 1
    
    for nombre in proveedores:
        if nombre:
            # Case-insensitive check
            existing = await db.proveedores.find_one(
                {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
            )
            if not existing:
                prov = Proveedor(nombre=nombre)
                doc = prov.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.proveedores.insert_one(doc)
                added["proveedores"] += 1
    
    for nombre in instituciones:
        if nombre:
            # Case-insensitive check
            existing = await db.instituciones.find_one(
                {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
            )
            if not existing:
                inst = Institucion(nombre=nombre)
                doc = inst.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.instituciones.insert_one(doc)
                added["instituciones"] += 1
    
    return {"message": "Elementos agregados exitosamente", "added": added}

# ============ PDF REPORTS ENDPOINTS ============

@api_router.get("/reportes/ejecutivo")
async def get_reporte_ejecutivo(
    año: Optional[int] = None,
    institucion: Optional[str] = None,
    informe_pentest: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Generate executive PDF report with KPIs and charts"""
    if not current_user.es_admin and not current_user.permisos.dashboard.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para generar reportes")
    
    # Build query
    query = {}
    if año:
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if institucion:
        query["institucion"] = institucion
    if informe_pentest:
        query["nombre_informe_pentest"] = informe_pentest
    
    # Get stats
    total = await db.vulnerabilidades.count_documents(query)
    criticas = await db.vulnerabilidades.count_documents({**query, "severidad": "Critica", "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}})
    corregidas = await db.vulnerabilidades.count_documents({**query, "estatus": {"$in": ["Corregido", "Cerrado"]}})
    pendientes = await db.vulnerabilidades.count_documents({**query, "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}})
    en_proceso = await db.vulnerabilidades.count_documents({**query, "estatus": "En Proceso"})
    para_retest = await db.vulnerabilidades.count_documents({**query, "estatus": "Para Re Test"})
    
    stats = {
        "total_vulnerabilidades": total,
        "criticas_abiertas": criticas,
        "vulnerabilidades_corregidas": corregidas,
        "pendientes": pendientes,
        "en_proceso": en_proceso,
        "para_retest": para_retest
    }
    
    # Get distribution by severity
    por_severidad = {}
    for sev in ["Critica", "Alta", "Media", "Baja"]:
        count = await db.vulnerabilidades.count_documents({**query, "severidad": sev})
        por_severidad[sev] = count
    
    # Get distribution by status
    por_estatus = {}
    for est in ["Pendiente", "En Proceso", "Para Re Test", "Corregido", "Cerrado", "Desestimado"]:
        count = await db.vulnerabilidades.count_documents({**query, "estatus": est})
        por_estatus[est] = count
    
    # Get distribution by institution (top 10)
    pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {"_id": "$institucion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    cursor = db.vulnerabilidades.aggregate(pipeline)
    por_institucion = {}
    async for doc in cursor:
        if doc["_id"]:
            por_institucion[doc["_id"]] = doc["count"]
    
    # Generate PDF
    filtros = {"año": año, "institucion": institucion, "informe_pentest": informe_pentest}
    pdf_buffer = generate_executive_report(stats, por_severidad, por_estatus, por_institucion, filtros)
    
    filename = f"reporte_ejecutivo_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/reportes/institucion/{institucion}")
async def get_reporte_institucion(
    institucion: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Generate PDF report for a specific institution"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para generar reportes")
    
    # Get vulnerabilities for this institution
    vulns = await db.vulnerabilidades.find(
        {"institucion": institucion},
        {"_id": 0}
    ).sort("severidad", 1).to_list(1000)
    
    if not vulns:
        raise HTTPException(status_code=404, detail="No se encontraron vulnerabilidades para esta institución")
    
    # Calculate stats
    stats = {
        "criticas": sum(1 for v in vulns if v.get("severidad") == "Critica"),
        "altas": sum(1 for v in vulns if v.get("severidad") == "Alta"),
        "medias": sum(1 for v in vulns if v.get("severidad") == "Media"),
        "bajas": sum(1 for v in vulns if v.get("severidad") == "Baja"),
        "pendientes": sum(1 for v in vulns if v.get("estatus") not in ["Cerrado", "Corregido", "Desestimado"]),
        "corregidas": sum(1 for v in vulns if v.get("estatus") in ["Corregido", "Cerrado"]),
    }
    
    pdf_buffer = generate_institution_report(institucion, vulns, stats)
    
    filename = f"reporte_{institucion.replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/reportes/informe/{informe}")
async def get_reporte_informe(
    informe: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Generate PDF report for a specific pentest report"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para generar reportes")
    
    # Get vulnerabilities for this informe
    vulns = await db.vulnerabilidades.find(
        {"nombre_informe_pentest": informe},
        {"_id": 0}
    ).sort("severidad", 1).to_list(1000)
    
    if not vulns:
        raise HTTPException(status_code=404, detail="No se encontraron vulnerabilidades para este informe")
    
    # Calculate stats
    stats = {
        "criticas": sum(1 for v in vulns if v.get("severidad") == "Critica"),
        "altas": sum(1 for v in vulns if v.get("severidad") == "Alta"),
        "medias": sum(1 for v in vulns if v.get("severidad") == "Media"),
        "bajas": sum(1 for v in vulns if v.get("severidad") == "Baja"),
        "pendientes": sum(1 for v in vulns if v.get("estatus") not in ["Cerrado", "Corregido", "Desestimado"]),
        "corregidas": sum(1 for v in vulns if v.get("estatus") in ["Corregido", "Cerrado"]),
    }
    
    # Use institution report template with informe name
    pdf_buffer = generate_institution_report(f"Informe: {informe}", vulns, stats)
    
    filename = f"reporte_informe_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/reportes/vista-comite")
async def get_reporte_vista_comite(
    informes: str = "",
    current_user: CurrentUser = Depends(get_current_user)
):
    """Generate Vista Comité PDF report"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para generar reportes")
    
    informes_list = [i.strip() for i in informes.split(",") if i.strip()] if informes else []
    
    if not informes_list:
        # Get all informes if none specified
        all_informes = await db.informes_pentest.find({}, {"_id": 0, "nombre": 1}).to_list(1000)
        informes_list = [i["nombre"] for i in all_informes if i.get("nombre")]
    
    if not informes_list:
        raise HTTPException(status_code=400, detail="No hay informes para generar el reporte")
    
    # Get aggregated data (similar to vista-comite endpoint)
    query = {"nombre_informe_pentest": {"$in": informes_list}}
    closed_statuses = ["Cerrado", "Corregido", "Desestimado"]
    
    vulns = await db.vulnerabilidades.find(
        query,
        {"_id": 0, "nombre_informe_pentest": 1, "severidad": 1, "estatus": 1, "responsable": 1, "fecha_hallazgo": 1}
    ).to_list(50000)
    
    from collections import defaultdict
    
    informe_data = defaultdict(lambda: {
        "criticas_pendientes": 0, "criticas_total": 0,
        "altas_pendientes": 0, "altas_total": 0,
        "medias_pendientes": 0, "medias_total": 0,
        "bajas_pendientes": 0, "bajas_total": 0,
        "total_pendientes": 0, "total_hallazgos": 0,
        "responsables": set(),
        "fecha_mas_antigua": None
    })
    
    for v in vulns:
        inf = v.get("nombre_informe_pentest", "Sin informe")
        sev = v.get("severidad", "")
        est = v.get("estatus")
        resp = v.get("responsable")
        fecha = v.get("fecha_hallazgo")
        
        if resp:
            informe_data[inf]["responsables"].add(resp)
        
        if fecha:
            try:
                current = informe_data[inf]["fecha_mas_antigua"]
                if current is None or fecha < current:
                    informe_data[inf]["fecha_mas_antigua"] = fecha
            except:
                pass
        
        is_pending = est not in closed_statuses
        
        if sev == "Critica":
            informe_data[inf]["criticas_total"] += 1
            if is_pending:
                informe_data[inf]["criticas_pendientes"] += 1
        elif sev == "Alta":
            informe_data[inf]["altas_total"] += 1
            if is_pending:
                informe_data[inf]["altas_pendientes"] += 1
        elif sev == "Media":
            informe_data[inf]["medias_total"] += 1
            if is_pending:
                informe_data[inf]["medias_pendientes"] += 1
        elif sev == "Baja":
            informe_data[inf]["bajas_total"] += 1
            if is_pending:
                informe_data[inf]["bajas_pendientes"] += 1
        
        if sev in ["Critica", "Alta", "Media", "Baja"]:
            informe_data[inf]["total_hallazgos"] += 1
            if is_pending:
                informe_data[inf]["total_pendientes"] += 1
    
    # Build result
    result = []
    today = datetime.now(timezone.utc).date()
    
    for inf in sorted(informe_data.keys()):
        data = informe_data[inf]
        responsables_list = sorted(data["responsables"])
        
        tiempo_activo_meses = None
        if data["fecha_mas_antigua"]:
            try:
                fecha_str = data["fecha_mas_antigua"]
                fecha_date = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
                months_diff = (today.year - fecha_date.year) * 12 + (today.month - fecha_date.month)
                tiempo_activo_meses = max(0, months_diff)
            except:
                pass
        
        result.append({
            "informe": inf,
            "criticas_pendientes": data["criticas_pendientes"],
            "criticas_total": data["criticas_total"],
            "altas_pendientes": data["altas_pendientes"],
            "altas_total": data["altas_total"],
            "medias_pendientes": data["medias_pendientes"],
            "medias_total": data["medias_total"],
            "bajas_pendientes": data["bajas_pendientes"],
            "bajas_total": data["bajas_total"],
            "responsable": ", ".join(responsables_list) if responsables_list else None,
            "total_pendientes": data["total_pendientes"],
            "total_hallazgos": data["total_hallazgos"],
            "tiempo_activo_meses": tiempo_activo_meses
        })
    
    pdf_buffer = generate_vista_comite_report(result)
    
    filename = f"vista_comite_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    await init_aplicaciones()
    await init_proveedores()
    await init_informes_pentest()
    await migrate_aplicaciones()
    await init_admin_user()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
