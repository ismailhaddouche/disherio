#!/bin/bash
# =============================================================================
# DisherIo - Configurador de Despliegue Multi-Entorno
# =============================================================================
# Script interactivo para configurar el despliegue según el entorno:
#   - local: localhost (desarrollo)
#   - local-ip: IP de red local (192.168.x.x)
#   - public-ip: IP pública (con Cloudflare Tunnel/ngrok)
#   - domain: Dominio propio (con Let's Encrypt)
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Directorio base
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infrastructure"

# Archivos generados
ENV_FILE="$PROJECT_ROOT/.env"
CADDYFILE="$PROJECT_ROOT/Caddyfile"
COMPOSE_OVERRIDE="$PROJECT_ROOT/docker-compose.override.yml"

# =============================================================================
# FUNCIONES AUXILIARES
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

get_local_ip() {
    # Intenta obtener la IP local en la red
    local ip=""
    
    # Linux
    if command -v ip &> /dev/null; then
        ip=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
    fi
    
    # Fallback con hostname
    if [ -z "$ip" ] && command -v hostname &> /dev/null; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    # macOS
    if [ -z "$ip" ] && command -v ifconfig &> /dev/null; then
        ip=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n 1)
    fi
    
    echo "$ip"
}

get_public_ip() {
    # Obtiene la IP pública
    local ip=""
    
    # Intenta múltiples servicios
    for service in "ifconfig.me" "icanhazip.com" "api.ipify.org"; do
        ip=$(curl -s --max-time 5 "$service" 2>/dev/null || true)
        if [ -n "$ip" ]; then
            break
        fi
    done
    
    echo "$ip"
}

# =============================================================================
# MENÚ PRINCIPAL
# =============================================================================

show_welcome() {
    clear
    print_header "🚀 DisherIo - Configurador de Despliegue"
    echo ""
    echo "Este script te ayudará a configurar DisherIo para tu entorno."
    echo ""
    echo -e "${BOLD}Modos de instalación disponibles:${NC}"
    echo ""
    echo -e "  ${GREEN}1. local${NC}      - Desarrollo local (localhost:4200)"
    echo -e "  ${GREEN}2. local-ip${NC}   - Red local (192.168.x.x) - Sin HTTPS"
    echo -e "  ${GREEN}3. public-ip${NC}  - IP pública - Con túnel (Cloudflare/ngrok)"
    echo -e "  ${GREEN}4. domain${NC}     - Dominio propio - Let's Encrypt automático"
    echo ""
    echo -e "${CYAN}Tu IP local:${NC} $(get_local_ip)"
    echo -e "${CYAN}Tu IP pública:${NC} $(get_public_ip)"
    echo ""
}

select_deployment_mode() {
    echo -e "${BOLD}Selecciona el modo de despliegue:${NC}"
    echo ""
    
    PS3=$'\nElige una opción (1-4): '
    options=(
        "local     - Desarrollo en localhost"
        "local-ip  - Red local (sin HTTPS)"
        "public-ip - IP pública (con túnel)"
        "domain    - Dominio propio (HTTPS)"
    )
    
    select opt in "${options[@]}"; do
        case $REPLY in
            1)
                DEPLOYMENT_MODE="local"
                break
                ;;
            2)
                DEPLOYMENT_MODE="local-ip"
                break
                ;;
            3)
                DEPLOYMENT_MODE="public-ip"
                break
                ;;
            4)
                DEPLOYMENT_MODE="domain"
                break
                ;;
            *)
                print_error "Opción inválida. Intenta de nuevo."
                ;;
        esac
    done
    
    echo ""
    print_success "Modo seleccionado: ${BOLD}$DEPLOYMENT_MODE${NC}"
}

# =============================================================================
# CONFIGURACIÓN POR MODO
# =============================================================================

