#!/bin/bash

# Disher.io - IP Verification & Auto-Update Script v2.0
# Runs on boot and can be run manually to detect IP changes.
# If the IP changed, updates .env and restarts affected containers.

BLUE='\033[0;34m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Resolve script directory (where .env and docker-compose.yml live)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

echo -e "${CYAN}[Disher.io] Verificación de IP...${NC}"

# --- Verify .env exists ---
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: No se encontró $ENV_FILE${NC}"
    echo "Ejecuta primero './install.sh'."
    exit 1
fi

# --- Detect compose command ---
if docker compose version &> /dev/null 2>&1; then
    DOCKER_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
else
    echo -e "${RED}Error: Docker Compose no encontrado.${NC}"
    exit 1
fi

# --- Read current config from .env ---
INSTALL_MODE=$(grep '^INSTALL_MODE=' "$ENV_FILE" | cut -d= -f2)
CURRENT_DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2)
STORED_PUBLIC_IP=$(grep '^PUBLIC_IP=' "$ENV_FILE" | cut -d= -f2)
STORED_LOCAL_IP=$(grep '^LOCAL_IP=' "$ENV_FILE" | cut -d= -f2)

# --- Public IP verification (3 sources, cross-validation) ---
verify_public_ip() {
    local IP1 IP2 IP3

    IP1=$(curl -s --connect-timeout 5 --max-time 10 https://ifconfig.me 2>/dev/null | tr -d '[:space:]')
    IP2=$(curl -s --connect-timeout 5 --max-time 10 https://api.ipify.org 2>/dev/null | tr -d '[:space:]')
    IP3=$(curl -s --connect-timeout 5 --max-time 10 https://icanhazip.com 2>/dev/null | tr -d '[:space:]')

    # Validate each result looks like an IP (basic check)
    local VALID_IP_REGEX='^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
    [[ ! "$IP1" =~ $VALID_IP_REGEX ]] && IP1=""
    [[ ! "$IP2" =~ $VALID_IP_REGEX ]] && IP2=""
    [[ ! "$IP3" =~ $VALID_IP_REGEX ]] && IP3=""

    # Cross-validate: prefer consensus of 2+ sources
    if [[ -n "$IP1" && "$IP1" == "$IP2" ]]; then
        echo "$IP1"
        return 0
    elif [[ -n "$IP1" && "$IP1" == "$IP3" ]]; then
        echo "$IP1"
        return 0
    elif [[ -n "$IP2" && "$IP2" == "$IP3" ]]; then
        echo "$IP2"
        return 0
    elif [[ -n "$IP1" ]]; then
        # Single source available
        echo "$IP1"
        return 0
    elif [[ -n "$IP2" ]]; then
        echo "$IP2"
        return 0
    elif [[ -n "$IP3" ]]; then
        echo "$IP3"
        return 0
    else
        return 1
    fi
}

# --- Local IP detection ---
get_local_ip() {
    hostname -I 2>/dev/null | awk '{print $1}' || echo ""
}

# --- If domain-based (not IP-based), skip IP verification ---
if [[ "$CURRENT_DOMAIN" != http://* ]]; then
    echo -e "${GREEN}Modo dominio detectado (${CURRENT_DOMAIN}), no se requiere verificación de IP.${NC}"
    exit 0
fi

# Extract current IP from DOMAIN (strip http:// prefix)
CURRENT_IP=$(echo "$CURRENT_DOMAIN" | sed 's|^http://||')

CHANGES_MADE=false

# --- Cloud mode: verify public IP ---
if [[ "$INSTALL_MODE" == "cloud" ]]; then
    echo -e "  Modo:    ${CYAN}cloud${NC}"
    echo -e "  IP almacenada: ${CYAN}$STORED_PUBLIC_IP${NC}"
    echo -ne "  Verificando IP pública (3 fuentes)... "

    VERIFIED_IP=$(verify_public_ip)
    if [[ $? -ne 0 ]] || [[ -z "$VERIFIED_IP" ]]; then
        echo -e "${RED}ERROR${NC}"
        echo -e "  ${RED}No se pudo verificar la IP pública.${NC}"
        echo -e "  ${YELLOW}Sin conexión a Internet o servicios de IP no disponibles.${NC}"
        echo -e "  ${YELLOW}Se mantiene la configuración actual: $CURRENT_IP${NC}"
        exit 1
    fi

    echo -e "${GREEN}$VERIFIED_IP${NC}"

    if [[ "$VERIFIED_IP" != "$STORED_PUBLIC_IP" ]]; then
        echo -e "  ${YELLOW}IP pública CAMBIÓ: $STORED_PUBLIC_IP -> $VERIFIED_IP${NC}"
        sed -i "s|^DOMAIN=.*|DOMAIN=http://${VERIFIED_IP}|" "$ENV_FILE"
        sed -i "s|^PUBLIC_IP=.*|PUBLIC_IP=${VERIFIED_IP}|" "$ENV_FILE"
        CHANGES_MADE=true
    else
        echo -e "  ${GREEN}IP pública verificada, sin cambios.${NC}"
    fi
fi

# --- Local mode: verify local IP ---
if [[ "$INSTALL_MODE" == "local" ]]; then
    echo -e "  Modo:    ${CYAN}local${NC}"
    echo -e "  IP almacenada: ${CYAN}$STORED_LOCAL_IP${NC}"
    echo -ne "  Detectando IP local actual... "

    NEW_LOCAL_IP=$(get_local_ip)
    if [[ -z "$NEW_LOCAL_IP" ]]; then
        echo -e "${RED}ERROR${NC}"
        echo -e "  ${RED}No se pudo detectar la IP local.${NC}"
        echo -e "  ${YELLOW}Se mantiene la configuración actual: $CURRENT_IP${NC}"
        exit 1
    fi

    echo -e "${GREEN}$NEW_LOCAL_IP${NC}"

    if [[ "$NEW_LOCAL_IP" != "$STORED_LOCAL_IP" ]]; then
        echo -e "  ${YELLOW}IP local CAMBIÓ: $STORED_LOCAL_IP -> $NEW_LOCAL_IP${NC}"
        sed -i "s|^DOMAIN=.*|DOMAIN=http://${NEW_LOCAL_IP}|" "$ENV_FILE"
        sed -i "s|^LOCAL_IP=.*|LOCAL_IP=${NEW_LOCAL_IP}|" "$ENV_FILE"
        CHANGES_MADE=true
    else
        echo -e "  ${GREEN}IP local verificada, sin cambios.${NC}"
    fi
fi

# --- Also update local IP in cloud mode (for reference) ---
if [[ "$INSTALL_MODE" == "cloud" ]]; then
    NEW_LOCAL_IP=$(get_local_ip)
    if [[ -n "$NEW_LOCAL_IP" && "$NEW_LOCAL_IP" != "$STORED_LOCAL_IP" ]]; then
        sed -i "s|^LOCAL_IP=.*|LOCAL_IP=${NEW_LOCAL_IP}|" "$ENV_FILE"
    fi
fi

# --- Also update public IP in local mode (for reference) ---
if [[ "$INSTALL_MODE" == "local" ]]; then
    VERIFIED_PUBLIC=$(verify_public_ip)
    if [[ -n "$VERIFIED_PUBLIC" && "$VERIFIED_PUBLIC" != "$STORED_PUBLIC_IP" ]]; then
        sed -i "s|^PUBLIC_IP=.*|PUBLIC_IP=${VERIFIED_PUBLIC}|" "$ENV_FILE"
    fi
fi

# --- Restart containers if IP changed ---
if [[ "$CHANGES_MADE" == true ]]; then
    echo -e "\n  ${YELLOW}Reiniciando servicios con nueva configuración...${NC}"
    cd "$SCRIPT_DIR"
    $DOCKER_CMD up -d --force-recreate caddy backend 2>/dev/null

    if [[ $? -eq 0 ]]; then
        # Show new access URL
        NEW_DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2)
        echo -e "  ${GREEN}Servicios reiniciados correctamente.${NC}"
        echo -e "  Nueva URL de acceso: ${CYAN}${NEW_DOMAIN}${NC}"
    else
        echo -e "  ${RED}Error al reiniciar servicios. Ejecuta manualmente:${NC}"
        echo -e "  ${CYAN}cd $SCRIPT_DIR && $DOCKER_CMD up -d --force-recreate caddy backend${NC}"
    fi
else
    echo -e "\n  ${GREEN}No se detectaron cambios. Configuración correcta.${NC}"
fi
