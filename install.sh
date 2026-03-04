#!/bin/bash

# Disher.io - Full Installer v2.7.0

# Styles
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initial checks
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Por favor, ejecuta el script como root (sudo ./install.sh)${NC}"
  echo -e "${RED}Please run as root (sudo ./install.sh)${NC}"
  exit 1
fi

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}         DISHER.IO - INSTALLER              ${NC}"
echo -e "${CYAN}============================================${NC}"

# 1. Language Selection
echo -e "\nSelecciona el idioma / Select language:"
echo -e "1) Español"
echo -e "2) English"
read -p "Opcion [1-2] (default: 1): " LANG_OPT

if [ "$LANG_OPT" = "2" ]; then
    MSG_DOM="[1/6] Access Configuration"
    MSG_DOM_TYPE="Select access type:"
    MSG_TYPE_DOM="1) Domain (recommended)"
    MSG_TYPE_IP="2) IP Address"
    MSG_DOM_OPT="Select domain type:"
    MSG_DOM_LOC="1) Local domain (disherio.local)"
    MSG_DOM_CUS="2) Custom domain"
    MSG_DOM_PROMPT="Enter your domain (e.g. app.disher.io): "
    MSG_IP_OPT="Select IP type:"
    MSG_IP_LOC="1) Local IP"
    MSG_IP_PUB="2) Public IP"
    MSG_ERR_DOM="Invalid domain. IPs or empty values are not allowed."
    MSG_SEC="[2/6] Configuring Security..."
    MSG_ENV="[3/6] Saving Configuration..."
    MSG_DOCKER="[4/6] Checking Docker..."
    MSG_SRV="[5/6] Starting Services..."
    MSG_INIT="[6/6] Configuring Initial Store..."
    MSG_UPD="DISHER.IO UPDATED SUCCESSFULLY"
    MSG_INST="DISHER.IO INSTALLED SUCCESSFULLY"
    MSG_CRED="--- Initial Credentials (save in a secure place) ---"
    MSG_USRADM="Admin User: "
    MSG_PWDADM="Admin Password: "
    MSG_USRWT="Waiter User: "
    MSG_PWDWT="Waiter Password: "
    MSG_ACCESS="Access: "
    MSG_WARN_DOCK="Docker not found. Installing automatically..."
    MSG_ERR_DOCK="Docker Compose could not be installed. Please install it manually."
    MSG_PORT="[1.5/6] Port Configuration"
    MSG_PORT_PROMPT="HTTP Port (default 80, use 8080 if 80 is busy): "
    MSG_PORT_BUSY="Port is already in use! Try another port (e.g. 8080):"
    MSG_PORT_OK="Port available"
else
    MSG_DOM="[1/6] Configuración de Acceso"
    MSG_DOM_TYPE="Selecciona el tipo de acceso:"
    MSG_TYPE_DOM="1) Dominio (recomendado)"
    MSG_TYPE_IP="2) Dirección IP"
    MSG_DOM_OPT="Selecciona el tipo de dominio:"
    MSG_DOM_LOC="1) Dominio local (disherio.local)"
    MSG_DOM_CUS="2) Dominio personalizado"
    MSG_DOM_PROMPT="Introduce tu dominio (ej: app.disher.io): "
    MSG_IP_OPT="Selecciona el tipo de IP:"
    MSG_IP_LOC="1) IP Local"
    MSG_IP_PUB="2) IP Pública"
    MSG_ERR_DOM="Dominio inválido. No se permiten IPs ni dejarse en blanco."
    MSG_SEC="[2/6] Configurando Seguridad..."
    MSG_ENV="[3/6] Guardando Configuración..."
    MSG_DOCKER="[4/6] Comprobando Docker..."
    MSG_SRV="[5/6] Levantando Servicios..."
    MSG_INIT="[6/6] Configurando Tienda Inicial..."
    MSG_UPD="DISHER.IO ACTUALIZADO CORRECTAMENTE"
    MSG_INST="DISHER.IO INSTALADO CORRECTAMENTE"
    MSG_CRED="--- Credenciales Iniciales (guardar en lugar seguro) ---"
    MSG_USRADM="Usuario Admin: "
    MSG_PWDADM="Contraseña Admin: "
    MSG_USRWT="Usuario Camarero: "
    MSG_PWDWT="Contraseña Camarero: "
    MSG_ACCESS="Acceso: "
    MSG_WARN_DOCK="Docker no encontrado. Instalando automáticamente..."
    MSG_ERR_DOCK="No se pudo auto-instalar Docker Compose. Por favor, instálalo manualmente."
    MSG_PORT="[1.5/6] Configuración de Puerto"
    MSG_PORT_PROMPT="Puerto HTTP (por defecto 80, usa 8080 si el 80 está ocupado): "
    MSG_PORT_BUSY="El puerto está en uso. Prueba otro (ej: 8080):"
    MSG_PORT_OK="Puerto disponible"