configure_local() {
    print_header "Configuración: Modo LOCAL"
    
    echo ""
    print_info "Modo desarrollo local. La aplicación será accesible en:"
    echo -e "  ${CYAN}• Frontend:${NC} http://localhost:4200"
    echo -e "  ${CYAN}• Backend API:${NC} http://localhost:3000/api"
    echo -e "  ${CYAN}• WebSockets:${NC} ws://localhost:3000/socket.io"
    echo ""
    
    # Puerto para Caddy
    read -rp "Puerto para el servidor web [4200]: " CADDY_PORT
    CADDY_PORT=${CADDY_PORT:-4200}
    
    # Puerto para backend
    read -rp "Puerto para el backend API [3000]: " BACKEND_PORT
    BACKEND_PORT=${BACKEND_PORT:-3000}
    
    # Generar .env
    cat > "$ENV_FILE" << EOF
# ============================================
# DisherIo - Configuración Local
# ============================================

# Modo de despliegue
DEPLOYMENT_MODE=local

# URLs
FRONTEND_URL=http://localhost:$CADDY_PORT
BACKEND_URL=http://localhost:$BACKEND_PORT

# Puertos
PORT=$BACKEND_PORT
CADDY_PORT=$CADDY_PORT

# Seguridad (cambiar en producción)
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_EXPIRES=8h

# Base de datos (local)
MONGODB_URI=mongodb://mongo:27017/disherio
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=change-this-secure-password
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=change-this-app-password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# Logging
LOG_LEVEL=debug
EOF
    
    print_success "Archivo .env generado"
}

configure_local_ip() {
    print_header "Configuración: Modo LOCAL-IP"
    
    local local_ip=$(get_local_ip)
    
    echo ""
    print_info "Modo red local. La aplicación será accesible desde cualquier dispositivo"
    print_info "en tu red local usando tu IP interna."
    echo ""
    
    read -rp "IP de tu red local [$local_ip]: " SELECTED_IP
    SELECTED_IP=${SELECTED_IP:-$local_ip}
    
    echo ""
    echo "La aplicación será accesible en:"
    echo -e "  ${CYAN}• http://$SELECTED_IP${NC}"
    echo ""
    
    read -rp "Puerto HTTP [80]: " HTTP_PORT
    HTTP_PORT=${HTTP_PORT:-80}
    
    # Generar .env
    cat > "$ENV_FILE" << EOF
# ============================================
# DisherIo - Configuración Red Local
# ============================================

# Modo de despliegue
DEPLOYMENT_MODE=local-ip

# URLs (usar la IP seleccionada)
FRONTEND_URL=http://$SELECTED_IP:$HTTP_PORT
BACKEND_URL=http://$SELECTED_IP:$HTTP_PORT/api

# Configuración de red
LOCAL_IP=$SELECTED_IP
PORT=3000
HTTP_PORT=$HTTP_PORT

# Deshabilitar HTTPS en Caddy
TLS_ENABLED=false

# Seguridad
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_EXPIRES=8h

# Base de datos
MONGODB_URI=mongodb://mongo:27017/disherio
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=change-this-secure-password
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=change-this-app-password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# Logging
LOG_LEVEL=info
EOF
    
    print_success "Archivo .env generado"
}

configure_public_ip() {
    print_header "Configuración: Modo PUBLIC-IP"
    
    local public_ip=$(get_public_ip)
    
    echo ""
    print_warning "Las IPs públicas NO pueden obtener certificados SSL directamente."
    print_info "Se requiere usar un túnel para obtener HTTPS."
    echo ""
    
    echo -e "${BOLD}Opciones de túnel disponibles:${NC}"
    echo ""
    echo -e "  ${GREEN}1. Cloudflare Tunnel (Recomendado)${NC}"
    echo "     ✓ Gratuito, estable, sin límite de tiempo"
    echo "     ✓ HTTPS automático con certificado válido"
    echo ""
    echo -e "  ${GREEN}2. ngrok${NC}"
    echo "     ✓ Fácil de usar, bueno para pruebas"
    echo "     ✗ URLs temporales cambian al reiniciar"
    echo "     ✗ Limitaciones en plan gratuito"
    echo ""
    
    PS3=$'\nSelecciona una opción (1-2): '
    options=("Cloudflare Tunnel (Recomendado)" "ngrok")
    select opt in "${options[@]}"; do
        case $REPLY in
            1)
                TUNNEL_TYPE="cloudflare"
                break
                ;;
            2)
                TUNNEL_TYPE="ngrok"
                break
                ;;
            *)
                print_error "Opción inválida."
                ;;
        esac
    done
    
    if [ "$TUNNEL_TYPE" == "cloudflare" ]; then
        configure_cloudflare_tunnel "$public_ip"
    else
        configure_ngrok "$public_ip"
    fi
}

