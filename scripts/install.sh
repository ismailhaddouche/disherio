#!/usr/bin/env bash
# =============================================================================
# DisherIO — Enhanced Installer v2.0
# Secure, verified and automated installation
# Usage: sudo ./scripts/install.sh
# =============================================================================
set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
CADDYFILE="$ROOT_DIR/Caddyfile"
LOG_FILE="/var/log/disherio_install.log"

# Installation state
INSTALL_MODE=""          # domain-public, domain-local, ip-public, ip-local
HTTP_PORT=80
HTTPS_PORT=443
BACKEND_PORT=3000
CADDY_DOMAIN=""
ACCESS_URL=""
JWT_SECRET=""
ADMIN_USER="admin"
ADMIN_PASS=""
ADMIN_PIN=""
IS_DOMAIN=false
DEFAULT_LANGUAGE="es"    # es | en
DEFAULT_THEME="dark"     # light | dark
DEFAULT_TAX_RATE="10"    # percentage
DEFAULT_CURRENCY="EUR"   # EUR | USD | GBP

# ── Utilities ───────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || { echo -e "${RED}Ejecuta como root: sudo ./scripts/install.sh${NC}"; exit 1; }

err() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }
ok()  { echo -e "${GREEN}[OK]${NC} $*" | tee -a "$LOG_FILE"; }
log() { echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[ADVERTENCIA]${NC} $*" | tee -a "$LOG_FILE"; }
step() { echo -e "\n${CYAN}=== PASO $1 ===${NC}\n" | tee -a "$LOG_FILE"; }

# Force flush output
flush_output() { true; }

banner() {
  echo -e "${CYAN}"
  echo "  ██████╗ ██╗███████╗██╗  ██╗███████╗██████╗ ██╗ ██████╗"
  echo "  ██╔══██╗██║██╔════╝██║  ██║██╔════╝██╔══██╗██║██╔═══██╗"
  echo "  ██║  ██║██║███████╗███████║█████╗  ██████╔╝██║██║   ██║"
  echo "  ██║  ██║██║╚════██║██╔══██║██╔══╝  ██╔══██╗██║██║   ██║"
  echo "  ██████╔╝██║███████║██║  ██║███████╗██║  ██║██║╚██████╔╝"
  echo "  ╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}Instalador v2.0 — Sistema de gestión de restaurantes${NC}"
  echo ""
}

# ── Step 0: IP Detection ─────────────────────────────────────────────────
validate_ip() {
  local ip="$1"
  # Validate IPv4 format
  [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] && return 0 || return 1
}

detect_ips() {
  # Local IP
  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
  
  # Public IP (cloud metadata or external services)
  PUBLIC_IP=""
  local detected_ip=""
  
  # AWS EC2
  local aws_token=$(curl -s --max-time 2 -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 10" 2>/dev/null || true)
  if [[ -n "$aws_token" ]]; then
    detected_ip=$(curl -s --max-time 2 -H "X-aws-ec2-metadata-token: $aws_token" \
      http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
    validate_ip "$detected_ip" && PUBLIC_IP="$detected_ip"
  fi
  
  # Azure
  if [[ -z "$PUBLIC_IP" ]]; then
    detected_ip=$(curl -s --max-time 2 -H "Metadata:true" \
      "http://169.254.169.254/metadata/instance/network/interface/0/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" 2>/dev/null || true)
    validate_ip "$detected_ip" && PUBLIC_IP="$detected_ip"
  fi
  
  # GCP
  if [[ -z "$PUBLIC_IP" ]]; then
    detected_ip=$(curl -s --max-time 2 -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" 2>/dev/null || true)
    validate_ip "$detected_ip" && PUBLIC_IP="$detected_ip"
  fi
  
  # Fallback to external services
  if [[ -z "$PUBLIC_IP" ]]; then
    detected_ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null)
    validate_ip "$detected_ip" && PUBLIC_IP="$detected_ip"
  fi
  
  if [[ -z "$PUBLIC_IP" ]]; then
    detected_ip=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null)
    validate_ip "$detected_ip" && PUBLIC_IP="$detected_ip"
  fi
  
  # Last fallback
  if [[ -z "$PUBLIC_IP" ]]; then
    detected_ip=$(curl -s --max-time 5 https://icanhazip.com 2>/dev/null)
    validate_ip "$detected_ip" && PUBLIC_IP="$detected_ip"
  fi
}

# ── Step 1: Access Configuration ──────────────────────────────────────────
configure_access() {
  step "1/7: CONFIGURACION DE ACCESO"
  detect_ips
  
  # Small pause to ensure output is displayed
  sleep 0.5
  
  cat << 'MENUTXT'

============================================================
  SELECCIONA EL TIPO DE INSTALACION
============================================================

OPCIONES DISPONIBLES:

[1] Dominio publico con HTTPS
    - Ejemplo: restaurante.com / app.tudominio.com
    - Certificados SSL automaticos (Let's Encrypt)
    - Acceso desde internet

[2] Dominio local (sin HTTPS externo)
    - Ejemplo: disherio.local / restaurante.lan
    - Para red local con DNS local

MENUTXT

  if [[ -n "$PUBLIC_IP" ]]; then
    cat << MENUTXT2
[3] IP Publica
    - Detectada: $PUBLIC_IP
    - Acceso directo por IP
    - Sin dominio

MENUTXT2
  else
    cat << 'MENUTXT2'
[3] IP Publica (no detectada)
    - Se te pedira introducirla manualmente

MENUTXT2
  fi

  cat << MENUTXT3
[4] IP Local (recomendado para pruebas)
    - Detectada: $LOCAL_IP
    - Solo acceso desde la red local

------------------------------------------------------------
MENUTXT3

  while true; do
    echo ""
    read -rp "Introduce tu opcion (1-4) [por defecto: 4]: " choice
    choice="${choice:-4}"
    case "$choice" in
      1) INSTALL_MODE="domain-public"; IS_DOMAIN=true; log "Seleccionado: Dominio publico con HTTPS"; break;;
      2) INSTALL_MODE="domain-local"; IS_DOMAIN=true; log "Seleccionado: Dominio local"; break;;
      3) INSTALL_MODE="ip-public"; IS_DOMAIN=false; log "Seleccionado: IP Publica"; break;;
      4) INSTALL_MODE="ip-local"; IS_DOMAIN=false; log "Seleccionado: IP Local"; break;;
      *) echo "Opcion invalida. Por favor, introduce 1, 2, 3 o 4.";;
    esac
  done
  
  # Configure domain/IP
  case "$INSTALL_MODE" in
    domain-public|domain-local)
      while true; do
        read -rp "  Introduce el dominio: " CADDY_DOMAIN
        if [[ -n "$CADDY_DOMAIN" ]]; then
          # Validate basic format
          if [[ "$CADDY_DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
            break
          else
            warn "Formato de dominio inválido. Ejemplo: app.disherio.com"
          fi
        fi
      done
      ;;
    ip-public)
      if [[ -z "$PUBLIC_IP" ]]; then
        warn "No se pudo detectar la IP pública automáticamente."
        read -rp "  Introduce tu IP pública manualmente: " manual_ip
        if validate_ip "$manual_ip"; then
          PUBLIC_IP="$manual_ip"
        else
          err "IP inválida. Usa formato: xxx.xxx.xxx.xxx"
        fi
      fi
      CADDY_DOMAIN="$PUBLIC_IP"
      ;;
    ip-local)
      CADDY_DOMAIN="$LOCAL_IP"
      ;;
  esac
  
  # Configure ports
  echo ""
  echo "============================================================"
  echo "  CONFIGURACIÓN DE PUERTOS"
  echo "  (Presiona ENTER para usar los valores por defecto)"
  echo "============================================================"
  echo ""
  
  read -rp "  Puerto HTTP [80]: " http_port
  HTTP_PORT="${http_port:-80}"
  ok "Puerto HTTP: $HTTP_PORT"
  
  if [[ "$INSTALL_MODE" == "domain-public" ]]; then
    read -rp "  Puerto HTTPS [443]: " https_port
    HTTPS_PORT="${https_port:-443}"
    ok "Puerto HTTPS: $HTTPS_PORT"
  fi
  
  read -rp "  Puerto interno backend [3000]: " backend_port
  BACKEND_PORT="${backend_port:-3000}"
  ok "Puerto backend: $BACKEND_PORT"
  
  # Validate ports
  for port in "$HTTP_PORT" "$HTTPS_PORT" "$BACKEND_PORT"; do
    if ! [[ "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
      err "Puerto inválido: $port"
    fi
  done
  
  # Configure localization preferences
  echo ""
  echo "============================================================"
  echo "  CONFIGURACIÓN DE IDIOMA Y TEMA"
  echo "============================================================"
  echo ""
  
  # Language selection
  echo "------------------------------------------------------------"
  echo "  SELECCIONA EL IDIOMA POR DEFECTO:"
  echo "------------------------------------------------------------"
  echo ""
  echo "  [1] Español (ES)"
  echo "  [2] English (EN)"
  echo ""
  while true; do
    read -rp "  Introduce tu opción (1-2) [por defecto: 1]: " lang_choice
    lang_choice="${lang_choice:-1}"
    case "$lang_choice" in
      1) DEFAULT_LANGUAGE="es"; log "Idioma seleccionado: Español"; break;;
      2) DEFAULT_LANGUAGE="en"; log "Idioma seleccionado: English"; break;;
      *) echo "  Opción inválida. Por favor, introduce 1 o 2.";;
    esac
  done
  
  # Theme selection
  echo ""
  echo "------------------------------------------------------------"
  echo "  SELECCIONA EL TEMA POR DEFECTO:"
  echo "------------------------------------------------------------"
  echo ""
  echo "  [1] Claro (Light)"
  echo "  [2] Oscuro (Dark)"
  echo ""
  while true; do
    read -rp "  Introduce tu opción (1-2) [por defecto: 2]: " theme_choice
    theme_choice="${theme_choice:-2}"
    case "$theme_choice" in
      1) DEFAULT_THEME="light"; log "Tema seleccionado: Claro"; break;;
      2) DEFAULT_THEME="dark"; log "Tema seleccionado: Oscuro"; break;;
      *) echo "  Opción inválida. Por favor, introduce 1 o 2.";;
    esac
  done
  
  # Configure taxes and currency
  echo ""
  echo "============================================================"
  echo "  CONFIGURACIÓN DE IMPUESTOS Y MONEDA"
  echo "============================================================"
  echo ""
  
  # Tax rate
  read -rp "  Tasa de impuestos por defecto [%] [10]: " tax_rate
  DEFAULT_TAX_RATE="${tax_rate:-10}"
  ok "Tasa de impuestos: ${DEFAULT_TAX_RATE}%"
  
  # Currency
  echo ""
  echo "------------------------------------------------------------"
  echo "  SELECCIONA LA MONEDA POR DEFECTO:"
  echo "------------------------------------------------------------"
  echo ""
  echo "  [1] EUR (€) - Euro"
  echo "  [2] USD ($) - Dólar"
  echo "  [3] GBP (£) - Libra"
  echo ""
  while true; do
    read -rp "  Introduce tu opción (1-3) [por defecto: 1]: " currency_choice
    currency_choice="${currency_choice:-1}"
    case "$currency_choice" in
      1) DEFAULT_CURRENCY="EUR"; log "Moneda seleccionada: EUR (€)"; break;;
      2) DEFAULT_CURRENCY="USD"; log "Moneda seleccionada: USD ($)"; break;;
      3) DEFAULT_CURRENCY="GBP"; log "Moneda seleccionada: GBP (£)"; break;;
      *) echo "  Opción inválida. Por favor, introduce 1, 2 o 3.";;
    esac
  done
  
  # Verify that ports are not in use
  for port in "$HTTP_PORT" "$HTTPS_PORT"; do
    if ss -tuln | grep -q ":$port "; then
      warn "El puerto $port está en uso. Deteniendo servicio..."
      # Try to stop any service on that port (except ssh)
      if [[ "$port" != "22" ]]; then
        fuser -k "${port}/tcp" 2>/dev/null || true
        sleep 2
      fi
    fi
  done
  
  # Build access URL
  if [[ "$INSTALL_MODE" == "domain-public" ]]; then
    ACCESS_URL="https://${CADDY_DOMAIN}${HTTPS_PORT:+:${HTTPS_PORT}}"
  elif [[ "$INSTALL_MODE" == "domain-local" ]]; then
    ACCESS_URL="http://${CADDY_DOMAIN}${HTTP_PORT:+:${HTTP_PORT}}"
  else
    ACCESS_URL="http://${CADDY_DOMAIN}:${HTTP_PORT}"
  fi
  
  ok "Modo: $INSTALL_MODE"
  ok "Acceso: $ACCESS_URL"
}

