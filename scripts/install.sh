#!/usr/bin/env bash
# =============================================================================
# DisherIo — Instalador
# Uso: sudo ./scripts/install.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
CADDYFILE="$ROOT_DIR/Caddyfile"
LOG_FILE="/var/log/disherio_install.log"

# ── Verificar root ────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || { echo -e "${RED}Ejecuta como root: sudo ./scripts/install.sh${NC}"; exit 1; }

err() { echo -e "${RED}❌ $*${NC}" | tee -a "$LOG_FILE"; exit 1; }
ok()  { echo -e "${GREEN}✓${NC} $*" | tee -a "$LOG_FILE"; }
log() { echo -e "${BLUE}▶${NC} $*" | tee -a "$LOG_FILE"; }

banner() {
  echo -e "${CYAN}"
  echo "  ██████╗ ██╗███████╗██╗  ██╗███████╗██████╗ ██╗ ██████╗"
  echo "  ██╔══██╗██║██╔════╝██║  ██║██╔════╝██╔══██╗██║██╔═══██╗"
  echo "  ██║  ██║██║███████╗███████║█████╗  ██████╔╝██║██║   ██║"
  echo "  ██║  ██║██║╚════██║██╔══██║██╔══╝  ██╔══██╗██║██║   ██║"
  echo "  ██████╔╝██║███████║██║  ██║███████╗██║  ██║██║╚██████╔╝"
  echo "  ╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝"
  echo -e "${NC}"
  echo -e "  ${BOLD}Instalador — Sistema de gestión de restaurantes${NC}"
  echo ""
}

# ── 1. Configuración de acceso ────────────────────────────────────────────────
configure_access() {
  echo -e "${CYAN}[1/5] Configuración de acceso${NC}"

  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}' || echo "127.0.0.1")

  # Detectar IP pública (AWS → Azure → GCP → fallback)
  PUBLIC_IP=""
  TOKEN=$(curl -s --max-time 2 -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 10" 2>/dev/null || true)
  [[ -n "$TOKEN" ]] && PUBLIC_IP=$(curl -s --max-time 2 \
    -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
  [[ -z "$PUBLIC_IP" ]] && PUBLIC_IP=$(curl -s --max-time 2 \
    -H "Metadata:true" \
    "http://169.254.169.254/metadata/instance/network/interface/0/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" 2>/dev/null || true)
  [[ -z "$PUBLIC_IP" ]] && PUBLIC_IP=$(curl -s --max-time 2 \
    -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" 2>/dev/null || true)
  [[ -z "$PUBLIC_IP" ]] && PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
    curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "")

  echo ""
  echo "  Tipo de acceso:"
  echo "  1) Dominio público con HTTPS  (ej: mi-restaurante.com)"
  echo "  2) IP pública                 ${PUBLIC_IP:+(detectada: $PUBLIC_IP)}"
  echo "  3) IP local                   (detectada: $LOCAL_IP)"
  echo ""
  read -rp "  Opción [2]: " ACCESS_OPT
  ACCESS_OPT="${ACCESS_OPT:-2}"

  IS_PUBLIC_DOMAIN="false"

  case "$ACCESS_OPT" in
    1)
      read -rp "  Introduce tu dominio (ej: app.disherio.com): " CADDY_DOMAIN
      [[ -z "$CADDY_DOMAIN" ]] && err "Dominio requerido"
      IS_PUBLIC_DOMAIN="true"
      ACCESS_URL="https://${CADDY_DOMAIN}"
      ;;
    3)
      CADDY_DOMAIN="$LOCAL_IP"
      ACCESS_URL="http://${CADDY_DOMAIN}"
      ;;
    *)
      [[ -z "$PUBLIC_IP" ]] && err "No se pudo detectar la IP pública. Usa opción 3 (IP local) o 1 (dominio)."
      CADDY_DOMAIN="$PUBLIC_IP"
      ACCESS_URL="http://${CADDY_DOMAIN}"
      ;;
  esac

  ok "Acceso configurado: ${ACCESS_URL}"
}

