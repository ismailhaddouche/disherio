#!/usr/bin/env bash
# =============================================================================
# DisherIo - Full Installer
# Interactive installer with multi-language support and robust healthchecks.
# =============================================================================
# VALIDACIÓN: Fallar en errores críticos
set -euo pipefail

# Función para manejar errores
error_exit() {
  echo -e "${RED}❌ ERROR: $1${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}Revisa el log: $LOG_FILE${NC}"
  exit 1
}

# ── Styles ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
CADDYFILE="$ROOT_DIR/Caddyfile"
LOG_FILE="/var/log/disherio_install.log"

# Initial checks
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Por favor, ejecuta el script como root (sudo ./scripts/install.sh)${NC}"
  echo -e "${RED}Please run as root (sudo ./scripts/install.sh)${NC}"
  exit 1
fi

banner() {
  echo -e "${CYAN}"
  echo "  ██████╗ ██╗███████╗██╗  ██╗███████╗██████╗ ██╗ ██████╗ "
  echo "  ██╔══██╗██║██╔════╝██║  ██║██╔════╝██╔══██╗██║██╔═══██╗"
  echo "  ██║  ██║██║███████╗███████║█████╗  ██████╔╝██║██║   ██║"
  echo "  ██║  ██║██║╚════██║██╔══██║██╔══╝  ██╔══██╗██║██║   ██║"
  echo "  ██████╔╝██║███████║██║  ██║███████╗██║  ██║██║╚██████╔╝"
  echo "  ╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝ "
  echo -e "${NC}"
  echo -e "${BOLD}  Instalador v2.0 — Sistema de gestión de restaurantes${NC}"
  echo ""
}

# ── 1. Language Selection ─────────────────────────────────────────────────────
select_language() {
    echo -e "\nSelecciona el idioma / Select language:"
    echo -e "1) Español"
    echo -e "2) English"
    read -p "Opcion [1-2] (default: 1): " LANG_OPT

    if [ "${LANG_OPT:-1}" = "2" ]; then
        APP_LANG="en"
        MSG_STEP1="[1/6] Access Configuration"
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
        MSG_STEP2="[2/6] Security & Dependencies"
        MSG_STEP3="[3/6] Writing Configuration..."
        MSG_STEP4="[4/6] Building Images..."
        MSG_STEP5="[5/6] Starting Services..."
        MSG_STEP6="[6/6] Healthcheck & Seeding..."
        MSG_INST_OK="DISHER.IO INSTALLED SUCCESSFULLY"
        MSG_CRED="--- Initial Credentials ---"
        MSG_ACCESS="Access URL: "
        MSG_PORT_STEP="[1.5/6] Port Configuration"
        MSG_PORT_PROMPT="HTTP Port (default 80): "
        MSG_PORT_BUSY="Port is already in use!"
        MSG_HEALTH="Waiting for backend to be ready..."
        MSG_SEEDING="Seeding initial data..."
    else
        APP_LANG="es"
        MSG_STEP1="[1/6] Configuración de Acceso"
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
        MSG_STEP2="[2/6] Seguridad y Dependencias"
        MSG_STEP3="[3/6] Guardando Configuración..."
        MSG_STEP4="[4/6] Construyendo Imágenes..."
        MSG_STEP5="[5/6] Levantando Servicios..."
        MSG_STEP6="[6/6] Verificación y Seeding..."
        MSG_INST_OK="DISHER.IO INSTALADO CORRECTAMENTE"
        MSG_CRED="--- Credenciales Iniciales ---"
        MSG_ACCESS="URL de Acceso: "
        MSG_PORT_STEP="[1.5/6] Configuración de Puerto"
        MSG_PORT_PROMPT="Puerto HTTP (defecto 80): "
        MSG_PORT_BUSY="El puerto ya está en uso!"
        MSG_HEALTH="Esperando que el backend esté listo..."
        MSG_SEEDING="Cargando datos iniciales..."
    fi
}