configure_cloudflare_tunnel() {
    local public_ip=$1
    
    echo ""
    print_header "Configuración: Cloudflare Tunnel"
    echo ""
    
    print_info "Necesitarás una cuenta gratuita de Cloudflare."
    echo ""
    echo -e "${BOLD}Pasos a seguir:${NC}"
    echo "  1. Crea una cuenta en https://dash.cloudflare.com/sign-up"
    echo "  2. Añade tu dominio (puede ser uno gratuito de workers.dev)"
    echo "  3. Ve a Zero Trust > Networks > Tunnels"
    echo "  4. Crea un túnel y copia el TOKEN"
    echo ""
    
    read -rp "¿Ya tienes el TOKEN de Cloudflare Tunnel? (s/n): " has_token
    
    if [[ ! "$has_token" =~ ^[Ss]$ ]]; then
        echo ""
        print_info "Guarda este TOKEN cuando lo tengas y vuelve a ejecutar este script."
        echo ""
        echo -e "${CYAN}URL de ayuda:${NC} https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/"
        exit 0
    fi
    
    read -rp "Cloudflare Tunnel TOKEN: " CF_TUNNEL_TOKEN
    
    while [ -z "$CF_TUNNEL_TOKEN" ]; do
        print_error "El TOKEN es obligatorio"
        read -rp "Cloudflare Tunnel TOKEN: " CF_TUNNEL_TOKEN
    done
    
    read -rp "Dominio asignado por Cloudflare (ej: tunel-tuuuid.cfargotunnel.com): " CF_TUNNEL_DOMAIN
    
    # Generar .env
    cat > "$ENV_FILE" << EOF
# ============================================
# DisherIo - Configuración IP Pública (Cloudflare)
# ============================================

# Modo de despliegue
DEPLOYMENT_MODE=public-ip
TUNNEL_TYPE=cloudflare

# Cloudflare Tunnel
CF_TUNNEL_TOKEN=$CF_TUNNEL_TOKEN
CF_TUNNEL_DOMAIN=${CF_TUNNEL_DOMAIN:-}

# URLs (se usarán las del túnel)
TUNNEL_URL=https://$CF_TUNNEL_DOMAIN
FRONTEND_URL=https://$CF_TUNNEL_DOMAIN
BACKEND_URL=https://$CF_TUNNEL_DOMAIN/api

# Configuración de red
PUBLIC_IP=$public_ip
PORT=3000

# Puerto interno de Caddy (el túnel se conecta aquí)
CADDY_INTERNAL_PORT=8080

# Seguridad
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_EXPIRES=8h

# Base de datos
MONGODB_URI=mongodb://mongo:27017/disherio
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=change-this-secure-password
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=change-this-app-password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# Logging
LOG_LEVEL=info
EOF
    
    print_success "Archivo .env generado"
    
    echo ""
    print_info "El túnel de Cloudflare se ejecutará automáticamente con Docker Compose."
    print_info "Tu aplicación estará disponible en: https://$CF_TUNNEL_DOMAIN"
}