fi

# 2. Domain or IP
echo -e "\n${CYAN}${MSG_DOM}${NC}"

while true; do
    echo -e "${MSG_DOM_TYPE}"
    echo -e "${MSG_TYPE_DOM}"
    echo -e "${MSG_TYPE_IP}"
    read -p "Opcion [1-2] (default: 1): " ACCESS_OPT
    ACCESS_OPT=${ACCESS_OPT:-1}

    if [ "$ACCESS_OPT" = "1" ]; then
        # Submenú Dominio
        while true; do
            echo -e "\n${MSG_DOM_OPT}"
            echo -e "${MSG_DOM_LOC}"
            echo -e "${MSG_DOM_CUS}"
            read -p "Opcion [1-2] (default: 1): " DOM_OPT
            DOM_OPT=${DOM_OPT:-1}

            if [ "$DOM_OPT" = "1" ]; then
                CADDY_DOMAIN="disherio.local"
                PROTOCOL="http"
                break 2
            elif [ "$DOM_OPT" = "2" ]; then
                while true; do
                    read -p "${MSG_DOM_PROMPT}" CADDY_DOMAIN
                    if [[ "$CADDY_DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                        PROTOCOL="https"
                        break 3
                    else
                        echo -e "${RED}${MSG_ERR_DOM}${NC}"
                    fi
                done
            fi
        done
    elif [ "$ACCESS_OPT" = "2" ]; then
        # Submenú IP
        while true; do
            echo -e "\n${MSG_IP_OPT}"
            echo -e "${MSG_IP_LOC}"
            echo -e "${MSG_IP_PUB}"
            read -p "Opcion [1-2] (default: 1): " IP_OPT
            IP_OPT=${IP_OPT:-1}
            
            if [ "$IP_OPT" = "2" ]; then
                # Forzar IPv4 con el flag -4
                CADDY_DOMAIN=$(curl -4 -s ifconfig.me)
                if [ -z "$CADDY_DOMAIN" ]; then
                    echo -e "${RED}Error detecting Public IP. Please check internet connection.${NC}"
                    continue
                fi
                echo -e "${GREEN}Detected Public IP: ${CADDY_DOMAIN}${NC}"
            else
                # Filtrar solo la primera IPv4 encontrada
                CADDY_DOMAIN=$(hostname -I | tr ' ' '\n' | grep -v ':' | head -n 1)
                if [ -z "$CADDY_DOMAIN" ]; then
                     CADDY_DOMAIN="127.0.0.1"
                fi
                echo -e "${GREEN}Detected Local IP: ${CADDY_DOMAIN}${NC}"
            fi
            
            read -p "Confirm IP ${CADDY_DOMAIN}? [Y/n]: " CONFIRM_IP
            if [[ "$CONFIRM_IP" =~ ^[Nn]$ ]]; then
                read -p "Enter IP manually: " CADDY_DOMAIN
            fi
            
            PROTOCOL="http"
            break 2
        done
    else
        echo -e "${RED}Invalid option.${NC}"
    fi
done

# 2.5. Port selection
echo -e "\n${CYAN}${MSG_PORT}${NC}"
while true; do
    read -p "${MSG_PORT_PROMPT}" HTTP_PORT
    HTTP_PORT=${HTTP_PORT:-80}
    
    # Validate it's a number
    if ! [[ "$HTTP_PORT" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Puerto inválido. Introduce un número (ej: 80, 8080).${NC}"
        continue
    fi
    
    # Check if port is already in use
    if ss -tlnp 2>/dev/null | grep -q ":${HTTP_PORT} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${HTTP_PORT} "; then
        echo -e "${RED}${MSG_PORT_BUSY}${NC}"
    else
        echo -e "${GREEN}${MSG_PORT_OK}: ${HTTP_PORT}${NC}"
        break
    fi
done

echo -e "\n${CYAN}${MSG_SEC}${NC}"
JWT_SECRET=$(openssl rand -base64 32)
MONGO_PASS=$(openssl rand -base64 16)
MONGODB_URI="mongodb://admin:${MONGO_PASS}@database:27017/disher?authSource=admin"

ADMIN_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 12)
WAITER_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 8)

# 4. Environment
echo -e "\n${CYAN}${MSG_ENV}${NC}"
cat > .env <<EOF
# Auto-generated by Disher Installer
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=${JWT_SECRET}

# Database
MONGODB_URI=${MONGODB_URI}
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASS}

# Network
CADDY_DOMAIN=${CADDY_DOMAIN}
DOMAIN=${CADDY_DOMAIN}
PROTOCOL=${PROTOCOL}
HTTP_PORT=${HTTP_PORT}
EOF

# 5. Docker Detection
echo -e "\n${CYAN}${MSG_DOCKER}${NC}"
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_CMD="docker compose"
else
    echo -e "${YELLOW}${MSG_WARN_DOCK}${NC}"
    # Intentar instalar Docker usando el script oficial
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Intentar instalar el plugin de docker-compose por si acaso (Ubuntu/Debian)
    if command -v apt-get &> /dev/null; then
        apt-get update -y && apt-get install -y docker-compose-plugin
    fi
    
    # Re-evaluar si se pudo instalar
    if docker compose version &> /dev/null; then
        DOCKER_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_CMD="docker-compose"
    else
        echo -e "${RED}${MSG_ERR_DOCK}${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}Using: ${DOCKER_CMD}${NC}"

# 6. Infrastructure
echo -e "\n${CYAN}${MSG_SRV}${NC}"
$DOCKER_CMD down --remove-orphans || true
$DOCKER_CMD up -d --build

# 7. Initial Store Setup
echo -e "\n${CYAN}${MSG_INIT}${NC}"
# Wait for backend and database to be ready
sleep 15
$DOCKER_CMD exec -e MONGO_URI="$MONGODB_URI" \
               -e INIT_ADMIN_PASS="$ADMIN_PASS" \
               -e INIT_WAITER_PASS="$WAITER_PASS" \
               backend sh -c "node init-store.js"

# 8. Summary
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}   ${MSG_INST}${NC}"
echo -e "${GREEN}============================================${NC}"

# Construir URL de acceso
if [ "$HTTP_PORT" = "80" ]; then
    ACCESS_URL="${PROTOCOL}://${CADDY_DOMAIN}"
else
    ACCESS_URL="${PROTOCOL}://${CADDY_DOMAIN}:${HTTP_PORT}"
fi

echo -e "  ${MSG_ACCESS}${ACCESS_URL}"

echo -e "\n${YELLOW}${MSG_CRED}${NC}"
echo -e "  ${MSG_USRADM}${CYAN}admin${NC}"
echo -e "  ${MSG_PWDADM}${CYAN}$ADMIN_PASS${NC}"
echo -e "\n  Acceso: ${CYAN}${ACCESS_URL}${NC}"
echo -e "\n  ${MSG_USRWT}${CYAN}waiter${NC}"
echo -e "  ${MSG_PWDWT}${CYAN}$WAITER_PASS${NC}"

echo -e "\n${GREEN}Listo! / Done!${NC}\n"
