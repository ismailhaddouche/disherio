#!/usr/bin/env bash
# =============================================================================
# DisherIO — Universal Script v3.1 (lineal y determinista)
# Single entry point for installation, management, and maintenance.
#
# Uso:
#   sudo ./scripts/install.sh              # Guided installation (5 parameters)
#   sudo ./scripts/install.sh install      # Same as above
#   sudo ./scripts/install.sh start        # Start services
#   sudo ./scripts/install.sh stop         # Stop services
#   sudo ./scripts/install.sh restart      # Restart services
#   sudo ./scripts/install.sh status       # Status and access information (no secrets)
#   sudo ./scripts/install.sh logs         # View live logs
#   sudo ./scripts/install.sh backup       # Back up data and configuration
#   sudo ./scripts/install.sh uninstall    # Uninstall everything
#   sudo ./scripts/install.sh update       # Update images and restart
#
# Installation only requires five user-supplied parameters:
#   1. Deployment type (domain/local IP/public IP)
#   2. Domain (only in domain mode) or confirmation of the detected IP
#   3. Language (es/en/fr)
#   4. Restaurant name
#   5. Moneda (EUR/USD/GBP)
#
# Non-interactive mode (CI/CD, SSH without a TTY, gcloud):
#   DISHERIO_DEPLOY_MODE=domain \
#   DISHERIO_DOMAIN=app.example.com \
#   DISHERIO_LANGUAGE=es \
#   DISHERIO_RESTAURANT_NAME="DisherIO Restaurant" \
#   DISHERIO_CURRENCY=EUR \
#   sudo -E ./scripts/install.sh install
#
# Optional non-interactive variables:
#   DISHERIO_DEPLOY_MODE   = domain | local | public
#   DISHERIO_DOMAIN        = domain (only when DEPLOY_MODE=domain)
#   DISHERIO_ACCESS_IP     = IP/host to advertise in local mode (overrides the
#                            auto-detected one; useful when the internal IP is
#                            RFC1918/unreachable, e.g. a cloud VM)
#   DISHERIO_LANGUAGE      = es | en | fr
#   DISHERIO_RESTAURANT_NAME = restaurant name
#   DISHERIO_CURRENCY       = EUR | USD | GBP
#   DISHERIO_SEED_EXAMPLES  = y | n  (install demo categories, dishes and a table)
#   DISHERIO_NONINTERACTIVE = 1  (fuerza modo non-interactive)
#   DISHERIO_UNINSTALL_CONFIRM = SI  (confirmar uninstall en modo non-interactive)
# =============================================================================
set -euo pipefail
umask 077

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

# ── Rutas ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
CADDYFILE="$ROOT_DIR/Caddyfile"
CREDENTIALS_FILE="$ROOT_DIR/.credentials"
LOG_FILE="/var/log/disherio.log"
LOG_DIR="$(dirname "$LOG_FILE")"

# ── Defaults auto-generados ───────────────────────────────────────────────────
HTTP_PORT=80
HTTPS_PORT=443
BACKEND_PORT=3000
ADMIN_USER="admin"
ADMIN_PASS=""
MONGO_ROOT_USER="admin"
MONGO_ROOT_PASS=""
MONGO_APP_USER="disherio_app"
MONGO_APP_PASS=""
REDIS_PASSWORD=""
JWT_SECRET=""
JWT_REFRESH_SECRET=""
INSTALL_MODE=""
CADDY_DOMAIN=""
ACCESS_URL=""
RESTAURANT_NAME="DisherIO Restaurant"
DEFAULT_LANGUAGE="es"
DEFAULT_THEME="dark"
DEFAULT_TAX_RATE="10"
DEFAULT_CURRENCY="EUR"
SEED_EXAMPLES="n"
LOCAL_IP=""
PUBLIC_IP=""
PRESERVE_EXISTING_SECRETS=0

# ── Utilidades ────────────────────────────────────────────────────────────────
# Note: err() writes to stderr and to the log only when the log directory exists.
# Otherwise it writes only to stderr and does not fail.
_log_write() {
  if [[ -d "$LOG_DIR" ]]; then
    echo -e "$*" >> "$LOG_FILE" 2>/dev/null || true
  fi
}
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; _log_write "[ERROR] $*"; exit 1; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; _log_write "[OK] $*"; }
log()  { echo -e "${BLUE}[INFO]${NC} $*"; _log_write "[INFO] $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; _log_write "[WARN] $*"; }
step() { echo -e "\n${CYAN}═══ PASO $1 ═══${NC}\n"; }

banner() {
  echo -e "${CYAN}"
  echo "  ██████╗ ██╗███████╗██╗  ██╗███████╗██████╗ ██╗ ██████╗"
  echo "  ██╔══██╗██║██╔════╝██║  ██║██╔════╝██╔══██╗██║██╔═══██╗"
  echo "  ██║  ██║██║███████╗███████║█████╗  ██████╔╝██║██║   ██║"
  echo "  ██║  ██║██║╚════██║██╔══██║██╔══╝  ██╔══██╗██║██║   ██║"
  echo "  ██████╔╝██║███████║██║  ██║███████╗██║  ██║██║╚██████╔╝"
  echo "  ╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}Sistema de Gestión de Restaurantes v3.1${NC}"
  echo ""
}

# Read helper with a non-interactive fallback.
# Without a TTY, use the default instead of blocking on stdin.
# Uso: read_or_default "prompt" "default_value" result_var
read_or_default() {
  local prompt="$1" default="$2" varname="$3"
  if [[ ! -t 0 ]] || [[ "${DISHERIO_NONINTERACTIVE:-}" == "1" ]]; then
    printf -v "$varname" '%s' "$default"
    echo -e "${DIM}  (auto) ${prompt} → ${default}${NC}"
  else
    read -rp "$prompt" "$varname"
    if [[ -z "${!varname}" ]]; then printf -v "$varname" '%s' "$default"; fi
  fi
}

# Distribution detection without lsb_release.
detect_distro() {
  local distro="ubuntu" codename="jammy"
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    distro="${ID:-ubuntu}"
    codename="${VERSION_CODENAME:-jammy}"
    # Normalize the distribution ID for the Docker repository.
    case "$distro" in
      linuxmint|pop|neon) distro="ubuntu"; codename="${UBUNTU_CODENAME:-$codename}";;
      # Debian derivatives (raspbian, etc.) map to debian for Docker repo.
      raspbian) distro="debian"; codename="${VERSION_CODENAME:-$codename}";;
    esac
  fi
  # Fallback: detect Debian via dpkg when os-release is missing.
  if [[ "$distro" == "ubuntu" && ! -f /etc/os-release ]]; then
    if dpkg -l 2>/dev/null | grep -qiE '^ii\s+debian-installer|^ii\s+base-files'; then
      distro="debian"; codename="bookworm"
    fi
  fi
  DISTRO_ID="$distro"
  DISTRO_CODENAME="$codename"
}

# Network detection without curl.
detect_ip() {
  # Try several local IP detection methods without requiring curl.
  LOCAL_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}' \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "127.0.0.1") || true
  if [[ -z "$LOCAL_IP" ]]; then LOCAL_IP="127.0.0.1"; fi

  # Detect the public IP only when curl is available.
  PUBLIC_IP=""
  if command -v curl &>/dev/null; then
    PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || true)
    if [[ -z "$PUBLIC_IP" ]]; then
      PUBLIC_IP=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || true)
    fi
  fi
}

# Whether an IPv4 is RFC1918 private (10/8, 172.16/12, 192.168/16) or loopback.
is_rfc1918() {
  local ip="$1"
  [[ "$ip" =~ ^10\. ]] && return 0
  [[ "$ip" =~ ^192\.168\. ]] && return 0
  [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] && return 0
  [[ "$ip" == "127.0.0.1" ]] && return 0
  return 1
}

# Resolve the IP to advertise for HTTP (mode "local") access.
# A cloud VM has an RFC1918 internal address that is unreachable from the
# operator's machine; in that case the public IP is the only usable access
# address, so prefer it (with a clear warning that HTTP is unencrypted).
# An explicit DISHERIO_ACCESS_IP override always wins.
resolve_local_access_ip() {
  if [[ -n "${DISHERIO_ACCESS_IP:-}" ]]; then
    echo "$DISHERIO_ACCESS_IP"
    return
  fi
  if is_rfc1918 "$LOCAL_IP" && [[ -n "$PUBLIC_IP" ]]; then
    echo "$PUBLIC_IP"
  else
    echo "$LOCAL_IP"
  fi
}