configure_ngrok() {
    local public_ip=$1
    
    echo ""
    print_header "Configuración: ngrok"
    echo ""
    
    print_info "ngrok es ideal para pruebas temporales."
    echo ""
    
    read -rp "¿Tienes authtoken de ngrok? (s/n): " has_ngrok
    
    if [[ "$has_ngrok" =~ ^[Ss]$ ]]; then
        read -rp "ngrok authtoken: " NGROK_AUTHTOKEN
    else
        print_info "Puedes obtener un authtoken gratuito en: https://dashboard.ngrok.com/get-started/your-authtoken"
        NGROK_AUTHTOKEN=""
    fi
    
    # Generar .env
    cat > "$ENV_FILE" << EOF
# ============================================
# DisherIo - Configuración IP Pública (ngrok)
# ============================================

# Modo de despliegue
DEPLOYMENT_MODE=public-ip
TUNNEL_TYPE=ngrok

# ngrok
NGROK_AUTHTOKEN=$NGROK_AUTHTOKEN

# URLs (ngrok generará una URL temporal)
TUNNEL_TYPE_LABEL=ngrok
FRONTEND_URL=http://localhost
BACKEND_URL=http://localhost/api

# Configuración de red
PUBLIC_IP=$public_ip
PORT=3000

# Puerto interno de Caddy
CADDY_INTERNAL_PORT=8080

# Seguridad
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_EXPIRES=8h

# Base de datos
MONGODB_URI=mongodb://mongo:27017/disherio
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=change-this-secure-password
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=change-this-app-password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# Logging
LOG_LEVEL=info
EOF
    
    print_success "Archivo .env generado"
    
    echo ""
    print_warning "ngrok generará una URL temporal cada vez que inicies."
    print_info "Revisa los logs para ver la URL asignada: docker compose logs -f ngrok"
}

configure_domain() {
    print_header "Configuración: Modo DOMAIN"
    
    echo ""
    print_info "Modo dominio propio con HTTPS automático vía Let's Encrypt."
    echo ""
    
    read -rp "Tu dominio (ej: disherio.tudominio.com): " DOMAIN
    
    while [ -z "$DOMAIN" ]; do
        print_error "El dominio es obligatorio"
        read -rp "Tu dominio: " DOMAIN
    done
    
    echo ""
    echo -e "${BOLD}Verificación de requisitos:${NC}"
    echo ""
    
    print_info "Para que Let's Encrypt funcione, asegúrate de:"
    echo "  1. El dominio $DOMAIN apunte a esta IP pública"
    echo "  2. Los puertos 80 y 443 estén abiertos en el firewall"
    echo "  3. No haya otro servicio usando esos puertos"
    echo ""
    
    local public_ip=$(get_public_ip)
    read -rp "¿El dominio $DOMAIN apunta a la IP $public_ip? (s/n): " dns_ok
    
    if [[ ! "$dns_ok" =~ ^[Ss]$ ]]; then
        print_warning "Por favor configura el DNS antes de continuar."
        echo "Apunta $DOMAIN a $public_ip"
        exit 0
    fi
    
    read -rp "Email para notificaciones de Let's Encrypt: " EMAIL
    EMAIL=${EMAIL:-admin@$DOMAIN}
    
    # Generar .env
    cat > "$ENV_FILE" << EOF
# ============================================
# DisherIo - Configuración Dominio Propio
# ============================================

# Modo de despliegue
DEPLOYMENT_MODE=domain

# Dominio
DOMAIN=$DOMAIN
EMAIL=$EMAIL

# URLs
FRONTEND_URL=https://$DOMAIN
BACKEND_URL=https://$DOMAIN/api

# HTTPS - Let's Encrypt automático
TLS_ENABLED=true
TLS_AUTO=true

# Configuración de red
PORT=3000
HTTPS_PORT=443
HTTP_PORT=80

# Seguridad
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_EXPIRES=8h

# Base de datos
MONGODB_URI=mongodb://mongo:27017/disherio
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=change-this-secure-password
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=change-this-app-password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# Logging
LOG_LEVEL=info
EOF
    
    print_success "Archivo .env generado"
    print_info "Let's Encrypt generará certificados automáticamente al iniciar."
}

