#!/bin/bash

# Disher.io - Configuration Wizard v2.0
# Utility to manage domain, store settings, and resets.

BLUE='\033[0;34m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ____  _     _                 _       _ "
echo " |  _ \(_)___| |__   ___ _ __  (_) ___ | |"
echo " | | | | / __| '_ \ / _ \ '__| | |/ _ \| |"
echo " | |_| | \__ \ | | |  __/ |    | | (_) |_|"
echo " |____/|_|___/_| |_|\___|_|    |_|\___/(_)"
echo "                                          "
echo -e "--- Configuration Tool v2.0 ---${NC}\n"

# Detect compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
else
    echo -e "${RED}Error: Docker Compose no encontrado.${NC}"
    exit 1
fi

# Check if Docker is running
if ! $DOCKER_CMD ps > /dev/null 2>&1; then
    echo -e "${RED}Error: Los servicios Docker no están corriendo.${NC}"
    echo "Ejecuta primero './install.sh' o '$DOCKER_CMD up -d'."
    exit 1
fi

echo -e "Selecciona una opción:"
echo "1) Configurar Datos del Restaurante (Nombre, Admin)"
echo "2) Cambiar Dominio / Modo de Acceso"
echo "3) Resetear Base de Datos (PELIGRO)"
echo "4) Ver Estado de los Servicios"
echo "5) Salir"
read -p "> " OPTION

