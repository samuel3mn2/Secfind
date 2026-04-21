# Guía de Instalación con Docker

Esta guía te ayudará a instalar SecFind usando Docker, la forma más rápida y sencilla de desplegar la aplicación.

---

## Requisitos Previos

### Instalar Docker

#### Windows
1. Descarga [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/)
2. Ejecuta el instalador
3. Reinicia tu computadora
4. Abre Docker Desktop y espera a que inicie

#### Mac
1. Descarga [Docker Desktop para Mac](https://www.docker.com/products/docker-desktop/)
2. Arrastra Docker a la carpeta Aplicaciones
3. Abre Docker desde Aplicaciones
4. Espera a que el icono de Docker en la barra de menú indique "Docker Desktop is running"

#### Linux (Ubuntu/Debian)
```bash
# Actualizar paquetes
sudo apt update

# Instalar dependencias
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Agregar clave GPG de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Agregar repositorio de Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Agregar usuario al grupo docker (para no usar sudo)
sudo usermod -aG docker $USER

# Reiniciar sesión o ejecutar:
newgrp docker
```

### Verificar instalación
```bash
docker --version
docker compose version
```

---

## Instalación Rápida (5 minutos)

### Paso 1: Descargar el proyecto
```bash
git clone <url-del-repositorio>
cd secfind
```

### Paso 2: Crear archivo docker-compose.yml
Crea un archivo `docker-compose.yml` en la raíz del proyecto:

```yaml
version: '3.8'

services:
  # Base de datos MongoDB
  mongodb:
    image: mongo:7
    container_name: secfind-mongodb
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    networks:
      - secfind-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API (FastAPI)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: secfind-backend
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=secfind_db
      - CORS_ORIGINS=http://localhost:3000,http://localhost
      # Opcional: Para importación de PDF con IA
      # - EMERGENT_LLM_KEY=tu-api-key-aqui
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - secfind-network
    healthcheck:
      test: curl -f http://localhost:8001/health || exit 1
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend (React)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - REACT_APP_BACKEND_URL=http://localhost:8001
    container_name: secfind-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - secfind-network

networks:
  secfind-network:
    driver: bridge

volumes:
  mongo_data:
    driver: local
```

### Paso 3: Crear Dockerfile del Backend
Crea el archivo `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 8001

# Comando para iniciar el servidor
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Paso 4: Crear Dockerfile del Frontend
Crea el archivo `frontend/Dockerfile`:

```dockerfile
# Etapa de construcción
FROM node:20-alpine as build

WORKDIR /app

# Copiar package.json y yarn.lock
COPY package.json yarn.lock ./

# Instalar dependencias
RUN yarn install --frozen-lockfile

# Copiar código fuente
COPY . .

# Argumento para la URL del backend
ARG REACT_APP_BACKEND_URL=http://localhost:8001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Construir la aplicación
RUN yarn build

# Etapa de producción con Nginx
FROM nginx:alpine

# Copiar la configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos construidos
COPY --from=build /app/build /usr/share/nginx/html

# Exponer puerto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Paso 5: Crear configuración de Nginx
Crea el archivo `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Compresión gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Caché para archivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router - redirigir todas las rutas a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para API (opcional si usas el mismo dominio)
    location /api {
        proxy_pass http://backend:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Paso 6: Iniciar los contenedores
```bash
# Construir e iniciar todos los servicios
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f

# Ver estado de los contenedores
docker compose ps
```

### Paso 7: Acceder a la aplicación
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **Documentación API**: http://localhost:8001/docs

### Credenciales por defecto
- **Usuario**: `admin`
- **Contraseña**: `admin123`

---

## Comandos Útiles

### Gestión de contenedores
```bash
# Iniciar servicios
docker compose up -d

# Detener servicios
docker compose down

# Reiniciar un servicio específico
docker compose restart backend

# Ver logs de un servicio
docker compose logs -f backend

# Ver logs de todos los servicios
docker compose logs -f
```

### Mantenimiento
```bash
# Reconstruir imágenes (después de cambios en código)
docker compose up -d --build

# Limpiar imágenes no utilizadas
docker image prune -f

# Ver uso de espacio
docker system df

# Limpiar todo (¡CUIDADO! borra volúmenes)
docker system prune -a --volumes
```

### Base de datos
```bash
# Acceder a MongoDB
docker exec -it secfind-mongodb mongosh

# Backup de la base de datos
docker exec secfind-mongodb mongodump --out=/data/backup
docker cp secfind-mongodb:/data/backup ./backup

# Restaurar backup
docker cp ./backup secfind-mongodb:/data/backup
docker exec secfind-mongodb mongorestore /data/backup
```

---

## Configuración Avanzada

### Variables de Entorno

#### Backend (.env o docker-compose.yml)
| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGO_URL` | URL de conexión a MongoDB | `mongodb://mongodb:27017` |
| `DB_NAME` | Nombre de la base de datos | `secfind_db` |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) | `http://localhost:3000` |
| `EMERGENT_LLM_KEY` | API key para importación PDF con IA | `sk-emergent-xxx` |