# =============================================================================
# GENERACIÓN DE ARCHIVOS DE CONFIGURACIÓN
# =============================================================================

generate_caddyfile() {
    print_header "Generando Caddyfile"
    
    local mode=$DEPLOYMENT_MODE
    local template_file="$INFRA_DIR/caddy-templates/Caddyfile.$mode"
    
    if [ ! -f "$template_file" ]; then
        print_error "Template no encontrado: $template_file"
        exit 1
    fi
    
    # Copiar template
    cp "$template_file" "$CADDYFILE"
    
    # Reemplazar variables según el modo
    case $mode in
        local)
            sed -i "s/\${CADDY_PORT}/$CADDY_PORT/g" "$CADDYFILE" 2>/dev/null || \
            sed -e "s/\${CADDY_PORT}/$CADDY_PORT/g" "$CADDYFILE" > "$CADDYFILE.tmp" && mv "$CADDYFILE.tmp" "$CADDYFILE"
            ;;
        local-ip)
            sed -i "s/\${LOCAL_IP}/$SELECTED_IP/g" "$CADDYFILE" 2>/dev/null || \
            sed -e "s/\${LOCAL_IP}/$SELECTED_IP/g" "$CADDYFILE" > "$CADDYFILE.tmp" && mv "$CADDYFILE.tmp" "$CADDYFILE"
            sed -i "s/\${HTTP_PORT}/$HTTP_PORT/g" "$CADDYFILE" 2>/dev/null || \
            sed -e "s/\${HTTP_PORT}/$HTTP_PORT/g" "$CADDYFILE" > "$CADDYFILE.tmp" && mv "$CADDYFILE.tmp" "$CADDYFILE"
            ;;
        public-ip)
            local internal_port=${CADDY_INTERNAL_PORT:-8080}
            sed -i "s/\${CADDY_INTERNAL_PORT}/$internal_port/g" "$CADDYFILE" 2>/dev/null || \
            sed -e "s/\${CADDY_INTERNAL_PORT}/$internal_port/g" "$CADDYFILE" > "$CADDYFILE.tmp" && mv "$CADDYFILE.tmp" "$CADDYFILE"
            ;;
        domain)
            sed -i "s/\${DOMAIN}/$DOMAIN/g" "$CADDYFILE" 2>/dev/null || \
            sed -e "s/\${DOMAIN}/$DOMAIN/g" "$CADDYFILE" > "$CADDYFILE.tmp" && mv "$CADDYFILE.tmp" "$CADDYFILE"
            sed -i "s/\${EMAIL}/$EMAIL/g" "$CADDYFILE" 2>/dev/null || \
            sed -e "s/\${EMAIL}/$EMAIL/g" "$CADDYFILE" > "$CADDYFILE.tmp" && mv "$CADDYFILE.tmp" "$CADDYFILE"
            ;;
    esac
    
    print_success "Caddyfile generado para modo: $mode"
}

generate_docker_compose_override() {
    print_header "Generando Docker Compose Override"
    
    local mode=$DEPLOYMENT_MODE
    local template_file="$INFRA_DIR/docker-compose.$mode.yml"
    
    if [ -f "$template_file" ]; then
        cp "$template_file" "$COMPOSE_OVERRIDE"
        print_success "docker-compose.override.yml generado"
    else
        # Si no hay template específico, crear uno vacío o genérico
        cat > "$COMPOSE_OVERRIDE" << 'EOF'
# ============================================
# Docker Compose Override
# Generado automáticamente por configure.sh
# ============================================

# Este archivo extiende la configuración base según el modo seleccionado
# Ver docker-compose.yml para la configuración completa
EOF
        print_info "Usando configuración base estándar"
    fi
}