# Automatic secret generation.
# Use only alphanumeric characters to avoid breaking MongoDB URLs, shells, and YAML.
# Minimal systems may lack openssl, so /dev/urandom is the fallback.
_rand_alnum() {
  local len="$1"
  local s=""
  # Prefer openssl and fall back to /dev/urandom.
  if command -v openssl &>/dev/null; then
    s=$(openssl rand -base64 48 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c "$len" || true)
  fi
  while [[ ${#s} -lt "$len" ]]; do
    s="${s}$(tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c "$((len - ${#s}))")"
  done
  echo "${s:0:$len}"
}
gen_secret() { _rand_alnum "$1"; }
gen_pass()   { _rand_alnum "$1"; }
generate_all_secrets() {
  JWT_SECRET="${JWT_SECRET:-$(gen_secret 64)}"
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(gen_secret 64)}"
  ADMIN_PASS="${ADMIN_PASS:-$(gen_pass 20)}"
  MONGO_ROOT_PASS="${MONGO_ROOT_PASS:-$(gen_secret 32)}"
  MONGO_APP_PASS="${MONGO_APP_PASS:-$(gen_secret 32)}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-$(gen_secret 24)}"
}

load_existing_secrets() {
  MONGO_ROOT_USER=$(env_get "MONGO_ROOT_USER" "$MONGO_ROOT_USER")
  MONGO_ROOT_PASS=$(secret_get "mongo_root_password" "MONGO_ROOT_PASS" "")
  MONGO_APP_USER=$(env_get "MONGO_APP_USER" "$MONGO_APP_USER")
  MONGO_APP_PASS=$(secret_get "mongo_app_password" "MONGO_APP_PASS" "")
  REDIS_PASSWORD=$(secret_get "redis_password" "REDIS_PASSWORD" "")
  JWT_SECRET=$(secret_get "jwt_secret" "JWT_SECRET" "")
  JWT_REFRESH_SECRET=$(secret_get "jwt_refresh_secret" "JWT_REFRESH_SECRET" "")
  ADMIN_USER=$(env_get "ADMIN_USERNAME" "$ADMIN_USER")
  ADMIN_PASS=$(secret_get "admin_password" "ADMIN_PASSWORD" "")
}

generate_caddy_config() {
  local template
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    template="$ROOT_DIR/infrastructure/caddy-templates/Caddyfile.domain"
    cp "$template" "$CADDYFILE"
    sed -i \
      -e "s|\${DOMAIN}|${CADDY_DOMAIN}|g" \
      -e "s|\${EMAIL}|admin@${CADDY_DOMAIN}|g" \
      "$CADDYFILE"
  else
    template="$ROOT_DIR/infrastructure/caddy-templates/Caddyfile.local-ip"
    cp "$template" "$CADDYFILE"
    sed -i -e "s|\${HTTP_PORT}|${HTTP_PORT}|g" "$CADDYFILE"
  fi
  chmod 644 "$CADDYFILE"
}

# Check that the port is available.
port_in_use() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -E ":${port}$" >/dev/null 2>&1
  elif command -v netstat &>/dev/null; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -E ":${port}$" >/dev/null 2>&1
  else
    return 1
  fi
}

# Read .env safely without source.
env_get() {
  local key="$1" default="${2:-}"
  if [[ -f "$ENV_FILE" ]]; then
    local v
    v=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2- || true)
    # Quitar comillas si las tiene
    v="${v#\"}"; v="${v%\"}"
    v="${v#\'}"; v="${v%\'}"
    [[ -n "$v" ]] && echo "$v" || echo "$default"
  else
    echo "$default"
  fi
}

secret_get() {
  local filename="$1" env_key="$2" default="${3:-}"
  local secret_path="$ROOT_DIR/config/secrets/$filename"
  if [[ -s "$secret_path" ]]; then
    tr -d '\r\n' < "$secret_path"
  else
    env_get "$env_key" "$default"
  fi
}

scrub_secret_env() {
  sed -i -E '/^(MONGO_ROOT_PASS|MONGO_APP_PASS|MONGODB_URI|JWT_SECRET|JWT_REFRESH_SECRET|REDIS_PASSWORD|ADMIN_PASSWORD)=/d' "$ENV_FILE"
}

write_docker_secret_files() {
  local secret_dir="$ROOT_DIR/config/secrets"
  install -d -m 0700 "$secret_dir"

  printf '%s' "$MONGO_ROOT_PASS" > "$secret_dir/mongo_root_password"
  printf '%s' "$MONGO_APP_PASS" > "$secret_dir/mongo_app_password"
  printf 'mongodb://%s:%s@mongo:27017/disherio?authSource=disherio&replicaSet=rs0' \
    "$MONGO_APP_USER" "$MONGO_APP_PASS" > "$secret_dir/mongodb_uri"
  printf '%s' "$REDIS_PASSWORD" > "$secret_dir/redis_password"
  printf '%s' "$JWT_SECRET" > "$secret_dir/jwt_secret"
  printf '%s' "$JWT_REFRESH_SECRET" > "$secret_dir/jwt_refresh_secret"
  printf '%s' "$ADMIN_PASS" > "$secret_dir/admin_password"
  # The secret files are bind-mounted into containers that do not run as root
  # (mongo runs as UID 999, backend as 1001, redis as its own user). A 0600
  # mode owned by root makes them unreadable inside those containers, which
  # crashes mongo with "/run/secrets/mongo_root_password: Permission denied"
  # on real Linux hosts. The directory stays 0700 (root only), but each file
  # must be world-readable so the non-root container UIDs can read the secret
  # they are bind-mounted. This matches how the official mongo image expects
  # *_FILE secrets to be readable.
  chmod 644 "$secret_dir"/*
}

# =============================================================================
# PRE-FLIGHT: install system dependencies before using them.
#  Orden estricto: nada de este bloque depende de algo posterior.
# =============================================================================
preflight_system() {
  step "0/7: PRE-FLIGHT DEL SISTEMA"

  # Create the log directory first because err() depends on it.
  if ! mkdir -p "$LOG_DIR" 2>/dev/null; then
    # Fall back to a repository-local log when /var/log cannot be created.
    LOG_FILE="$ROOT_DIR/disherio-install.log"
    LOG_DIR="$ROOT_DIR"
    warn "No se pudo crear $LOG_DIR. Usando log local: $LOG_FILE"
  fi
  echo "=== DisherIO Installer v3.1 — $(date) ===" > "$LOG_FILE" 2>/dev/null || true

  log "Comprobando dependencias del sistema..."

  local need_install=()
  # Check each required tool individually.
  # jq is needed by some container introspection; git is needed for updates.
  for tool in curl wget ca-certificates gnupg openssl apt-get git jq; do
    if ! command -v "$tool" &>/dev/null; then
      need_install+=("$tool")
    fi
  done

  if [[ ${#need_install[@]} -gt 0 ]]; then
    log "Instalando dependencias base: ${need_install[*]}"
    if command -v apt-get &>/dev/null; then
      apt-get update -qq >> "$LOG_FILE" 2>&1 || err "apt-get update fallido"
      apt-get install -y -qq "${need_install[@]}" >> "$LOG_FILE" 2>&1 \
        || err "No se pudieron instalar: ${need_install[*]}"
    else
      err "Faltan herramientas (${need_install[*]}) y no hay apt-get. Instálalas manualmente."
    fi
    ok "Dependencias base instaladas"
  else
    ok "Dependencias base presentes"
  fi

  # Detect the distribution and IP addresses after curl and openssl are available.
  detect_distro
  detect_ip
  ok "Distro: ${DISTRO_ID}/${DISTRO_CODENAME} | IP local: ${LOCAL_IP} | IP pública: ${PUBLIC_IP:-n/a}"

  # Resource pre-check: Docker + MongoDB + Redis + Caddy + build need at least
  # 2 GB RAM and 5 GB disk. Warn early instead of failing mid-build.
  if command -v free &>/dev/null; then
    local avail_mb
    avail_mb=$(free -m 2>/dev/null | awk '/^Mem:/ {print $7}')
    if [[ -n "$avail_mb" ]] && (( avail_mb < 1024 )); then
      warn "Memoria disponible baja (${avail_mb}MB). Se recomiendan al menos 2GB."
    fi
  fi
  if command -v df &>/dev/null; then
    local avail_disk_mb
    avail_disk_mb=$(df -m / 2>/dev/null | awk 'NR==2 {print $4}')
    if [[ -n "$avail_disk_mb" ]] && (( avail_disk_mb < 5120 )); then
      warn "Espacio en disco bajo (${avail_disk_mb}MB disponible). Se recomiendan al menos 5GB."
    fi
  fi
}

# =============================================================================
# INSTALLATION — Only five user-supplied parameters
# =============================================================================
cmd_install() {
  [[ $EUID -eq 0 ]] || err "Ejecuta como root: sudo ./scripts/install.sh"

  banner

  # Step 0: system pre-flight (installs curl, openssl, and related tools).
  preflight_system

  if [[ -f "$ENV_FILE" ]] && docker volume inspect disherio_mongo_data &>/dev/null; then
    PRESERVE_EXISTING_SECRETS=1
  fi

  # Clean a previous installation after confirmation.
  if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    if docker compose ps -a 2>/dev/null | grep -q "disherio"; then
      warn "Se detectó una instalación anterior de DisherIO."
      clean_choice="n"
      if [[ ! -t 0 ]] || [[ "${DISHERIO_NONINTERACTIVE:-}" == "1" ]]; then
        log "Modo non-interactive: saltando limpieza de instalación previa"
      else
        read -rp "¿Eliminar contenedores y volúmenes previos? (s/N): " clean_choice
      fi
      if [[ "${clean_choice:-n}" =~ ^[sSyY] ]]; then
        log "Limpiando instalación anterior..."
        docker compose down --remove-orphans >> "$LOG_FILE" 2>&1 || true
        vol_choice="n"
        if [[ -t 0 ]] && [[ "${DISHERIO_NONINTERACTIVE:-}" != "1" ]]; then
          read -rp "¿Borrar también los DATOS (volúmenes MongoDB/Redis)? (s/N): " vol_choice
        fi
        if [[ "${vol_choice:-n}" =~ ^[sSyY] ]]; then
          docker compose down --volumes --remove-orphans >> "$LOG_FILE" 2>&1 || true
          PRESERVE_EXISTING_SECRETS=0
          ok "Volúmenes previos eliminados"
        fi
      fi
    fi
  fi

  # Step 1: five essential parameters.
  step "1/7: CONFIGURACIÓN"

  # Reconfirm the IP detected during pre-flight in case it changed.
  detect_ip

  # Detectar modo non-interactive
  NONINTERACTIVE=0
  if [[ ! -t 0 ]] || [[ "${DISHERIO_NONINTERACTIVE:-}" == "1" ]]; then
    NONINTERACTIVE=1
    log "Modo non-interactive detectado (sin TTY o DISHERIO_NONINTERACTIVE=1)"
  fi

  # Parameter 1: deployment type.
  if [[ -n "${DISHERIO_DEPLOY_MODE:-}" ]]; then
    # Non-interactive via env var
    case "$DISHERIO_DEPLOY_MODE" in
      domain) INSTALL_MODE="domain";;
      local)  INSTALL_MODE="local";  CADDY_DOMAIN="$(resolve_local_access_ip)";;
      public) INSTALL_MODE="local";  CADDY_DOMAIN="${PUBLIC_IP:-$(resolve_local_access_ip)}"; warn "Modo 'public' = IP pública por HTTP sin cifrar (sin TLS).";;
      *) err "DISHERIO_DEPLOY_MODE inválido: '$DISHERIO_DEPLOY_MODE' (usar: domain|local|public)";;
    esac
    log "Deploy mode (env): $DISHERIO_DEPLOY_MODE"
  elif [[ "$NONINTERACTIVE" == "1" ]]; then
    # Automatic mode: use the public IP when the internal one is unreachable
    # from outside (typical cloud VM), never an unencrypted auth on a public
    # IP would be worse — but the operator explicitly chose local/non-interactive.
    INSTALL_MODE="local"; CADDY_DOMAIN="$(resolve_local_access_ip)"
    log "Deploy mode (auto): $INSTALL_MODE → $CADDY_DOMAIN"
  else
    # Interactive
    echo ""
    echo "  ¿Cómo vas a acceder a DisherIO?"
    echo ""
    echo "  [1] Dominio público con HTTPS  (ej: app.restaurante.com)"
    echo "  [2] IP local por HTTP SIN CIFRAR (solo LAN de confianza: ${LOCAL_IP})"
    echo "  [3] IP pública por HTTP SIN CIFRAR (${PUBLIC_IP:-no detectada})"
    echo ""
    local choice
    read_or_default "  Elige opción [2]: " "2" choice
    case "$choice" in
      1) INSTALL_MODE="domain";;
      2) INSTALL_MODE="local"; CADDY_DOMAIN="$(resolve_local_access_ip)";;
      3) INSTALL_MODE="local"; CADDY_DOMAIN="${PUBLIC_IP}";;
      *) err "Opción inválida";;
    esac
  fi

  if [[ "$INSTALL_MODE" == "local" ]]; then
    if is_rfc1918 "$LOCAL_IP" && [[ -n "$PUBLIC_IP" && "$CADDY_DOMAIN" == "$PUBLIC_IP" ]]; then
      warn "Se detectó IP interna RFC1918 (${LOCAL_IP}) con IP pública ${PUBLIC_IP}."
      warn "Usando la IP pública por HTTP SIN CIFRAR: las credenciales viajan en claro."
      warn "Para cifrar el acceso, redespliega en modo 'domain' con un dominio."
    elif [[ -n "$PUBLIC_IP" && "$CADDY_DOMAIN" == "$PUBLIC_IP" ]]; then
      warn "IP pública ${PUBLIC_IP} por HTTP SIN CIFRAR: las credenciales viajan en claro."
      warn "Para HTTPS, redespliega en modo 'domain' con un dominio o usa un túnel."
    else
      warn "El modo IP local usa HTTP sin cifrar. Úsalo únicamente en una LAN privada de confianza."
    fi
  fi

  # Parameter 2: domain (domain mode only).
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    if [[ -n "${DISHERIO_DOMAIN:-}" ]]; then
      CADDY_DOMAIN="$DISHERIO_DOMAIN"
      log "Dominio (env): $CADDY_DOMAIN"
    elif [[ "$NONINTERACTIVE" == "1" ]]; then
      err "Modo domain requiere DISHERIO_DOMAIN en modo non-interactive"
    else
      echo ""
      read -rp "  Introduce tu dominio (ej: app.restaurante.com): " CADDY_DOMAIN
      if [[ -z "$CADDY_DOMAIN" ]]; then err "Dominio requerido"; fi
    fi
    [[ "$CADDY_DOMAIN" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]] \
      || err "Dominio inválido: $CADDY_DOMAIN"
  fi

  ok "Acceso: ${CADDY_DOMAIN}"

  # Pre-check DNS resolution in domain mode so the installer fails fast
  # instead of wasting 60+ seconds on Let's Encrypt challenges that cannot
  # succeed when the domain does not resolve to this server.
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    log "Verificando resolución DNS para ${CADDY_DOMAIN}..."
    local resolved_ip=""
    if command -v dig &>/dev/null; then
      resolved_ip=$(dig +short "$CADDY_DOMAIN" A 2>/dev/null | head -1 || true)
    elif command -v host &>/dev/null; then
      resolved_ip=$(host -t A "$CADDY_DOMAIN" 2>/dev/null | awk '/has address/ {print $NF; exit}' || true)
    elif command -v getent &>/dev/null; then
      resolved_ip=$(getent hosts "$CADDY_DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
    fi
    if [[ -z "$resolved_ip" ]]; then
      err "El dominio ${CADDY_DOMAIN} no resuelve a ninguna IP. Configura el registro DNS A -> ${PUBLIC_IP:-tu IP pública} antes de instalar en modo domain."
    fi
    # Compare resolved IP against the server's public/local IP.
    local server_ip="${PUBLIC_IP:-$LOCAL_IP}"
    if [[ -n "$server_ip" && "$resolved_ip" != "$server_ip" ]]; then
      warn "El dominio ${CADDY_DOMAIN} resuelve a ${resolved_ip} pero la IP de este servidor es ${server_ip}."
      warn "Let's Encrypt no podrá emitir un certificado si el DNS no apunta a esta máquina."
      if [[ "$NONINTERACTIVE" != "1" ]]; then
        local dns_confirm
        read -rp "¿Continuar de todas formas? (s/N): " dns_confirm
        [[ "${dns_confirm:-n}" =~ ^[sSyY] ]] || err "Instalación cancelada. Corrige el DNS antes de continuar."
      fi
    fi
    ok "DNS: ${CADDY_DOMAIN} -> ${resolved_ip}"
  fi

  # Parameter 3: language.
  if [[ -n "${DISHERIO_LANGUAGE:-}" ]]; then
    DEFAULT_LANGUAGE="$DISHERIO_LANGUAGE"
    log "Idioma (env): $DEFAULT_LANGUAGE"
  elif [[ "$NONINTERACTIVE" == "1" ]]; then
    log "Idioma (auto): $DEFAULT_LANGUAGE"
  else
    echo ""
    echo "  Idioma del sistema:"
    echo "  [1] Español  [2] English  [3] Français"
    local lang_choice
    read_or_default "  Elige [1]: " "1" lang_choice
    case "$lang_choice" in
      1) DEFAULT_LANGUAGE="es";; 2) DEFAULT_LANGUAGE="en";; 3) DEFAULT_LANGUAGE="fr";;
      *) DEFAULT_LANGUAGE="es";;
    esac
  fi
  ok "Idioma: ${DEFAULT_LANGUAGE}"

  # Parameter 4: restaurant name.
  if [[ -n "${DISHERIO_RESTAURANT_NAME:-}" ]]; then
    RESTAURANT_NAME="$DISHERIO_RESTAURANT_NAME"
    log "Restaurante (env): $RESTAURANT_NAME"
  elif [[ "$NONINTERACTIVE" == "1" ]]; then
    log "Restaurante (auto): $RESTAURANT_NAME"
  else
    echo ""
    local rn
    read_or_default "  Nombre del restaurante [${RESTAURANT_NAME}]: " "$RESTAURANT_NAME" rn
    RESTAURANT_NAME="${rn:-$RESTAURANT_NAME}"
  fi
  ok "Restaurante: ${RESTAURANT_NAME}"

  # Parameter 5: currency.
  if [[ -n "${DISHERIO_CURRENCY:-}" ]]; then
    DEFAULT_CURRENCY="$DISHERIO_CURRENCY"
    log "Moneda (env): $DEFAULT_CURRENCY"
  elif [[ "$NONINTERACTIVE" == "1" ]]; then
    log "Moneda (auto): $DEFAULT_CURRENCY"
  else
    echo ""
    echo "  Moneda: [1] EUR (€)  [2] USD (\$)  [3] GBP (£)"
    local cur_choice
    read_or_default "  Elige [1]: " "1" cur_choice
    case "$cur_choice" in
      1) DEFAULT_CURRENCY="EUR";; 2) DEFAULT_CURRENCY="USD";; 3) DEFAULT_CURRENCY="GBP";;
      *) DEFAULT_CURRENCY="EUR";;
    esac
  fi
  ok "Moneda: ${DEFAULT_CURRENCY}"

  # Parameter 6: example data.
  if [[ -n "${DISHERIO_SEED_EXAMPLES:-}" ]]; then
    SEED_EXAMPLES="$DISHERIO_SEED_EXAMPLES"
    log "Datos ejemplo (env): $SEED_EXAMPLES"
  elif [[ "$NONINTERACTIVE" == "1" ]]; then
    SEED_EXAMPLES="n"
    log "Datos ejemplo (auto): no"
  else
    echo ""
    echo "  ¿Instalar datos de ejemplo?"
    echo "  Incluye 2 categorías (Entrantes, Bebidas), 8 platos y una mesa demo"
    echo "  (categorías, platos y una mesa de ejemplo; sin usuarios de contraseña fija)"
    local seed_choice
    read_or_default "  ¿Instalar? (s/N): " "n" seed_choice
    if [[ "${seed_choice}" =~ ^[sSyY] ]]; then
      SEED_EXAMPLES="y"
    else
      SEED_EXAMPLES="n"
    fi
  fi
  if [[ "$SEED_EXAMPLES" =~ ^[yYsS] ]]; then
    ok "Datos ejemplo: sí"
  else
    ok "Datos ejemplo: no"
  fi

  # Construir URL de acceso
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    ACCESS_URL="https://${CADDY_DOMAIN}"
  else
    ACCESS_URL="http://${CADDY_DOMAIN}"
  fi

  # Step 2: verify or install Docker.
  step "2/7: VERIFICANDO DOCKER"

  if ! command -v docker &>/dev/null; then
    log "Instalando Docker..."
    apt-get update -qq >> "$LOG_FILE" 2>&1
    apt-get install -y -qq curl wget ca-certificates gnupg >> "$LOG_FILE" 2>&1
    install -m 0755 -d /etc/apt/keyrings
    # Determine the architecture for the Docker repo.
    local arch
    arch=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
    # Map common architecture names to Docker's naming.
    case "$arch" in
      amd64|x86_64)   arch="amd64";;
      arm64|aarch64)  arch="arm64";;
      armhf|armv7l)   arch="armhf";;
      *) err "Arquitectura no soportada para Docker: $arch";;
    esac
    # Fetch the Docker GPG key; tolerate transient network issues.
    curl -fsSL "https://download.docker.com/linux/${DISTRO_ID}/gpg" -o /etc/apt/keyrings/docker.asc 2>>"$LOG_FILE" \
      || err "No se pudo descargar la clave GPG de Docker. Verifica la conectividad a download.docker.com."
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DISTRO_ID} ${DISTRO_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq >> "$LOG_FILE" 2>&1 \
      || err "apt-get update fallido tras añadir el repositorio de Docker. Revisa /etc/apt/sources.list.d/docker.list"
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >> "$LOG_FILE" 2>&1 \
      || err "No se pudo instalar Docker CE. Ver $LOG_FILE"
    systemctl enable --now docker >> "$LOG_FILE" 2>&1
    ok "Docker instalado"
  else
    ok "Docker ya instalado: $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  fi

  # Require the Docker Compose v2 plugin, not docker-compose v1.
  if ! docker compose version &>/dev/null; then
    err "docker compose v2 no disponible. Instala: apt-get install docker-compose-plugin"
  fi
  ok "docker compose v2: $(docker compose version 2>/dev/null | head -1)"

  # Step 3: generate secrets.
  step "3/7: GENERANDO SECRETOS"
  if [[ "$PRESERVE_EXISTING_SECRETS" == "1" ]]; then
    load_existing_secrets
    log "Conservando credenciales asociadas a los volúmenes existentes"
  fi
  generate_all_secrets
  ok "JWT, MongoDB, Redis y credenciales admin generadas automáticamente"

  # Step 4: write configuration.
  step "4/7: CONFIGURANDO ARCHIVOS"

  # Quote every .env value to preserve spaces and symbols.
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${BACKEND_PORT}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
MONGO_ROOT_USER="${MONGO_ROOT_USER}"
MONGO_APP_USER="${MONGO_APP_USER}"
JWT_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
FRONTEND_URL="${ACCESS_URL}"
LOG_LEVEL=info
DEFAULT_LANGUAGE=${DEFAULT_LANGUAGE}
DEFAULT_THEME=${DEFAULT_THEME}
DEFAULT_TAX_RATE=${DEFAULT_TAX_RATE}
DEFAULT_CURRENCY=${DEFAULT_CURRENCY}
RESTAURANT_NAME="${RESTAURANT_NAME}"
ADMIN_USERNAME=${ADMIN_USER}
TRUST_PROXY=true
REDIS_URL=redis://redis:6379
MONGODB_MAX_POOL_SIZE=50
MONGODB_SERVER_SELECTION_TIMEOUT=30000
MONGODB_SOCKET_TIMEOUT=45000
APP_LANG=${DEFAULT_LANGUAGE}
MONGO_KEYFILE=/data/db/mongo-keyfile
EOF
  chmod 600 "$ENV_FILE"
  write_docker_secret_files
  scrub_secret_env
  ok ".env creado"

  generate_caddy_config
  ok "Caddyfile creado"

  # Generate the keyFile for MongoDB replica set authentication.
  MONGO_KEYFILE="$ROOT_DIR/config/mongo-keyfile"
  mkdir -p "$ROOT_DIR/config"
  chmod 700 "$ROOT_DIR/config"
  if [[ ! -f "$MONGO_KEYFILE" ]] || [[ ! -s "$MONGO_KEYFILE" ]]; then
    log "Generando keyFile para MongoDB replica set..."
    openssl rand -base64 756 > "$MONGO_KEYFILE" 2>/dev/null || \
      head -c 756 /dev/urandom | base64 > "$MONGO_KEYFILE"
    chmod 600 "$MONGO_KEYFILE"
    # Ensure the MongoDB container user (UID 999) can read it.
    chown 999:999 "$MONGO_KEYFILE" 2>/dev/null || true
    ok "keyFile generado: $MONGO_KEYFILE"
  else
    chmod 600 "$MONGO_KEYFILE"
    chown 999:999 "$MONGO_KEYFILE" 2>/dev/null || true
    ok "keyFile ya existe: $MONGO_KEYFILE"
  fi

  # Step 5: verify ports before building.
  step "5/7: VERIFICANDO PUERTOS"

  local port_err=""
  for p in "$HTTP_PORT" "$HTTPS_PORT"; do
    if port_in_use "$p"; then
      port_err="${port_err} ${p}"
    fi
  done
  if [[ -n "$port_err" ]]; then
    warn "Puertos en uso:${port_err}. Caddy podría no arrancar."
    warn "Libéralos o ajústalos con: sudo ./scripts/configure.sh (opción 2)."
    warn "(El Caddyfile se materializa con el puerto al configurar; editarlo solo en .env no basta.)"
  else
    ok "Puertos ${HTTP_PORT}/${HTTPS_PORT} disponibles"
  fi

  # In domain mode, check that the firewall allows inbound 80/443 for
  # Let's Encrypt challenges. Cloud VMs (GCloud, AWS, Azure) often block
  # these by default. We can only warn, not fix it automatically.
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "active"; then
      if ! ufw status 2>/dev/null | grep -qE "80/tcp.*ALLOW|443/tcp.*ALLOW"; then
        warn "El firewall (ufw) podría estar bloqueando los puertos 80/443."
        warn "Let's Encrypt necesita ambos puertos. Ejecuta: sudo ufw allow 80,443/tcp"
      fi
    fi
    # Hint for GCloud / AWS / Azure users.
    if [[ -f /etc/cloud/cloud.cfg.d/* ]] || command -v gcloud &>/dev/null; then
      warn "Si estás en Google Cloud, verifica que el firewall permita 80/443 en la consola de GCP."
    fi
  fi

  # ── PASO 6: Construir ────────────────────────────────────────────────────
  step "6/7: CONSTRUYENDO IMÁGENES"
  cd "$ROOT_DIR"

  log "Descargando imágenes base..."
  docker compose pull >> "$LOG_FILE" 2>&1 || err "No se pudieron descargar las imágenes. Ver $LOG_FILE"

  # Pull the published seed image from GHCR. If the pull fails (offline,
  # first-time before CI publishes, or private registry), fall back to
  # building locally so the installer always works.
  log "Descargando imagen seed..."
  if ! docker compose --profile seed pull seed >> "$LOG_FILE" 2>&1; then
    warn "No se pudo descargar la imagen seed desde GHCR. Construyendo localmente..."
    docker compose --profile seed build seed >> "$LOG_FILE" 2>&1 \
      || err "Build de la imagen seed falló. Ver $LOG_FILE"
  fi
  ok "Imagen seed lista"

  log "Construyendo backend y frontend (3-5 min)..."
  docker compose build >> "$LOG_FILE" 2>&1 || err "Build fallido. Ver $LOG_FILE"
  ok "Imágenes construidas"

  # Step 7: start services in strict dependency order.
  step "7/7: INICIANDO SERVICIOS (orden estricto)"

  # 7.1 — Start MongoDB first; init-mongo.js creates the app user only on first initialization.
  log "Iniciando MongoDB (crea app user + índices)..."
  docker compose up -d mongo --wait --wait-timeout 120 >> "$LOG_FILE" 2>&1 \
    || err "MongoDB no arrancó. Ver $LOG_FILE"
  ok "MongoDB listo"

  # 7.2 — Initialize the replica set explicitly; transactions require it.
  log "Inicializando replica set rs0..."
  # mongo-init-replica is a one-shot service; --wait waits for completion.
  docker compose up --force-recreate --exit-code-from mongo-init-replica mongo-init-replica \
    >> "$LOG_FILE" 2>&1 || err "init-replica falló. Ver $LOG_FILE"
  ok "Replica set rs0 listo (primary)"

# 7.3 — Force-create the app user when a pre-existing volume skipped initialization.
# MongoDB stores all users in admin.system.users with a db field, not in
# <dbname>.system.users, so getUser() is the reliable check.
  log "Verificando usuario de aplicación MongoDB..."
  # getUser() returns null when the user does not exist.
  app_user_exists=$(docker compose exec -T mongo sh -c \
        'mongosh --quiet --eval "const fs=require(\"fs\"); const pw=fs.readFileSync(\"/run/secrets/mongo_root_password\",\"utf8\").trim(); db.getSiblingDB(\"admin\").auth(process.env.MONGO_INITDB_ROOT_USERNAME,pw); const u=db.getSiblingDB(\"disherio\").getUser(process.env.MONGO_APP_USER); print((u !== null && typeof u === \"object\") ? \"yes\" : \"no\")"' \
        2>/dev/null || echo "err")
  if [[ "$app_user_exists" == "yes" ]]; then
    ok "Usuario app presente"
    # The volume predates this install: if config/secrets was lost and
    # MONGO_APP_PASS was regenerated, the password stored in MongoDB no longer
    # matches the secret the backend will use, and authentication would fail
    # silently. Always reconcile the user's password with the current secret.
    log "Sincronizando la contraseña del usuario app con el secreto actual..."
    docker compose exec -T mongo sh -c \
      'mongosh --quiet --eval "const fs=require(\"fs\"); const pw=fs.readFileSync(\"/run/secrets/mongo_root_password\",\"utf8\").trim(); const appPw=fs.readFileSync(\"/run/secrets/mongo_app_password\",\"utf8\").trim(); db.getSiblingDB(\"admin\").auth(process.env.MONGO_INITDB_ROOT_USERNAME,pw); db.getSiblingDB(\"disherio\").changeUserPassword(process.env.MONGO_APP_USER, appPw); print(\"password reconciled\")"' \
      >> "$LOG_FILE" 2>&1 || err "No se pudo sincronizar la contraseña del usuario app"
    ok "Contraseña del usuario app sincronizada"
  else
    log "Usuario app no encontrado. Creándolo a la fuerza..."
    # createUser throws when the user already exists; tolerate that case with try/catch.
    docker compose exec -T mongo sh -c \
      'mongosh --quiet --eval "const fs=require(\"fs\"); const pw=fs.readFileSync(\"/run/secrets/mongo_root_password\",\"utf8\").trim(); db.getSiblingDB(\"admin\").auth(process.env.MONGO_INITDB_ROOT_USERNAME,pw); load(\"/docker-entrypoint-initdb.d/init-mongo.js\")"' \
      >> "$LOG_FILE" 2>&1 || err "No se pudo crear el usuario app"
    ok "Usuario app creado"
  fi

  # 7.4 — Redis
  log "Iniciando Redis..."
  docker compose up -d redis --wait --wait-timeout 60 >> "$LOG_FILE" 2>&1 \
    || err "Redis no arrancó. Ver $LOG_FILE"
  ok "Redis listo"

  # 7.5 — Backend (depende de mongo + replica + redis)
  log "Iniciando backend..."
  docker compose up -d backend --wait --wait-timeout 180 >> "$LOG_FILE" 2>&1 \
    || err "Backend no arrancó. Ver $LOG_FILE"
  ok "Backend listo"

  # 7.6 — Frontend
  log "Iniciando frontend..."
  docker compose up -d frontend --wait --wait-timeout 120 >> "$LOG_FILE" 2>&1 \
    || err "Frontend no arrancó. Ver $LOG_FILE"
  ok "Frontend listo"

  # 7.7 — Seed through the Compose service at dist/seeders/index.js.
  log "Ejecutando seed (restaurante, roles, admin)..."
  # Build the seed image when missing, then run it.
  docker compose --profile seed up --force-recreate --exit-code-from seed seed >> "$LOG_FILE" 2>&1 \
    || err "Seed falló. Ver $LOG_FILE"
  ok "Datos iniciales creados (restaurante, roles, admin)"

  # 7.7b — Seed example data when requested.
  if [[ "$SEED_EXAMPLES" =~ ^[yYsS] ]]; then
    log "Ejecutando seed de ejemplos (categorías, platos, usuarios demo)..."
    # The user's opt-in above is the explicit confirmation required by the
    # production guard in seed-examples (SEED_EXAMPLES_CONFIRM=true).
    SEED_EXAMPLES_CONFIRM=true docker compose --profile seed up --force-recreate --exit-code-from seed-examples seed-examples >> "$LOG_FILE" 2>&1 \
      || err "Seed de ejemplos falló. Ver $LOG_FILE"
    ok "Datos de ejemplo creados (categorías, platos y mesa; sin credenciales fijas)"
  fi

  # 7.8 — Caddy (depende de backend + frontend sanos)
  log "Iniciando Caddy (proxy)..."
  # In domain mode, Caddy needs extra time to obtain the Let's Encrypt cert.
  local caddy_timeout=60
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    caddy_timeout=120
  fi
  if ! docker compose up -d caddy --wait --wait-timeout "$caddy_timeout" >> "$LOG_FILE" 2>&1; then
    # Provide a domain-specific hint: the most common cause of Caddy failure
    # in domain mode is Let's Encrypt not being able to verify the domain.
    if [[ "$INSTALL_MODE" == "domain" ]]; then
      err "Caddy no arrancó. En modo domain, la causa más común es que Let's Encrypt no puede verificar ${CADDY_DOMAIN}. Verifica que el DNS A record apunta a ${PUBLIC_IP:-esta IP} y que los puertos 80/443 están abiertos. Ver $LOG_FILE y 'docker compose logs caddy'."
    else
      err "Caddy no arrancó. Ver $LOG_FILE y 'docker compose logs caddy'."
    fi
  fi
  ok "Caddy listo"

  # Summary.
  print_summary
}

# Final summary with credentials.
print_summary() {
  # Guardar credenciales
  cat > "$CREDENTIALS_FILE" <<EOF
# DisherIO — Credenciales
# Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# KEEP THIS FILE SECURE!

URL de acceso:    ${ACCESS_URL}
Usuario admin:    ${ADMIN_USER}
Contraseña admin: ${ADMIN_PASS}
Restaurante:      ${RESTAURANT_NAME}
Idioma:           ${DEFAULT_LANGUAGE}
Moneda:           ${DEFAULT_CURRENCY}

EOF

  cat >> "$CREDENTIALS_FILE" <<EOF
Comandos útiles:
  Estado:    sudo ./scripts/install.sh status
  Logs:      sudo ./scripts/install.sh logs
  Reiniciar: sudo ./scripts/install.sh restart
  Backup:    sudo ./scripts/install.sh backup
  Parar:     sudo ./scripts/install.sh stop
EOF
  chmod 600 "$CREDENTIALS_FILE"

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║${NC}         ${BOLD}DISHERIO INSTALADO CORRECTAMENTE${NC}              ${GREEN}║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}   URL:      ${BOLD}${CYAN}${ACCESS_URL}${NC}"
  echo -e "${GREEN}║${NC}   Restaurante: ${BOLD}${RESTAURANT_NAME}${NC}"
  echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}         ${YELLOW}CREDENCIALES DE ADMINISTRADOR${NC}               ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}   Usuario:  ${BOLD}${ADMIN_USER}${NC}"
  echo -e "${GREEN}║${NC}   Password: guardada en ${BOLD}${CREDENTIALS_FILE}${NC} (0600)"
  echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}   Accesos:                                             ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     Admin:  ${ACCESS_URL}/admin                          ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     POS:    ${ACCESS_URL}/pos                            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     Cocina: ${ACCESS_URL}/kds                            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}     Mesas:  ${ACCESS_URL}/tas                            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}   Credenciales guardadas: ${CREDENTIALS_FILE}    ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}   Log de instalación:    ${LOG_FILE}              ${GREEN}║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  warn "Guarda estas credenciales en un lugar seguro."
  echo ""
}

# =============================================================================
# MANAGEMENT SUBCOMMANDS
# =============================================================================

cmd_start() {
  cd "$ROOT_DIR"
  [[ -f "$ENV_FILE" ]] || err "No hay instalación. Ejecuta: sudo ./scripts/install.sh install"
  log "Iniciando servicios..."
  docker compose up -d --wait >> "$LOG_FILE" 2>&1 || err "No se pudieron iniciar"
  ok "Servicios iniciados"
  cmd_status
}

cmd_stop() {
  cd "$ROOT_DIR"
  log "Deteniendo servicios..."
  docker compose stop >> "$LOG_FILE" 2>&1 || true
  ok "Servicios detenidos"
}

cmd_restart() {
  cd "$ROOT_DIR"
  log "Reiniciando servicios..."
  docker compose restart >> "$LOG_FILE" 2>&1 || err "No se pudieron reiniciar"
  ok "Servicios reiniciados"
  cmd_status
}

cmd_status() {
  cd "$ROOT_DIR"

  # Read .env safely without source.
  local url
  url=$(env_get "FRONTEND_URL" "http://localhost")

  echo ""
  echo -e "  ${BOLD}ESTADO DE SERVICIOS${NC}"
  echo -e "  ${BLUE}$(printf '─%.0s' {1..55})${NC}"

  if ! docker compose ps 2>/dev/null | grep -q .; then
    echo -e "  ${RED}Sin contenedores activos${NC}"
    return
  fi

  docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null

  echo ""
  echo -e "  ${BOLD}ACCESO${NC}"
  echo -e "  ${BLUE}$(printf '─%.0s' {1..55})${NC}"
  echo -e "  URL:     ${BOLD}${url}${NC}"
  echo -e "  Admin:   ${url}/admin"
  echo -e "  POS:     ${url}/pos"
  echo -e "  Cocina:  ${url}/kds"
  echo -e "  Mesas:   ${url}/tas"

  if [[ -f "$CREDENTIALS_FILE" ]]; then
    echo ""
    echo -e "  ${BOLD}CREDENCIALES${NC}"
    echo -e "  ${BLUE}$(printf '─%.0s' {1..55})${NC}"
    echo "  Archivo protegido: $CREDENTIALS_FILE (0600)"
    echo "  El comando status no imprime contraseñas ni tokens."
  fi

  echo ""
  echo -e "  ${BOLD}RECURSOS${NC}"
  echo -e "  ${BLUE}$(printf '─%.0s' {1..55})${NC}"
  docker stats --no-stream --format "  {{.Name}}\tCPU: {{.CPUPerc}}\tRAM: {{.MemUsage}}" 2>/dev/null || true
  echo ""
}

cmd_logs() {
  cd "$ROOT_DIR"
  local svc="${1:-}"
  if [[ -n "$svc" ]]; then
    docker compose logs -f "$svc"
  else
    docker compose logs -f
  fi
}

cmd_backup() {
  [[ $EUID -eq 0 ]] || err "Ejecuta el backup como root para incluir la configuración protegida"
  cd "$ROOT_DIR"
  local backup_dir="${BACKUP_DIR:-/var/backups/disherio}"
  local ts
  ts=$(date '+%Y%m%d_%H%M%S')
  local archive="${backup_dir}/disherio_backup_${ts}.tar.gz"
  local staging

  install -d -m 0700 "$backup_dir"
  staging=$(mktemp -d "${backup_dir}/.backup_${ts}.XXXXXX")
  trap 'rm -rf "$staging"' RETURN
  install -d -m 0700 "$staging/database" "$staging/uploads" "$staging/config" "$staging/config/secrets"

  log "Creando backup autenticado..."
  docker compose exec -T mongo sh -c \
    'mongodump --db disherio --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$(cat /run/secrets/mongo_root_password)" --authenticationDatabase admin \
    --out "$1" --quiet' sh "/tmp/dump_${ts}" >> "$LOG_FILE" 2>&1 \
    || err "mongodump falló. Ver $LOG_FILE"

  docker compose cp "mongo:/tmp/dump_${ts}/." "$staging/database/" >> "$LOG_FILE" 2>&1 \
    || err "copy falló"
  docker compose exec -T mongo rm -rf "/tmp/dump_${ts}" 2>/dev/null || true

  log "Incluyendo uploads y configuración recuperable..."
  docker compose cp "backend:/app/uploads/." "$staging/uploads/" >> "$LOG_FILE" 2>&1 \
    || err "No se pudieron copiar los uploads"
  install -m 0600 "$ENV_FILE" "$staging/config/.env"
  install -m 0600 "$CADDYFILE" "$staging/config/Caddyfile"
  install -m 0600 "$ROOT_DIR/config/mongo-keyfile" "$staging/config/mongo-keyfile"
  for secret_file in "$ROOT_DIR"/config/secrets/*; do
    [[ -f "$secret_file" ]] || continue
    install -m 0600 "$secret_file" "$staging/config/secrets/$(basename "$secret_file")"
  done
  if [[ -f "$ROOT_DIR/docker-compose.override.yml" ]]; then
    install -m 0600 "$ROOT_DIR/docker-compose.override.yml" "$staging/config/docker-compose.override.yml"
  fi
  printf 'format=disherio-backup-v1\ncreated_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$staging/manifest"
  (cd "$staging" && find database uploads config -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

  tar -czf "$archive" -C "$staging" manifest SHA256SUMS database uploads config

  # The archive contains Docker secrets and the MongoDB keyfile: encrypt and
  # authenticate it at rest. The v2 envelope is: magic, HMAC, ciphertext.
  # Password from DISHERIO_BACKUP_PASSWORD or interactive prompt.
  local backup_pass="${DISHERIO_BACKUP_PASSWORD:-}"
  if [[ -z "$backup_pass" ]]; then
    if [[ -t 0 ]] && [[ "${DISHERIO_NONINTERACTIVE:-}" != "1" ]]; then
      local backup_pass2=""
      read -rsp "Contraseña para cifrar el backup: " backup_pass; echo
      read -rsp "Repite la contraseña: " backup_pass2; echo
      [[ -n "$backup_pass" && "$backup_pass" == "$backup_pass2" ]] \
        || err "Las contraseñas no coinciden o están vacías"
      unset backup_pass2
    else
      err "Define DISHERIO_BACKUP_PASSWORD para cifrar el backup (modo no interactivo)"
    fi
  fi
  local enc_archive="${archive}.enc"
  local cipher_archive="${staging}/backup.cipher"
  DISHERIO_BACKUP_PASS="$backup_pass" openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
    -pass env:DISHERIO_BACKUP_PASS -in "$archive" -out "$cipher_archive" \
    || err "No se pudo cifrar el backup"
  local backup_mac
  backup_mac=$(DISHERIO_BACKUP_PASS="$backup_pass" openssl dgst -sha256 -mac HMAC \
    -macopt keyenv:DISHERIO_BACKUP_PASS "$cipher_archive" | awk '{print $NF}') \
    || err "No se pudo autenticar el backup"
  [[ "$backup_mac" =~ ^[a-fA-F0-9]{64}$ ]] || err "OpenSSL devolvió un HMAC no válido"
  {
    printf 'DISHERIO-BACKUP-V2\n%s\n' "$backup_mac"
    dd if="$cipher_archive" bs=1M status=none
  } > "$enc_archive"
  unset backup_pass
  rm -f "$archive"
  archive="$enc_archive"
  chmod 600 "$archive"

  local size
  size=$(du -sh "$archive" | cut -f1)
  ok "Backup cifrado: ${archive} (${size})"

  # Rotation: remove backups older than seven days.
  find "$backup_dir" -name "disherio_backup_*.tar.gz*" -mtime +7 -delete 2>/dev/null || true
  log "Backups >7 días eliminados"
}

cmd_restore() {
  [[ $EUID -eq 0 ]] || err "Ejecuta la restauración como root"
  local archive="${1:-}"
  [[ -n "$archive" ]] || err "Uso: sudo ./scripts/install.sh restore /ruta/backup.tar.gz[.enc]"
  [[ -f "$archive" ]] || err "Backup no encontrado: $archive"

  local staging entry confirm=""
  staging=$(mktemp -d /tmp/disherio-restore.XXXXXX)
  chmod 700 "$staging"
  trap 'rm -rf "$staging"' RETURN

  # V2 encrypted backups are authenticated before decryption. Legacy OpenSSL
  # and plain .tar.gz backups remain readable for migration.
  local work_archive="$archive"
  if [[ "$archive" == *.enc ]]; then
    local restore_pass="${DISHERIO_BACKUP_PASSWORD:-}"
    if [[ -z "$restore_pass" ]]; then
      if [[ -t 0 ]] && [[ "${DISHERIO_NONINTERACTIVE:-}" != "1" ]]; then
        read -rsp "Contraseña del backup cifrado: " restore_pass; echo
      else
        err "Define DISHERIO_BACKUP_PASSWORD para restaurar un backup cifrado (modo no interactivo)"
      fi
    fi
    work_archive="$staging/backup.tar.gz"
    local encrypted_input="$archive"
    local decrypt_iterations=()
    if [[ "$(head -n 1 "$archive" 2>/dev/null || true)" == "DISHERIO-BACKUP-V2" ]]; then
      local expected_mac actual_mac
      expected_mac=$(sed -n '2p' "$archive" | tr -d '\r')
      [[ "$expected_mac" =~ ^[a-fA-F0-9]{64}$ ]] || err "Cabecera de autenticación del backup no válida"
      encrypted_input="$staging/backup.cipher"
      tail -n +3 "$archive" > "$encrypted_input"
      actual_mac=$(DISHERIO_BACKUP_PASS="$restore_pass" openssl dgst -sha256 -mac HMAC \
        -macopt keyenv:DISHERIO_BACKUP_PASS "$encrypted_input" | awk '{print $NF}') \
        || err "No se pudo verificar la autenticidad del backup"
      [[ "$actual_mac" == "$expected_mac" ]] \
        || err "La autenticación del backup falló (archivo alterado o contraseña incorrecta)"
      decrypt_iterations=(-iter 600000)
    else
      warn "Backup cifrado heredado sin autenticación externa; conviértelo creando una copia nueva"
    fi
    DISHERIO_BACKUP_PASS="$restore_pass" openssl enc -d -aes-256-cbc -pbkdf2 "${decrypt_iterations[@]}" \
      -pass env:DISHERIO_BACKUP_PASS -in "$encrypted_input" -out "$work_archive" \
      || err "No se pudo descifrar el backup (¿contraseña incorrecta?)"
    unset restore_pass
  fi

  while IFS= read -r entry; do
    case "$entry" in
      /*|../*|*/../*|*/..) err "El backup contiene una ruta insegura: $entry" ;;
    esac
  done < <(tar -tzf "$work_archive")
  tar -xzf "$work_archive" --no-same-owner --no-same-permissions -C "$staging"
  if find "$staging" -type l -print -quit | grep -q .; then
    err "El backup contiene enlaces simbólicos no permitidos"
  fi
  [[ "$(cat "$staging/manifest" 2>/dev/null || true)" == format=disherio-backup-v1* ]] \
    || err "Formato de backup no reconocido"
  [[ -f "$staging/config/.env" && -f "$staging/config/Caddyfile" && -f "$staging/config/mongo-keyfile" ]] \
    || err "El backup no contiene la configuración requerida"
  [[ -d "$staging/database/disherio" && -d "$staging/uploads" ]] \
    || err "El backup no contiene MongoDB y uploads"
  (cd "$staging" && sha256sum -c SHA256SUMS >/dev/null) || err "La verificación de integridad del backup falló"

  if [[ -t 0 ]] && [[ "${DISHERIO_NONINTERACTIVE:-}" != "1" ]]; then
    warn "La restauración reemplazará la base de datos, uploads y configuración actuales."
    read -rp "Escribe RESTAURAR para continuar: " confirm
  else
    confirm="${DISHERIO_RESTORE_CONFIRM:-}"
  fi
  [[ "$confirm" == "RESTAURAR" ]] || err "Restauración cancelada"

  cd "$ROOT_DIR"
  log "Deteniendo servicios y recreando los volúmenes restaurables..."
  docker compose down --remove-orphans >> "$LOG_FILE" 2>&1 || err "No se pudieron detener los servicios"
  docker volume rm disherio_mongo_data disherio_redis_data disherio_uploads >> "$LOG_FILE" 2>&1 || true

  install -m 0600 "$staging/config/.env" "$ENV_FILE"
  rm -rf "$ROOT_DIR/config/secrets"
  if [[ -d "$staging/config/secrets" ]]; then
    install -d -m 0700 "$ROOT_DIR/config/secrets"
    for secret_file in "$staging"/config/secrets/*; do
      [[ -f "$secret_file" ]] || continue
      install -m 0600 "$secret_file" "$ROOT_DIR/config/secrets/$(basename "$secret_file")"
    done
  else
    load_existing_secrets
    write_docker_secret_files
  fi
  scrub_secret_env
  install -m 0644 "$staging/config/Caddyfile" "$CADDYFILE"
  install -d -m 0700 "$ROOT_DIR/config"
  install -m 0600 "$staging/config/mongo-keyfile" "$ROOT_DIR/config/mongo-keyfile"
  chown 999:999 "$ROOT_DIR/config/mongo-keyfile" 2>/dev/null || true
  if [[ -f "$staging/config/docker-compose.override.yml" ]]; then
    install -m 0600 "$staging/config/docker-compose.override.yml" "$ROOT_DIR/docker-compose.override.yml"
  else
    rm -f "$ROOT_DIR/docker-compose.override.yml"
  fi

  docker compose up -d mongo --wait --wait-timeout 120 >> "$LOG_FILE" 2>&1 \
    || err "MongoDB no arrancó con la configuración restaurada"
  docker compose up --force-recreate --exit-code-from mongo-init-replica mongo-init-replica >> "$LOG_FILE" 2>&1 \
    || err "No se pudo inicializar el replica set"
  docker compose cp "$staging/database/." "mongo:/tmp/disherio-restore/" >> "$LOG_FILE" 2>&1 \
    || err "No se pudo copiar el dump a MongoDB"
  docker compose exec -T mongo sh -c \
    'mongorestore --drop --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$(cat /run/secrets/mongo_root_password)" --authenticationDatabase admin \
    /tmp/disherio-restore' >> "$LOG_FILE" 2>&1 || err "mongorestore falló"
  docker compose exec -T mongo rm -rf /tmp/disherio-restore >/dev/null 2>&1 || true

  docker compose up -d redis backend --wait --wait-timeout 180 >> "$LOG_FILE" 2>&1 \
    || err "Backend o Redis no arrancaron tras restaurar"
  docker compose exec -T backend sh -c 'rm -rf /app/uploads/* /app/uploads/.[!.]* /app/uploads/..?*' >> "$LOG_FILE" 2>&1 || true
  docker compose cp "$staging/uploads/." "backend:/app/uploads/" >> "$LOG_FILE" 2>&1 \
    || err "No se pudieron restaurar los uploads"
  docker compose exec -T --user 0 backend chown -R 1001:1001 /app/uploads >> "$LOG_FILE" 2>&1 \
    || err "No se pudieron ajustar los permisos de uploads"
  docker compose up -d frontend caddy --wait --wait-timeout 120 >> "$LOG_FILE" 2>&1 \
    || err "Frontend o Caddy no arrancaron tras restaurar"
  ok "Restauración completada desde $archive"
}

cmd_uninstall() {
  cd "$ROOT_DIR"
  warn "Esto eliminará TODOS los datos de DisherIO."
  local confirm="N"
  if [[ -t 0 ]] && [[ "${DISHERIO_NONINTERACTIVE:-}" != "1" ]]; then
    read -rp "¿Confirmar? (escribe SI): " confirm
  else
    # Non-interactive mode: require explicit env var to avoid accidental data loss.
    if [[ "${DISHERIO_UNINSTALL_CONFIRM:-}" == "SI" ]]; then
      confirm="SI"
      log "Modo non-interactive: confirmación via DISHERIO_UNINSTALL_CONFIRM=SI"
    else
      err "Uninstall requiere confirmación interactiva (escribe SI) o DISHERIO_UNINSTALL_CONFIRM=SI en modo non-interactive"
    fi
  fi
  if [[ "$confirm" != "SI" ]]; then echo "Cancelado."; exit 0; fi

  log "Deteniendo y eliminando contenedores..."
  # Handle the case where .env or docker-compose.yml was already removed:
  # fall back to stopping all disherio-* containers directly.
  if [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
    docker compose down --remove-orphans --volumes --rmi local >> "$LOG_FILE" 2>&1 || true
  fi
  # Force-remove any leftover disherio containers (e.g. exited seed containers
  # that compose down may miss when the image is still referenced).
  local leftover
  leftover=$(docker ps -a --filter "name=disherio-" --format '{{.Names}}' 2>/dev/null || true)
  if [[ -n "$leftover" ]]; then
    log "Eliminando contenedores restantes: ${leftover//$'\n'/ }"
    docker rm -f $leftover >> "$LOG_FILE" 2>&1 || true
  fi

  log "Eliminando volúmenes..."
  docker volume rm disherio_mongo_data disherio_redis_data disherio_uploads \
    disherio_caddy_data disherio_caddy_config \
    2>/dev/null || true
  # Prune anonymous dangling volumes left behind by compose.
  docker volume prune -f >> "$LOG_FILE" 2>&1 || true

  log "Eliminando imágenes de DisherIO..."
  # Remove built images by name (not the external base images).
  docker rmi disherio-backend disherio-frontend disherio-seed 2>/dev/null || true

  log "Eliminando keyFile y secretos..."
  rm -f "$ROOT_DIR/config/mongo-keyfile" 2>/dev/null || true

  rm -f "$ENV_FILE" "$CREDENTIALS_FILE" "$CADDYFILE" "$ROOT_DIR/docker-compose.override.yml"
  rm -rf -- "$ROOT_DIR/config/secrets"
  ok "DisherIO desinstalado completamente"
}

cmd_update() {
  cd "$ROOT_DIR"
  log "Descargando nuevas imágenes..."
  docker compose pull >> "$LOG_FILE" 2>&1 || err "No se pudieron descargar las imágenes"
  log "Reconstruyendo..."
  docker compose build >> "$LOG_FILE" 2>&1 || err "Build fallido"
  log "Reiniciando..."
  docker compose up -d --wait >> "$LOG_FILE" 2>&1 || err "No se pudieron reiniciar"
  ok "DisherIO actualizado"
  cmd_status
}

# =============================================================================
#  AYUDA
# =============================================================================
show_help() {
  cat <<HELP
DisherIO v3.1 — Script Universal

USO:
  sudo ./scripts/install.sh [COMANDO]

COMANDOS:
  (sin args)   Instalación guiada (solo 5 preguntas)
  install       Igual que arriba
  start         Iniciar servicios
  stop          Detener servicios
  restart       Reiniciar servicios
  status        Ver estado + URLs (no imprime secretos)
  logs [servicio]  Ver logs en vivo (backend/frontend/mongo/redis/caddy)
  backup        Crear backup de MongoDB, uploads y configuración
  restore FILE  Restaurar base de datos, uploads y configuración
  update        Actualizar imágenes y reiniciar
  uninstall     Eliminar TODO (contenedores, datos, config)
  help          Mostrar esta ayuda

EJEMPLOS:
  sudo ./scripts/install.sh                # Instalar
  sudo ./scripts/install.sh status         # ¿Está funcionando?
  sudo ./scripts/install.sh logs backend   # Ver logs del backend
  sudo ./scripts/install.sh backup         # Hacer backup

MODO NON-INTERACTIVE (CI/CD, SSH sin TTY, gcloud):
  DISHERIO_DEPLOY_MODE=domain \\
  DISHERIO_DOMAIN=app.example.com \\
  DISHERIO_LANGUAGE=es \\
  DISHERIO_RESTAURANT_NAME="DisherIO Restaurant" \\
  DISHERIO_CURRENCY=EUR \\
  sudo -E ./scripts/install.sh install

  Variables non-interactive:
    DISHERIO_DEPLOY_MODE     domain | local | public
    DISHERIO_DOMAIN           dominio (solo si DEPLOY_MODE=domain)
    DISHERIO_LANGUAGE         es | en | fr
    DISHERIO_RESTAURANT_NAME  nombre del restaurante
    DISHERIO_CURRENCY         EUR | USD | GBP
    DISHERIO_NONINTERACTIVE   1 (fuerza modo non-interactive)
    DISHERIO_ACCESS_IP        IP/host para acceso en modo local (override)
    DISHERIO_SEED_EXAMPLES    y | n (instalar datos de ejemplo)
    DISHERIO_UNINSTALL_CONFIRM=SI  (confirmar uninstall en modo non-interactive)
HELP
}

# =============================================================================
#  ENTRY POINT
# =============================================================================
main() {
  local cmd="${1:-install}"

  case "$cmd" in
    install)    cmd_install ;;
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    restart)    cmd_restart ;;
    status|info) cmd_status ;;
    logs)       shift; cmd_logs "$@" ;;
    backup)     cmd_backup ;;
    restore)    shift; cmd_restore "$@" ;;
    uninstall)  cmd_uninstall ;;
    update)     cmd_update ;;
    help|-h|--help) show_help ;;
    *)          echo "Comando desconocido: $cmd"; show_help; exit 1 ;;
  esac
}

main "$@"
