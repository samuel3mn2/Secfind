"""Seed/Cleanup temporal de backup_logs para pruebas UI de historial (iteration 35)."""

import argparse
import gzip
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import dotenv_values
from pymongo import MongoClient


PREFIX = "TEST_BACKUP_HISTORY_UI_"
TZ_SD = ZoneInfo("America/Santo_Domingo")


def get_db():
    env = dotenv_values("/app/backend/.env")
    client = MongoClient(env["MONGO_URL"])
    return client, client[env["DB_NAME"]]


def seed():
    client, db = get_db()
    try:
        docs = []
        base = datetime(2026, 2, 20, 9, 0, tzinfo=TZ_SD)
        estados = ["exitoso", "fallido", "en_progreso"]
        destinos = ["local", "google_drive", "ambos"]

        for i in range(18):
            dt = base + timedelta(hours=i)
            estado = estados[i % len(estados)]
            destino = destinos[i % len(destinos)]
            docs.append(
                {
                    "id": f"{PREFIX}{i:02d}",
                    "fecha": dt.astimezone(timezone.utc).isoformat(),
                    "estado": estado,
                    "destino": destino,
                    "ruta_local": f"/tmp/{PREFIX}{i:02d}.gz" if destino != "google_drive" else None,
                    "google_drive_file_id": f"ui_gd_{i}" if destino != "local" else None,
                    "tamaño": 1024 + i,
                    "tamaño_humano": "1.00 KB",
                    "duracion_segundos": 1.5,
                }
            )

        file_path = Path(f"/tmp/{PREFIX}DOWNLOAD.gz")
        with gzip.open(file_path, "wb") as f:
            f.write(b"ui download test")

        docs.append(
            {
                "id": f"{PREFIX}DOWNLOAD",
                "fecha": datetime(2026, 2, 21, 12, 0, tzinfo=TZ_SD).astimezone(timezone.utc).isoformat(),
                "estado": "exitoso",
                "destino": "local",
                "ruta_local": str(file_path),
                "tamaño": file_path.stat().st_size,
                "tamaño_humano": "0.10 KB",
                "duracion_segundos": 0.8,
            }
        )

        # Registro futuro para eliminación aislada
        docs.append(
            {
                "id": f"{PREFIX}FUTURE_DELETE",
                "fecha": datetime(2027, 5, 1, 0, 0, tzinfo=TZ_SD).astimezone(timezone.utc).isoformat(),
                "estado": "fallido",
                "destino": "ambos",
                "ruta_local": f"/tmp/{PREFIX}FUTURE_DELETE.gz",
                "tamaño": 555,
                "tamaño_humano": "0.54 KB",
                "duracion_segundos": 2.3,
                "error": "UI test record",
            }
        )

        db.backup_logs.insert_many(docs)
        print(f"Seeded {len(docs)} backup_logs with prefix {PREFIX}")
    finally:
        client.close()


def cleanup():
    client, db = get_db()
    try:
        result = db.backup_logs.delete_many({"id": {"$regex": f"^{PREFIX}"}})
        for p in Path("/tmp").glob(f"{PREFIX}*.gz"):
            p.unlink(missing_ok=True)
        print(f"Deleted {result.deleted_count} backup_logs with prefix {PREFIX}")
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["seed", "cleanup"])
    args = parser.parse_args()

    if args.action == "seed":
        seed()
    else:
        cleanup()