# ── Step 2: Dependencies ─────────────────────────────────────────────────────
install_dependencies() {
  step "2/7: INSTALANDO DEPENDENCIAS"
  
  # Check if Docker is already installed
  if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    ok "Docker ya instalado: $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  else
    log "Actualizando repositorios..."
    apt-get update -qq 2>&1 | tee -a "$LOG_FILE" || err "apt-get update falló"
    
    # Install prerequisite dependencies
    for pkg in curl wget ca-certificates gnupg lsb-release; do
      apt-get install -y -qq "$pkg" </dev/null >/dev/null 2>&1 || true
    done
    
    # Add official Docker repository
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null || \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null || \
    err "No se pudo descargar la clave GPG de Docker"
    
    chmod a+r /etc/apt/keyrings/docker.asc
    
    local distro=$(lsb_release -is 2>/dev/null | tr '[:upper:]' '[:lower:]')
    local codename=$(lsb_release -cs 2>/dev/null)
    
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/${distro:-ubuntu} ${codename:-jammy} stable" \
      > /etc/apt/sources.list.d/docker.list
    
    apt-get update -qq >/dev/null 2>&1
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin \
      </dev/null >/dev/null 2>&1 || err "Error instalando Docker"
    
    systemctl enable docker >/dev/null 2>&1
    systemctl start docker >/dev/null 2>&1
    ok "Docker instalado"
  fi
  
  # Firewall
  if command -v ufw &>/dev/null; then
    log "Configurando firewall UFW..."
    ufw default deny incoming >/dev/null 2>&1 || true
    ufw default allow outgoing >/dev/null 2>&1 || true
    ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
    ufw allow "${HTTP_PORT}/tcp" comment 'DisherIO HTTP' >/dev/null 2>&1 || true
    [[ "$INSTALL_MODE" == "domain-public" ]] && ufw allow "${HTTPS_PORT}/tcp" comment 'DisherIO HTTPS' >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
    ok "Firewall configurado"
  fi
}

