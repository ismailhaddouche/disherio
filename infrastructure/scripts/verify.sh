#!/bin/bash
# =============================================================================
# DisherIo - Script de Verificación de Configuración
# =============================================================================
# Verifica que todo esté correctamente configurado antes de iniciar
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ERRORS=0
WARNINGS=0

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
}

# =============================================================================
# VERIFICACIONES
# =============================================================================

check_docker() {
    print_header "Verificando Docker"
    
    if command -v docker &> /dev/null; then
        local version=$(docker --version)
        print_success "Docker instalado: $version"
    else
        print_error "Docker no está instalado"
        return 1
    fi
    
    if command -v docker compose &> /dev/null; then
        local version=$(docker compose version)
        print_success "Docker Compose instalado: $version"
    else
        print_error "Docker Compose no está instalado"
        return 1
    fi
    
    # Verificar que Docker daemon esté corriendo
    if docker info &> /dev/null; then
        print_success "Docker daemon está corriendo"
    else
        print_error "Docker daemon no está corriendo"
        return 1
    fi
}

check_files() {
    print_header "Verificando Archivos de Configuración"
    
    # .env
    if [ -f "$PROJECT_ROOT/.env" ]; then
        print_success ".env encontrado"
        
        # Verificar DEPLOYMENT_MODE
        if grep -q "DEPLOYMENT_MODE=" "$PROJECT_ROOT/.env"; then
            local mode=$(grep "DEPLOYMENT_MODE=" "$PROJECT_ROOT/.env" | cut -d'=' -f2 | tr -d '"')
            print_info "Modo de despliegue: ${BOLD}$mode${NC}"
        else
            print_warning "DEPLOYMENT_MODE no definido en .env"
        fi
    else
        print_error ".env no encontrado. Ejecuta: ./infrastructure/scripts/configure.sh"
        return 1
    fi
    
    # Caddyfile
    if [ -f "$PROJECT_ROOT/Caddyfile" ]; then
        print_success "Caddyfile encontrado"
    else
        print_error "Caddyfile no encontrado. Ejecuta: ./infrastructure/scripts/configure.sh"
    fi
    
    # docker-compose.yml
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        print_success "docker-compose.yml encontrado"
    else
        print_error "docker-compose.yml no encontrado"
    fi
}

check_environment() {
    print_header "Verificando Variables de Entorno"
    
    # Cargar .env
    set -a
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
    set +a
    
    # Verificar JWT_SECRET
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "cambia-esto-por-un-secreto-largo" ]; then
        print_warning "JWT_SECRET no configurado o es el valor por defecto"
    else
        print_success "JWT_SECRET configurado"
    fi
    
    # Verificar según el modo
    case "$DEPLOYMENT_MODE" in
        local)
            print_info "Modo local - No se requieren configuraciones adicionales"
            ;;
        local-ip)
            if [ -n "$LOCAL_IP" ]; then
                print_info "IP local configurada: $LOCAL_IP"
                # Verificar que la IP pertenezca a esta máquina
                local current_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
                if [ "$LOCAL_IP" = "$current_ip" ]; then
                    print_success "IP local coincide con la IP actual"
                else
                    print_warning "IP local ($LOCAL_IP) no coincide con IP actual ($current_ip)"
                fi
            else
                print_warning "LOCAL_IP no configurada"
            fi
            ;;
        public-ip)
            case "$TUNNEL_TYPE" in
                cloudflare)
                    if [ -n "$CF_TUNNEL_TOKEN" ]; then
                        print_success "Cloudflare Tunnel TOKEN configurado"
                    else
                        print_error "CF_TUNNEL_TOKEN no configurado"
                    fi
                    ;;
                ngrok)
                    if [ -n "$NGROK_AUTHTOKEN" ]; then
                        print_success "ngrok authtoken configurado"
                    else
                        print_error "NGROK_AUTHTOKEN no configurado"
                    fi
                    ;;
                *)
                    print_warning "TUNNEL_TYPE no configurado o desconocido"
                    ;;
            esac
            ;;
        domain)
            if [ -n "$DOMAIN" ]; then
                print_info "Dominio configurado: $DOMAIN"
                # Verificar resolución DNS
                if command -v dig &> /dev/null; then
                    local resolved_ip=$(dig +short "$DOMAIN" 2>/dev/null || true)
                    local public_ip=$(curl -s ifconfig.me 2>/dev/null || true)
                    if [ -n "$resolved_ip" ]; then
                        print_info "Dominio resuelve a: $resolved_ip"
                        if [ "$resolved_ip" = "$public_ip" ]; then
                            print_success "Dominio apunta a esta IP pública"
                        else
                            print_warning "Dominio no apunta a esta IP pública ($public_ip)"
                        fi
                    else
                        print_warning "No se pudo resolver el dominio $DOMAIN"
                    fi
                fi
            else
                print_error "DOMAIN no configurado"
            fi
            
            if [ -n "$EMAIL" ]; then
                print_success "Email configurado: $EMAIL"
            else
                print_warning "EMAIL no configurado (necesario para Let's Encrypt)"
            fi
            ;;
        *)
            print_warning "DEPLOYMENT_MODE desconocido o no configurado"
            ;;
    esac
}