# =============================================================================
# RESUMEN Y FINALIZACIÓN
# =============================================================================

show_summary() {
    print_header "Resumen de Configuración"
    
    echo ""
    echo -e "${BOLD}Modo de despliegue:${NC} $DEPLOYMENT_MODE"
    echo ""
    
    case $DEPLOYMENT_MODE in
        local)
            echo -e "  ${CYAN}Frontend:${NC} http://localhost:$CADDY_PORT"
            echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
            ;;
        local-ip)
            echo -e "  ${CYAN}URL de acceso:${NC} http://$SELECTED_IP:$HTTP_PORT"
            echo -e "  ${CYAN}Nota:${NC} Accesible desde cualquier dispositivo en tu red local"
            ;;
        public-ip)
            if [ "$TUNNEL_TYPE" == "cloudflare" ]; then
                echo -e "  ${CYAN}Túnel:${NC} Cloudflare Tunnel"
                echo -e "  ${CYAN}URL:${NC} https://$CF_TUNNEL_DOMAIN"
                echo -e "  ${CYAN}Nota:${NC} HTTPS automático y gratuito"
            else
                echo -e "  ${CYAN}Túnel:${NC} ngrok"
                echo -e "  ${CYAN}URL:${NC} Se mostrará al iniciar (docker compose logs -f ngrok)"
                echo -e "  ${CYAN}Nota:${NC} URL temporal que cambia al reiniciar"
            fi
            ;;
        domain)
            echo -e "  ${CYAN}Dominio:${NC} https://$DOMAIN"
            echo -e "  ${CYAN}Email:${NC} $EMAIL"
            echo -e "  ${CYAN}Certificado:${NC} Let's Encrypt (automático)"
            ;;
    esac
    
    echo ""
    echo -e "${BOLD}Archivos generados:${NC}"
    echo -e "  • $ENV_FILE"
    echo -e "  • $CADDYFILE"
    echo -e "  • $COMPOSE_OVERRIDE"
    echo ""
}

show_next_steps() {
    print_header "Próximos Pasos"
    
    echo ""
    echo -e "${BOLD}Para iniciar DisherIo:${NC}"
    echo ""
    echo -e "  ${GREEN}1.${NC} Construir imágenes:"
    echo -e "     ${CYAN}docker compose build${NC}"
    echo ""
    echo -e "  ${GREEN}2.${NC} Iniciar servicios:"
    echo -e "     ${CYAN}docker compose up -d${NC}"
    echo ""
    echo -e "  ${GREEN}3.${NC} Ver logs:"
    echo -e "     ${CYAN}docker compose logs -f${NC}"
    echo ""
    
    if [ "$DEPLOYMENT_MODE" == "public-ip" ] && [ "$TUNNEL_TYPE" == "cloudflare" ]; then
        echo -e "  ${GREEN}4.${NC} Verificar túnel de Cloudflare:"
        echo -e "     ${CYAN}docker compose logs -f cloudflared${NC}"
        echo ""
    fi
    
    echo -e "${BOLD}Para cambiar la configuración:${NC}"
    echo -e "  ${CYAN}./infrastructure/scripts/configure.sh${NC}"
    echo ""
    
    print_success "¡Configuración completada!"
}

# =============================================================================
# EJECUCIÓN PRINCIPAL
# =============================================================================

main() {
    # Verificar dependencias
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        exit 1
    fi
    
    show_welcome
    select_deployment_mode
    
    # Configurar según el modo seleccionado
    case $DEPLOYMENT_MODE in
        local)
            configure_local
            ;;
        local-ip)
            configure_local_ip
            ;;
        public-ip)
            configure_public_ip
            ;;
        domain)
            configure_domain
            ;;
    esac
    
    # Generar archivos de configuración
    generate_caddyfile
    generate_docker_compose_override
    
    # Mostrar resumen
    show_summary
    show_next_steps
}

# Ejecutar si se llama directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
