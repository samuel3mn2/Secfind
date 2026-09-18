"""Consulta paginada del historial; no modifica registros ni archivos de backup."""
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel


class BackupLog(BaseModel):
    id: str
    fecha: str
    estado: str
    destino: str
    ruta_local: Optional[str] = None
    google_drive_file_id: Optional[str] = None
    tamaño: Optional[int] = None
    tamaño_humano: Optional[str] = None
    duracion_segundos: Optional[float] = None
    error: Optional[str] = None
    error_google_drive: Optional[str] = None


class BackupHistoryPage(BaseModel):
    items: List[BackupLog]
    total: int
    pagina: int
    limite: int
    total_paginas: int


def utc_iso(value: datetime) -> str:
    return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()


async def ensure_history_indexes(db):
    # Orden estable incluso cuando varios backups comparten la misma fecha.
    for fields in [[], [("estado", 1)], [("destino", 1)], [("estado", 1), ("destino", 1)]]:
        await db.backup_logs.create_index(fields + [("fecha", -1), ("id", -1)])


async def get_history_page(db, pagina, limite, estado=None, destino=None,
                           fecha_desde=None, fecha_hasta=None):
    query = {}
    if estado:
        query["estado"] = estado
    if destino:
        query["destino"] = destino
    if fecha_desde or fecha_hasta:
        query["fecha"] = {}
        if fecha_desde:
            query["fecha"]["$gte"] = utc_iso(fecha_desde)
        if fecha_hasta:
            # Límite exclusivo: el cliente envía el inicio del día siguiente.
            query["fecha"]["$lt"] = utc_iso(fecha_hasta)

    total = await db.backup_logs.count_documents(query)
    total_paginas = max(1, (total + limite - 1) // limite)
    pagina = min(pagina, total_paginas)
    items = await db.backup_logs.find(query, {"_id": 0}).sort(
        [("fecha", -1), ("id", -1)]
    ).skip((pagina - 1) * limite).limit(limite).to_list(length=limite)
    return BackupHistoryPage(items=items, total=total, pagina=pagina,
                             limite=limite, total_paginas=total_paginas)