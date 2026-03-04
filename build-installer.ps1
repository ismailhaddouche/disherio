$ErrorActionPreference = "Stop"

$VERSION = "2.0.0"
$INSTALLER_DIR = "disher-installer"
$ARCHIVE_NAME = "disher-setup-v$VERSION.tar.gz"

Write-Host "--- Iniciando Empaquetado de Disher.io v$VERSION ---" -ForegroundColor Cyan

# 1. Cleanup
if (Test-Path $INSTALLER_DIR) { Remove-Item -Recurse -Force $INSTALLER_DIR }
if (Test-Path $ARCHIVE_NAME) { Remove-Item -Force $ARCHIVE_NAME }

New-Item -ItemType Directory -Force -Path $INSTALLER_DIR | Out-Null

# 2. Build Images
Write-Host "`n[1/4] Construyendo Imagenes Docker..." -ForegroundColor Blue
docker compose build
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo en docker compose build"; exit }

# 3. Pull external images and export all to tar
Write-Host "`n[2/4] Descargando y exportando imagenes (Esto puede tardar)..." -ForegroundColor Blue
docker pull mongo:7
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo al descargar mongo:7"; exit }
docker pull caddy:2
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo al descargar caddy:2"; exit }
docker save -o "$INSTALLER_DIR/images.tar" disher-backend:latest disher-frontend:latest mongo:7 caddy:2
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo al exportar imagenes"; exit }

# 4. Generate Production Compose File
Write-Host "`n[3/4] Generando configuracion de produccion..." -ForegroundColor Blue
$composeContent = @"
services:
  database:
    image: mongo:7
    container_name: disher-db
    restart: always
    volumes:
      - mongo-data:/data/db
    networks:
      - disher-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  backend:
    image: disher-backend:latest
    container_name: disher-backend
    restart: always
    environment:
      - MONGODB_URI=mongodb://database:27017/disher
      - PORT=3000
      - NODE_ENV=production
      - DOMAIN=`${DOMAIN}
      - INSTALL_MODE=`${INSTALL_MODE:-local}
      - JWT_SECRET=`${JWT_SECRET}
    depends_on:
      database:
        condition: service_healthy
    networks:
      - disher-network
    healthcheck:
      test: ["CMD", "node", "-e", "const http=require('http');const r=http.get('http://localhost:3000/api/health',s=>{process.exit(s.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s

  frontend:
    image: disher-frontend:latest
    container_name: disher-frontend
    restart: always
    networks:
      - disher-network

  caddy:
    image: caddy:2
    container_name: disher-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN=`${DOMAIN}
      - INSTALL_MODE=`${INSTALL_MODE:-local}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      frontend:
        condition: service_started
      backend:
        condition: service_healthy
    networks:
      - disher-network

networks:
  disher-network:
    driver: bridge

volumes:
  mongo-data:
  caddy-data:
  caddy-config:
"@
Set-Content -Path "$INSTALLER_DIR/docker-compose.yml" -Value $composeContent -Encoding UTF8

# 5. Copy Scripts & Configs
Write-Host "`n[4/4] Copiando scripts y archivos de configuracion..." -ForegroundColor Blue
Copy-Item "install.sh" -Destination $INSTALLER_DIR
Copy-Item "configure.sh" -Destination $INSTALLER_DIR
Copy-Item "check-ip.sh" -Destination $INSTALLER_DIR
Copy-Item "Caddyfile" -Destination $INSTALLER_DIR

# 6. Compress using tar
Write-Host "`nComprimiendo instalador..." -ForegroundColor Blue
tar -czvf $ARCHIVE_NAME -C $INSTALLER_DIR .

Write-Host "`nEmpaquetado Completado!" -ForegroundColor Green
Write-Host "Archivo generado: $ARCHIVE_NAME" -ForegroundColor Green
$size = [math]::Round((Get-Item $ARCHIVE_NAME).Length / 1MB, 2)
Write-Host "Tamano: $size MB"
Write-Host "`nInstrucciones para el Cliente:"
Write-Host "1. Enviar '$ARCHIVE_NAME' al servidor del cliente."
Write-Host "2. Descomprimir: 'mkdir disher && tar -xzvf $ARCHIVE_NAME -C disher'"
Write-Host "3. Entrar y ejecutar: 'cd disher && sudo ./install.sh'"
Write-Host "4. Configurar restaurante: 'sudo ./configure.sh'"
