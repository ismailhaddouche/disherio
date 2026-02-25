#!/bin/bash

# Disher.io - Master Installer v2.0.0
# Supports: Debian/Ubuntu, RHEL/CentOS/Amazon Linux, Raspberry Pi OS, AWS, GCP, Azure, Bare Metal

set -e

# --- Styles ---
BLUE='\033[0;34m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ____  _     _                 _ ___"
echo " |  _ \(_)___| |__   ___ _ __ (_) _ \\"
echo " | | | | / __| '_ \ / _ \ '__|| | | |"
echo " | |_| | \__ \ | | |  __/ | _ | | |_| |"
echo " |____/|_|___/_| |_|\___|_|(_)|_|\___/ "
echo "                                       "
echo -e "--- Master Infrastructure Installer v2.0 ---${NC}\n"

# --- Root Check ---
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: Este script debe ejecutarse como root (sudo).${NC}"
   exit 1
fi

# --- Architecture & OS Detection ---
ARCH=$(uname -m)
echo -e "${CYAN}[1/8] Verificando Sistema...${NC}"
echo "  Arquitectura: $ARCH"

# Detect OS family
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="$ID"
    OS_LIKE="$ID_LIKE"
    OS_VERSION="$VERSION_ID"
    echo "  Sistema: $PRETTY_NAME"
else
    OS_ID="unknown"
    OS_LIKE=""
    echo -e "  ${YELLOW}Sistema: No detectado (/etc/os-release no encontrado)${NC}"
fi

# Detect Raspberry Pi
IS_RASPBERRY=false
if [[ "$ARCH" == "armv7l" || "$ARCH" == "aarch64" ]] && [[ -f /proc/device-tree/model ]]; then
    MODEL=$(cat /proc/device-tree/model 2>/dev/null || echo "")
    if [[ "$MODEL" == *"Raspberry"* ]]; then
        IS_RASPBERRY=true
        echo -e "  ${CYAN}Raspberry Pi detectada: $MODEL${NC}"
    fi
fi

# ARM architecture warning for MongoDB
if [[ "$ARCH" == "armv7l" ]]; then
    echo -e "\n${RED}AVISO: Arquitectura armv7l (32-bit) detectada.${NC}"
    echo -e "${RED}MongoDB oficial no soporta ARM 32-bit.${NC}"
    echo -e "${YELLOW}Se necesita Raspberry Pi 4+ con OS de 64-bit (aarch64).${NC}"
    echo -e "${YELLOW}Puedes instalar Raspberry Pi OS 64-bit desde: https://www.raspberrypi.com/software/${NC}"
    read -p "¿Continuar de todas formas? (s/N): " CONTINUE_ARM
    if [[ "$CONTINUE_ARM" != "s" && "$CONTINUE_ARM" != "S" ]]; then
        echo "Instalación cancelada."
        exit 1
    fi
fi

