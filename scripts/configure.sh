#!/usr/bin/env bash
# =============================================================================
# DisherIo - configure.sh
# Hot reconfiguration: network, domain, port and admin credentials.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
CADDYFILE="$ROOT_DIR/Caddyfile"

log()  { echo -e "${GREEN}[OK]${RESET} $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }
err()  { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }
step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; echo -e "${BOLD}  $*${RESET}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }

require_root() {
  [[ $EUID -eq 0 ]] || err "Ejecuta como root: sudo ./configure.sh"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || err ".env no encontrado. Ejecuta install.sh primero."
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
}

# ── Main menu ─────────────────────────────────────────────────────────────────
main_menu() {
  echo ""
  echo -e "${BOLD}  DisherIo — Configuración${RESET}"
  echo ""
  echo "  1) Cambiar modo de red / dominio / IP"
  echo "  2) Cambiar puerto de acceso"
  echo "  3) Resetear contraseña del administrador"
  echo "  4) Cambiar idioma por defecto"
  echo "  5) Ver configuración actual"
  echo "  6) Salir"
  echo ""
  read -rp "  Opción [1]: " choice
  echo ""

  case "${choice:-1}" in
    1) change_network ;;
    2) change_port ;;
    3) reset_admin_password ;;
    4) change_language ;;
    5) show_current_config ;;
    6) exit 0 ;;
    *) warn "Opción no válida"; main_menu ;;
  esac
}

# ── Change network ────────────────────────────────────────────────────────────
change_network() {
  step "Cambiar modo de red"
  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "127.0.0.1")
  PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || echo "")

  echo "  1) Dominio público (HTTPS — Let's Encrypt)"
  echo "  2) Dominio local   (disherio.local)"
  echo "  3) IP pública"
  echo "  4) IP local"
  read -rp "  Selecciona [4]: " net_choice

  local access_url port domain

  case "${net_choice:-4}" in
    1)
      read -rp "  Dominio (ej: mi-restaurante.com): " domain
      [[ -z "$domain" ]] && err "Dominio requerido"
      port=443
      access_url="https://$domain"
      cat > "$CADDYFILE" <<EOF
$domain {
    handle /socket.io/* { reverse_proxy backend:3000 }
    handle /api/* { reverse_proxy backend:3000 }
    handle { reverse_proxy frontend:4200 }
    log { output file /var/log/caddy/access.log; format json }
}
EOF
      echo ""
      echo -e "${YELLOW}  Registros DNS requeridos:${RESET}"
      echo -e "    A   @    → ${PUBLIC_IP}"
      echo -e "    A   www  → ${PUBLIC_IP}"
      ;;
    2)
      domain="disherio.local"
      port=80
      access_url="http://$domain"
      write_http_caddyfile ":80"
      warn "Añade '$LOCAL_IP $domain' a /etc/hosts en los clientes"
      ;;
    3)
      [[ -z "$PUBLIC_IP" ]] && err "No se pudo detectar la IP pública"
      read -rp "  Puerto [80]: " port; port="${port:-80}"
      domain="$PUBLIC_IP"
      access_url="http://$PUBLIC_IP:$port"
      write_http_caddyfile ":$port"
      ;;
    *)
      read -rp "  Puerto [80]: " port; port="${port:-80}"
      domain="$LOCAL_IP"
      access_url="http://$LOCAL_IP:$port"
      write_http_caddyfile ":$port"
      ;;
  esac

  # Update .env
  sed_env "FRONTEND_URL" "$access_url"
  log "Red actualizada: $access_url"
  restart_services
}

write_http_caddyfile() {
  local host="$1"
  cat > "$CADDYFILE" <<EOF
{ admin off; auto_https off }
$host {
    handle /socket.io/* { reverse_proxy backend:3000 }
    handle /api/* { reverse_proxy backend:3000 }
    handle { reverse_proxy frontend:4200 }
    log { output stdout; format json }
}
EOF
}

# ── Change port ───────────────────────────────────────────────────────────────
change_port() {
  step "Cambiar puerto"
  read -rp "  Nuevo puerto [80]: " new_port
  new_port="${new_port:-80}"

  # Rewrite Caddyfile with new port (HTTP mode only)
  sed -i "s/^:[0-9]*/\:$new_port/" "$CADDYFILE" 2>/dev/null || true

  current_url="${FRONTEND_URL:-http://localhost}"
  # Replace port in URL
  new_url=$(echo "$current_url" | sed "s/:[0-9]*$//:$new_port/" | sed "s|http://[^:/]*|http://$(echo "$current_url" | sed 's|http://||' | cut -d: -f1 \| cut -d/ -f1)|")
  sed_env "FRONTEND_URL" "$new_url"
  log "Puerto cambiado a $new_port"
  restart_services
}

# ── Reset admin password ──────────────────────────────────────────────────────
reset_admin_password() {
  step "Resetear contraseña del administrador"
  read -rp "  Usuario admin [admin]: " admin_user
  admin_user="${admin_user:-admin}"

  read -rsp "  Nueva contraseña (vacío = generar aleatoriamente): " new_pass
  echo ""
  if [[ -z "$new_pass" ]]; then
    new_pass=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    log "Contraseña generada: $new_pass"
  fi

  cd "$ROOT_DIR"
  docker compose exec -T backend node -e "
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    async function run() {
      await mongoose.connect(process.env.MONGODB_URI);
      const Staff = mongoose.model('Staff', new mongoose.Schema({ username: String, password_hash: String }, { strict: false }));
      const hash = await bcrypt.hash('${new_pass}', 12);
      const result = await Staff.updateOne({ username: '${admin_user}' }, { \$set: { password_hash: hash } });
      if (result.matchedCount === 0) { console.error('Usuario no encontrado: ${admin_user}'); process.exit(1); }
      console.log('Contraseña actualizada');
      await mongoose.disconnect();
    }
    run().catch(e => { console.error(e.message); process.exit(1); });
  " || err "No se pudo actualizar la contraseña. Verifica que el contenedor backend esté corriendo."

  echo ""
  echo -e "  ${GREEN}Contraseña actualizada para${RESET} ${BOLD}${admin_user}${RESET}"
  echo -e "  ${YELLOW}Nueva contraseña: ${BOLD}${new_pass}${RESET}  (guárdala ahora)"
}

# ── Change language ───────────────────────────────────────────────────────────
change_language() {
  step "Cambiar idioma por defecto"
  echo "  1) Español (es)"
  echo "  2) English (en)"
  echo "  3) Français (fr)"
  read -rp "  Selecciona [1]: " lang_choice
  case "${lang_choice:-1}" in
    2) new_lang="en" ;;
    3) new_lang="fr" ;;
    *) new_lang="es" ;;
  esac
  sed_env "APP_LANG" "$new_lang"
  log "Idioma actualizado a: $new_lang"
}

# ── View current config ───────────────────────────────────────────────────────
show_current_config() {
  step "Configuración actual"
  echo ""
  grep -v "^#" "$ENV_FILE" | grep -v "^$" | grep -v "JWT_SECRET" | while IFS='=' read -r key val; do
    echo -e "  ${CYAN}${key}${RESET} = ${BOLD}${val}${RESET}"
  done
  echo ""
}

# ── Helpers ────────────────────────────────────────────────────────────────────
sed_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

restart_services() {
  log "Reiniciando servicios para aplicar cambios..."
  cd "$ROOT_DIR"
  docker compose down 2>/dev/null || true
  docker compose up -d
  log "Servicios reiniciados"
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  require_root
  load_env
  main_menu
}

main "$@"