#### Frontend (build args)
| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | URL del backend | `http://localhost:8001` |

### Configuración de Notificaciones por Email

Para habilitar las notificaciones por email, configura tu cuenta SMTP desde la interfaz:

1. Ve a **Configuración > Notificaciones**
2. Ingresa los datos de tu servidor SMTP:
   - **Gmail**: smtp.gmail.com, puerto 587, TLS habilitado
   - **Outlook**: smtp.office365.com, puerto 587, TLS habilitado
3. Para Gmail, necesitas una **App Password** (no tu contraseña normal)
4. Prueba la conexión antes de guardar

---

## Despliegue en Producción

### Con dominio personalizado

Modifica `docker-compose.yml`:

```yaml
services:
  frontend:
    build:
      args:
        - REACT_APP_BACKEND_URL=https://api.tu-dominio.com
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl  # Certificados SSL
```

### Con Traefik (HTTPS automático)

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=tu@email.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"
    networks:
      - secfind-network

  backend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`api.tu-dominio.com`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=myresolver"

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`tu-dominio.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"
```

---

## Solución de Problemas

### El backend no conecta a MongoDB
```bash
# Verificar que MongoDB está corriendo
docker compose ps

# Ver logs de MongoDB
docker compose logs mongodb

# Reiniciar MongoDB
docker compose restart mongodb
```

### Error de permisos en volúmenes (Linux)
```bash
# Dar permisos al directorio
sudo chown -R 1000:1000 ./data

# O usar volúmenes nombrados (recomendado)
volumes:
  mongo_data:
    driver: local
```

### La aplicación es muy lenta
```bash
# Aumentar recursos en Docker Desktop:
# Settings > Resources > Advanced
# - CPUs: 4
# - Memory: 4 GB
```

### Limpiar y empezar de cero
```bash
# Detener todo y eliminar volúmenes
docker compose down -v

# Eliminar imágenes
docker compose down --rmi all

# Reconstruir todo
docker compose up -d --build
```

---

## Estructura de Archivos Docker

```
secfind/
├── docker-compose.yml          # Orquestación de servicios
├── backend/
│   ├── Dockerfile              # Imagen del backend
│   ├── server.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── Dockerfile              # Imagen del frontend
│   ├── nginx.conf              # Configuración de Nginx
│   ├── package.json
│   └── ...
└── data/                       # Volúmenes (opcional, para bind mounts)
    └── mongodb/
```

---

## Próximos Pasos

1. **Cambiar la contraseña del admin** desde Configuración > Usuarios
2. **Configurar notificaciones** por email si las necesitas
3. **Importar tus datos** desde Excel o CSV
4. **Configurar catálogos** (instituciones, aplicaciones, proveedores)

---

**¡Listo!** Tu instancia de SecFind está corriendo en Docker.