check_ports() {
    print_header "Verificando Puertos"
    
    set -a
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
    set +a
    
    local http_port=${HTTP_PORT:-80}
    local https_port=${HTTPS_PORT:-443}
    local backend_port=${PORT:-3000}
    
    # Verificar si los puertos están en uso
    if command -v netstat &> /dev/null || command -v ss &> /dev/null; then
        for port in "$http_port" "$https_port" "$backend_port"; do
            if ss -tln | grep -q ":$port " || netstat -tln 2>/dev/null | grep -q ":$port "; then
                print_warning "Puerto $port está en uso"
            else
                print_success "Puerto $port disponible"
            fi
        done
    else
        print_info "No se puede verificar puertos (netstat/ss no disponible)"
    fi
}

check_resources() {
    print_header "Verificando Recursos del Sistema"
    
    # Memoria
    if command -v free &> /dev/null; then
        local memory=$(free -h | awk '/^Mem:/ {print $2}')
        local available=$(free -h | awk '/^Mem:/ {print $7}')
        print_info "Memoria total: $memory"
        print_info "Memoria disponible: $available"
        
        # Convertir a MB para comparar
        local avail_mb=$(free -m | awk '/^Mem:/ {print $7}')
        if [ "$avail_mb" -lt 1024 ]; then
            print_warning "Memoria disponible baja (${avail_mb}MB). Se recomiendan al menos 2GB."
        else
            print_success "Memoria suficiente"
        fi
    fi
    
    # Disco
    if command -v df &> /dev/null; then
        local disk=$(df -h . | awk 'NR==2 {print $4}')
        print_info "Espacio disponible: $disk"
    fi
}

# =============================================================================
# RESUMEN
# =============================================================================

show_summary() {
    print_header "Resumen de Verificación"
    
    echo ""
    if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✓ Todo está configurado correctamente${NC}"
        echo ""
        echo "Puedes iniciar DisherIo con:"
        echo -e "  ${CYAN}docker compose up -d --build${NC}"
        return 0
    elif [ $ERRORS -eq 0 ]; then
        echo -e "${YELLOW}${BOLD}⚠ Configuración válida con advertencias${NC}"
        echo ""
        echo "Puedes iniciar DisherIo, pero revisa las advertencias:"
        echo -e "  ${CYAN}docker compose up -d --build${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}✗ Se encontraron errores${NC}"
        echo ""
        echo "Por favor corrige los errores antes de continuar."
        echo "Ejecuta el configurador:"
        echo -e "  ${CYAN}./infrastructure/scripts/configure.sh${NC}"
        return 1
    fi
}

# =============================================================================
# EJECUCIÓN
# =============================================================================

main() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}         DisherIo - Verificación de Configuración${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    
    check_docker
    check_files
    check_environment
    check_ports
    check_resources
    show_summary
}

main "$@"
