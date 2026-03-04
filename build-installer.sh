#!/bin/bash

# Disher.io - Packaging Script v2.0
# Generates a standalone .tar.gz installer for distribution.

VERSION="2.0.0"
INSTALLER_DIR="disher-installer"
ARCHIVE_NAME="disher-setup-v$VERSION.tar.gz"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}--- Iniciando Empaquetado de Disher.io v$VERSION ---${NC}"

# 1. Cleanup
rm -rf $INSTALLER_DIR $ARCHIVE_NAME
mkdir -p $INSTALLER_DIR

# 2. Build Images
echo -e "\n${BLUE}[1/4] Construyendo Imágenes Docker...${NC}"
docker compose build

# 3. Pull external images and export all to tar
echo -e "\n${BLUE}[2/4] Descargando y exportando imágenes (Esto puede tardar)...${NC}"
docker pull mongo:7
docker pull caddy:2
docker save -o $INSTALLER_DIR/images.tar disher-backend:latest disher-frontend:latest mongo:7 caddy:2

if [ $? -ne 0 ]; then
    echo "Error exportando imágenes. Asegúrate de que se construyeron correctamente."
    exit 1
fi

# 4. Generate Production Compose File (No Source / No Build)
echo -e "\n${BLUE}[3/4] Generando configuración de producción...${NC}"
cat <<'EOF' > $INSTALLER_DIR/docker-compose.yml
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
      - DOMAIN=${DOMAIN}
      - INSTALL_MODE=${INSTALL_MODE:-local}
      - JWT_SECRET=${JWT_SECRET}
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
      - DOMAIN=${DOMAIN}
      - INSTALL_MODE=${INSTALL_MODE:-local}
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
EOF

# 5. Copy Scripts & Configs
echo -e "\n${BLUE}[4/4] Copiando scripts y archivos de configuración...${NC}"
cp install.sh $INSTALLER_DIR/
cp configure.sh $INSTALLER_DIR/
cp check-ip.sh $INSTALLER_DIR/
cp Caddyfile $INSTALLER_DIR/

chmod +x $INSTALLER_DIR/install.sh
chmod +x $INSTALLER_DIR/configure.sh
chmod +x $INSTALLER_DIR/check-ip.sh

# 6. Compress
echo -e "\n${BLUE}Comprimiendo instalador...${NC}"
tar -czvf $ARCHIVE_NAME -C $INSTALLER_DIR .

echo -e "\n${GREEN}Empaquetado Completado!${NC}"
echo -e "Archivo generado: ${GREEN}$ARCHIVE_NAME${NC}"
echo -e "Tamaño: $(du -h $ARCHIVE_NAME | cut -f1)"
echo -e "\nInstrucciones para el Cliente:"
echo -e "1. Enviar '$ARCHIVE_NAME' al servidor del cliente."
echo -e "2. Descomprimir: 'mkdir disher && tar -xzvf $ARCHIVE_NAME -C disher'"
echo -e "3. Entrar y ejecutar: 'cd disher && sudo ./install.sh'"
echo -e "4. Configurar restaurante: 'sudo ./configure.sh'"
