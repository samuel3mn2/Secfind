from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query, Depends, Header, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re as regex_module
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Literal
import uuid
from datetime import datetime, timezone, date, timedelta
import pandas as pd
import io
import bcrypt
import jwt
from pdf_reports import generate_executive_report, generate_institution_report, generate_vista_comite_report
from email_service import EmailService, generate_alert_email, generate_weekly_summary_email

# GRC Module Routes (Modular Architecture)
from routes.dominios import create_dominios_router
from routes.controles import create_controles_router
from routes.catalogo_riesgos import create_catalogo_riesgos_router
from routes.hallazgos_auditoria import create_hallazgos_router
from routes.dashboard import create_dashboard_router
from routes.vista_comite import create_router as create_vista_comite_router

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
DEFAULT_ESTATUS = ["En Proceso", "Cerrado", "Pendiente", "Para Re Test"]
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
    debe_cambiar_password: bool = True  # Force password change on first login
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
    debe_cambiar_password: bool = False
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

# Nivel de Riesgo GRC - valores normalizados
NivelRiesgoGRC = Literal["Bajo", "Medio", "Medio Alto", "Alto"]

# Mapeo de Severidad Técnica a Nivel de Riesgo GRC
SEVERIDAD_TO_NIVEL_RIESGO = {
    "Critica": "Alto",
    "Alta": "Medio Alto",
    "Media": "Medio",
    "Baja": "Bajo"
}

def es_informe_primera_emulacion_2024_o_anterior(nombre_informe: str, fecha_hallazgo: str) -> bool:
    """
    Determina si una vulnerabilidad pertenece a un informe de "Primera emulación" 
    del año 2024 o anteriores.
    
    Args:
        nombre_informe: Nombre del informe pentest
        fecha_hallazgo: Fecha del hallazgo en formato YYYY-MM-DD o DD-MM-YYYY
        
    Returns:
        True si aplica el fallback de severidad, False si es 2025+
    """
    if not nombre_informe:
        return False
    
    # Verificar si es informe de "Primera emulación" (case insensitive)
    nombre_lower = nombre_informe.lower()
    if "primera emulacion" not in nombre_lower and "primera emulación" not in nombre_lower:
        return False
    
    # Extraer año de la fecha de hallazgo
    if fecha_hallazgo:
        try:
            # Intentar formato YYYY-MM-DD
            if len(fecha_hallazgo) >= 4 and fecha_hallazgo[:4].isdigit():
                year = int(fecha_hallazgo[:4])
            # Intentar formato DD-MM-YYYY
            elif len(fecha_hallazgo) >= 10 and fecha_hallazgo[-4:].isdigit():
                year = int(fecha_hallazgo[-4:])
            else:
                year = 2024  # Default conservador
            
            return year <= 2024
        except (ValueError, IndexError):
            return True  # Conservador: aplicar fallback si no se puede parsear
    
    return True  # Conservador: si no hay fecha, asumir que necesita fallback

def calcular_nivel_riesgo_desde_severidad(severidad: str) -> Optional[str]:
    """
    Calcula el nivel de riesgo GRC a partir de la severidad técnica.
    
    Args:
        severidad: Severidad técnica (Critica, Alta, Media, Baja)
        
    Returns:
        Nivel de riesgo GRC normalizado o None si la severidad no es válida
    """
    return SEVERIDAD_TO_NIVEL_RIESGO.get(severidad)

class VulnerabilidadBase(BaseModel):
    codigo: Optional[str] = None  # Código único de la vulnerabilidad
    fecha_hallazgo: Optional[str] = None
    institucion: Optional[str] = None
    aplicaciones: Optional[List[str]] = None  # Changed to list
    vulnerabilidad: Optional[str] = None
    recomendaciones: Optional[str] = None
    severidad: Optional[str] = None
    nivel_riesgo: Optional[NivelRiesgoGRC] = None  # Nivel de riesgo GRC normalizado
    riesgo_asociado: Optional[str] = None  # Legacy field - kept for backward compatibility
    descripcion_riesgo: Optional[str] = None
    responsable: Optional[str] = None
    fecha_compromiso: Optional[str] = None
    estatus: Optional[str] = None
    resultado_re_test: Optional[str] = None
    veces_en_retest: Optional[int] = 0
    nombre_informe_pentest: Optional[str] = None
    proveedor: Optional[str] = None
    # GRC Integration fields
    control_id: Optional[str] = None  # Reference to config_controles
    riesgo_id: Optional[str] = None  # Reference to catalogo_riesgos

class VulnerabilidadCreate(VulnerabilidadBase):
    pass

class VulnerabilidadUpdate(VulnerabilidadBase):
    pass

