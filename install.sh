#!/bin/bash

# Disher.io - Master Installer v2.2.0
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
echo -e "--- Master Infrastructure Installer v2.2 ---${NC}\n"

# --- Root Check ---
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: Este script debe ejecutarse como root (sudo).${NC}"
   exit 1
fi

# --- Port Availability Check ---
check_port() {
    if command -v lsof &> /dev/null; then
        lsof -i :$1 > /dev/null 2>&1
        return $?
    elif command -v netstat &> /dev/null; then
        netstat -tuln | grep -q ":$1 "
        return $?
    fi
    return 1
}

echo -e "${CYAN}Verificando disponibilidad de puertos...${NC}"
if check_port 80 || check_port 443; then
    echo -e "${RED}Error: Los puertos 80 o 443 ya están en uso.${NC}"
    echo -e "${YELLOW}Asegúrate de detener cualquier otro servidor web (Apache, Nginx) antes de instalar Disher.io.${NC}"
    exit 1
fi

# --- Architecture & OS Detection ---
ARCH=$(uname -m)
echo -e "${CYAN}[1/9] Verificando Sistema...${NC}"
echo "  Arquitectura: $ARCH"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="$ID"
    OS_LIKE="$ID_LIKE"
    echo "  Sistema: $PRETTY_NAME"
else
    OS_ID="unknown"
    echo -e "  ${YELLOW}Sistema: No detectado${NC}"
fi

# --- IP Verification ---
verify_public_ip() {
    curl -s --connect-timeout 5 https://ifconfig.me || echo ""
}

echo -e "\n${CYAN}[2/9] Detectando Red...${NC}"
LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
PUBLIC_IP=$(verify_public_ip)
echo "  IP Local:   $LOCAL_IP"
echo "  IP Pública: ${PUBLIC_IP:-No detectada}"

# --- Docker Check ---
echo -e "\n${CYAN}[3/9] Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${BLUE}Instalando Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
fi
systemctl start docker || service docker start || true

# --- Avahi/mDNS Configuration ---
echo -e "\n${CYAN}[4/9] Configurando Identidad Local (disher.local)...${NC}"
if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_LIKE" == *"debian"* ]]; then
    apt-get update -y && apt-get install -y avahi-daemon libnss-mdns
    # Create HTTP service announcement
    cat <<EOF > /etc/avahi/services/http.service
<?xml version="1.0" standalone="no"?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Disher Server</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>
</service-group>
EOF
    # Set hostname
    hostnamectl set-hostname disher || hostname disher
    echo "127.0.1.1 disher" >> /etc/hosts || true
    systemctl restart avahi-daemon
    echo -e "  ${GREEN}Servidor ahora responde a http://disher.local${NC}"
fi

# --- Deployment Mode ---
echo -e "\n${CYAN}[5/9] Selección de Modo de Acceso${NC}"
echo "  1) Local Persistente (Recomendado): http://disher.local"
echo "  2) Dominio Web (HTTPS): https://tu-dominio.com"
echo "  3) Dirección IP (Legacy): http://$LOCAL_IP"
read -p "  Selecciona una opción [1-3]: " MODE_OPTION

case $MODE_OPTION in
    2)
        INSTALL_MODE="cloud"
        read -p "  Introduce tu dominio: " DOMAIN
        CADDY_DOMAIN="$DOMAIN"
        ;;
    3)
        INSTALL_MODE="ip"
        DOMAIN="$LOCAL_IP"
        CADDY_DOMAIN="http://$DOMAIN"
        ;;
    1|*)
        INSTALL_MODE="local"
        DOMAIN="disher.local"
        CADDY_DOMAIN="http://$DOMAIN"
        ;;
esac

# --- Security ---
echo -e "\n${CYAN}[6/9] Configurando Seguridad...${NC}"
JWT_SECRET=$(openssl rand -hex 32 || head -c 32 /dev/urandom | hex)

# --- Environment ---
echo -e "\n${CYAN}[7/9] Guardando Configuración...${NC}"
cat <<EOF > .env
NODE_ENV=production
DOMAIN=$CADDY_DOMAIN
INSTALL_MODE=$INSTALL_MODE
MONGODB_URI=mongodb://database:27017/disher
JWT_SECRET=$JWT_SECRET
PUBLIC_IP=$PUBLIC_IP
LOCAL_IP=$LOCAL_IP
EOF

# --- Infrastructure ---
echo -e "\n${CYAN}[8/9] Levantando Servicios...${NC}"
docker compose down --remove-orphans || true
docker compose up -d --build

# --- Firewall ---
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp > /dev/null
    ufw allow 443/tcp > /dev/null
    ufw allow 5353/udp > /dev/null # mDNS
    ufw --force enable > /dev/null
fi

# --- Summary ---
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}   DISHER.IO INSTALADO CORRECTAMENTE${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "  Acceso: ${CYAN}$CADDY_DOMAIN${NC}"
echo -e "  Modo:   ${CYAN}$INSTALL_MODE${NC}"
echo ""
echo -e "  Admin: admin / password"
echo -e "  Ejecuta 'sudo ./configure.sh' para personalizar tu tienda."
echo ""
