"""
GRC Models - Governance, Risk, and Compliance
Pydantic models for Dominios, Controles, Catálogo de Riesgos, and Hallazgos de Auditoría
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


# ============ ENUMS ============

class EstadoHallazgo(str, Enum):
    ABIERTO = "Abierto"
    EN_PROCESO = "En Proceso"
    LISTO_REVISION = "Listo para Revisión"
    CERRADO = "Cerrado"


# ============ DOMINIOS ============

class DominioBase(BaseModel):
    nombre_dominio: str
    codigo_referencia: Optional[str] = None

class DominioCreate(DominioBase):
    pass

class DominioUpdate(BaseModel):
    nombre_dominio: Optional[str] = None
    codigo_referencia: Optional[str] = None

class Dominio(DominioBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============ CONTROLES ============

class ControlBase(BaseModel):
    dominio_id: str
    codigo_control: Optional[str] = None
    nombre_control: str

class ControlCreate(ControlBase):
    pass

class ControlUpdate(BaseModel):
    dominio_id: Optional[str] = None
    codigo_control: Optional[str] = None
    nombre_control: Optional[str] = None

class Control(ControlBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============ CATÁLOGO DE RIESGOS ============

class RiesgoCatalogoBase(BaseModel):
    codigo_riesgo: str
    nombre_corto: str  # Para UI, selectores y búsquedas
    descripcion_completa: Optional[str] = None  # Texto largo explicativo

class RiesgoCatalogoCreate(RiesgoCatalogoBase):
    pass

class RiesgoCatalogoUpdate(BaseModel):
    codigo_riesgo: Optional[str] = None
    nombre_corto: Optional[str] = None
    descripcion_completa: Optional[str] = None

class RiesgoCatalogo(RiesgoCatalogoBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============ HALLAZGOS DE AUDITORÍA ============

class HallazgoAuditoriaBase(BaseModel):
    codigo: str  # Ej: AUD-2026-001
    control_id: Optional[str] = None  # FK a config_controles
    brecha: str  # Descripción de la deficiencia encontrada
    riesgo_id: Optional[str] = None  # FK a catalogo_riesgos
    probabilidad: int = Field(ge=1, le=4, default=1)  # 1=Bajo, 2=Medio, 3=Medio-Alto, 4=Alto
    impacto: int = Field(ge=1, le=4, default=1)  # 1=Bajo, 2=Medio, 3=Medio-Alto, 4=Alto
    estado: EstadoHallazgo = EstadoHallazgo.ABIERTO
    responsable: Optional[str] = None  # Nombre del responsable (del catálogo)
    fecha_hallazgo: Optional[str] = None  # Fecha de identificación (DD-MM-YYYY)
    fecha_compromiso: Optional[str] = None  # Fecha límite de remediación (DD-MM-YYYY)
    fecha_cierre: Optional[str] = None  # Fecha cuando se cerró el hallazgo
    observaciones: Optional[str] = None

class HallazgoAuditoriaCreate(HallazgoAuditoriaBase):
    pass

class HallazgoAuditoriaUpdate(BaseModel):
    codigo: Optional[str] = None
    control_id: Optional[str] = None
    brecha: Optional[str] = None
    riesgo_id: Optional[str] = None
    probabilidad: Optional[int] = Field(default=None, ge=1, le=4)
    impacto: Optional[int] = Field(default=None, ge=1, le=4)
    estado: Optional[EstadoHallazgo] = None
    responsable: Optional[str] = None
    fecha_hallazgo: Optional[str] = None
    fecha_compromiso: Optional[str] = None
    fecha_cierre: Optional[str] = None
    observaciones: Optional[str] = None

class HallazgoAuditoria(HallazgoAuditoriaBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    riesgo_inherente: int = 0  # Calculado: probabilidad * impacto
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    def __init__(self, **data):
        super().__init__(**data)
        # Auto-calculate riesgo_inherente
        self.riesgo_inherente = self.probabilidad * self.impacto

    def calcular_riesgo_inherente(self):
        self.riesgo_inherente = self.probabilidad * self.impacto
        return self.riesgo_inherente