# ── Step 3: Generate Secrets ─────────────────────────────────────────────────
generate_secrets() {
  step "3/7: GENERANDO SECRETOS SEGUROS"
  
  # JWT Secret - 64 alphanumeric characters
  JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
  
  # Admin Password - 20 characters with uppercase, lowercase, numbers and symbols
  ADMIN_PASS=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9@#$%^&*' | head -c 20)
  
  # PIN - 4 numeric digits
  ADMIN_PIN=$(printf '%04d' $((RANDOM % 10000)))
  
  ok "Secretos generados"
}

# ── Step 4: Write Configuration ───────────────────────────────────────────
write_config() {
  step "4/7: CONFIGURANDO ARCHIVOS"
  
  # Clean up previous files
  rm -f "$ENV_FILE" "$CADDYFILE"
  
  # Create .env (no admin credentials, only system configuration)
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
BACKEND_PORT=${BACKEND_PORT}
MONGODB_URI=mongodb://mongo:27017/disherio
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=8h
FRONTEND_URL=${ACCESS_URL}
LOG_LEVEL=info
DEFAULT_LANGUAGE=${DEFAULT_LANGUAGE}
DEFAULT_THEME=${DEFAULT_THEME}
DEFAULT_TAX_RATE=${DEFAULT_TAX_RATE}
DEFAULT_CURRENCY=${DEFAULT_CURRENCY}
EOF
  chmod 600 "$ENV_FILE"
  chown root:root "$ENV_FILE" 2>/dev/null || true
  
  # Create Caddyfile based on mode
  if [[ "$INSTALL_MODE" == "domain-public" ]]; then
    cat > "$CADDYFILE" <<EOF
${CADDY_DOMAIN}:${HTTPS_PORT} {
    tls internal
    handle /api/* {
        reverse_proxy backend:${BACKEND_PORT}
    }
    handle /socket.io/* {
        reverse_proxy backend:${BACKEND_PORT} {
            transport http {
                versions 1.1
            }
        }
    }
    handle {
        reverse_proxy frontend:4200
    }
}

:${HTTP_PORT} {
    redir https://${CADDY_DOMAIN}:${HTTPS_PORT}{uri}
}
EOF
  elif [[ "$INSTALL_MODE" == "domain-local" ]]; then
    cat > "$CADDYFILE" <<EOF
${CADDY_DOMAIN}:${HTTP_PORT} {
    handle /api/* {
        reverse_proxy backend:${BACKEND_PORT}
    }
    handle /socket.io/* {
        reverse_proxy backend:${BACKEND_PORT} {
            transport http {
                versions 1.1
            }
        }
    }
    handle {
        reverse_proxy frontend:4200
    }
}
EOF
  else
    # IP mode
    cat > "$CADDYFILE" <<EOF
{
    admin off
    auto_https off
}

:${HTTP_PORT} {
    handle /api/* {
        reverse_proxy backend:${BACKEND_PORT}
    }
    handle /socket.io/* {
        reverse_proxy backend:${BACKEND_PORT} {
            transport http {
                versions 1.1
            }
        }
    }
    handle {
        reverse_proxy frontend:4200
    }
}
EOF
  fi
  
  ok "Configuración escrita"
}

# ── Step 5: Build and Start ───────────────────────────────────────────────────
build_and_start() {
  step "5/7: CONSTRUYENDO E INICIANDO SERVICIOS"
  cd "$ROOT_DIR"
  
  log "Descargando imágenes base de Docker..."
  log "  (Este proceso puede tardar unos minutos)"
  docker compose pull 2>&1 | tee -a "$LOG_FILE" || true
  ok "Imágenes descargadas"
  
  echo ""
  log "Construyendo imágenes personalizadas..."
  log "  (Backend y Frontend - puede tardar 3-5 minutos)"
  docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE" || err "Build fallido. Ver $LOG_FILE"
  ok "Imágenes construidas correctamente"
  
  echo ""
  log "=== FASE 1: Iniciando MongoDB ==="
  docker compose up -d mongo --wait --wait-timeout 120 2>&1 | tee -a "$LOG_FILE" || err "No se pudo iniciar MongoDB"
  ok "MongoDB iniciado y saludable"
  
  echo ""
  log "=== FASE 2: Iniciando Backend ==="
  log "  (Este proceso puede tardar 1-2 minutos en la primera ejecución)"
  if ! docker compose up -d backend --wait --wait-timeout 180 2>&1 | tee -a "$LOG_FILE"; then
    warn "Backend no arrancó correctamente. Últimos logs del contenedor:"
    docker compose logs --tail=60 backend 2>&1 | tee -a "$LOG_FILE" || true
    err "No se pudo iniciar Backend. Revisa los logs arriba o ejecuta: docker compose logs backend"
  fi
  ok "Backend iniciado y saludable"
  
  echo ""
  log "=== FASE 3: Iniciando Frontend ==="
  docker compose up -d frontend --wait --wait-timeout 120 2>&1 | tee -a "$LOG_FILE" || err "No se pudo iniciar Frontend"
  ok "Frontend iniciado y saludable"
  
  echo ""
  log "=== FASE 4: Iniciando Caddy (Proxy) ==="
  docker compose up -d caddy --wait --wait-timeout 120 2>&1 | tee -a "$LOG_FILE" || err "No se pudo iniciar Caddy"
  ok "Caddy iniciado y saludable"
  
  ok "Todos los servicios iniciados correctamente"
}

# ── Step 6: Healthcheck and Verification ───────────────────────────────────────
verify_installation() {
  step "6/7: VERIFICANDO INSTALACIÓN"
  
  cd "$ROOT_DIR"
  
  # Verify containers
  log "Verificando contenedores..."
  local containers=("mongo" "backend" "frontend" "caddy")
  for container in "${containers[@]}"; do
    if docker compose ps --format json 2>/dev/null | grep -q "\"Name\":\".*${container}.*\""; then
      ok "Contenedor $container: running"
    else
      err "Contenedor $container no está ejecutándose"
    fi
  done
  
  # Verify backend (health endpoint via localhost)
  log "Verificando backend..."
  local attempts=0
  local max_attempts=30  # 2.5 minutos (5s * 30)
  local backend_ok=false
  
  while [[ $attempts -lt $max_attempts ]]; do
    sleep 5
    attempts=$((attempts + 1))
    echo -e "  ${BLUE}⏳ Esperando backend... intento ${attempts}/${max_attempts}${NC}"
    
    # Verify using docker exec (port is not exposed to host, everything goes through Caddy)
    if docker exec disherio_backend wget -qO- http://localhost:3000/health >/dev/null 2>&1; then
      backend_ok=true
      break
    fi
  done
  
  if [[ "$backend_ok" == "true" ]]; then
    ok "Backend respondiendo correctamente (interno puerto ${BACKEND_PORT})"
  else
    warn "Backend no responde internamente en puerto ${BACKEND_PORT}. Mostrando logs:"
    docker compose logs --tail=50 backend 2>&1 || true
    err "Backend no respondió tras ${max_attempts} intentos. Verifica 'docker logs disherio_backend'"
  fi
  
  # Verify external connectivity
  log "Verificando conectividad..."
  if curl -s --max-time 10 -o /dev/null -w "%{http_code}" "http://localhost:${HTTP_PORT}" | grep -qE "^(200|301|302|307)"; then
    ok "Caddy respondiendo en puerto $HTTP_PORT"
  else
    warn "Caddy no responde en puerto $HTTP_PORT (puede ser normal al inicio)"
  fi
  
  # Show resource status
  log "Estado de recursos:"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true
}

# ── Step 7: Data Seed ────────────────────────────────────────────────────
seed_database() {
  step "7/7: CREANDO USUARIO ADMINISTRADOR"
  
  cd "$ROOT_DIR"
  
  log "Instalando dependencias para seed..."
  
  # Create temporary directory for seed
  local seed_dir=$(mktemp -d)
  
  # Create temporary package.json
  cat > "$seed_dir/package.json" <<'PKG'
{
  "name": "disherio-seed",
  "version": "1.0.0",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "mongoose": "^8.0.0"
  }
}
PKG

  # Create seed script
  cat > "$seed_dir/seed.js" <<NODE_SCRIPT
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminPin = process.env.SEED_ADMIN_PIN;
  const defaultLanguage = process.env.DEFAULT_LANGUAGE || 'es';
  const defaultTheme = process.env.DEFAULT_THEME || 'light';
  const defaultTaxRate = parseInt(process.env.DEFAULT_TAX_RATE) || 10;
  const defaultCurrency = process.env.DEFAULT_CURRENCY || 'EUR';
  
  // Create restaurant
  let restaurant = await mongoose.connection.collection('restaurants').findOne({ restaurant_name: 'DisherIO Restaurant' });
  if (!restaurant) {
    const result = await mongoose.connection.collection('restaurants').insertOne({
      restaurant_name: 'DisherIO Restaurant',
      tax_rate: defaultTaxRate,
      currency: defaultCurrency,
      default_language: defaultLanguage,
      default_theme: defaultTheme,
      tips_state: false,
      tips_type: 'VOLUNTARY',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Restaurante creado:');
    console.log('  - Idioma:', defaultLanguage);
    console.log('  - Tema:', defaultTheme);
    console.log('  - Impuestos:', defaultTaxRate + '%');
    console.log('  - Moneda:', defaultCurrency);
    restaurant = await mongoose.connection.collection('restaurants').findOne({ _id: result.insertedId });
    console.log('Restaurante creado');
  }
  
  // Create default roles
  const defaultRoles = [
    { role_name: 'Admin', permissions: ['ADMIN'] },
    { role_name: 'KTS', permissions: ['KTS'] },
    { role_name: 'POS', permissions: ['POS'] },
    { role_name: 'TAS', permissions: ['TAS'] }
  ];
  
  let adminRole = null;
  for (const roleData of defaultRoles) {
    let role = await mongoose.connection.collection('roles').findOne({ 
      restaurant_id: restaurant._id, 
      role_name: roleData.role_name 
    });
    if (!role) {
      const result = await mongoose.connection.collection('roles').insertOne({
        restaurant_id: restaurant._id,
        role_name: roleData.role_name,
        permissions: roleData.permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      role = await mongoose.connection.collection('roles').findOne({ _id: result.insertedId });
      console.log('Rol ' + roleData.role_name + ' creado');
    }
    if (roleData.role_name === 'Admin') {
      adminRole = role;
    }
  }
  
  // Create admin user
  let staff = await mongoose.connection.collection('staffs').findOne({ username: 'admin' });
  if (!staff) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const pinHash = await bcrypt.hash(adminPin, 12);
    
    await mongoose.connection.collection('staffs').insertOne({
      restaurant_id: restaurant._id,
      role_id: adminRole._id,
      staff_name: 'Administrator',
      username: 'admin',
      password_hash: passwordHash,
      pin_code_hash: pinHash,
      language: null,  // Uses restaurant default
      theme: null,     // Uses restaurant default
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Usuario admin creado');
  } else {
    console.log('Usuario admin ya existe');
  }
  
  await mongoose.disconnect();
  console.log('Seed completado');
}

seed().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
NODE_SCRIPT

  # Execute seed using a temporary Node container
  log "Ejecutando seed en contenedor temporal..."
  if docker run --rm \
    --network disherio_disherio_net \
    -v "$seed_dir:/seed" \
    -w /seed \
    -e MONGODB_URI="mongodb://mongo:27017/disherio" \
    -e SEED_ADMIN_PASSWORD="$ADMIN_PASS" \
    -e SEED_ADMIN_PIN="$ADMIN_PIN" \
    -e DEFAULT_LANGUAGE="$DEFAULT_LANGUAGE" \
    -e DEFAULT_THEME="$DEFAULT_THEME" \
    -e DEFAULT_TAX_RATE="$DEFAULT_TAX_RATE" \
    -e DEFAULT_CURRENCY="$DEFAULT_CURRENCY" \
    node:20-alpine sh -c "npm install --silent && node seed.js" >> "$LOG_FILE" 2>&1; then
    ok "Usuario administrador y roles creados (Admin, KTS, POS, TAS)"
    rm -rf "$seed_dir"
  else
    rm -rf "$seed_dir"
    err "Error creando usuario administrador. Ver $LOG_FILE"
  fi
}

# ── Final Summary ────────────────────────────────────────────────────────────
print_summary() {
  # Save credentials to protected file
  local creds_file="$ROOT_DIR/.credentials"
  cat > "$creds_file" <<EOF
# DisherIO — Credenciales de Administrador
# Generado: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# ESTE ARCHIVO CONTIENE INFORMACIÓN SENSIBLE — MANTÉNLO SEGURO

URL=${ACCESS_URL}
Username=${ADMIN_USER}
Password=${ADMIN_PASS}
PIN=${ADMIN_PIN}

Comandos útiles:
  Ver logs:        sudo docker compose logs -f
  Reiniciar:       sudo docker compose restart
  Backup:          sudo ./scripts/backup.sh
  Estado:          sudo ./scripts/info.sh
EOF
  chmod 600 "$creds_file"
  chown root:root "$creds_file" 2>/dev/null || true
  
  # Show summary
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║${NC}              ${BOLD}DISHERIO INSTALADO CORRECTAMENTE${NC}                ${GREEN}║${NC}"
  echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  🌐 URL de acceso:  ${BOLD}${CYAN}${ACCESS_URL}${NC}"
  echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
  echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}              ${YELLOW}CREDENCIALES DE ADMINISTRADOR${NC}                   ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  👤 Usuario:  ${BOLD}${ADMIN_USER}${NC}"
  echo -e "${GREEN}║${NC}  🔑 Password: ${BOLD}${ADMIN_PASS}${NC}"
  echo -e "${GREEN}║${NC}  🔢 PIN:      ${BOLD}${ADMIN_PIN}${NC}"
  echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
  echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  📁 Accesos directos:                                          ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     • Panel Admin: ${ACCESS_URL}/admin                          ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     • TPV (POS):   ${ACCESS_URL}/pos                            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     • Cocina:      ${ACCESS_URL}/kds                            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     • Mesas:       ${ACCESS_URL}/tas                            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                                ${GREEN}║${NC}"
  echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  ℹ️  Información guardada en: ${creds_file}            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  📋 Logs de instalación:      ${LOG_FILE}                       ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  ⚙️  Reconfigurar:             sudo ./scripts/configure.sh      ${GREEN}║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  warn "IMPORTANTE: Guarda estas credenciales. El archivo .credentials se borrará en 7 días."
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  # Initialize log
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "=== DisherIO Installer v2.0 - $(date) ===" > "$LOG_FILE"
  
  banner
  
  # Verify we are in the correct directory
  if [[ ! -f "docker-compose.yml" ]] && [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
    err "No se encontró docker-compose.yml. Ejecuta desde la raíz del proyecto."
  fi
  
  # Clean up corrupt files from previous failed installations
  if [[ -f "$ENV_FILE" ]]; then
    # Check if the file contains HTML (corrupt)
    if head -1 "$ENV_FILE" | grep -q "<html\|<!DOCTYPE"; then
      warn "Archivo .env corrupto detectado, limpiando..."
      rm -f "$ENV_FILE"
    fi
  fi
  
  # Stop and clean up previous containers if they exist
  if docker compose ps 2>/dev/null | grep -q "disherio"; then
    log "Deteniendo instalación anterior..."
    docker compose down --remove-orphans >> "$LOG_FILE" 2>&1 || true
  fi
  
  configure_access
  install_dependencies
  generate_secrets
  write_config
  build_and_start
  verify_installation
  seed_database
  print_summary
}

main "$@"