class Vulnerabilidad(VulnerabilidadBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Enriched fields (populated by API, not stored)
    nombre_dominio: Optional[str] = None
    codigo_control: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Report Groups Model
class GrupoInformesBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    informes: List[str] = []  # List of report names that belong to this group

class GrupoInformesCreate(GrupoInformesBase):
    pass

class GrupoInformesUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    informes: Optional[List[str]] = None

class GrupoInformes(GrupoInformesBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Saved Views Model (for Vista Comité)
class VistaGuardadaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    agrupar_por_grupo: bool = False
    grupos_ids: List[str] = []  # IDs of selected grupos
    informes_adicionales: List[str] = []  # Names of individual informes
    informes_individuales: List[str] = []  # For individual mode
    severidades: List[str] = ["Critica", "Alta", "Media", "Baja"]

class VistaGuardadaCreate(VistaGuardadaBase):
    pass

class VistaGuardadaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    agrupar_por_grupo: Optional[bool] = None
    grupos_ids: Optional[List[str]] = None
    informes_adicionales: Optional[List[str]] = None
    informes_individuales: Optional[List[str]] = None
    severidades: Optional[List[str]] = None

class VistaGuardada(VistaGuardadaBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: str  # User ID who created the view
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

# Responsable model
class Responsable(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    email: Optional[str] = None
    activo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ResponsableCreate(BaseModel):
    nombre: str
    email: Optional[str] = None

class ResponsableUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
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
    responsables: List[dict]  # [{nombre, email}]

class DashboardStats(BaseModel):
    total_vulnerabilidades: int
    criticas_abiertas: int
    altas_abiertas: int
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

# ============ NOTIFICATION CONFIG MODEL ============

class AlertConfig(BaseModel):
    dias_7: bool = True
    dias_3: bool = True
    dias_1: bool = True

class NotificacionConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default="config_notificaciones")
    habilitado: bool = False
    smtp_servidor: str = "smtp.gmail.com"
    smtp_puerto: int = 587
    smtp_email: str = ""
    smtp_password: str = ""
    smtp_usar_tls: bool = True
    alertas: AlertConfig = AlertConfig()
    enviar_a_responsables: bool = False
    resumen_semanal: bool = True
    ultima_ejecucion: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificacionConfigUpdate(BaseModel):
    habilitado: Optional[bool] = None
    smtp_servidor: Optional[str] = None
    smtp_puerto: Optional[int] = None
    smtp_email: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_usar_tls: Optional[bool] = None
    alertas: Optional[AlertConfig] = None
    enviar_a_responsables: Optional[bool] = None
    resumen_semanal: Optional[bool] = None

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
    except Exception:
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
            debe_cambiar_password=user.get("debe_cambiar_password", False),
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
        debe_cambiar_password=user.get("debe_cambiar_password", False),
        permisos=UserPermissions(**permisos) if permisos else UserPermissions(),
        created_at=user.get("created_at", datetime.now(timezone.utc))
    )

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user: CurrentUser = Depends(get_current_user)):
    """Allow any authenticated user to change their own password"""
    # Get user with password hash
    user = await db.usuarios.find_one({"id": current_user.id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Verify current password
    if not verify_password(data.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    
    # Validate new password
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 4 caracteres")
    
    # Update password and mark as changed (no longer needs to change)
    new_hash = hash_password(data.new_password)
    await db.usuarios.update_one(
        {"id": current_user.id},
        {"$set": {"password_hash": new_hash, "debe_cambiar_password": False}}
    )
    
    # Log the action in audit history
    await registrar_cambio(
        entidad="usuario",
        entidad_id=current_user.id,
        entidad_nombre=current_user.username,
        accion="cambio_contraseña",
        usuario_id=current_user.id,
        usuario_nombre=current_user.username,
        cambios=[{"campo": "password", "valor_anterior": "****", "valor_nuevo": "****"}]
    )
    
    return {"message": "Contraseña actualizada correctamente"}

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
            debe_cambiar_password=u.get("debe_cambiar_password", False),
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
        debe_cambiar_password=True,
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
        debe_cambiar_password=updated.get("debe_cambiar_password", False),
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
            # Update all occurrences in array field 'aplicaciones' using arrayFilters
            await db.vulnerabilidades.update_many(
                {"aplicaciones": old_name},
                {"$set": {"aplicaciones.$[elem]": new_name}},
                array_filters=[{"elem": old_name}]
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

# ============ RESPONSABLES ENDPOINTS ============

@api_router.get("/config/responsables", response_model=List[Responsable])
async def get_responsables(current_user: CurrentUser = Depends(get_current_user)):
    docs = await db.responsables.find({}, {"_id": 0}).sort("nombre", 1).to_list(1000)
    return docs

@api_router.post("/config/responsables", response_model=Responsable)
async def create_responsable(data: ResponsableCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear")
    
    # Check if already exists
    existing = await db.responsables.find_one({"nombre": {"$regex": f"^{data.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un responsable con ese nombre")
    
    responsable = Responsable(nombre=data.nombre, email=data.email)
    doc = responsable.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.responsables.insert_one(doc)
    return responsable

@api_router.put("/config/responsables/{responsable_id}", response_model=Responsable)
async def update_responsable(responsable_id: str, data: ResponsableUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar")
    
    existing = await db.responsables.find_one({"id": responsable_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Responsable no encontrado")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # If name is being changed, update all vulnerabilities with this responsable
    if "nombre" in update_data and update_data["nombre"] != existing["nombre"]:
        old_name = existing["nombre"]
        new_name = update_data["nombre"]
        await db.vulnerabilidades.update_many(
            {"responsable": old_name},
            {"$set": {"responsable": new_name}}
        )
    
    await db.responsables.update_one({"id": responsable_id}, {"$set": update_data})
    
    updated = await db.responsables.find_one({"id": responsable_id}, {"_id": 0})
    return updated

@api_router.delete("/config/responsables/{responsable_id}")
async def delete_responsable(responsable_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar")
    
    result = await db.responsables.delete_one({"id": responsable_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Responsable no encontrado")
    return {"message": "Responsable eliminado exitosamente"}

# ============ REPORT GROUPS ENDPOINTS ============

@api_router.get("/config/grupos-informes")
async def get_grupos_informes(current_user: CurrentUser = Depends(get_current_user)):
    """Get all report groups"""
    if not current_user.es_admin and not current_user.permisos.configuracion.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver grupos de informes")
    
    grupos = await db.grupos_informes.find({}, {"_id": 0}).to_list(1000)
    return grupos

@api_router.post("/config/grupos-informes")
async def create_grupo_informes(data: GrupoInformesCreate, current_user: CurrentUser = Depends(get_current_user)):
    """Create a new report group"""
    if not current_user.es_admin and not current_user.permisos.configuracion.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear grupos")
    
    # Check if name already exists
    existing = await db.grupos_informes.find_one({"nombre": {"$regex": f"^{data.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un grupo con ese nombre")
    
    # Check that reports are not already in another group
    if data.informes:
        for informe in data.informes:
            other_group = await db.grupos_informes.find_one({"informes": informe})
            if other_group:
                raise HTTPException(
                    status_code=400, 
                    detail=f"El informe '{informe}' ya pertenece al grupo '{other_group['nombre']}'"
                )
    
    grupo = GrupoInformes(**data.model_dump())
    doc = grupo.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.grupos_informes.insert_one(doc)
    
    return {"id": grupo.id, "nombre": grupo.nombre, "informes": grupo.informes, "descripcion": grupo.descripcion}

@api_router.put("/config/grupos-informes/{grupo_id}")
async def update_grupo_informes(grupo_id: str, data: GrupoInformesUpdate, current_user: CurrentUser = Depends(get_current_user)):
    """Update a report group"""
    if not current_user.es_admin and not current_user.permisos.configuracion.editar:
        raise HTTPException(status_code=403, detail="No tiene permisos para editar grupos")
    
    existing = await db.grupos_informes.find_one({"id": grupo_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # If updating reports, check they're not in another group
    if "informes" in update_data:
        for informe in update_data["informes"]:
            other_group = await db.grupos_informes.find_one({
                "informes": informe,
                "id": {"$ne": grupo_id}
            })
            if other_group:
                raise HTTPException(
                    status_code=400,
                    detail=f"El informe '{informe}' ya pertenece al grupo '{other_group['nombre']}'"
                )
    
    await db.grupos_informes.update_one({"id": grupo_id}, {"$set": update_data})
    
    updated = await db.grupos_informes.find_one({"id": grupo_id}, {"_id": 0})
    return updated

@api_router.delete("/config/grupos-informes/{grupo_id}")
async def delete_grupo_informes(grupo_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """Delete a report group"""
    if not current_user.es_admin and not current_user.permisos.configuracion.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar grupos")
    
    result = await db.grupos_informes.delete_one({"id": grupo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return {"message": "Grupo eliminado exitosamente"}

@api_router.get("/config/informes-sin-grupo")
async def get_informes_sin_grupo(current_user: CurrentUser = Depends(get_current_user)):
    """Get reports that are not assigned to any group"""
    if not current_user.es_admin and not current_user.permisos.configuracion.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    # Get all reports
    informes = await db.informes_pentest.find({}, {"_id": 0, "nombre": 1}).to_list(1000)
    all_report_names = [i["nombre"] for i in informes]
    
    # Get all reports that are in groups
    grupos = await db.grupos_informes.find({}, {"_id": 0, "informes": 1}).to_list(1000)
    reports_in_groups = set()
    for g in grupos:
        reports_in_groups.update(g.get("informes", []))
    
    # Return reports not in any group
    informes_sin_grupo = [r for r in all_report_names if r not in reports_in_groups]
    return informes_sin_grupo

# ============ SAVED VIEWS ENDPOINTS ============

@api_router.get("/vistas-guardadas")
async def get_vistas_guardadas(current_user: CurrentUser = Depends(get_current_user)):
    """Get all saved views for Vista Comité"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    vistas = await db.vistas_guardadas.find({}, {"_id": 0}).sort("nombre", 1).to_list(100)
    return vistas

@api_router.post("/vistas-guardadas")
async def create_vista_guardada(data: VistaGuardadaCreate, current_user: CurrentUser = Depends(get_current_user)):
    """Create a new saved view"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    # Check if name already exists
    existing = await db.vistas_guardadas.find_one({"nombre": {"$regex": f"^{data.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una vista con ese nombre")
    
    vista = VistaGuardada(
        **data.model_dump(),
        created_by=current_user.id
    )
    doc = vista.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.vistas_guardadas.insert_one(doc)
    
    return {
        "id": vista.id,
        "nombre": vista.nombre,
        "descripcion": vista.descripcion,
        "agrupar_por_grupo": vista.agrupar_por_grupo,
        "grupos_ids": vista.grupos_ids,
        "informes_adicionales": vista.informes_adicionales,
        "informes_individuales": vista.informes_individuales,
        "severidades": vista.severidades
    }

@api_router.put("/vistas-guardadas/{vista_id}")
async def update_vista_guardada(vista_id: str, data: VistaGuardadaUpdate, current_user: CurrentUser = Depends(get_current_user)):
    """Update a saved view"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    existing = await db.vistas_guardadas.find_one({"id": vista_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vista no encontrada")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Check name uniqueness if updating name
    if "nombre" in update_data:
        other = await db.vistas_guardadas.find_one({
            "nombre": {"$regex": f"^{update_data['nombre']}$", "$options": "i"},
            "id": {"$ne": vista_id}
        })
        if other:
            raise HTTPException(status_code=400, detail="Ya existe otra vista con ese nombre")
    
    await db.vistas_guardadas.update_one({"id": vista_id}, {"$set": update_data})
    
    updated = await db.vistas_guardadas.find_one({"id": vista_id}, {"_id": 0})
    return updated

@api_router.delete("/vistas-guardadas/{vista_id}")
async def delete_vista_guardada(vista_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """Delete a saved view"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    result = await db.vistas_guardadas.delete_one({"id": vista_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vista no encontrada")
    return {"message": "Vista eliminada exitosamente"}

# ============ NOTIFICATION CONFIGURATION ENDPOINTS ============

@api_router.get("/config/notificaciones")
async def get_notificacion_config(current_user: CurrentUser = Depends(get_current_user)):
    """Get notification configuration (admin only)"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver la configuración de notificaciones")
    
    config = await db.configuracion.find_one({"id": "config_notificaciones"}, {"_id": 0})
    if not config:
        # Return default config
        default_config = NotificacionConfig()
        return default_config.model_dump()
    
    # Don't expose the password in responses
    if config.get("smtp_password"):
        config["smtp_password"] = "********"
    return config

@api_router.put("/config/notificaciones")
async def update_notificacion_config(
    data: NotificacionConfigUpdate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update notification configuration (admin only)"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar la configuración")
    
    # Get existing config or create default
    existing = await db.configuracion.find_one({"id": "config_notificaciones"})
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If password is masked, don't update it
    if update_data.get("smtp_password") == "********":
        del update_data["smtp_password"]
    
    if existing:
        await db.configuracion.update_one(
            {"id": "config_notificaciones"},
            {"$set": update_data}
        )
    else:
        new_config = NotificacionConfig(**update_data)
        doc = new_config.model_dump()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.configuracion.insert_one(doc)
    
    return {"message": "Configuración actualizada exitosamente"}

@api_router.post("/config/notificaciones/test")
async def test_notificacion_config(current_user: CurrentUser = Depends(get_current_user)):
    """Test SMTP connection (admin only)"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden probar la configuración")
    
    config = await db.configuracion.find_one({"id": "config_notificaciones"}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="No hay configuración SMTP guardada")
    
    if not config.get("smtp_email") or not config.get("smtp_password"):
        raise HTTPException(status_code=400, detail="Faltan credenciales SMTP")
    
    email_service = EmailService({
        "servidor": config.get("smtp_servidor", "smtp.gmail.com"),
        "puerto": config.get("smtp_puerto", 587),
        "email": config.get("smtp_email"),
        "password": config.get("smtp_password"),
        "usar_tls": config.get("smtp_usar_tls", True)
    })
    
    result = email_service.test_connection()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return {"message": "Conexión SMTP exitosa"}

@api_router.post("/config/notificaciones/send-test-email")
async def send_test_email(current_user: CurrentUser = Depends(get_current_user)):
    """Send a test email to verify the configuration (admin only)"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar emails de prueba")
    
    config = await db.configuracion.find_one({"id": "config_notificaciones"}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="No hay configuración SMTP guardada")
    
    email_service = EmailService({
        "servidor": config.get("smtp_servidor", "smtp.gmail.com"),
        "puerto": config.get("smtp_puerto", 587),
        "email": config.get("smtp_email"),
        "password": config.get("smtp_password"),
        "usar_tls": config.get("smtp_usar_tls", True)
    })
    
    # Get current user's email or use SMTP email
    user = await db.usuarios.find_one({"id": current_user.id}, {"_id": 0, "email": 1})
    to_email = user.get("email") if user and user.get("email") else config.get("smtp_email")
    
    # Generate test email with sample data
    test_vulns = [
        {"vulnerabilidad": "Test - SQL Injection en login", "institucion": "Test Corp", "severidad": "Critica", "fecha_compromiso": "2026-04-20", "responsable": "Admin"},
        {"vulnerabilidad": "Test - XSS en formulario", "institucion": "Test Corp", "severidad": "Alta", "fecha_compromiso": "2026-04-22", "responsable": "Admin"}
    ]
    test_hallazgos = [
        {"codigo": "AUD-TEST-001", "brecha": "Test - Falta de monitoreo en sistemas críticos", "riesgo_inherente": 16, "fecha_compromiso": "2026-04-25", "responsable": "Auditor"}
    ]
    html_content = generate_alert_email(test_vulns, test_hallazgos, 7)
    
    result = email_service.send_email([to_email], "SecFind - Email de Prueba", html_content)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return {"message": f"Email de prueba enviado a {to_email}"}

@api_router.post("/notificaciones/ejecutar")
async def ejecutar_notificaciones(current_user: CurrentUser = Depends(get_current_user)):
    """Manually trigger notification check for vulnerabilities and audit findings (admin only)"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar notificaciones")
    
    config = await db.configuracion.find_one({"id": "config_notificaciones"}, {"_id": 0})
    if not config or not config.get("habilitado"):
        raise HTTPException(status_code=400, detail="Las notificaciones no están habilitadas")
    
    if not config.get("smtp_email") or not config.get("smtp_password"):
        raise HTTPException(status_code=400, detail="Configuración SMTP incompleta")
    
    email_service = EmailService({
        "servidor": config.get("smtp_servidor", "smtp.gmail.com"),
        "puerto": config.get("smtp_puerto", 587),
        "email": config.get("smtp_email"),
        "password": config.get("smtp_password"),
        "usar_tls": config.get("smtp_usar_tls", True)
    })
    
    # Get admin emails
    admins = await db.usuarios.find({"es_admin": True, "activo": True}, {"_id": 0, "email": 1}).to_list(100)
    admin_emails = [a["email"] for a in admins if a.get("email")]
    
    if not admin_emails:
        admin_emails = [config.get("smtp_email")]
    
    today = datetime.now(timezone.utc).date()
    emails_sent = 0
    alertas = config.get("alertas", {})
    
    # Check each alert threshold
    for dias, habilitado in [
        (1, alertas.get("dias_1", True)),
        (3, alertas.get("dias_3", True)),
        (7, alertas.get("dias_7", True))
    ]:
        if not habilitado:
            continue
        
        target_date = today + timedelta(days=dias)
        target_str = target_date.strftime("%Y-%m-%d")
        
        # Find vulnerabilities expiring on this date
        vulns = await db.vulnerabilidades.find({
            "fecha_compromiso": target_str,
            "estatus": {"$in": ["Pendiente", "En Proceso"]}
        }, {"_id": 0}).to_list(1000)
        
        # Find hallazgos de auditoría expiring on this date
        hallazgos = await db.hallazgos_auditoria.find({
            "fecha_compromiso": target_str,
            "estado": {"$nin": ["Cerrado"]}
        }, {"_id": 0}).to_list(1000)
        
        if vulns or hallazgos:
            html_content = generate_alert_email(vulns, hallazgos, dias)
            recipients = admin_emails.copy()
            
            # Add responsables if enabled
            if config.get("enviar_a_responsables"):
                # Process vulnerability responsables
                for v in vulns:
                    resp = v.get("responsable")
                    if resp:
                        responsable = await db.responsables.find_one({"nombre": resp, "activo": True}, {"_id": 0, "email": 1})
                        if responsable and responsable.get("email") and responsable["email"] not in recipients:
                            recipients.append(responsable["email"])
                        else:
                            user = await db.usuarios.find_one({"nombre": resp, "activo": True}, {"_id": 0, "email": 1})
                            if user and user.get("email") and user["email"] not in recipients:
                                recipients.append(user["email"])
                
                # Process hallazgo responsables (same logic)
                for h in hallazgos:
                    resp = h.get("responsable")
                    if resp:
                        responsable = await db.responsables.find_one({"nombre": resp, "activo": True}, {"_id": 0, "email": 1})
                        if responsable and responsable.get("email") and responsable["email"] not in recipients:
                            recipients.append(responsable["email"])
                        else:
                            user = await db.usuarios.find_one({"nombre": resp, "activo": True}, {"_id": 0, "email": 1})
                            if user and user.get("email") and user["email"] not in recipients:
                                recipients.append(user["email"])
            
            total_items = len(vulns) + len(hallazgos)
            result = email_service.send_email(
                recipients,
                f"SecFind - {total_items} remediación(es) vence(n) en {dias} día(s)",
                html_content
            )
            if result["success"]:
                emails_sent += 1
    
    # Update last execution time
    await db.configuracion.update_one(
        {"id": "config_notificaciones"},
        {"$set": {"ultima_ejecucion": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Proceso completado. {emails_sent} alerta(s) enviada(s)"}

@api_router.post("/notificaciones/resumen-semanal")
async def enviar_resumen_semanal(current_user: CurrentUser = Depends(get_current_user)):
    """Manually send weekly summary for vulnerabilities and audit findings (admin only)"""
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar el resumen")
    
    config = await db.configuracion.find_one({"id": "config_notificaciones"}, {"_id": 0})
    if not config or not config.get("habilitado"):
        raise HTTPException(status_code=400, detail="Las notificaciones no están habilitadas")
    
    email_service = EmailService({
        "servidor": config.get("smtp_servidor", "smtp.gmail.com"),
        "puerto": config.get("smtp_puerto", 587),
        "email": config.get("smtp_email"),
        "password": config.get("smtp_password"),
        "usar_tls": config.get("smtp_usar_tls", True)
    })
    
    # Get admin emails
    admins = await db.usuarios.find({"es_admin": True, "activo": True}, {"_id": 0, "email": 1}).to_list(100)
    admin_emails = [a["email"] for a in admins if a.get("email")]
    
    if not admin_emails:
        admin_emails = [config.get("smtp_email")]
    
    today = datetime.now(timezone.utc).date()
    today_str = today.strftime("%Y-%m-%d")
    fecha_7 = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    fecha_30 = (today + timedelta(days=30)).strftime("%Y-%m-%d")
    
    # === VULNERABILITY STATS ===
    vuln_vencidas = await db.vulnerabilidades.count_documents({
        "fecha_compromiso": {"$lt": today_str},
        "estatus": {"$in": ["Pendiente", "En Proceso"]}
    })
    
    vuln_proximas_7 = await db.vulnerabilidades.count_documents({
        "fecha_compromiso": {"$gte": today_str, "$lte": fecha_7},
        "estatus": {"$in": ["Pendiente", "En Proceso"]}
    })
    
    vuln_proximas_30 = await db.vulnerabilidades.count_documents({
        "fecha_compromiso": {"$gte": today_str, "$lte": fecha_30},
        "estatus": {"$in": ["Pendiente", "En Proceso"]}
    })
    
    vuln_total_pendientes = await db.vulnerabilidades.count_documents({
        "estatus": {"$in": ["Pendiente", "En Proceso"]}
    })
    
    vuln_stats = {
        "vencidas": vuln_vencidas,
        "proximas_7_dias": vuln_proximas_7,
        "proximas_30_dias": vuln_proximas_30,
        "total_pendientes": vuln_total_pendientes
    }
    
    # === HALLAZGOS STATS ===
    hallazgo_vencidas = await db.hallazgos_auditoria.count_documents({
        "fecha_compromiso": {"$lt": today_str, "$ne": None, "$exists": True},
        "estado": {"$nin": ["Cerrado"]}
    })
    
    hallazgo_proximas_7 = await db.hallazgos_auditoria.count_documents({
        "fecha_compromiso": {"$gte": today_str, "$lte": fecha_7},
        "estado": {"$nin": ["Cerrado"]}
    })
    
    hallazgo_proximas_30 = await db.hallazgos_auditoria.count_documents({
        "fecha_compromiso": {"$gte": today_str, "$lte": fecha_30},
        "estado": {"$nin": ["Cerrado"]}
    })
    
    hallazgo_total_pendientes = await db.hallazgos_auditoria.count_documents({
        "estado": {"$nin": ["Cerrado"]}
    })
    
    hallazgo_stats = {
        "vencidas": hallazgo_vencidas,
        "proximas_7_dias": hallazgo_proximas_7,
        "proximas_30_dias": hallazgo_proximas_30,
        "total_pendientes": hallazgo_total_pendientes
    }
    
    # Get upcoming vulnerabilities for the list
    vulns = await db.vulnerabilidades.find({
        "fecha_compromiso": {"$gte": today_str, "$lte": fecha_30},
        "estatus": {"$in": ["Pendiente", "En Proceso"]}
    }, {"_id": 0}).sort("fecha_compromiso", 1).to_list(15)
    
    # Get upcoming hallazgos for the list
    hallazgos = await db.hallazgos_auditoria.find({
        "fecha_compromiso": {"$gte": today_str, "$lte": fecha_30},
        "estado": {"$nin": ["Cerrado"]}
    }, {"_id": 0}).sort("fecha_compromiso", 1).to_list(15)
    
    html_content = generate_weekly_summary_email(vuln_stats, hallazgo_stats, vulns, hallazgos)
    
    result = email_service.send_email(
        admin_emails,
        "SecFind - Resumen Semanal de Remediaciones",
        html_content
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return {"message": f"Resumen semanal enviado a {len(admin_emails)} administrador(es)"}

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

# Migrate nivel_riesgo field for "Primera emulación" reports (2024 or earlier)
async def migrate_nivel_riesgo():
    """
    Migra el campo nivel_riesgo para vulnerabilidades de informes 
    "Primera emulación" del año 2024 o anteriores.
    
    Mapeo:
    - Critica -> "Alto"
    - Alta -> "Medio Alto"
    - Media -> "Medio"
    - Baja -> "Bajo"
    """
    # Buscar vulnerabilidades de "Primera emulación" sin nivel_riesgo
    query = {
        "$or": [
            {"nombre_informe_pentest": {"$regex": "primera emulacion", "$options": "i"}},
            {"nombre_informe_pentest": {"$regex": "primera emulación", "$options": "i"}}
        ],
        "$or": [
            {"nivel_riesgo": {"$exists": False}},
            {"nivel_riesgo": None},
            {"nivel_riesgo": ""}
        ]
    }
    
    vulns = await db.vulnerabilidades.find(
        query,
        {"_id": 0, "id": 1, "severidad": 1, "fecha_hallazgo": 1, "nombre_informe_pentest": 1}
    ).to_list(10000)
    
    migrated = 0
    skipped = 0
    
    for v in vulns:
        # Verificar si es 2024 o anterior
        if not es_informe_primera_emulacion_2024_o_anterior(
            v.get("nombre_informe_pentest"), 
            v.get("fecha_hallazgo")
        ):
            skipped += 1
            continue
        
        severidad = v.get("severidad")
        nivel_riesgo = calcular_nivel_riesgo_desde_severidad(severidad)
        
        if nivel_riesgo:
            await db.vulnerabilidades.update_one(
                {"id": v["id"]},
                {"$set": {"nivel_riesgo": nivel_riesgo}}
            )
            migrated += 1
    
    if migrated > 0 or skipped > 0:
        logging.info(f"Migración nivel_riesgo: {migrated} actualizados, {skipped} omitidos (2025+)")
    
    return {"migrated": migrated, "skipped": skipped}

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

@api_router.post("/admin/migrate-nivel-riesgo")
async def api_migrate_nivel_riesgo(current_user: Usuario = Depends(get_current_user)):
    """
    Endpoint para ejecutar la migración de nivel_riesgo manualmente.
    Solo accesible por administradores.
    
    Aplica el mapeo de severidad a nivel_riesgo ÚNICAMENTE para:
    - Informes de "Primera emulación" 
    - Año 2024 o anteriores
    
    Mapeo:
    - Critica -> "Alto"
    - Alta -> "Medio Alto"  
    - Media -> "Medio"
    - Baja -> "Bajo"
    """
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar migraciones")
    
    result = await migrate_nivel_riesgo()
    return {
        "mensaje": "Migración de nivel_riesgo completada",
        "migrados": result["migrated"],
        "omitidos_2025_plus": result["skipped"]
    }

@api_router.get("/admin/nivel-riesgo-stats")
async def get_nivel_riesgo_stats(current_user: Usuario = Depends(get_current_user)):
    """
    Retorna estadísticas del campo nivel_riesgo en vulnerabilidades.
    """
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    total = await db.vulnerabilidades.count_documents({})
    
    # Contar por nivel_riesgo
    pipeline = [
        {"$group": {"_id": "$nivel_riesgo", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    nivel_riesgo_dist = await db.vulnerabilidades.aggregate(pipeline).to_list(10)
    
    # Contar sin nivel_riesgo
    sin_nivel = await db.vulnerabilidades.count_documents({
        "$or": [
            {"nivel_riesgo": {"$exists": False}},
            {"nivel_riesgo": None},
            {"nivel_riesgo": ""}
        ]
    })
    
    # Contar "Primera emulación" que necesitan migración
    primera_emulacion_sin_nivel = await db.vulnerabilidades.count_documents({
        "$and": [
            {"$or": [
                {"nombre_informe_pentest": {"$regex": "primera emulacion", "$options": "i"}},
                {"nombre_informe_pentest": {"$regex": "primera emulación", "$options": "i"}}
            ]},
            {"$or": [
                {"nivel_riesgo": {"$exists": False}},
                {"nivel_riesgo": None},
                {"nivel_riesgo": ""}
            ]}
        ]
    })
    
    return {
        "total_vulnerabilidades": total,
        "sin_nivel_riesgo": sin_nivel,
        "primera_emulacion_pendientes": primera_emulacion_sin_nivel,
        "distribucion_nivel_riesgo": {
            item["_id"] if item["_id"] else "Sin asignar": item["count"] 
            for item in nivel_riesgo_dist
        }
    }

@api_router.post("/admin/migrate-nivel-riesgo-all")
async def api_migrate_nivel_riesgo_all(current_user: Usuario = Depends(get_current_user)):
    """
    Endpoint para migrar nivel_riesgo de TODAS las vulnerabilidades que no lo tengan.
    Calcula el valor desde la severidad técnica sin restricción de fecha/informe.
    
    Mapeo:
    - Critica -> "Alto"
    - Alta -> "Medio Alto"  
    - Media -> "Medio"
    - Baja -> "Bajo"
    
    Uso en instalación local:
    curl -X POST http://localhost:8001/api/admin/migrate-nivel-riesgo-all \
      -H "Authorization: Bearer <token>"
    """
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar migraciones")
    
    # Mapeo de severidad a nivel_riesgo
    nivel_riesgo_map = {
        "Critica": "Alto",
        "Alta": "Medio Alto",
        "Media": "Medio",
        "Baja": "Bajo"
    }
    
    # Buscar vulnerabilidades sin nivel_riesgo
    vulns = await db.vulnerabilidades.find(
        {
            "$or": [
                {"nivel_riesgo": {"$exists": False}},
                {"nivel_riesgo": None},
                {"nivel_riesgo": ""}
            ]
        },
        {"_id": 0, "id": 1, "severidad": 1}
    ).to_list(50000)
    
    migrated = 0
    skipped = 0
    
    for v in vulns:
        severidad = v.get("severidad")
        nivel_riesgo = nivel_riesgo_map.get(severidad)
        
        if nivel_riesgo:
            await db.vulnerabilidades.update_one(
                {"id": v["id"]},
                {"$set": {"nivel_riesgo": nivel_riesgo}}
            )
            migrated += 1
        else:
            skipped += 1  # Severidad no reconocida
    
    logging.info(f"Migración nivel_riesgo (ALL): {migrated} actualizados, {skipped} sin severidad válida")
    
    return {
        "mensaje": "Migración de nivel_riesgo completada (todas las vulnerabilidades)",
        "migrados": migrated,
        "omitidos_sin_severidad": skipped,
        "total_procesados": len(vulns)
    }

# ============ BULK ASSOCIATE GRC ============

class BulkAssociateGRCItem(BaseModel):
    """Estructura de cada item del mapeo GRC desde Excel"""
    CodigoDeVulns: str
    Dominio: str
    Riesgo: str
    Fuente: Optional[str] = None
    Informes: Optional[str] = None

class BulkAssociateGRCRequest(BaseModel):
    """Request para asociación masiva GRC"""
    items: List[BulkAssociateGRCItem]

@api_router.post("/admin/bulk-associate-grc")
async def bulk_associate_grc(
    request: BulkAssociateGRCRequest,
    current_user: Usuario = Depends(get_current_user)
):
    """
    Endpoint de Asociación Masiva GRC.
    Recibe un arreglo JSON con mapeo de vulnerabilidades a dominios y riesgos.
    
    Payload esperado:
    {
      "items": [
        {
          "CodigoDeVulns": "VULN_EA_CTCE_1",
          "Dominio": "Seguridad de Aplicaciones",
          "Riesgo": "Acceso a cuentas sin validación de identidad..."
        },
        ...
      ]
    }
    
    Lógica:
    1. Busca vulnerabilidad por código exacto
    2. Busca/crea dominio en config_dominios
    3. Busca/crea riesgo en catalogo_riesgos
    4. Actualiza vulnerabilidad con dominio_id y riesgo_id
    """
    if not current_user.es_admin:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar asociaciones masivas")
    
    stats = {
        "procesados": 0,
        "exitosos": 0,
        "vulnerabilidad_no_encontrada": 0,
        "dominio_creado": 0,
        "riesgo_creado": 0,
        "errores": []
    }
    
    # Cache para dominios y riesgos (evitar múltiples queries)
    dominios_cache = {}
    riesgos_cache = {}
    
    for item in request.items:
        stats["procesados"] += 1
        
        try:
            # 1. Buscar vulnerabilidad por código
            vuln = await db.vulnerabilidades.find_one({"codigo": item.CodigoDeVulns})
            
            if not vuln:
                stats["vulnerabilidad_no_encontrada"] += 1
                stats["errores"].append(f"Vulnerabilidad no encontrada: {item.CodigoDeVulns}")
                continue
            
            update_fields = {}
            
            # 2. Buscar/crear dominio
            dominio_nombre = item.Dominio.strip()
            if dominio_nombre:
                if dominio_nombre not in dominios_cache:
                    dominio_doc = await db.config_dominios.find_one({"nombre_dominio": dominio_nombre})
                    
                    if not dominio_doc:
                        # Crear dominio dinámicamente
                        import uuid
                        new_dominio_id = str(uuid.uuid4())
                        await db.config_dominios.insert_one({
                            "id": new_dominio_id,
                            "nombre_dominio": dominio_nombre,
                            "descripcion": f"Dominio creado automáticamente desde mapeo GRC",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        dominios_cache[dominio_nombre] = new_dominio_id
                        stats["dominio_creado"] += 1
                        logging.info(f"Dominio creado: {dominio_nombre}")
                    else:
                        dominios_cache[dominio_nombre] = dominio_doc.get("id")
                
                update_fields["dominio_id"] = dominios_cache[dominio_nombre]
            
            # 3. Buscar/crear riesgo
            riesgo_descripcion = item.Riesgo.strip()
            if riesgo_descripcion:
                # Usar los primeros 100 caracteres como clave de cache
                riesgo_key = riesgo_descripcion[:100]
                
                if riesgo_key not in riesgos_cache:
                    # Buscar por descripción similar
                    riesgo_doc = await db.catalogo_riesgos.find_one({
                        "$or": [
                            {"descripcion": {"$regex": riesgo_descripcion[:50], "$options": "i"}},
                            {"nombre": {"$regex": riesgo_descripcion[:30], "$options": "i"}}
                        ]
                    })
                    
                    if not riesgo_doc:
                        # Crear riesgo dinámicamente
                        import uuid
                        new_riesgo_id = str(uuid.uuid4())
                        # Generar código y nombre corto desde la descripción
                        nombre_corto = riesgo_descripcion.split('.')[0][:80] if '.' in riesgo_descripcion else riesgo_descripcion[:80]
                        # Generar código único
                        codigo_riesgo = f"R-{stats['riesgo_creado'] + 1:04d}"
                        
                        await db.catalogo_riesgos.insert_one({
                            "id": new_riesgo_id,
                            "codigo_riesgo": codigo_riesgo,
                            "nombre_corto": nombre_corto,
                            "descripcion_completa": riesgo_descripcion,
                            "nombre": nombre_corto,  # Compatibilidad
                            "descripcion": riesgo_descripcion,  # Compatibilidad
                            "categoria": "Operativo",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        riesgos_cache[riesgo_key] = new_riesgo_id
                        stats["riesgo_creado"] += 1
                        logging.info(f"Riesgo creado: {codigo_riesgo} - {nombre_corto}")
                    else:
                        riesgos_cache[riesgo_key] = riesgo_doc.get("id")
                
                update_fields["riesgo_id"] = riesgos_cache[riesgo_key]
            
            # 4. Actualizar vulnerabilidad
            if update_fields:
                await db.vulnerabilidades.update_one(
                    {"id": vuln["id"]},
                    {"$set": update_fields}
                )
                stats["exitosos"] += 1
            
        except Exception as e:
            stats["errores"].append(f"Error procesando {item.CodigoDeVulns}: {str(e)}")
            logging.error(f"Error en bulk-associate-grc: {e}")
    
    # Limitar errores en respuesta
    if len(stats["errores"]) > 20:
        stats["errores"] = stats["errores"][:20] + [f"... y {len(stats['errores']) - 20} errores más"]
    
    logging.info(f"Bulk Associate GRC: {stats['exitosos']}/{stats['procesados']} exitosos")
    
    return stats

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
    
    # Get responsables from catalog
    responsables_docs = await db.responsables.find({"activo": True}, {"_id": 0, "nombre": 1, "email": 1}).to_list(1000)
    responsables = [{"nombre": r["nombre"], "email": r.get("email", "")} for r in responsables_docs] if responsables_docs else []
    
    # Fallback: get unique responsables from vulnerabilities if catalog is empty
    if not responsables:
        resp_names = await db.vulnerabilidades.distinct("responsable")
        responsables = [{"nombre": r, "email": ""} for r in resp_names if r]
    
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
        proveedores=sorted(proveedores),
        responsables=sorted(responsables, key=lambda x: x["nombre"])
    )

# ============ VULNERABILIDADES ENDPOINTS ============

@api_router.get("/vulnerabilidades", response_model=List[Vulnerabilidad])
async def get_vulnerabilidades(
    request: Request,
    search: Optional[str] = None,
    proveedor: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver vulnerabilidades")
    
    # Get multi-value params manually
    severidades = request.query_params.getlist("severidad")
    estatus_list = request.query_params.getlist("estatus")
    instituciones = request.query_params.getlist("institucion")
    aplicaciones = request.query_params.getlist("aplicacion")
    informes = request.query_params.getlist("informe_pentest")
    responsables = request.query_params.getlist("responsable")
    años = request.query_params.getlist("año")
    dominios_filter = request.query_params.getlist("dominio")
    controles_filter = request.query_params.getlist("control")
    nivel_riesgo_filter = request.query_params.getlist("nivel_riesgo")
    
    query = {}
    if severidades:
        query["severidad"] = {"$in": severidades}
    if estatus_list:
        query["estatus"] = {"$in": estatus_list}
    if instituciones:
        query["institucion"] = {"$in": instituciones}
    if aplicaciones:
        query["aplicaciones"] = {"$in": aplicaciones}
    if proveedor:
        query["proveedor"] = proveedor
    if informes:
        query["nombre_informe_pentest"] = {"$in": informes}
    if responsables:
        query["responsable"] = {"$in": responsables}
    if nivel_riesgo_filter:
        query["nivel_riesgo"] = {"$in": nivel_riesgo_filter}
    if años:
        # Multiple years - use $or with regex for each year
        year_conditions = [{"fecha_hallazgo": {"$regex": f"^{año}"}} for año in años]
        if len(year_conditions) == 1:
            query["fecha_hallazgo"] = year_conditions[0]["fecha_hallazgo"]
        else:
            query["$and"] = query.get("$and", [])
            query["$and"].append({"$or": year_conditions})
    if search:
        search_conditions = [
            {"codigo": {"$regex": search, "$options": "i"}},
            {"vulnerabilidad": {"$regex": search, "$options": "i"}},
            {"aplicaciones": {"$regex": search, "$options": "i"}},
            {"responsable": {"$regex": search, "$options": "i"}},
            {"nombre_informe_pentest": {"$regex": search, "$options": "i"}}
        ]
        if "$and" in query:
            query["$and"].append({"$or": search_conditions})
        else:
            query["$or"] = search_conditions
    
    vulnerabilidades = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with dominio/control names
    controles_ids = list(set(v.get("control_id") for v in vulnerabilidades if v.get("control_id")))
    controles_map = {}
    if controles_ids:
        controles = await db.config_controles.find({"id": {"$in": controles_ids}}, {"_id": 0}).to_list(1000)
        controles_map = {c["id"]: c for c in controles}
    
    dominios_ids = list(set(c.get("dominio_id") for c in controles_map.values() if c.get("dominio_id")))
    dominios_map = {}
    if dominios_ids:
        dominios = await db.config_dominios.find({"id": {"$in": dominios_ids}}, {"_id": 0}).to_list(100)
        dominios_map = {d["id"]: d for d in dominios}
    
    result = []
    for v in vulnerabilidades:
        control_id = v.get("control_id")
        nombre_dominio = None
        codigo_control = None
        
        if control_id and control_id in controles_map:
            control = controles_map[control_id]
            codigo_control = control.get("codigo_control")
            dominio_id = control.get("dominio_id")
            if dominio_id and dominio_id in dominios_map:
                nombre_dominio = dominios_map[dominio_id].get("nombre_dominio")
        
        v["codigo_control"] = codigo_control
        v["nombre_dominio"] = nombre_dominio
        
        # Apply dominio/control filters after enrichment
        if dominios_filter and nombre_dominio not in dominios_filter:
            continue
        if controles_filter and codigo_control not in controles_filter:
            continue
        
        result.append(v)
    
    return result

@api_router.get("/vulnerabilidades/{vuln_id}", response_model=Vulnerabilidad)
async def get_vulnerabilidad(vuln_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver vulnerabilidades")
    
    vuln = await db.vulnerabilidades.find_one({"id": vuln_id}, {"_id": 0})
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerabilidad no encontrada")
    return vuln

@api_router.post("/vulnerabilidades/verificar-duplicado")
async def verificar_duplicado_vulnerabilidad(
    vulnerabilidad: str,
    aplicaciones: Optional[str] = None,
    institucion: Optional[str] = None,
    exclude_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Check if a vulnerability with same text, application, and institution already exists"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    
    # Build query - case insensitive comparison
    query = {
        "vulnerabilidad": {"$regex": f"^{regex_module.escape(vulnerabilidad.strip())}$", "$options": "i"}
    }
    
    # Handle nullable fields
    if aplicaciones and aplicaciones.strip():
        query["aplicaciones"] = {"$regex": f"^{regex_module.escape(aplicaciones.strip())}$", "$options": "i"}
    else:
        query["$or"] = [{"aplicaciones": None}, {"aplicaciones": ""}, {"aplicaciones": {"$exists": False}}]
    
    if institucion and institucion.strip():
        if "$or" in query:
            # Need to combine conditions properly
            app_cond = query.pop("$or")
            query["$and"] = [
                {"$or": app_cond},
                {"institucion": {"$regex": f"^{regex_module.escape(institucion.strip())}$", "$options": "i"}}
            ]
        else:
            query["institucion"] = {"$regex": f"^{regex_module.escape(institucion.strip())}$", "$options": "i"}
    
    # Exclude current record if editing
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    
    duplicates = await db.vulnerabilidades.find(query, {"_id": 0, "id": 1, "vulnerabilidad": 1, "aplicaciones": 1, "institucion": 1, "codigo": 1, "fecha_hallazgo": 1}).to_list(5)
    
    return {
        "has_duplicates": len(duplicates) > 0,
        "duplicates": duplicates
    }

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
    
    # Sincronizar estatus basado en resultado de retest
    # Mapeo: Corregido/Desestimado -> Cerrado, Vulnerable/Impedimento -> Pendiente
    if "resultado_re_test" in update_dict:
        resultado_retest = (update_dict.get("resultado_re_test") or "").strip().lower()
        if resultado_retest in ["corregido", "desestimado"]:
            update_dict["estatus"] = "Cerrado"
        elif resultado_retest in ["vulnerable", "impedimento"]:
            update_dict["estatus"] = "Pendiente"
    
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
    incrementar_retest: Optional[int] = None

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
    
    # Handle incrementar_retest separately (uses $inc)
    has_retest_increment = data.incrementar_retest and data.incrementar_retest > 0
    
    if not update_dict and not has_retest_increment:
        raise HTTPException(status_code=400, detail="No se especificaron campos para actualizar")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Build the update operation
    update_operation = {"$set": update_dict}
    if has_retest_increment:
        update_operation["$inc"] = {"veces_en_retest": data.incrementar_retest}
    
    # Update all matching documents
    result = await db.vulnerabilidades.update_many(
        {"id": {"$in": data.ids}},
        update_operation
    )
    
    # Build change description for audit log
    cambios = []
    if data.estatus:
        cambios.append({"campo": "estatus", "valor_anterior": "(múltiple)", "valor_nuevo": data.estatus})
    if data.responsable is not None:
        cambios.append({"campo": "responsable", "valor_anterior": "(múltiple)", "valor_nuevo": data.responsable or "(vacío)"})
    if data.fecha_compromiso is not None:
        cambios.append({"campo": "fecha_compromiso", "valor_anterior": "(múltiple)", "valor_nuevo": data.fecha_compromiso or "(vacío)"})
    if has_retest_increment:
        cambios.append({"campo": "veces_en_retest", "valor_anterior": "(múltiple)", "valor_nuevo": f"+{data.incrementar_retest}"})
    
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

class BulkDeleteRequest(BaseModel):
    ids: List[str]

@api_router.post("/vulnerabilidades/bulk-delete")
async def bulk_delete_vulnerabilidades(
    data: BulkDeleteRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete multiple vulnerabilities at once"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.eliminar:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar vulnerabilidades")
    
    if not data.ids:
        raise HTTPException(status_code=400, detail="No se especificaron vulnerabilidades")
    
    # Get vulnerability names for audit log before deleting
    vulns = await db.vulnerabilidades.find(
        {"id": {"$in": data.ids}},
        {"_id": 0, "vulnerabilidad": 1}
    ).to_list(len(data.ids))
    
    vuln_names = [v.get("vulnerabilidad", "")[:30] for v in vulns[:5]]
    
    # Delete all matching documents
    result = await db.vulnerabilidades.delete_many({"id": {"$in": data.ids}})
    
    # Register in audit log
    await registrar_cambio(
        entidad="vulnerabilidad",
        entidad_id=f"bulk-delete-{len(data.ids)}",
        entidad_nombre=f"Eliminación masiva de {result.deleted_count} vulnerabilidades",
        accion="eliminar",
        usuario_id=current_user.id,
        usuario_nombre=current_user.username,
        cambios=[{"campo": "ejemplos", "valor_anterior": ", ".join(vuln_names), "valor_nuevo": "(eliminados)"}]
    )
    
    return {
        "message": f"Se eliminaron {result.deleted_count} vulnerabilidades",
        "deleted_count": result.deleted_count
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
    request: Request,
    año: Optional[int] = None,
    institucion: Optional[str] = None,
    proveedor: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.dashboard.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
    
    # Get multiple values from query params
    informe_pentest_list = request.query_params.getlist("informe_pentest")
    severidad_list = request.query_params.getlist("severidad")
    
    base_query = {}
    if año:
        base_query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if institucion:
        base_query["institucion"] = institucion
    if informe_pentest_list:
        base_query["nombre_informe_pentest"] = {"$in": informe_pentest_list}
    if severidad_list:
        base_query["severidad"] = {"$in": severidad_list}
    if proveedor:
        base_query["proveedor"] = proveedor
    
    total = await db.vulnerabilidades.count_documents(base_query)
    
    criticas_query = {**base_query, "severidad": "Critica", "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}}
    criticas_abiertas = await db.vulnerabilidades.count_documents(criticas_query)
    
    altas_query = {**base_query, "severidad": "Alta", "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}}
    altas_abiertas = await db.vulnerabilidades.count_documents(altas_query)
    
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
        "altas_abiertas": altas_abiertas,
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
    año: str = None,
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
            
            # Filter by year if specified
            if año and year != año:
                continue
            
            if tipo == "anual":
                periodo = year
            elif tipo == "trimestral":
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
    grupos: str = "",  # comma-separated group IDs
    informes_adicionales: str = "",  # NEW: individual reports to add (without group) in group mode
    agrupar_por: str = "informe",  # "informe" or "grupo"
    severidades: str = "Critica,Alta,Media,Baja",
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Agregación de vulnerabilidades por informe de pentest para vista de comité.
    Retorna pendientes/total por severidad, responsables, y porcentaje de pendientes.
    
    agrupar_por: 
      - "informe": agrupa por informe individual (comportamiento original)
      - "grupo": agrupa por grupo de informes (grupos consolidados + informes adicionales individuales)
    
    informes_adicionales: cuando agrupar_por=grupo, permite añadir informes individuales
                          que no pertenecen a ningún grupo (aparecen como filas separadas)
    """
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver este módulo")
    
    # Parse filters
    informes_list = [i.strip() for i in informes.split(",") if i.strip()] if informes else []
    grupos_list = [g.strip() for g in grupos.split(",") if g.strip()] if grupos else []
    informes_adicionales_list = [i.strip() for i in informes_adicionales.split(",") if i.strip()] if informes_adicionales else []
    severidades_list = [s.strip() for s in severidades.split(",") if s.strip()] if severidades else []
    
    # If grouping by "grupo", expand grupo IDs to their report names
    grupo_to_informes = {}  # Maps grupo_nombre -> list of informes
    
    if agrupar_por == "grupo":
        if grupos_list:
            # Fetch groups and their reports
            grupos_docs = await db.grupos_informes.find(
                {"$or": [{"id": {"$in": grupos_list}}, {"nombre": {"$in": grupos_list}}]},
                {"_id": 0}
            ).to_list(1000)
            
            for g in grupos_docs:
                grupo_to_informes[g["nombre"]] = g.get("informes", [])
                informes_list.extend(g.get("informes", []))
        
        # Add informes_adicionales (they will appear as individual rows)
        if informes_adicionales_list:
            informes_list.extend(informes_adicionales_list)
        
        informes_list = list(set(informes_list))  # Remove duplicates
    
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
    
    # Create reverse mapping: informe -> grupo_nombre
    informe_to_grupo = {}
    if agrupar_por == "grupo":
        for grupo_nombre, grupo_informes in grupo_to_informes.items():
            for inf in grupo_informes:
                informe_to_grupo[inf] = grupo_nombre
    
    # Aggregate by informe or grupo
    from collections import defaultdict
    
    informe_data = defaultdict(lambda: {
        "criticas_pendientes": 0, "criticas_total": 0,
        "altas_pendientes": 0, "altas_total": 0,
        "medias_pendientes": 0, "medias_total": 0,
        "bajas_pendientes": 0, "bajas_total": 0,
        "total_pendientes": 0, "total_hallazgos": 0,
        "responsables": set(),
        "fecha_mas_antigua": None,
        "informes_incluidos": set()
    })
    
    for v in vulns:
        informe = v.get("nombre_informe_pentest", "Sin informe")
        severidad = v.get("severidad", "")
        estatus = v.get("estatus")
        responsable = v.get("responsable")
        fecha_hallazgo = v.get("fecha_hallazgo")
        
        # Determine the aggregation key based on mode
        if agrupar_por == "grupo":
            # Map informe to its group name, or use informe itself if not in any group
            key = informe_to_grupo.get(informe, informe)
        else:
            key = informe
        
        # Track which informes are included in this key
        informe_data[key]["informes_incluidos"].add(informe)
        
        if responsable:
            informe_data[key]["responsables"].add(responsable)
        
        # Track oldest date
        if fecha_hallazgo:
            try:
                current_oldest = informe_data[key]["fecha_mas_antigua"]
                if current_oldest is None or fecha_hallazgo < current_oldest:
                    informe_data[key]["fecha_mas_antigua"] = fecha_hallazgo
            except:
                pass
        
        # Check if pending (not in closed statuses)
        is_pending = estatus not in closed_statuses
        
        # Map severidad to field name
        if severidad == "Critica":
            informe_data[key]["criticas_total"] += 1
            if is_pending:
                informe_data[key]["criticas_pendientes"] += 1
        elif severidad == "Alta":
            informe_data[key]["altas_total"] += 1
            if is_pending:
                informe_data[key]["altas_pendientes"] += 1
        elif severidad == "Media":
            informe_data[key]["medias_total"] += 1
            if is_pending:
                informe_data[key]["medias_pendientes"] += 1
        elif severidad == "Baja":
            informe_data[key]["bajas_total"] += 1
            if is_pending:
                informe_data[key]["bajas_pendientes"] += 1
        
        # Totals (only count if severidad is in the selected list)
        if severidad in ["Critica", "Alta", "Media", "Baja"]:
            informe_data[key]["total_hallazgos"] += 1
            if is_pending:
                informe_data[key]["total_pendientes"] += 1
    
    # Build response
    result = []
    today = datetime.now(timezone.utc).date()
    
    for key in informe_data.keys():
        data = informe_data[key]
        responsables_list = sorted(data["responsables"])
        informes_incluidos = sorted(data["informes_incluidos"])
        
        # Calculate tiempo activo in months
        tiempo_activo_meses = None
        fecha_orden = "9999-12-31"  # Default for sorting (at the end if no date)
        if data["fecha_mas_antigua"]:
            try:
                fecha_str = data["fecha_mas_antigua"]
                fecha_date = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
                months_diff = (today.year - fecha_date.year) * 12 + (today.month - fecha_date.month)
                tiempo_activo_meses = max(0, months_diff)
                fecha_orden = fecha_str[:10]  # ISO date for sorting
            except:
                tiempo_activo_meses = None
        
        result.append({
            "informe": key,
            "es_grupo": agrupar_por == "grupo" and key in grupo_to_informes,
            "informes_incluidos": informes_incluidos if agrupar_por == "grupo" else [],
            "criticas_pendientes": data["criticas_pendientes"],
            "criticas_total": data["criticas_total"],
            "altas_pendientes": data["altas_pendientes"],
            "altas_total": data["altas_total"],
            "medias_pendientes": data["medias_pendientes"],
            "medias_total": data["medias_total"],
            "bajas_pendientes": data["bajas_pendientes"],
            "bajas_total": data["bajas_total"],
            "responsable": " | ".join(responsables_list) if responsables_list else None,
            "total_pendientes": data["total_pendientes"],
            "total_hallazgos": data["total_hallazgos"],
            "tiempo_activo_meses": tiempo_activo_meses,
            "fecha_orden": fecha_orden
        })
    
    # Sort by date: oldest first (ascending)
    result.sort(key=lambda x: x["fecha_orden"])
    
    return result

@api_router.get("/dashboard/kpi-detail")
async def get_kpi_detail(
    request: Request,
    tipo: str,
    año: Optional[int] = None,
    institucion: Optional[str] = None,
    proveedor: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.dashboard.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el dashboard")
    
    # Get multiple values from query params
    informe_pentest_list = request.query_params.getlist("informe_pentest")
    severidad_list = request.query_params.getlist("severidad")
    
    query = {}
    
    if año:
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if institucion:
        query["institucion"] = institucion
    if informe_pentest_list:
        query["nombre_informe_pentest"] = {"$in": informe_pentest_list}
    if severidad_list:
        query["severidad"] = {"$in": severidad_list}
    if proveedor:
        query["proveedor"] = proveedor
    
    if tipo == "criticas_abiertas":
        query["severidad"] = "Critica"
        query["estatus"] = {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    elif tipo == "altas_abiertas":
        query["severidad"] = "Alta"
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
    request: Request,
    filtro: Optional[str] = None,  # "vencidas", "proximas", "todas"
    mes: Optional[str] = None,  # "01" to "12"
    año_compromiso: Optional[str] = None,  # "2024", "2025", etc.
    tipo_fecha: Optional[str] = "con_fecha",  # "con_fecha", "sin_fecha", "todas"
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get vulnerabilities for risk tracking.
    - tipo_fecha: "con_fecha" (only with fecha_compromiso), "sin_fecha" (without), "todas" (all pending)
    - vencidas: past due date, not resolved
    - proximas: due within next 30 days
    - mes/año_compromiso: filter by specific month/year of fecha_compromiso
    """
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver el seguimiento de riesgos")
    
    # Get multi-value params
    severidades = request.query_params.getlist("severidad")
    instituciones = request.query_params.getlist("institucion")
    aplicaciones = request.query_params.getlist("aplicacion")
    informes = request.query_params.getlist("informe_pentest")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_30 = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Base query: not resolved
    query = {
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    }
    
    # Filter by tipo_fecha
    if tipo_fecha == "sin_fecha":
        query["$or"] = [
            {"fecha_compromiso": {"$exists": False}},
            {"fecha_compromiso": None},
            {"fecha_compromiso": ""}
        ]
    elif tipo_fecha == "con_fecha":
        query["fecha_compromiso"] = {"$exists": True, "$nin": [None, ""]}
    # tipo_fecha == "todas" - no fecha_compromiso filter
    
    # Filter by month/year of fecha_compromiso (only applies when tipo_fecha is "con_fecha" or "todas")
    if tipo_fecha != "sin_fecha":
        if mes and mes != "all" and año_compromiso and año_compromiso != "all":
            # Filter by specific month and year (YYYY-MM format)
            prefix = f"{año_compromiso}-{mes}"
            query["fecha_compromiso"] = {"$regex": f"^{prefix}"}
        elif año_compromiso and año_compromiso != "all":
            # Filter by year only
            query["fecha_compromiso"] = {"$regex": f"^{año_compromiso}"}
        elif mes and mes != "all":
            # Filter by month only (any year)
            query["fecha_compromiso"] = {"$regex": f"^\\d{{4}}-{mes}"}
        elif filtro == "vencidas":
            query["fecha_compromiso"] = {"$lt": today, "$nin": [None, ""]}
        elif filtro == "proximas":
            query["$and"] = [
                {"fecha_compromiso": {"$gte": today}},
                {"fecha_compromiso": {"$lte": future_30}}
            ]
    
    if severidades:
        query["severidad"] = {"$in": severidades}
    if instituciones:
        query["institucion"] = {"$in": instituciones}
    if aplicaciones:
        query["aplicaciones"] = {"$in": aplicaciones}
    if informes:
        query["nombre_informe_pentest"] = {"$in": informes}
    
    # Get responsables filter
    responsables = request.query_params.getlist("responsable")
    if responsables:
        query["responsable"] = {"$in": responsables}
    
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
        "fecha_compromiso": {"$exists": True, "$nin": [None, ""]},
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]}
    }
    
    # Count overdue
    vencidas = await db.vulnerabilidades.count_documents({
        **base_query,
        "fecha_compromiso": {"$lt": today, "$nin": [None, ""]}
    })
    
    # Count critical (due within 7 days)
    criticas_query = {
        "fecha_compromiso": {"$exists": True, "$nin": [None, ""]},
        "estatus": {"$nin": ["Cerrado", "Corregido", "Desestimado"]},
        "$and": [
            {"fecha_compromiso": {"$gte": today}},
            {"fecha_compromiso": {"$lte": future_7}}
        ]
    }
    criticas = await db.vulnerabilidades.count_documents(criticas_query)
    
    # Count upcoming (due within 30 days)
    proximas_query = {
        "fecha_compromiso": {"$exists": True, "$nin": [None, ""]},
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
async def export_csv(
    request: Request,
    search: Optional[str] = None,
    año: Optional[str] = None,
    columnas: Optional[str] = None,  # Comma-separated column names
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para exportar")
    
    # Build query with filters
    query = {}
    
    # Get multi-value params
    severidades = request.query_params.getlist("severidad")
    estatus_list = request.query_params.getlist("estatus")
    instituciones = request.query_params.getlist("institucion")
    aplicaciones = request.query_params.getlist("aplicacion")
    informes = request.query_params.getlist("informe_pentest")
    responsables = request.query_params.getlist("responsable")
    
    if severidades:
        query["severidad"] = {"$in": severidades}
    if estatus_list:
        query["estatus"] = {"$in": estatus_list}
    if instituciones:
        query["institucion"] = {"$in": instituciones}
    if aplicaciones:
        query["aplicaciones"] = {"$in": aplicaciones}
    if informes:
        query["nombre_informe_pentest"] = {"$in": informes}
    if responsables:
        query["responsables"] = {"$in": responsables}
    if año and año != "all":
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if search:
        query["$or"] = [
            {"codigo": {"$regex": search, "$options": "i"}},
            {"vulnerabilidad": {"$regex": search, "$options": "i"}},
            {"aplicaciones": {"$regex": search, "$options": "i"}},
            {"responsables": {"$regex": search, "$options": "i"}},
            {"institucion": {"$regex": search, "$options": "i"}}
        ]
    
    vulnerabilidades = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    
    if not vulnerabilidades:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")
    
    # Enrich with dominio, control and riesgo names if needed
    dominio_ids = list(set(v.get("dominio_id") for v in vulnerabilidades if v.get("dominio_id")))
    control_ids = list(set(v.get("control_id") for v in vulnerabilidades if v.get("control_id")))
    riesgo_ids = list(set(v.get("riesgo_id") for v in vulnerabilidades if v.get("riesgo_id")))
    
    dominios_map = {}
    if dominio_ids:
        dominios = await db.config_dominios.find({"id": {"$in": dominio_ids}}, {"_id": 0}).to_list(100)
        dominios_map = {d["id"]: d.get("nombre_dominio", "") for d in dominios}
    
    controles_map = {}
    if control_ids:
        controles = await db.config_controles.find({"id": {"$in": control_ids}}, {"_id": 0}).to_list(100)
        controles_map = {c["id"]: c.get("codigo_control", "") for c in controles}
    
    riesgos_map = {}
    if riesgo_ids:
        riesgos = await db.catalogo_riesgos.find({"id": {"$in": riesgo_ids}}, {"_id": 0}).to_list(200)
        riesgos_map = {r["id"]: r.get("nombre_corto") or r.get("nombre") or r.get("descripcion_completa", "")[:80] for r in riesgos}
    
    # Convert array fields and enrich data for CSV compatibility
    for vuln in vulnerabilidades:
        if isinstance(vuln.get("aplicaciones"), list):
            vuln["aplicaciones"] = " | ".join(vuln["aplicaciones"])
        if isinstance(vuln.get("responsables"), list):
            vuln["responsables"] = " | ".join(vuln["responsables"])
        # Add dominio, control and riesgo names
        if vuln.get("dominio_id"):
            vuln["dominio_nombre"] = dominios_map.get(vuln["dominio_id"], "")
        if vuln.get("control_id"):
            vuln["control_codigo"] = controles_map.get(vuln["control_id"], "")
        if vuln.get("riesgo_id"):
            vuln["riesgo_catalogo"] = riesgos_map.get(vuln["riesgo_id"], "")
    
    df = pd.DataFrame(vulnerabilidades)
    
    # Remove internal columns
    columns_to_remove = ['id', 'created_at', 'updated_at']
    for col in columns_to_remove:
        if col in df.columns:
            df = df.drop(columns=[col])
    
    # Filter columns if specified
    if columnas:
        selected_cols = [c.strip() for c in columnas.split(",")]
        # Map frontend column IDs to backend field names
        column_map = {
            "codigo": "codigo",
            "fecha_hallazgo": "fecha_hallazgo",
            "institucion": "institucion", 
            "aplicaciones": "aplicaciones",
            "vulnerabilidad": "vulnerabilidad",
            "recomendaciones": "recomendaciones",
            "severidad": "severidad",
            "nivel_riesgo": "nivel_riesgo",
            "estatus": "estatus",
            "responsable": "responsable",
            "responsables": "responsables",
            "nombre_informe_pentest": "nombre_informe_pentest",
            "fecha_compromiso": "fecha_compromiso",
            "resultado_re_test": "resultado_re_test",
            "veces_en_retest": "veces_en_retest",
            "riesgo_asociado": "riesgo_asociado",
            "descripcion_riesgo": "descripcion_riesgo",
            "proveedor": "proveedor",
            "dominio": "dominio_nombre",
            "control_asociado": "control_codigo",
            "riesgo_catalogo": "riesgo_catalogo",
        }
        cols_to_keep = [column_map.get(c, c) for c in selected_cols if column_map.get(c, c) in df.columns]
        if cols_to_keep:
            df = df[cols_to_keep]
    
    output = io.StringIO()
    df.to_csv(output, index=False, encoding='utf-8')
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vulnerabilidades.csv"}
    )

@api_router.get("/export/excel")
async def export_excel(
    request: Request,
    search: Optional[str] = None,
    año: Optional[str] = None,
    columnas: Optional[str] = None,  # Comma-separated column names
    current_user: CurrentUser = Depends(get_current_user)
):
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para exportar")
    
    # Build query with filters
    query = {}
    
    # Get multi-value params
    severidades = request.query_params.getlist("severidad")
    estatus_list = request.query_params.getlist("estatus")
    instituciones = request.query_params.getlist("institucion")
    aplicaciones = request.query_params.getlist("aplicacion")
    informes = request.query_params.getlist("informe_pentest")
    responsables = request.query_params.getlist("responsable")
    
    if severidades:
        query["severidad"] = {"$in": severidades}
    if estatus_list:
        query["estatus"] = {"$in": estatus_list}
    if instituciones:
        query["institucion"] = {"$in": instituciones}
    if aplicaciones:
        query["aplicaciones"] = {"$in": aplicaciones}
    if informes:
        query["nombre_informe_pentest"] = {"$in": informes}
    if responsables:
        query["responsables"] = {"$in": responsables}
    if año and año != "all":
        query["fecha_hallazgo"] = {"$regex": f"^{año}"}
    if search:
        query["$or"] = [
            {"codigo": {"$regex": search, "$options": "i"}},
            {"vulnerabilidad": {"$regex": search, "$options": "i"}},
            {"aplicaciones": {"$regex": search, "$options": "i"}},
            {"responsables": {"$regex": search, "$options": "i"}},
            {"institucion": {"$regex": search, "$options": "i"}}
        ]
    
    vulnerabilidades = await db.vulnerabilidades.find(query, {"_id": 0}).to_list(10000)
    
    if not vulnerabilidades:
        raise HTTPException(status_code=404, detail="No hay datos para exportar")
    
    # Enrich with dominio, control and riesgo names if needed
    dominio_ids = list(set(v.get("dominio_id") for v in vulnerabilidades if v.get("dominio_id")))
    control_ids = list(set(v.get("control_id") for v in vulnerabilidades if v.get("control_id")))
    riesgo_ids = list(set(v.get("riesgo_id") for v in vulnerabilidades if v.get("riesgo_id")))
    
    dominios_map = {}
    if dominio_ids:
        dominios = await db.config_dominios.find({"id": {"$in": dominio_ids}}, {"_id": 0}).to_list(100)
        dominios_map = {d["id"]: d.get("nombre_dominio", "") for d in dominios}
    
    controles_map = {}
    if control_ids:
        controles = await db.config_controles.find({"id": {"$in": control_ids}}, {"_id": 0}).to_list(100)
        controles_map = {c["id"]: c.get("codigo_control", "") for c in controles}
    
    riesgos_map = {}
    if riesgo_ids:
        riesgos = await db.catalogo_riesgos.find({"id": {"$in": riesgo_ids}}, {"_id": 0}).to_list(200)
        riesgos_map = {r["id"]: r.get("nombre_corto") or r.get("nombre") or r.get("descripcion_completa", "")[:80] for r in riesgos}
    
    # Convert array fields and enrich data
    for vuln in vulnerabilidades:
        if isinstance(vuln.get("aplicaciones"), list):
            vuln["aplicaciones"] = " | ".join(vuln["aplicaciones"])
        if isinstance(vuln.get("responsables"), list):
            vuln["responsables"] = " | ".join(vuln["responsables"])
        # Add dominio, control and riesgo names
        if vuln.get("dominio_id"):
            vuln["dominio_nombre"] = dominios_map.get(vuln["dominio_id"], "")
        if vuln.get("control_id"):
            vuln["control_codigo"] = controles_map.get(vuln["control_id"], "")
        if vuln.get("riesgo_id"):
            vuln["riesgo_catalogo"] = riesgos_map.get(vuln["riesgo_id"], "")
    
    df = pd.DataFrame(vulnerabilidades)
    
    # Remove internal columns
    columns_to_remove = ['id', 'created_at', 'updated_at']
    for col in columns_to_remove:
        if col in df.columns:
            df = df.drop(columns=[col])
    
    # Filter columns if specified
    if columnas:
        selected_cols = [c.strip() for c in columnas.split(",")]
        # Map frontend column IDs to backend field names
        column_map = {
            "codigo": "codigo",
            "fecha_hallazgo": "fecha_hallazgo",
            "institucion": "institucion", 
            "aplicaciones": "aplicaciones",
            "vulnerabilidad": "vulnerabilidad",
            "recomendaciones": "recomendaciones",
            "severidad": "severidad",
            "nivel_riesgo": "nivel_riesgo",
            "estatus": "estatus",
            "responsable": "responsable",
            "responsables": "responsables",
            "nombre_informe_pentest": "nombre_informe_pentest",
            "fecha_compromiso": "fecha_compromiso",
            "resultado_re_test": "resultado_re_test",
            "veces_en_retest": "veces_en_retest",
            "riesgo_asociado": "riesgo_asociado",
            "descripcion_riesgo": "descripcion_riesgo",
            "proveedor": "proveedor",
            "dominio": "dominio_nombre",
            "control_asociado": "control_codigo",
            "riesgo_catalogo": "riesgo_catalogo",
        }
        cols_to_keep = [column_map.get(c, c) for c in selected_cols if column_map.get(c, c) in df.columns]
        if cols_to_keep:
            df = df[cols_to_keep]
    
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
    
    import re
    
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents))
    
    column_mapping = {
        'Código': 'codigo',
        'Codigo': 'codigo',
        'Fecha Hallazgo': 'fecha_hallazgo',
        'Institución': 'institucion',
        'Aplicación': 'aplicacion',
        'Aplicaciones': 'aplicacion',
        'Vulnerabilidad': 'vulnerabilidad',
        'Recomendaciones': 'recomendaciones',
        'Severidad': 'severidad',
        'Nivel Riesgo': 'nivel_riesgo',
        'Nivel de Riesgo': 'nivel_riesgo',
        'Nivel Riesgo Corporativo': 'nivel_riesgo',
        'Riesgo Asociado': 'riesgo_asociado',
        'Descripción Riesgo': 'descripcion_riesgo',
        'Descripción del Riesgo': 'descripcion_riesgo',
        'Responsable': 'responsable',
        'Fecha Compromiso': 'fecha_compromiso',
        'Estatus': 'estatus',
        'Resultado Re Test': 'resultado_re_test',
        'Veces en Retest': 'veces_en_retest',
        'Veces en Re Test': 'veces_en_retest',
        'Nombre Informe Pentest': 'nombre_informe_pentest',
        'Informe Pentest': 'nombre_informe_pentest',
        'Proveedor': 'proveedor'
    }
    df = df.rename(columns=column_mapping)
    
    records = df.to_dict('records')
    inserted_count = 0
    skipped_duplicates = 0
    catalogs_created = {"instituciones": 0, "aplicaciones": 0, "proveedores": 0, "informes": 0}
    
    for record in records:
        cleaned_record = {}
        for k, v in record.items():
            if pd.isna(v):
                cleaned_record[k] = None
            elif isinstance(v, (datetime, date)):
                cleaned_record[k] = v.strftime('%Y-%m-%d')
            else:
                cleaned_record[k] = str(v)
        
        # Auto-create catalogs if they don't exist (case-insensitive)
        # Institution - Normalize name first
        if cleaned_record.get("institucion"):
            inst_name = cleaned_record["institucion"]
            # Normalize: remove line breaks, normalize spaces
            inst_name = re.sub(r'[\n\r]+', ' ', inst_name)
            inst_name = re.sub(r'\s+', ' ', inst_name).strip()
            cleaned_record["institucion"] = inst_name
            
            existing = await db.instituciones.find_one(
                {"nombre": {"$regex": f"^{re.escape(inst_name)}$", "$options": "i"}}
            )
            if existing:
                cleaned_record["institucion"] = existing["nombre"]
            else:
                inst = Institucion(nombre=inst_name)
                doc = inst.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.instituciones.insert_one(doc)
                catalogs_created["instituciones"] += 1
        
        # Application (single field 'aplicacion' -> convert to list 'aplicaciones')
        # Support multiple apps separated by _, /, or ,
        if cleaned_record.get("aplicacion"):
            app_raw = str(cleaned_record["aplicacion"]).strip()
            # Split by multiple separators: _, /, or comma
            # Use regex to split by any of these separators
            app_names = re.split(r'[_/,]', app_raw)
            app_names = [name.strip() for name in app_names if name.strip()]
            
            cleaned_record["aplicaciones"] = []
            for app_name in app_names:
                existing = await db.aplicaciones.find_one(
                    {"nombre": {"$regex": f"^{re.escape(app_name)}$", "$options": "i"}}
                )
                if existing:
                    if existing["nombre"] not in cleaned_record["aplicaciones"]:
                        cleaned_record["aplicaciones"].append(existing["nombre"])
                else:
                    app = Aplicacion(nombre=app_name)
                    doc = app.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    await db.aplicaciones.insert_one(doc)
                    cleaned_record["aplicaciones"].append(app_name)
                    catalogs_created["aplicaciones"] += 1
            del cleaned_record["aplicacion"]
        
        # Provider
        if cleaned_record.get("proveedor"):
            prov_name = cleaned_record["proveedor"]
            existing = await db.proveedores.find_one(
                {"nombre": {"$regex": f"^{re.escape(prov_name)}$", "$options": "i"}}
            )
            if existing:
                cleaned_record["proveedor"] = existing["nombre"]
            else:
                prov = Proveedor(nombre=prov_name)
                doc = prov.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.proveedores.insert_one(doc)
                catalogs_created["proveedores"] += 1
        
        # Informe Pentest - Normalize name first
        if cleaned_record.get("nombre_informe_pentest"):
            inf_name = cleaned_record["nombre_informe_pentest"]
            # Normalize: remove line breaks, normalize spaces, replace comma-space with underscore
            inf_name = re.sub(r'[\n\r]+', ' ', inf_name)  # Replace line breaks with space
            inf_name = re.sub(r'\s+', ' ', inf_name).strip()  # Normalize multiple spaces
            inf_name = re.sub(r',\s+', '_', inf_name)  # Replace ", " with "_" for consistency
            cleaned_record["nombre_informe_pentest"] = inf_name
            
            existing = await db.informes_pentest.find_one(
                {"nombre": {"$regex": f"^{re.escape(inf_name)}$", "$options": "i"}}
            )
            if existing:
                cleaned_record["nombre_informe_pentest"] = existing["nombre"]
            else:
                informe = InformePentest(nombre=inf_name)
                doc = informe.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.informes_pentest.insert_one(doc)
                catalogs_created["informes"] += 1
        
        # Sincronizar estatus basado en resultado de retest
        # Solo aplicar mapeo si el estatus está vacío o nulo
        # Mapeo: Corregido/Desestimado -> Cerrado, Vulnerable/Impedimento -> Pendiente
        resultado_retest = cleaned_record.get("resultado_re_test", "").strip().lower() if cleaned_record.get("resultado_re_test") else ""
        estatus_actual = cleaned_record.get("estatus", "").strip() if cleaned_record.get("estatus") else ""
        
        # Solo sobrescribir si el estatus está vacío
        if not estatus_actual:
            if resultado_retest in ["corregido", "desestimado"]:
                cleaned_record["estatus"] = "Cerrado"
            elif resultado_retest in ["vulnerable", "impedimento"]:
                cleaned_record["estatus"] = "Pendiente"
        
        # Procesar nivel_riesgo: validar o calcular desde severidad
        nivel_riesgo_raw = cleaned_record.get("nivel_riesgo", "").strip() if cleaned_record.get("nivel_riesgo") else ""
        nivel_riesgo_valid = ["Bajo", "Medio", "Medio Alto", "Alto"]
        
        if nivel_riesgo_raw and nivel_riesgo_raw in nivel_riesgo_valid:
            # Valor válido, mantener
            cleaned_record["nivel_riesgo"] = nivel_riesgo_raw
        else:
            # Calcular desde severidad como fallback
            severidad = cleaned_record.get("severidad", "").strip() if cleaned_record.get("severidad") else ""
            nivel_riesgo_map = {
                "Critica": "Alto",
                "Alta": "Medio Alto", 
                "Media": "Medio",
                "Baja": "Bajo"
            }
            cleaned_record["nivel_riesgo"] = nivel_riesgo_map.get(severidad, None)
        
        # Check for duplicates before inserting
        vuln_text = cleaned_record.get("vulnerabilidad", "").strip()
        app_text = cleaned_record.get("aplicaciones", "").strip() if cleaned_record.get("aplicaciones") else ""
        inst_text = cleaned_record.get("institucion", "").strip() if cleaned_record.get("institucion") else ""
        
        if vuln_text and app_text and inst_text:
            duplicate = await db.vulnerabilidades.find_one({
                "vulnerabilidad": {"$regex": f"^{regex_module.escape(vuln_text)}$", "$options": "i"},
                "aplicaciones": {"$regex": f"^{regex_module.escape(app_text)}$", "$options": "i"},
                "institucion": {"$regex": f"^{regex_module.escape(inst_text)}$", "$options": "i"}
            })
            if duplicate:
                skipped_duplicates += 1
                continue
        
        vuln = Vulnerabilidad(**cleaned_record)
        doc = vuln.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.vulnerabilidades.insert_one(doc)
        inserted_count += 1
    
    catalog_msg = []
    if catalogs_created["instituciones"]:
        catalog_msg.append(f"{catalogs_created['instituciones']} instituciones")
    if catalogs_created["aplicaciones"]:
        catalog_msg.append(f"{catalogs_created['aplicaciones']} aplicaciones")
    if catalogs_created["proveedores"]:
        catalog_msg.append(f"{catalogs_created['proveedores']} proveedores")
    if catalogs_created["informes"]:
        catalog_msg.append(f"{catalogs_created['informes']} informes")
    
    msg = f"Se importaron {inserted_count} registros exitosamente"
    if skipped_duplicates > 0:
        msg += f". Se omitieron {skipped_duplicates} duplicados"
    if catalog_msg:
        msg += f". Se crearon: {', '.join(catalog_msg)}"
    
    return {"message": msg, "inserted": inserted_count, "skipped_duplicates": skipped_duplicates, "catalogs_created": catalogs_created}

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
    nivel_riesgo: Optional[str] = None  # "Alto", "Medio Alto", "Medio", "Bajo"
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
    nivel_riesgo: Optional[NivelRiesgoGRC] = None  # "Alto", "Medio Alto", "Medio", "Bajo"
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
        
        # System message for extraction
        system_message = """Eres un experto en ciberseguridad y gestión de riesgos corporativos que analiza informes de pruebas de penetración (pentest).
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
            "nivel_riesgo": "Alto|Medio Alto|Medio|Bajo",
            "activos_tecnicos": ["servidores", "IPs", "URLs afectados"],
            "descripcion": "descripción detallada de la vulnerabilidad",
            "impacto": "impacto de la vulnerabilidad",
            "recomendaciones": "recomendaciones para remediar"
        }
    ]
}

Reglas IMPORTANTES:
- La fecha debe estar en formato YYYY-MM-DD
- La severidad técnica debe ser exactamente: Critica, Alta, Media o Baja
- El nivel_riesgo corporativo debe ser ESTRICTAMENTE uno de estos 4 valores: "Alto", "Medio Alto", "Medio", "Bajo"
  * "Alto" = Vulnerabilidades que pueden causar daño crítico al negocio, pérdida financiera significativa, o exposición de datos sensibles
  * "Medio Alto" = Vulnerabilidades que representan un riesgo importante pero con algún factor mitigante
  * "Medio" = Vulnerabilidades que requieren atención pero no representan un riesgo inmediato
  * "Bajo" = Vulnerabilidades menores o informativas con bajo impacto al negocio
- Si el informe no especifica nivel_riesgo, infiere basándote en la severidad: Critica→Alto, Alta→Medio Alto, Media→Medio, Baja→Bajo
- Extrae TODAS las vulnerabilidades del informe
- "aplicacion_evaluada" es el SISTEMA o APLICACIÓN principal que se evaluó en el pentest (ej: SWIFT, SAP, Active Directory, Portal Web, etc.)
- "activos_tecnicos" son los SERVIDORES, IPs, URLs o hosts específicos donde se encontró la vulnerabilidad. NO son aplicaciones.
- NO confundas servidores (SERTERPRD05.cfbhd.com) con aplicaciones (SWIFT). Los servidores van en activos_tecnicos."""

        user_prompt = f"Analiza el siguiente informe de pentest y extrae la información en formato JSON:\n\n{full_text}"
        
        # Try to use emergentintegrations first (Emergent platform)
        # If not available, fall back to OpenAI directly (local installation)
        response_text = None
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            llm_key = os.environ.get('EMERGENT_LLM_KEY')
            if not llm_key:
                raise ImportError("EMERGENT_LLM_KEY not configured")
            
            chat = LlmChat(
                api_key=llm_key,
                session_id=f"pdf-extract-{uuid.uuid4()}",
                system_message=system_message
            ).with_model("openai", "gpt-4.1-mini")
            
            user_message = UserMessage(text=user_prompt)
            response_text = await chat.send_message(user_message)
            
        except ImportError:
            # Fall back to OpenAI directly for local installations
            import openai
            
            openai_key = os.environ.get('OPENAI_API_KEY')
            if not openai_key:
                raise HTTPException(
                    status_code=500, 
                    detail="Para usar la importación de PDF con IA en instalación local, configure OPENAI_API_KEY en el archivo .env"
                )
            
            client = openai.AsyncOpenAI(api_key=openai_key)
            
            completion = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )
            
            response_text = completion.choices[0].message.content
        
        # Parse JSON response
        import json
        import re
        
        # Clean response - remove markdown code blocks if present
        response_text = response_text.strip()
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



@api_router.post("/import/pdf/extract-rules")
async def extract_vulnerabilities_from_pdf_rules(
    file: UploadFile = File(...),
    parser_type: str = "pentraze",
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Extract vulnerabilities from a PDF using rule-based parser (no AI required).
    Currently supports: pentraze (Pentraze Cybersecurity reports)
    """
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.crear:
        raise HTTPException(status_code=403, detail="No tiene permisos para importar")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser PDF")
    
    try:
        contents = await file.read()
        
        if parser_type == "pentraze":
            from pdf_parsers.pentraze_parser import parse_pentraze_pdf
            result = parse_pentraze_pdf(contents)
        else:
            raise HTTPException(status_code=400, detail=f"Parser '{parser_type}' no soportado. Disponibles: pentraze")
        
        if not result.get('vulnerabilities'):
            raise HTTPException(
                status_code=400, 
                detail="No se encontraron vulnerabilidades en el PDF. Verifique que el formato sea compatible."
            )
        
        return {
            "success": True,
            "parser_used": result.get('parser', parser_type),
            "metadata": result.get('metadata', {}),
            "vulnerabilities": result.get('vulnerabilities', []),
            "total": result.get('total', 0),
            "message": f"Se extrajeron {result.get('total', 0)} vulnerabilidades usando parser '{parser_type}'"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PDF rules extraction error: {e}")
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
    
    # Calcular nivel_riesgo si no viene especificado
    nivel_riesgo_final = data.nivel_riesgo
    if not nivel_riesgo_final:
        nivel_riesgo_map = {
            "Critica": "Alto",
            "Alta": "Medio Alto",
            "Media": "Medio",
            "Baja": "Bajo"
        }
        nivel_riesgo_final = nivel_riesgo_map.get(data.severidad)
    
    vuln = Vulnerabilidad(
        fecha_hallazgo=data.fecha_hallazgo,
        institucion=final_institucion,
        aplicaciones=final_aplicaciones if final_aplicaciones else data.aplicaciones,
        vulnerabilidad=data.vulnerabilidad,
        descripcion_riesgo=data.descripcion_riesgo,
        recomendaciones=data.recomendaciones,
        severidad=data.severidad,
        nivel_riesgo=nivel_riesgo_final,
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
    for est in ["Pendiente", "En Proceso", "Para Re Test", "Corregido", "Cerrado"]:
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
    severidades: str = "Critica,Alta,Media,Baja",
    current_user: CurrentUser = Depends(get_current_user)
):
    """Generate Vista Comité PDF report with selected informes and severidades"""
    if not current_user.es_admin and not current_user.permisos.vulnerabilidades.ver:
        raise HTTPException(status_code=403, detail="No tiene permisos para generar reportes")
    
    informes_list = [i.strip() for i in informes.split(",") if i.strip()] if informes else []
    severidades_list = [s.strip() for s in severidades.split(",") if s.strip()] if severidades else ["Critica", "Alta", "Media", "Baja"]
    
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
            "responsable": " | ".join(responsables_list) if responsables_list else None,
            "total_pendientes": data["total_pendientes"],
            "total_hallazgos": data["total_hallazgos"],
            "tiempo_activo_meses": tiempo_activo_meses
        })
    
    pdf_buffer = generate_vista_comite_report(result, severidades=severidades_list)
    
    filename = f"vista_comite_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Initialize and register GRC module routers
def setup_grc_routers():
    """Setup GRC routers with database connection and dependencies"""
    # Create routers using factory functions
    dominios_router = create_dominios_router(db, get_current_user)
    controles_router = create_controles_router(db, get_current_user)
    catalogo_riesgos_router = create_catalogo_riesgos_router(db, get_current_user)
    hallazgos_router = create_hallazgos_router(db, get_current_user)
    dashboard_grc_router = create_dashboard_router(db, get_current_user)
    vista_comite_router = create_vista_comite_router(db, get_current_user, CurrentUser)
    
    # Register routers with api_router
    api_router.include_router(dominios_router)
    api_router.include_router(controles_router)
    api_router.include_router(catalogo_riesgos_router)
    api_router.include_router(hallazgos_router)
    api_router.include_router(dashboard_grc_router)
    api_router.include_router(vista_comite_router)

setup_grc_routers()

# Include the router in the main app (AFTER adding GRC routers)
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
    await migrate_nivel_riesgo()  # Migrate nivel_riesgo for "Primera emulación" 2024 or earlier
    await init_admin_user()
    await init_grc_data()  # Initialize GRC seed data

async def init_grc_data():
    """Initialize GRC seed data (dominios and controles) if not exists"""
    import uuid as uuid_mod
    
    # Check if dominios exist
    existing_dominios = await db.config_dominios.count_documents({})
    if existing_dominios == 0:
        # Seed dominios
        DOMINIOS = [
            {"nombre_dominio": "Gestión de Identidades", "codigo_referencia": "DOM-ID"},
            {"nombre_dominio": "Seguridad EndPoints", "codigo_referencia": "DOM-EP"},
            {"nombre_dominio": "Seguridad de Red y Perímetro", "codigo_referencia": "DOM-NET"},
            {"nombre_dominio": "Seguridad de Aplicaciones", "codigo_referencia": "DOM-APP"},
            {"nombre_dominio": "Seguridad de Datos", "codigo_referencia": "DOM-DAT"},
            {"nombre_dominio": "Gestión de Monitoreo & Respuesta", "codigo_referencia": "DOM-MON"},
        ]
        
        dominio_docs = []
        for d in DOMINIOS:
            dominio_docs.append({
                "id": str(uuid_mod.uuid4()),
                "nombre_dominio": d["nombre_dominio"],
                "codigo_referencia": d["codigo_referencia"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        await db.config_dominios.insert_many(dominio_docs)
        logger.info(f"Created {len(dominio_docs)} initial dominios")
        
        # Seed controles for Seguridad EndPoints
        dominio_ep = await db.config_dominios.find_one({"nombre_dominio": "Seguridad EndPoints"}, {"_id": 0})
        if dominio_ep:
            CONTROLES = [
                {"codigo_control": "CTRL-EP-01", "nombre_control": "Protección del endpoint (EDR/EPP + postura)"},
                {"codigo_control": "CTRL-EP-02", "nombre_control": "Gestión de vulnerabilidades y parches (endpoints)"},
                {"codigo_control": "CTRL-EP-03", "nombre_control": "Configuración segura (Baseline/Hardening)"},
                {"codigo_control": "CTRL-EP-04", "nombre_control": "Protección de datos (Cifrado)"},
            ]
            
            control_docs = []
            for c in CONTROLES:
                control_docs.append({
                    "id": str(uuid_mod.uuid4()),
                    "dominio_id": dominio_ep["id"],
                    "codigo_control": c["codigo_control"],
                    "nombre_control": c["nombre_control"],
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            await db.config_controles.insert_many(control_docs)
            logger.info(f"Created {len(control_docs)} initial controles for 'Seguridad EndPoints'")
    
    # Migration: Rename riesgo_asociado -> riesgo_id
    count_old = await db.vulnerabilidades.count_documents({"riesgo_asociado": {"$exists": True}})
    if count_old > 0:
        result = await db.vulnerabilidades.update_many(
            {"riesgo_asociado": {"$exists": True}},
            {"$rename": {"riesgo_asociado": "riesgo_id"}}
        )
        logger.info(f"Migrated {result.modified_count} vulnerabilidades: riesgo_asociado -> riesgo_id")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