case $OPTION in
    1)
        echo -e "\n${BLUE}--- Configuración del Restaurante ---${NC}"

        read -p "Nombre del Restaurante (ej: Casa Pepe): " R_NAME
        while [[ -z "$R_NAME" ]]; do
            echo -e "${RED}El nombre no puede estar vacío.${NC}"
            read -p "Nombre del Restaurante: " R_NAME
        done

        # Slugify function
        DEFAULT_SLUG=$(echo "$R_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//' | sed 's/-$//')

        read -p "Slug URL (enter para '$DEFAULT_SLUG'): " R_SLUG
        if [[ -z "$R_SLUG" ]]; then
            R_SLUG=$DEFAULT_SLUG
        fi

        echo -e "\n${CYAN}--- Credenciales del Administrador ---${NC}"
        read -p "Usuario Administrador (enter para 'admin'): " R_USER
        if [[ -z "$R_USER" ]]; then
            R_USER="admin"
        fi

        echo -e "Opciones de Contraseña:"
        echo -e "  [ENTER]   - ${GREEN}Generar contraseña segura automáticamente${NC}"
        echo -e "  [Escribir]- Usar tu propia contraseña"
        read -s -p "> Contraseña: " R_PASS_INPUT
        echo ""

        if [[ -z "$R_PASS_INPUT" ]]; then
            if command -v openssl &> /dev/null; then
                 R_PASS=$(openssl rand -base64 20 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 12)
            else
                 R_PASS="Admin$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 8)"
            fi
            echo -e "Contraseña Generada: ${GREEN}$R_PASS${NC}"
            echo -e "${YELLOW}NOTA: Cópiala ahora, no se volverá a mostrar.${NC}"
            read -p "Presiona Enter cuando la hayas guardado..."
        else
            R_PASS="$R_PASS_INPUT"
        fi

        echo -e "\n${YELLOW}Aplicando configuración...${NC}"

        $DOCKER_CMD exec backend sh -c "INIT_NAME='$R_NAME' INIT_SLUG='$R_SLUG' INIT_USER='$R_USER' INIT_PASS='$R_PASS' INIT_RESET='false' node init-store.js"

        if [ $? -eq 0 ]; then
            # Read current domain and mode from .env
            CURRENT_DOMAIN_RAW=$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2)
            CURRENT_MODE=$(grep '^INSTALL_MODE=' .env 2>/dev/null | cut -d= -f2)
            # Build correct URL based on mode
            if echo "$CURRENT_DOMAIN_RAW" | grep -q "^http://"; then
                ACCESS_URL="${CURRENT_DOMAIN_RAW}/login"
            elif [ "$CURRENT_MODE" = "cloud" ]; then
                ACCESS_URL="https://${CURRENT_DOMAIN_RAW}/login"
            else
                ACCESS_URL="http://${CURRENT_DOMAIN_RAW}/login"
            fi
            echo -e "\n${GREEN}Tienda configurada correctamente.${NC}"
            echo -e "Accede a: ${CYAN}${ACCESS_URL}${NC}"
            echo -e "Usuario:  ${CYAN}$R_USER${NC}"
        else
            echo -e "\n${RED}Hubo un error al configurar la tienda.${NC}"
        fi
        ;;

    2)
        echo -e "\n${BLUE}--- Cambio de Red / Dominio ---${NC}"
        PUBLIC_IP=$(curl -s --connect-timeout 5 https://ifconfig.me 2>/dev/null || echo "")
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

        echo "Selecciona el nuevo modo de acceso:"
        echo ""
        echo "  1) Local (Red WLAN/LAN) -> IP local: ${GREEN}$LOCAL_IP${NC}"
        if [ -n "$PUBLIC_IP" ]; then
            echo "  2) Cloud (IP Publica)   -> IP publica: ${GREEN}$PUBLIC_IP${NC}"
        else
            echo -e "  2) Cloud (IP Publica)   -> ${YELLOW}(No detectada - sin Internet?)${NC}"
        fi
        echo "  3) Cloud (Dominio)      -> Usar nombre de dominio propio"
        echo ""
        read -p "Opción [1-3]: " NET_OPT

        case $NET_OPT in
            1)
                NEW_DOMAIN=$LOCAL_IP
                NEW_MODE="local"
                ;;
            2)
                NEW_MODE="cloud"
                if [ -n "$PUBLIC_IP" ]; then
                    NEW_DOMAIN=$PUBLIC_IP
                else
                    echo -e "${YELLOW}IP pública no detectada.${NC}"
                    read -p "Introduce la IP pública manualmente (o Enter para usar IP local): " MANUAL_IP
                    if [ -n "$MANUAL_IP" ]; then
                        NEW_DOMAIN="$MANUAL_IP"
                    else
                        NEW_DOMAIN=$LOCAL_IP
                        NEW_MODE="local"
                        echo -e "${YELLOW}Usando IP local: $NEW_DOMAIN${NC}"
                    fi
                fi
                ;;
            3)
                NEW_MODE="cloud"
                read -p "Introduce tu dominio (ej: app.mirestaurante.com): " NEW_DOMAIN
                if [[ -z "$NEW_DOMAIN" ]]; then
                    # Dominio vacío: fallback a IP según modo
                    if [ -n "$PUBLIC_IP" ]; then
                        NEW_DOMAIN=$PUBLIC_IP
                        echo -e "${YELLOW}Dominio vacío, usando IP pública: $NEW_DOMAIN${NC}"
                    else
                        NEW_DOMAIN=$LOCAL_IP
                        NEW_MODE="local"
                        echo -e "${YELLOW}Dominio vacío y sin IP pública, usando IP local: $NEW_DOMAIN${NC}"
                    fi
                else
                    echo -e "\n${CYAN}[DNS] Configura un registro A:${NC}"
                    if [ -n "$PUBLIC_IP" ]; then
                        echo -e "  ${GREEN}$NEW_DOMAIN -> A -> $PUBLIC_IP${NC}"
                    else
                        echo -e "  ${GREEN}$NEW_DOMAIN -> A -> (tu IP pública)${NC}"
                    fi
                fi
                ;;
            *)
                echo "Opción no válida."
                exit 1
                ;;
        esac

        # Format domain for Caddy: http:// prefix for IPs (no auto-HTTPS)
        if echo "$NEW_DOMAIN" | grep -qP '^\d+\.\d+\.\d+\.\d+$'; then
            CADDY_DOMAIN="http://${NEW_DOMAIN}"
        else
            CADDY_DOMAIN="${NEW_DOMAIN}"
        fi

        sed -i "s|^DOMAIN=.*|DOMAIN=$CADDY_DOMAIN|" .env
        sed -i "s|^INSTALL_MODE=.*|INSTALL_MODE=$NEW_MODE|" .env

        echo -e "\n${YELLOW}Recreando servicios con nueva configuración...${NC}"
        $DOCKER_CMD up -d --force-recreate caddy backend

        echo -e "\n${GREEN}Configuración actualizada.${NC}"
        if echo "$CADDY_DOMAIN" | grep -q "^http://"; then
            echo -e "URL de acceso: ${CYAN}http://${NEW_DOMAIN}${NC} (modo: $NEW_MODE)"
        else
            echo -e "URL de acceso: ${CYAN}https://${NEW_DOMAIN}${NC} (modo: $NEW_MODE)"
        fi
        ;;

    3)
        echo -e "\n${RED}PELIGRO: ESTO BORRARA TODOS LOS DATOS DE LA BASE DE DATOS.${NC}"
        read -p "¿Estás seguro? Escribe 'BORRAR' para confirmar: " CONFIRM

        if [ "$CONFIRM" == "BORRAR" ]; then
            echo -e "${YELLOW}Reseteando base de datos...${NC}"

            read -p "Nombre del Restaurante por defecto: " R_NAME
            if [[ -z "$R_NAME" ]]; then R_NAME="Mi Restaurante"; fi

            DEFAULT_SLUG=$(echo "$R_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//' | sed 's/-$//')

            read -p "Usuario administrador (enter para 'admin'): " RESET_USER
            if [[ -z "$RESET_USER" ]]; then RESET_USER="admin"; fi

            # Generate a new password for the reset
            if command -v openssl &> /dev/null; then
                RESET_PASS=$(openssl rand -base64 20 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 12)
            else
                RESET_PASS="Admin$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 8)"
            fi

            $DOCKER_CMD exec backend sh -c "INIT_NAME='$R_NAME' INIT_SLUG='$DEFAULT_SLUG' INIT_USER='$RESET_USER' INIT_PASS='$RESET_PASS' INIT_RESET='true' node init-store.js"
            if [ $? -eq 0 ]; then
                # Build access URL from .env
                CURRENT_DOMAIN_RAW=$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2)
                CURRENT_MODE=$(grep '^INSTALL_MODE=' .env 2>/dev/null | cut -d= -f2)
                if echo "$CURRENT_DOMAIN_RAW" | grep -q "^http://"; then
                    RESET_URL="${CURRENT_DOMAIN_RAW}/login"
                elif [ "$CURRENT_MODE" = "cloud" ]; then
                    RESET_URL="https://${CURRENT_DOMAIN_RAW}/login"
                else
                    RESET_URL="http://${CURRENT_DOMAIN_RAW}/login"
                fi

                echo -e "\n${GREEN}Base de datos reseteada y reiniciada.${NC}"
                echo -e "Accede a:    ${CYAN}$RESET_URL${NC}"
                echo -e "Usuario:     ${CYAN}$RESET_USER${NC}"
                echo -e "Contraseña:  ${GREEN}$RESET_PASS${NC}"
                echo -e "${YELLOW}NOTA: Copia la contraseña ahora, no se volverá a mostrar.${NC}"
            fi
        else
            echo "Operación cancelada."
        fi
        ;;

    4)
        echo -e "\n${BLUE}--- Estado de los Servicios ---${NC}"
        $DOCKER_CMD ps
        echo ""

        # Show current config with proper URL formatting
        if [ -f .env ]; then
            CURRENT_DOMAIN_RAW=$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2)
            CURRENT_MODE=$(grep '^INSTALL_MODE=' .env 2>/dev/null | cut -d= -f2)

            # Build display URL
            if echo "$CURRENT_DOMAIN_RAW" | grep -q "^http://"; then
                DISPLAY_URL="$CURRENT_DOMAIN_RAW"
            elif [ "$CURRENT_MODE" = "cloud" ]; then
                DISPLAY_URL="https://${CURRENT_DOMAIN_RAW}"
            else
                DISPLAY_URL="http://${CURRENT_DOMAIN_RAW}"
            fi

            echo -e "URL de acceso:   ${CYAN}$DISPLAY_URL${NC}"
            echo -e "Modo:            ${CYAN}$CURRENT_MODE${NC}"
        fi
        ;;

    5)
        echo "Saliendo..."
        exit 0
        ;;

    *)
        echo "Opción no válida."
        exit 1
        ;;
esac