# --- IP Verification Function (3 sources, cross-validation) ---
verify_public_ip() {
    local IP1 IP2 IP3
    local VALID_IP_REGEX='^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'

    IP1=$(curl -s --connect-timeout 5 --max-time 10 https://ifconfig.me 2>/dev/null | tr -d '[:space:]')
    IP2=$(curl -s --connect-timeout 5 --max-time 10 https://api.ipify.org 2>/dev/null | tr -d '[:space:]')
    IP3=$(curl -s --connect-timeout 5 --max-time 10 https://icanhazip.com 2>/dev/null | tr -d '[:space:]')

    # Validate each result is a valid IPv4
    [[ ! "$IP1" =~ $VALID_IP_REGEX ]] && IP1=""
    [[ ! "$IP2" =~ $VALID_IP_REGEX ]] && IP2=""
    [[ ! "$IP3" =~ $VALID_IP_REGEX ]] && IP3=""

    # Cross-validate: prefer consensus of 2+ sources
    if [[ -n "$IP1" && "$IP1" == "$IP2" ]]; then
        echo "$IP1"; return 0
    elif [[ -n "$IP1" && "$IP1" == "$IP3" ]]; then
        echo "$IP1"; return 0
    elif [[ -n "$IP2" && "$IP2" == "$IP3" ]]; then
        echo "$IP2"; return 0
    elif [[ -n "$IP1" ]]; then
        echo "$IP1"; return 0
    elif [[ -n "$IP2" ]]; then
        echo "$IP2"; return 0
    elif [[ -n "$IP3" ]]; then
        echo "$IP3"; return 0
    else
        return 1
    fi
}

# --- Get IPs ---
echo -e "\n${CYAN}[2/8] Detectando y Verificando Red...${NC}"
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo "  IP Local:   $LOCAL_IP"

echo -ne "  IP Pública: Verificando (3 fuentes)... "
PUBLIC_IP=$(verify_public_ip)
if [ $? -eq 0 ] && [ -n "$PUBLIC_IP" ]; then
    echo -e "${GREEN}$PUBLIC_IP${NC} (verificada)"
else
    PUBLIC_IP=""
    echo -e "${YELLOW}No detectada (sin conexión a Internet)${NC}"
fi

# --- Docker Check & Installation ---
echo -e "\n${CYAN}[3/8] Verificando Docker...${NC}"

install_docker() {
    echo -e "${BLUE}Instalando Docker...${NC}"

    # Try the official convenience script first (supports most distros)
    if curl -fsSL https://get.docker.com -o /tmp/get-docker.sh 2>/dev/null; then
        sh /tmp/get-docker.sh
        rm -f /tmp/get-docker.sh
    else
        # Fallback: manual install by distro family
        if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_LIKE" == *"debian"* ]]; then
            export DEBIAN_FRONTEND=noninteractive
            apt-get update -y
            apt-get install -y ca-certificates curl gnupg
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL "https://download.docker.com/linux/$OS_ID/gpg" | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_ID $(lsb_release -cs 2>/dev/null || echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update -y
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

        elif [[ "$OS_ID" == "centos" || "$OS_ID" == "rhel" || "$OS_ID" == "rocky" || "$OS_ID" == "almalinux" || "$OS_ID" == "fedora" ]]; then
            yum install -y yum-utils || dnf install -y dnf-plugins-core
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || \
            dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || \
            dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

        elif [[ "$OS_ID" == "amzn" ]]; then
            # Amazon Linux 2 / 2023
            yum install -y docker
            # docker-compose-plugin may not be in Amazon repos, install standalone
            COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
            curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose

        else
            echo -e "${RED}Distribución no soportada automáticamente: $OS_ID${NC}"
            echo -e "${YELLOW}Instala Docker manualmente: https://docs.docker.com/engine/install/${NC}"
            exit 1
        fi
    fi
}

if ! command -v docker &> /dev/null; then
    install_docker
else
    echo -e "${GREEN}Docker ya instalado: $(docker --version)${NC}"
fi

# Ensure Docker Compose V2 is available
if docker compose version &> /dev/null; then
    DOCKER_CMD="docker compose"
    echo -e "${GREEN}Docker Compose V2 disponible.${NC}"
elif command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
    echo -e "${YELLOW}Usando docker-compose V1 (legacy).${NC}"
else
    echo -e "${RED}Docker Compose no encontrado. Intentando instalar plugin...${NC}"
    # Try installing compose plugin
    if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_LIKE" == *"debian"* ]]; then
        apt-get install -y docker-compose-plugin 2>/dev/null
    fi
    if docker compose version &> /dev/null; then
        DOCKER_CMD="docker compose"
    else
        echo -e "${RED}No se pudo instalar Docker Compose. Instálalo manualmente.${NC}"
        exit 1
    fi
fi

# Ensure Docker is running
systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
systemctl enable docker 2>/dev/null || true

# --- Deployment Mode ---
echo -e "\n${CYAN}[4/8] Selección de Modo de Despliegue${NC}"
echo ""
echo "  1) Local / Red Privada (Raspberry Pi, LAN, servidor interno)"
echo "     Acceso por IP local: ${GREEN}http://$LOCAL_IP${NC}"
echo ""
echo "  2) Servidor en la Nube (Google Cloud, AWS, DigitalOcean, VPS...)"
echo "     Acceso por IP pública o dominio propio"
echo ""
read -p "  Selecciona una opción [1-2]: " MODE

if [ "$MODE" == "2" ]; then
    INSTALL_MODE="cloud"

    # Validate public IP is available
    if [ -z "$PUBLIC_IP" ]; then
        echo -e "\n  ${RED}No se pudo detectar la IP pública.${NC}"
        echo -e "  ${YELLOW}Verifica tu conexión a Internet.${NC}"
        read -p "  Introduce la IP pública manualmente (o Enter para usar IP local): " MANUAL_IP
        if [ -n "$MANUAL_IP" ]; then
            PUBLIC_IP="$MANUAL_IP"
        else
            echo -e "  ${YELLOW}Usando IP local como fallback: $LOCAL_IP${NC}"
            PUBLIC_IP="$LOCAL_IP"
        fi
    fi

    echo -e "\n${YELLOW}  Modo NUBE seleccionado.${NC}"
    echo ""
    echo "  Por defecto se usará la IP Pública: ${GREEN}$PUBLIC_IP${NC}"
    echo ""
    read -p "  ¿Quieres usar un dominio propio en vez de la IP? (s/N): " USE_DOMAIN

    if [[ "$USE_DOMAIN" == "s" || "$USE_DOMAIN" == "S" ]]; then
        read -p "  Introduce tu dominio (ej: app.mirestaurante.com): " DOMAIN
        if [ -z "$DOMAIN" ]; then
            echo -e "  ${YELLOW}Dominio vacío, usando IP pública: $PUBLIC_IP${NC}"
            DOMAIN=$PUBLIC_IP
        else
            echo -e "\n  ${CYAN}[DNS] IMPORTANTE: Configura un registro A en tu proveedor DNS:${NC}"
            echo -e "  ${GREEN}$DOMAIN  ->  A  ->  $PUBLIC_IP${NC}"
            echo -e "  Caddy generará certificado HTTPS automáticamente con Let's Encrypt."
            read -p "  Presiona Enter cuando hayas configurado el DNS..."
        fi
    else
        DOMAIN=$PUBLIC_IP
        echo -e "  ${GREEN}Usando IP pública: $DOMAIN${NC}"
    fi

    echo -e "\n  Los QR y enlaces se generarán con: ${CYAN}http(s)://$DOMAIN${NC}"
else
    # Default: Local mode (option 1, empty, or any other input)
    INSTALL_MODE="local"
    DOMAIN=$LOCAL_IP
    echo -e "\n  ${GREEN}Modo LOCAL seleccionado.${NC}"
    echo -e "  Acceso por IP local: ${CYAN}http://$DOMAIN${NC}"
fi

# --- Generate JWT Secret ---
echo -e "\n${BLUE}[5/8] Configurando Seguridad...${NC}"
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
else
    JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
fi
echo -e "  ${GREEN}JWT Secret generado correctamente.${NC}"

# --- Environment Configuration ---
echo -e "\n${BLUE}[6/8] Configurando Variables de Entorno...${NC}"

# For IP-based access, Caddy needs http:// prefix to disable auto-HTTPS
if echo "$DOMAIN" | grep -qP '^\d+\.\d+\.\d+\.\d+$'; then
    CADDY_DOMAIN="http://${DOMAIN}"
    echo -e "  Modo IP detectado -> HTTP (sin certificado SSL)"
else
    CADDY_DOMAIN="${DOMAIN}"
    echo -e "  Modo Dominio detectado -> HTTPS automático (Let's Encrypt)"
fi

cat <<EOF > .env
NODE_ENV=production
DOMAIN=$CADDY_DOMAIN
INSTALL_MODE=$INSTALL_MODE
MONGODB_URI=mongodb://database:27017/disher
JWT_SECRET=$JWT_SECRET
PUBLIC_IP=$PUBLIC_IP
LOCAL_IP=$LOCAL_IP
EOF

echo -e "  ${GREEN}Archivo .env creado.${NC}"

# --- Launch Services ---
echo -e "\n${BLUE}[7/8] Levantando Infraestructura...${NC}"

# Cleanup previous containers
echo -e "  ${YELLOW}Limpiando contenedores previos...${NC}"
$DOCKER_CMD down --remove-orphans 2>/dev/null || true

if [ -f "images.tar" ]; then
    echo -e "  ${BLUE}Modo OFFLINE: Cargando imágenes locales (images.tar)...${NC}"
    docker load -i images.tar
    $DOCKER_CMD up -d
else
    echo -e "  ${BLUE}Modo ONLINE: Construyendo imágenes...${NC}"
    $DOCKER_CMD up -d --build
fi

# --- Wait for services to be healthy ---
echo -e "\n  ${YELLOW}Esperando a que los servicios estén listos...${NC}"
RETRIES=0
MAX_RETRIES=30
while [ $RETRIES -lt $MAX_RETRIES ]; do
    # Check if backend is healthy (it depends on DB, so if backend is healthy everything is up)
    HEALTH=$($DOCKER_CMD ps 2>/dev/null | grep "disher-backend" | grep "(healthy)" || true)
    if [ -n "$HEALTH" ]; then
        echo -e "\n  ${GREEN}Todos los servicios están funcionando correctamente.${NC}"
        break
    fi
    RETRIES=$((RETRIES + 1))
    echo -ne "  Verificando servicios... ($RETRIES/$MAX_RETRIES)\r"
    sleep 5
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
    echo -e "\n  ${YELLOW}Los servicios están arrancando. Usa '$DOCKER_CMD ps' para verificar el estado.${NC}"
fi

# --- Firewall ---
if command -v ufw &> /dev/null; then
    echo -e "\n  ${YELLOW}Configurando firewall (ufw)...${NC}"
    ufw allow 80/tcp  > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    ufw allow 22/tcp  > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1
    echo -e "  ${GREEN}Puertos 80, 443, 22 abiertos.${NC}"
elif command -v firewall-cmd &> /dev/null; then
    echo -e "\n  ${YELLOW}Configurando firewall (firewalld)...${NC}"
    firewall-cmd --permanent --add-service=http  > /dev/null 2>&1
    firewall-cmd --permanent --add-service=https > /dev/null 2>&1
    firewall-cmd --reload > /dev/null 2>&1
    echo -e "  ${GREEN}Puertos HTTP/HTTPS abiertos.${NC}"
fi

# --- Install IP Verification Service (runs on every boot) ---
echo -e "\n${BLUE}[8/8] Configurando Verificación Automática de IP...${NC}"

INSTALL_DIR="$(pwd)"
chmod +x check-ip.sh 2>/dev/null || true

if command -v systemctl &> /dev/null; then
    # Systemd service: runs check-ip.sh after network and docker are ready
    cat <<SVCEOF > /etc/systemd/system/disher-ip-check.service
[Unit]
Description=Disher.io IP Verification on Boot
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 10
ExecStart=${INSTALL_DIR}/check-ip.sh
WorkingDirectory=${INSTALL_DIR}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable disher-ip-check.service > /dev/null 2>&1
    echo -e "  ${GREEN}Servicio systemd 'disher-ip-check' instalado y activado.${NC}"
    echo -e "  ${CYAN}Se ejecutará automáticamente en cada reinicio del servidor.${NC}"
else
    # Fallback: cron @reboot for systems without systemd
    CRON_LINE="@reboot sleep 15 && ${INSTALL_DIR}/check-ip.sh >> /var/log/disher-ip-check.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "check-ip.sh"; echo "$CRON_LINE") | crontab -
    echo -e "  ${GREEN}Tarea cron @reboot instalada como fallback.${NC}"
    echo -e "  ${CYAN}Se ejecutará automáticamente en cada reinicio del servidor.${NC}"
fi

echo -e "  ${YELLOW}También puedes verificar la IP manualmente: ${CYAN}sudo ./check-ip.sh${NC}"

# --- Summary ---
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   INSTALACION COMPLETADA EXITOSAMENTE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Display access URL based on CADDY_DOMAIN (the actual value stored in .env)
if echo "$CADDY_DOMAIN" | grep -q "^http://"; then
    # IP-based access (local or cloud IP) - HTTP only
    DISPLAY_URL="$CADDY_DOMAIN"
else
    # Domain-based access - HTTPS via Let's Encrypt
    DISPLAY_URL="https://${CADDY_DOMAIN}"
fi

echo -e "  ${GREEN}URL de acceso:${NC}  ${CYAN}${DISPLAY_URL}${NC}"
echo -e "  Modo:          ${CYAN}${INSTALL_MODE}${NC}"
echo -e "  Arquitectura:  ${CYAN}${ARCH}${NC}"

if [ "$INSTALL_MODE" == "local" ]; then
    echo -e "  IP Local:      ${CYAN}${LOCAL_IP}${NC}"
    echo ""
    echo -e "  ${YELLOW}Todos los dispositivos en la misma red WiFi/LAN${NC}"
    echo -e "  ${YELLOW}pueden acceder a: ${CYAN}${DISPLAY_URL}${NC}"
elif [ "$INSTALL_MODE" == "cloud" ]; then
    echo -e "  IP Pública:    ${CYAN}${PUBLIC_IP}${NC}"
    echo ""
    echo -e "  ${YELLOW}Accesible desde Internet en: ${CYAN}${DISPLAY_URL}${NC}"
fi

echo ""
echo -e "  ${GREEN}Verificación de IP:${NC} ${CYAN}Automática en cada reinicio${NC}"
echo -e "  ${YELLOW}Verificar manualmente:${NC} ${CYAN}sudo ./check-ip.sh${NC}"
echo ""
echo -e "  ${GREEN}Usuario Administrador por Defecto:${NC}"
echo -e "   Username: ${CYAN}admin${NC}"
echo -e "   Password: ${CYAN}password${NC}"
echo -e "   ${YELLOW}⚠ Cambia esta contraseña después del primer login.${NC}"
echo ""
echo -e "  ${YELLOW}Siguiente paso:${NC} Ejecuta ${CYAN}sudo ./configure.sh${NC} para personalizar"
echo -e "  tu restaurante y credenciales de administrador."
echo ""
