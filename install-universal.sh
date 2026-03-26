#!/usr/bin/env bash
# =============================================================================
# DisherIO - Instalador Universal Automatizado
# Punto de entrada único: clona, configura, instala y verifica todo
# Uso: curl -sSL https://raw.githubusercontent.com/.../install.sh | sudo bash
#      o: sudo ./install.sh
# =============================================================================
set -euo pipefail

# Version
INSTALLER_VERSION="3.0.0"
REPO_URL="https://github.com/ismailhaddouche/disherio.git"
INSTALL_DIR="/opt/disherio"
LOG_FILE="/var/log/disherio-install.log"

# Colores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1" | tee -a "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; }

# Banner
banner() {
    echo -e "${CYAN}"
    echo "  ╔════════════════════════════════════════════════════════════════╗"
    echo "  ║           DisherIO - Instalador Automatizado v${INSTALLER_VERSION}         ║"
    echo "  ║                                                                ║"
    echo "  ║   Sistema de gestión de restaurantes - SaaS completo          ║"
    echo "  ╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# =============================================================================
# DETECCION DE MODO
# =============================================================================

detect_mode() {
    # Detectar si estamos en el repo clonado o en modo curl|bash
    if [ -f "docker-compose.yml" ] && [ -d "backend" ] && [ -d "frontend" ]; then
        echo "local"
    else
        echo "remote"
    fi
}

# =============================================================================
# VERIFICACIONES PRE-INSTALACION
# =============================================================================

check_prerequisites() {
    log_info "Verificando requisitos del sistema..."
    
    # Verificar root
    if [ "$EUID" -ne 0 ]; then
        log_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
    
    # Verificar sistema operativo
    if [ ! -f /etc/os-release ]; then
        log_error "Sistema operativo no soportado"
        exit 1
    fi
    
    # Verificar RAM
    RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "0")
    if [ "$RAM_MB" -lt 1024 ]; then
        log_error "RAM insuficiente: ${RAM_MB}MB (minimo 1GB)"
        exit 1
    fi
    log_success "RAM: ${RAM_MB}MB"
    
    # Verificar disco
    DISK_GB=$(df -BG /tmp 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G' || echo "0")
    if [ "$DISK_GB" -lt 5 ]; then
        log_error "Espacio en disco insuficiente: ${DISK_GB}GB (minimo 5GB)"
        exit 1
    fi
    log_success "Disco: ${DISK_GB}GB disponible"
    
    # Verificar conectividad
    if ! ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
        log_error "No hay conectividad a internet"
        exit 1
    fi
    log_success "Conectividad: OK"
}

# =============================================================================
# INSTALACION DE DEPENDENCIAS
# =============================================================================

install_dependencies() {
    log_info "Instalando dependencias del sistema..."
    
    export DEBIAN_FRONTEND=noninteractive
    
    apt-get update -qq >/dev/null 2>&1
    
    # Instalar paquetes necesarios
    PACKAGES="curl wget git ufw openssl ca-certificates gnupg lsb-release"
    
    for pkg in $PACKAGES; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            log_info "Instalando $pkg..."
            apt-get install -y -qq "$pkg" </dev/null >/dev/null 2>&1 || true
        fi
    done
    
    # Instalar Docker si no existe
    if ! command -v docker >/dev/null 2>&1; then
        log_info "Instalando Docker..."
        curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
        systemctl enable docker >/dev/null 2>&1
        systemctl start docker >/dev/null 2>&1
    fi
    
    # Verificar Docker Compose
    if ! docker compose version >/dev/null 2>&1 && ! docker-compose version >/dev/null 2>&1; then
        log_info "Instalando Docker Compose..."
        apt-get install -y -qq docker-compose-plugin </dev/null >/dev/null 2>&1 || true
    fi
    
    log_success "Dependencias instaladas"
}

# =============================================================================
# CLONADO DEL REPOSITORIO
# =============================================================================

clone_repository() {
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "El directorio $INSTALL_DIR ya existe"
        read -p "¿Eliminar y reinstalar? (s/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            log_info "Eliminando instalación anterior..."
            rm -rf "$INSTALL_DIR"
        else
            log_info "Actualizando repositorio existente..."
            cd "$INSTALL_DIR"
            git pull --quiet
            return 0
        fi
    fi
    
    log_info "Clonando repositorio..."
    git clone --depth 1 --quiet "$REPO_URL" "$INSTALL_DIR"
    log_success "Repositorio clonado en $INSTALL_DIR"
}

# =============================================================================
# CONFIGURACION AUTOMATICA
# =============================================================================

auto_configure() {
    log_info "Configurando DisherIO..."
    
    cd "$INSTALL_DIR"
    
    # Detectar IP
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    # Generar secretos
    JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    ADMIN_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 16)
    ADMIN_PIN="0000"
    
    # Crear .env
    cat > .env <<EOF
NODE_ENV=production
PORT=80
HTTPS_PORT=443
BACKEND_PORT=3000
MONGODB_URI=mongodb://mongo:27017/disherio
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=8h
ADMIN_EMAIL=admin@disherio.com
APP_LANG=es
FRONTEND_URL=http://${LOCAL_IP}
LOG_LEVEL=info
EOF
    
    # Crear Caddyfile para IP local
    cat > Caddyfile <<'EOF'
{
    admin off
    auto_https off
}

:80 {
    handle /api/* {
        reverse_proxy backend:3000
    }

    handle /socket.io/* {
        reverse_proxy backend:3000 {
            transport http {
                versions h1
            }
        }
    }

    handle {
        reverse_proxy frontend:4200
    }
}
EOF
    
    # Guardar credenciales
    cat > .credentials <<EOF
# DisherIO - Credenciales de Administrador
# Generado: $(date '+%Y-%m-%d %H:%M:%S')

ADMIN_EMAIL=admin@disherio.com
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_PIN=${ADMIN_PIN}

URL_DE_ACCESO=http://${LOCAL_IP}
EOF
    
    chmod 600 .credentials
    
    log_success "Configuración completada"
}

# =============================================================================
# APLICAR FIXES AUTOMATICAMENTE
# =============================================================================

apply_fixes() {
    log_info "Aplicando correcciones automáticas..."
    
    cd "$INSTALL_DIR"
    
    # Verificar que los scripts de fix existen
    if [ -f "scripts/fix-critical-bugs.sh" ]; then
        log_info "Aplicando correcciones de bugs críticos..."
        bash scripts/fix-critical-bugs.sh >/dev/null 2>&1 || log_warn "Algunas correcciones no se aplicaron"
    fi
    
    if [ -f "scripts/fix-security-ratelimit.sh" ]; then
        log_info "Aplicando correcciones de seguridad..."
        bash scripts/fix-security-ratelimit.sh >/dev/null 2>&1 || log_warn "Algunas correcciones de seguridad no se aplicaron"
    fi
    
    if [ -f "scripts/fix-performance.sh" ]; then
        log_info "Aplicando optimizaciones de rendimiento..."
        bash scripts/fix-performance.sh >/dev/null 2>&1 || log_warn "Algunas optimizaciones no se aplicaron"
    fi
    
    log_success "Correcciones aplicadas"
}

# =============================================================================
# CONSTRUCCION E INICIO
# =============================================================================

build_and_start() {
    log_info "Construyendo e iniciando servicios..."
    
    cd "$INSTALL_DIR"
    
    # Construir imágenes
    docker compose build --quiet 2>&1 | tee -a "$LOG_FILE" | grep -E "(ERROR|error)" || true
    
    # Iniciar servicios
    docker compose up -d 2>&1 | tee -a "$LOG_FILE"
    
    # Esperar a que MongoDB esté listo
    log_info "Esperando a que MongoDB esté listo..."
    local max_wait=60
    local waited=0
    while ! docker compose exec -T mongo mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
        sleep 2
        waited=$((waited + 2))
        echo -n "."
        if [ $waited -ge $max_wait ]; then
            log_error "MongoDB no respondió a tiempo"
            exit 1
        fi
    done
    echo
    log_success "MongoDB listo"
}

# =============================================================================
# INYECCION DE CREDENCIALES
# =============================================================================

inject_credentials() {
    log_info "Configurando credenciales de administrador..."
    
    cd "$INSTALL_DIR"
    
    # Cargar credenciales
    source .credentials
    
    # Crear usuario admin directamente en MongoDB
    docker compose exec -T mongo mongosh disherio --quiet --eval "
        // Crear restaurante
        var restaurant = db.restaurants.findOne({ restaurant_name: 'DisherIO Demo' });
        if (!restaurant) {
            var result = db.restaurants.insertOne({
                restaurant_name: 'DisherIO Demo',
                tax_rate: 10,
                currency: 'EUR',
                language: 'es',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            restaurant = db.restaurants.findOne({ _id: result.insertedId });
        }
        
        // Crear rol admin
        var role = db.roles.findOne({ restaurant_id: restaurant._id, role_name: 'Admin' });
        if (!role) {
            var result = db.roles.insertOne({
                restaurant_id: restaurant._id,
                role_name: 'Admin',
                permissions: ['ADMIN'],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            role = db.roles.findOne({ _id: result.insertedId });
        }
        
        // Crear usuario admin
        var staff = db.staffs.findOne({ email: '${ADMIN_EMAIL}' });
        if (!staff) {
            db.staffs.insertOne({
                restaurant_id: restaurant._id,
                role_id: role._id,
                staff_name: 'Administrator',
                email: '${ADMIN_EMAIL}',
                password_hash: '\$2a\$12\$placeholder',
                pin_code_hash: '\$2a\$12\$placeholder',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        print('Usuario creado');
    "
    
    # Hashear contraseñas con bcrypt usando Node
    docker compose exec -T backend node -e "
        const bcrypt = require('bcryptjs');
        const mongoose = require('mongoose');
        
        async function updatePasswords() {
            await mongoose.connect(process.env.MONGODB_URI);
            
            const passwordHash = await bcrypt.hash('${ADMIN_PASSWORD}', 12);
            const pinHash = await bcrypt.hash('${ADMIN_PIN}', 12);
            
            await mongoose.connection.collection('staffs').updateOne(
                { email: '${ADMIN_EMAIL}' },
                { \$set: { 
                    password_hash: passwordHash,
                    pin_code_hash: pinHash,
                    updatedAt: new Date()
                }}
            );
            
            console.log('Contraseñas actualizadas');
            await mongoose.disconnect();
        }
        
        updatePasswords().catch(e => {
            console.error('Error:', e.message);
            process.exit(1);
        });
    "
    
    log_success "Credenciales configuradas"
}

# =============================================================================
# CONFIGURACION DE FIREWALL
# =============================================================================

configure_firewall() {
    log_info "Configurando firewall..."
    
    # Permitir puertos necesarios
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    
    # Habilitar firewall (no bloqueante en modo non-interactive)
    echo "y" | ufw enable >/dev/null 2>&1 || true
    
    log_success "Firewall configurado"
}

# =============================================================================
# VERIFICACION FINAL
# =============================================================================

verify_installation() {
    log_info "Verificando instalación..."
    
    cd "$INSTALL_DIR"
    
    # Verificar contenedores
    local all_running=true
    for container in disherio_mongo disherio_backend disherio_frontend disherio_caddy; do
        if ! docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            log_error "Contenedor $container no está ejecutándose"
            all_running=false
        fi
    done
    
    if [ "$all_running" = true ]; then
        log_success "Todos los servicios están ejecutándose"
    else
        log_error "Algunos servicios no se iniciaron correctamente"
        docker compose logs --tail=50
        exit 1
    fi
    
    # Verificar credenciales
    local admin_exists=$(docker compose exec -T mongo mongosh disherio --quiet --eval "
        db.staffs.findOne({email: 'admin@disherio.com'}) ? 'EXISTS' : 'NOT_FOUND'
    " 2>/dev/null || echo "ERROR")
    
    if [ "$admin_exists" = "EXISTS" ]; then
        log_success "Usuario administrador verificado"
    else
        log_error "Usuario administrador no encontrado"
        exit 1
    fi
}

# =============================================================================
# RESUMEN FINAL
# =============================================================================

print_summary() {
    cd "$INSTALL_DIR"
    source .credentials
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}           ${BOLD}DISHER.IO INSTALADO CORRECTAMENTE${NC}                  ${GREEN}║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}URL de Acceso:${NC}                                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    http://${LOCAL_IP}                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}CREDENCIALES DE ADMINISTRADOR:${NC}                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Email:    ${BOLD}${ADMIN_EMAIL}${NC}                              ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Password: ${BOLD}${ADMIN_PASSWORD}${NC}                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    PIN:      ${BOLD}${ADMIN_PIN}${NC}                                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}IMPORTANTE:${NC}                                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  - Cambia la contraseña después del primer login               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  - Credenciales guardadas en: ${INSTALL_DIR}/.credentials       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  - Logs de instalación: ${LOG_FILE}                            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Comandos útiles:${NC}"
    echo "  cd ${INSTALL_DIR}"
    echo "  docker compose logs -f backend    # Ver logs del backend"
    echo "  docker compose logs -f mongo      # Ver logs de MongoDB"
    echo "  docker compose restart            # Reiniciar servicios"
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Inicializar log
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "=== DisherIO Installer v${INSTALLER_VERSION} - $(date) ===" > "$LOG_FILE"
    
    banner
    
    # Detectar modo
    MODE=$(detect_mode)
    if [ "$MODE" = "local" ]; then
        log_info "Modo local detectado - usando repositorio actual"
        INSTALL_DIR="$(pwd)"
    fi
    
    # Ejecutar pasos
    check_prerequisites
    install_dependencies
    
    if [ "$MODE" = "remote" ]; then
        clone_repository
    fi
    
    auto_configure
    apply_fixes
    build_and_start
    inject_credentials
    configure_firewall
    verify_installation
    
    print_summary
}

# Ejecutar
main "$@"