# ── 2. Access Configuration ──────────────────────────────────────────────────
configure_access() {
    echo -e "\n${CYAN}${MSG_STEP1}${NC}"
    while true; do
        echo -e "${MSG_DOM_TYPE}"
        echo -e "${MSG_TYPE_DOM}"
        echo -e "${MSG_TYPE_IP}"
        read -p "Opcion [1-2] (default: 1): " ACCESS_OPT
        ACCESS_OPT=${ACCESS_OPT:-1}

        LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
        # Multi-cloud public IP detection: AWS IMDSv2 → Azure → GCP → ifconfig.me
        PUBLIC_IP=""
        # AWS IMDSv2
        if [ -z "$PUBLIC_IP" ]; then
            TOKEN=$(curl -s --max-time 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10" 2>/dev/null)
            if [ -n "$TOKEN" ]; then
                PUBLIC_IP=$(curl -s --max-time 2 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
            fi
        fi
        # Azure IMDS
        if [ -z "$PUBLIC_IP" ]; then
            PUBLIC_IP=$(curl -s --max-time 2 -H "Metadata:true" "http://169.254.169.254/metadata/instance/network/interface/0/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" 2>/dev/null)
        fi
        # GCP metadata
        if [ -z "$PUBLIC_IP" ]; then
            PUBLIC_IP=$(curl -s --max-time 2 -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" 2>/dev/null)
        fi
        # Fallback: external service
        if [ -z "$PUBLIC_IP" ]; then
            PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "")
        fi

        if [ "$ACCESS_OPT" = "1" ]; then
            while true; do
                echo -e "\n${MSG_DOM_OPT}"
                echo -e "${MSG_DOM_LOC}"
                echo -e "${MSG_DOM_CUS}"
                read -p "Opcion [1-2] (default: 1): " DOM_OPT
                DOM_OPT=${DOM_OPT:-1}

                if [ "$DOM_OPT" = "1" ]; then
                    CADDY_DOMAIN="disherio.local"
                    IS_PUBLIC_DOMAIN="false"
                    break 2
                elif [ "$DOM_OPT" = "2" ]; then
                    read -p "${MSG_DOM_PROMPT}" CADDY_DOMAIN
                    [[ -z "$CADDY_DOMAIN" ]] && continue
                    IS_PUBLIC_DOMAIN="true"
                    break 2
                fi
            done
        else
            while true; do
                echo -e "\n${MSG_IP_OPT}"
                echo -e "${MSG_IP_LOC}"
                echo -e "${MSG_IP_PUB}"
                read -p "Opcion [1-2] (default: 1): " IP_OPT
                IP_OPT=${IP_OPT:-1}
                
                if [ "$IP_OPT" = "2" ]; then
                    [[ -z "$PUBLIC_IP" ]] && echo "Error detecting Public IP" && continue
                    CADDY_DOMAIN="$PUBLIC_IP"
                else
                    CADDY_DOMAIN="$LOCAL_IP"
                fi
                IS_PUBLIC_DOMAIN="false"
                break 2
            done
        fi
    done

    echo -e "\n${CYAN}${MSG_PORT_STEP}${NC}"
    while true; do
        read -p "${MSG_PORT_PROMPT}" PORT
        PORT=${PORT:-80}
        if ss -tlnp | grep -q ":${PORT} "; then
            echo -e "${RED}${MSG_PORT_BUSY}${NC}"
        else
            break
        fi
    done
}

# ── 3. Security & Dependencies ───────────────────────────────────────────────
install_dependencies() {
    echo -e "\n${CYAN}${MSG_STEP2}${NC}"

    # Check if we actually need to install anything before running apt-get update
    NEED_INSTALL=false
    for pkg in curl wget ufw openssl; do
        if ! command -v "$pkg" &>/dev/null; then NEED_INSTALL=true; break; fi
    done
    if ! command -v docker &>/dev/null; then NEED_INSTALL=true; fi
    if ! docker compose version &>/dev/null; then NEED_INSTALL=true; fi

    if [ "$NEED_INSTALL" = true ]; then
        echo -e "${BLUE}📦 Actualizando paquetes...${NC}" | tee -a "$LOG_FILE"
        apt-get update -qq >/dev/null 2>&1 || error_exit "Failed to run apt-get update"
        
        for pkg in curl wget ufw openssl; do
            if ! command -v "$pkg" &>/dev/null; then
                echo -e "${BLUE}📦 Instalando $pkg...${NC}" | tee -a "$LOG_FILE"
                apt-get install -y -qq "$pkg" </dev/null >/dev/null 2>&1 || error_exit "Failed to install $pkg"
            fi
        done
        
        if ! command -v docker &>/dev/null; then
            echo -e "${BLUE}🐳 Instalando Docker...${NC}" | tee -a "$LOG_FILE"
            apt-get install -y -qq docker.io </dev/null >/dev/null 2>&1 || error_exit "Failed to install Docker"
        fi
        
        if ! docker compose version &>/dev/null; then
            echo -e "${BLUE}🐳 Instalando Docker Compose...${NC}" | tee -a "$LOG_FILE"
            apt-get install -y -qq docker-compose-plugin </dev/null >/dev/null 2>&1 || error_exit "Failed to install Docker Compose"
        fi
        
        echo -e "${GREEN}✅ Dependencias instaladas correctamente${NC}" | tee -a "$LOG_FILE"
    fi

    # Firewall setup
    if command -v ufw &>/dev/null; then
        ufw allow 22/tcp >/dev/null 2>&1 || true
        ufw allow "$PORT/tcp" >/dev/null 2>&1 || true
        ufw allow 443/tcp >/dev/null 2>&1 || true
        ufw --force enable >/dev/null 2>&1 || true
    fi

    JWT_SECRET=$(openssl rand -base64 32)
    ADMIN_EMAIL="admin@disherio.com"
    ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12)
}

# ── 4. Save Configuration ───────────────────────────────────────────────────
write_config() {
    echo -e "\n${CYAN}${MSG_STEP3}${NC}"
    # BUG-13: FRONTEND_URL must match the public-facing origin so the backend's CORS allows requests
    if [ "$IS_PUBLIC_DOMAIN" = "true" ]; then
        FRONTEND_URL="https://${CADDY_DOMAIN}"
    elif [ "$PORT" = "80" ]; then
        FRONTEND_URL="http://${CADDY_DOMAIN}"
    else
        FRONTEND_URL="http://${CADDY_DOMAIN}:${PORT}"
    fi

    cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${PORT}
HTTPS_PORT=443
BACKEND_PORT=3000
MONGODB_URI=mongodb://mongo:27017/disherio
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=8h
ADMIN_EMAIL=${ADMIN_EMAIL}
APP_LANG=${APP_LANG}
FRONTEND_URL=${FRONTEND_URL}
EOF
    chmod 600 "$ENV_FILE"

    if [ "$IS_PUBLIC_DOMAIN" = "true" ]; then
        cat > "$CADDYFILE" <<EOF
$CADDY_DOMAIN {
    handle /api/* { reverse_proxy backend:3000 }
    handle /socket.io/* { reverse_proxy backend:3000 }
    handle { reverse_proxy frontend:4200 }
}
EOF
    else
        cat > "$CADDYFILE" <<EOF
{
    admin off
    auto_https off
}
:${PORT} {
    handle /api/* { reverse_proxy backend:3000 }
    handle /socket.io/* {
        reverse_proxy backend:3000 {
            transport http { versions h1 }
        }
    }
    handle { reverse_proxy frontend:4200 }
}
EOF
    fi
}

# ── 5. Build & Start ─────────────────────────────────────────────────────────
build_and_start() {
    echo -e "\n${CYAN}${MSG_STEP4}${NC}"
    cd "$ROOT_DIR"
    docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Step|#|ERROR|error)" || true

    echo -e "\n${CYAN}${MSG_STEP5}${NC}"
    docker compose up -d 2>&1 | tee -a "$LOG_FILE" | grep -v "^$" || {
        echo -e "${RED}ERROR: Falló al iniciar los servicios Docker${NC}"
        exit 1
    }
}

# ── 6. Healthcheck & Seed ────────────────────────────────────────────────────
healthcheck_and_seed() {
    echo -e "\n${CYAN}${MSG_STEP6}${NC}"
    echo -e "${YELLOW}${MSG_HEALTH}${NC}"
    MAX_WAIT=120
    WAITED=0
    BACKEND_READY=false
    until docker compose exec -T backend wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1; do
        sleep 5
        WAITED=$((WAITED + 5))
        echo -e "  ... ${WAITED}s/${MAX_WAIT}s"
        if [ $WAITED -ge $MAX_WAIT ]; then
            echo -e "${RED}Backend timeout — últimos logs:${NC}"
            docker compose logs --tail=30 backend 2>&1 || true
            echo -e "${RED}Mongo logs:${NC}"
            docker compose logs --tail=10 mongo 2>&1 || true
            break
        fi
    done && BACKEND_READY=true

    echo -e "${YELLOW}${MSG_SEEDING}${NC}"
    docker compose run --rm \
        -e MONGODB_URI=mongodb://mongo:27017/disherio \
        -e JWT_SECRET="${JWT_SECRET}" \
        backend node -e "
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const R = mongoose.models.Restaurant || mongoose.model('Restaurant', new mongoose.Schema({ restaurant_name: String, tax_rate: Number, currency: String, language: String }, { strict: false }));
  const Ro = mongoose.models.Role || mongoose.model('Role', new mongoose.Schema({ restaurant_id: mongoose.Schema.Types.ObjectId, role_name: String, permissions: [String] }, { strict: false }));
  const S = mongoose.models.Staff || mongoose.model('Staff', new mongoose.Schema({ restaurant_id: mongoose.Schema.Types.ObjectId, role_id: mongoose.Schema.Types.ObjectId, staff_name: String, email: String, password_hash: String, pin_code: String }, { strict: false }));
  
  let rest = await R.findOne({ restaurant_name: 'DisherIo' });
  if (!rest) rest = await R.create({ restaurant_name: 'DisherIo', tax_rate: 0, currency: 'EUR', language: '${APP_LANG}' });
  
  let role = await Ro.findOne({ restaurant_id: rest._id, role_name: 'Admin' });
  if (!role) role = await Ro.create({ restaurant_id: rest._id, role_name: 'Admin', permissions: ['ADMIN'] });
  
  if (!await S.findOne({ email: '${ADMIN_EMAIL}' })) {
    const hash = await bcrypt.hash('${ADMIN_PASS}', 12);
    await S.create({ 
      restaurant_id: rest._id, 
      role_id: role._id, 
      staff_name: 'Admin', 
      email: '${ADMIN_EMAIL}', 
      password_hash: hash,
      pin_code: '0000'
    });
  }
  await mongoose.disconnect();
}
seed().catch(e => { console.error(e); process.exit(1); });
"
}

# ── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
    ACCESS_URL="http://${CADDY_DOMAIN}:${PORT}"
    [[ "$IS_PUBLIC_DOMAIN" == "true" ]] && ACCESS_URL="https://${CADDY_DOMAIN}"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           ${MSG_INST_OK}               ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  ${MSG_ACCESS}   : ${BOLD}${ACCESS_URL}${NC}"
    echo -e "${GREEN}║${NC}  Admin email     : ${BOLD}${ADMIN_EMAIL}${NC}"
    echo -e "${GREEN}║${NC}  Admin password  : ${BOLD}${ADMIN_PASS}${NC}  ${YELLOW}(guarda esto ahora)${NC}"
    echo -e "${GREEN}║${NC}  Idioma          : ${BOLD}${APP_LANG}${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  Estado de servicios:"
    docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 | while read -r line; do
        echo -e "${GREEN}║${NC}    $line"
    done
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
    banner
    select_language
    configure_access
    install_dependencies
    write_config
    build_and_start
    healthcheck_and_seed
    print_summary
}

main "$@"
"$@"