# ── 2. Instalar dependencias ──────────────────────────────────────────────────
install_dependencies() {
  echo ""
  echo -e "${CYAN}[2/5] Dependencias${NC}"

  if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null; then
    log "Actualizando paquetes..."
    apt-get update -qq >/dev/null 2>&1 || err "apt-get update falló"

    for pkg in curl wget ufw openssl ca-certificates gnupg; do
      command -v "$pkg" &>/dev/null || apt-get install -y -qq "$pkg" </dev/null >/dev/null 2>&1
    done

    if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null; then
      log "Instalando Docker (repositorio oficial)..."
      # Add Docker's official GPG key and repo
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/debian/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg >/dev/null 2>&1
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
      apt-get update -qq >/dev/null 2>&1
      apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin \
        </dev/null >/dev/null 2>&1 || err "Error instalando Docker"
      systemctl enable docker >/dev/null 2>&1 || true
      systemctl start  docker >/dev/null 2>&1 || true
    fi
  fi

  ok "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  ok "Docker Compose $(docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"

  # Firewall
  if command -v ufw &>/dev/null; then
    ufw allow 22/tcp  >/dev/null 2>&1 || true
    ufw allow 80/tcp  >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
  fi

  # Generate secrets
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  ADMIN_USER="admin"
  ADMIN_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9@#%&*' | head -c 20)
  ADMIN_PIN=$(openssl rand -hex 4 | tr -dc '0-9' | head -c 4)
  # Ensure PIN is exactly 4 digits (pad with zeros if needed)
  ADMIN_PIN=$(printf '%04d' "$((10#${ADMIN_PIN:-0000} % 10000))")
}

# ── 3. Escribir configuración ─────────────────────────────────────────────────
write_config() {
  echo ""
  echo -e "${CYAN}[3/5] Configuración${NC}"

  FRONTEND_URL="$ACCESS_URL"

  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=80
HTTPS_PORT=443
MONGODB_URI=mongodb://mongo:27017/disherio
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=8h
FRONTEND_URL=${FRONTEND_URL}
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
ADMIN_PIN=${ADMIN_PIN}
EOF
  chmod 600 "$ENV_FILE"

  if [[ "$IS_PUBLIC_DOMAIN" == "true" ]]; then
    cat > "$CADDYFILE" <<EOF
${CADDY_DOMAIN} {
    handle /api/*       { reverse_proxy backend:3000 }
    handle /socket.io/* { reverse_proxy backend:3000 }
    handle              { reverse_proxy frontend:4200 }
}
EOF
  else
    cat > "$CADDYFILE" <<EOF
{
    admin off
    auto_https off
}
:80 {
    handle /api/*       { reverse_proxy backend:3000 }
    handle /socket.io/* {
        reverse_proxy backend:3000 {
            transport http { versions h1 }
        }
    }
    handle { reverse_proxy frontend:4200 }
}
EOF
  fi

  ok ".env y Caddyfile escritos"
}

# ── 4. Build y arranque ───────────────────────────────────────────────────────
build_and_start() {
  echo ""
  echo -e "${CYAN}[4/5] Build e inicio de servicios${NC}"
  cd "$ROOT_DIR"

  log "Construyendo imágenes (puede tardar unos minutos)..."
  docker compose build --no-cache >> "$LOG_FILE" 2>&1 || err "Build fallido. Revisa: $LOG_FILE"
  ok "Imágenes construidas"

  log "Levantando servicios..."
  docker compose up -d >> "$LOG_FILE" 2>&1 || err "docker compose up falló. Revisa: $LOG_FILE"
  ok "Servicios iniciados"
}

# ── 5. Healthcheck y seed ─────────────────────────────────────────────────────
healthcheck_and_seed() {
  echo ""
  echo -e "${CYAN}[5/5] Healthcheck y datos iniciales${NC}"
  cd "$ROOT_DIR"

  log "Esperando al backend..."
  MAX_WAIT=120; WAITED=0
  until docker compose exec -T backend wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1; do
    sleep 5; WAITED=$((WAITED + 5))
    echo -e "  ... ${WAITED}s / ${MAX_WAIT}s"
    if [[ $WAITED -ge $MAX_WAIT ]]; then
      echo -e "${YELLOW}Backend tardando — logs:${NC}"
      docker compose logs --tail=30 backend 2>&1 || true
      err "Backend no respondió tras ${MAX_WAIT}s"
    fi
  done
  ok "Backend listo"

  log "Creando usuario administrador..."
  docker compose run --rm \
    -e MONGODB_URI=mongodb://mongo:27017/disherio \
    -e JWT_SECRET="${JWT_SECRET}" \
    -e ADMIN_USERNAME="${ADMIN_USER}" \
    -e ADMIN_PASSWORD="${ADMIN_PASS}" \
    -e ADMIN_PIN="${ADMIN_PIN}" \
    backend node dist/seeders/index.js >> "$LOG_FILE" 2>&1 \
    || err "Seed falló. Revisa: $LOG_FILE"
  ok "Usuario administrador creado"
}

# ── Resumen final ─────────────────────────────────────────────────────────────
print_summary() {
  # Save credentials to a protected file so they can be retrieved later
  CREDS_FILE="$ROOT_DIR/.admin-credentials"
  cat > "$CREDS_FILE" <<EOF
# DisherIo — Admin credentials (generated $(date -u '+%Y-%m-%d %H:%M UTC'))
URL=${ACCESS_URL}
Username=${ADMIN_USER}
Password=${ADMIN_PASS}
PIN=${ADMIN_PIN}
EOF
  chmod 600 "$CREDS_FILE"

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║           DISHERIO INSTALLED SUCCESSFULLY                    ║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  Access URL   :  ${BOLD}${ACCESS_URL}${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}                                                              "
  echo -e "${YELLOW}║  ADMIN CREDENTIALS — COPY NOW, THEY WILL NOT BE SHOWN AGAIN  ${NC}"
  echo -e "${GREEN}║${NC}                                                              "
  echo -e "${GREEN}║${NC}  Username  :  ${BOLD}${ADMIN_USER}${NC}"
  echo -e "${GREEN}║${NC}  Password  :  ${BOLD}${ADMIN_PASS}${NC}"
  echo -e "${GREEN}║${NC}  PIN       :  ${BOLD}${ADMIN_PIN}${NC}"
  echo -e "${GREEN}║${NC}                                                              "
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  Quick links:"
  echo -e "${GREEN}║${NC}    Admin panel  →  ${ACCESS_URL}/admin"
  echo -e "${GREEN}║${NC}    POS          →  ${ACCESS_URL}/pos"
  echo -e "${GREEN}║${NC}    KDS          →  ${ACCESS_URL}/kds"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  Credentials saved to: ${CREDS_FILE}"
  echo -e "${GREEN}║${NC}  Full log:             ${LOG_FILE}"
  echo -e "${GREEN}║${NC}  Reconfigure:          sudo ./scripts/configure.sh"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  : > "$LOG_FILE"
  banner
  configure_access
  install_dependencies
  write_config
  build_and_start
  healthcheck_and_seed
  print_summary
}

main "$@"
