#!/usr/bin/env bash
# =============================================================================
# DisherIo - configure.sh
# Hot reconfiguration: network, domain, port and admin credentials.
# =============================================================================
set -euo pipefail
umask 077

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

# Validate a port number before using it.
valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( 10#$1 >= 1 && 10#$1 <= 65535 ))
}

# Validate a domain name before interpolating it into the Caddyfile via sed.
# Without this a value containing |, & or newlines would inject sed/Caddyfile
# directives (the script runs as root).
valid_domain() {
  [[ "$1" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]
}

# Validate an email address before interpolation; fall back to admin@<domain>
# when the configured EMAIL fails validation instead of aborting, so a
# malformed but previously-stored EMAIL never blocks reconfiguration.
valid_email() {
  [[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$ ]]
}

require_root() {
  [[ $EUID -eq 0 ]] || err "Ejecuta como root: sudo ./configure.sh"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || err ".env no encontrado. Ejecuta install.sh primero."
  # Read .env safely without source to prevent arbitrary code execution and
  # failures caused by values that contain spaces or symbols.
  FRONTEND_URL=$(env_get "FRONTEND_URL" "http://localhost")
  HTTP_PORT=$(env_get "HTTP_PORT" "80")
  HTTPS_PORT=$(env_get "HTTPS_PORT" "443")
  PORT=$(env_get "PORT" "3000")
  DEFAULT_LANGUAGE=$(env_get "DEFAULT_LANGUAGE" "es")
  APP_LANG=$(env_get "APP_LANG" "$DEFAULT_LANGUAGE")
    RESTAURANT_NAME=$(env_get "RESTAURANT_NAME" "DisherIO Restaurant")
    EMAIL=$(env_get "EMAIL" "")
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

is_rfc1918() {
  [[ "$1" =~ ^10\. ]] && return 0
  [[ "$1" =~ ^192\.168\. ]] && return 0
  [[ "$1" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] && return 0
  [[ "$1" == "127.0.0.1" ]] && return 0
  return 1
}

# In local (HTTP) mode, a cloud VM's internal IP is unreachable from the
# operator; prefer the public one when the internal is RFC1918. An explicit
# DISHERIO_ACCESS_IP override always wins.
resolve_local_access_ip() {
  if [[ -n "${DISHERIO_ACCESS_IP:-}" ]]; then echo "$DISHERIO_ACCESS_IP"; return; fi
  if is_rfc1918 "$LOCAL_IP" && [[ -n "$PUBLIC_IP" ]]; then echo "$PUBLIC_IP"; else echo "$LOCAL_IP"; fi
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
      valid_domain "$domain" || err "Dominio inválido: $domain"
      port=443
      access_url="https://$domain"
      # The EMAIL substitution below is sed-interpolated: never pass an
      # unvalidated EMAIL through. Fall back to admin@<domain> when needed.
      if [[ -n "$EMAIL" ]] && ! valid_email "$EMAIL"; then
        warn "EMAIL en .env inválido; usando admin@${domain}"
        EMAIL="admin@${domain}"
      elif [[ -z "$EMAIL" ]]; then
        EMAIL="admin@${domain}"
      fi
      cp "$ROOT_DIR/infrastructure/caddy-templates/Caddyfile.domain" "$CADDYFILE"
      sed -i \
        -e "s|\${DOMAIN}|${domain}|g" \
        -e "s|\${EMAIL}|${EMAIL}|g" \
        "$CADDYFILE"
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
      sed_env "HTTP_PORT" "80"
      warn "Añade '$LOCAL_IP $domain' a /etc/hosts en los clientes"
      ;;
    3)
      err "La IP pública directa por HTTP está deshabilitada. Usa un dominio HTTPS o un túnel."
      ;;
    *)
      read -rp "  Puerto [80]: " port; port="${port:-80}"
      valid_port "$port" || err "Puerto inválido: $port"
      domain="$(resolve_local_access_ip)"
      access_url="http://${domain}:$port"
      write_http_caddyfile ":$port"
      sed_env "HTTP_PORT" "$port"
      if is_rfc1918 "$LOCAL_IP" && [[ -n "$PUBLIC_IP" && "$domain" == "$PUBLIC_IP" ]]; then
        warn "IP interna ${LOCAL_IP} inalcanzable desde fuera; usando IP pública ${PUBLIC_IP} por HTTP sin cifrar."
      fi
      ;;
  esac

  # Update .env
  sed_env "FRONTEND_URL" "$access_url"
  log "Red actualizada: $access_url"
  restart_services
}

write_http_caddyfile() {
  local host="$1"
  local port="${host#:}"
  cp "$ROOT_DIR/infrastructure/caddy-templates/Caddyfile.local-ip" "$CADDYFILE"
  sed -i -e "s|\${HTTP_PORT}|${port}|g" "$CADDYFILE"
  chmod 644 "$CADDYFILE"
  warn "La configuración por IP local usa HTTP sin cifrar; limítala a una LAN privada de confianza."
}

# ── Change port ───────────────────────────────────────────────────────────────
change_port() {
  step "Cambiar puerto"
  read -rp "  Nuevo puerto [80]: " new_port
  new_port="${new_port:-80}"

  valid_port "$new_port" || err "Puerto inválido: $new_port (1-65535)"

  # Port changes are only supported in HTTP (local-ip) mode: the domain
  # template requires public 80/443 for Let's Encrypt challenges, and the
  # blind sed previously corrupted the domain Caddyfile by rewriting its
  # :80 redirect to an arbitrary port.
  if ! grep -q "http_port" "$CADDYFILE"; then
    err "El cambio de puerto solo está soportado en modo HTTP (IP local). En modo dominio, Let's Encrypt requiere 80/443."
  fi

  # Regenerate the HTTP Caddyfile from the template with the new port and keep
  # HTTP_PORT in .env in sync — the docker-compose host:container mapping and
  # the Caddyfile listen port must agree, or the published port never reaches
  # Caddy. (Both sides use the same ${HTTP_PORT} value.)
  write_http_caddyfile ":$new_port"
  sed_env "HTTP_PORT" "$new_port"

  current_url="${FRONTEND_URL:-http://localhost}"
  local host="${current_url#http://}"
  host="${host#https://}"
  host="${host%%:*}"
  host="${host%%/*}"
  local scheme="http"
  [[ "$current_url" == https://* ]] && scheme="https"
  new_url="${scheme}://${host}:${new_port}"
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
    new_pass=$(openssl rand -base64 16 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 16 || tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 16)
    log "Contraseña administrativa generada y reservada para almacenamiento protegido"
  fi
  if (( ${#new_pass} < 12 || ${#new_pass} > 72 )); then
    err "La contraseña debe tener entre 12 y 72 caracteres."
  fi

  cd "$ROOT_DIR"
  # Send credentials over stdin. They never appear in argv, container
  # environment metadata, logs, or terminal output.
  printf '%s\0%s\0' "$admin_user" "$new_pass" | docker compose exec -T backend node -e '
    const fs = require("fs");
    const mongoose = require("mongoose");
    const bcrypt = require("bcryptjs");
    const { loadSecretFiles } = require("/app/dist/config/secret-files");
    const { revokeAllUserRefreshTokens } = require("/app/dist/services/refresh-token.service");
    const { closeRedisConnections } = require("/app/dist/config/redis");
    async function run() {
      const [username, password] = fs.readFileSync(0).toString("utf8").split("\0");
      if (!username || !password) throw new Error("Entrada de credenciales no válida");
      loadSecretFiles();
      const uri = fs.readFileSync("/run/secrets/mongodb_uri", "utf8").trim();
      await mongoose.connect(uri);
      const Staff = mongoose.model("Staff", new mongoose.Schema({
        username: String,
        password_hash: String,
        auth_version: { type: Number, default: 0 },
      }, { strict: false }));
      const matches = await Staff.find({ username: username.toLowerCase() }).select("_id").limit(2).lean();
      if (matches.length !== 1) throw new Error(matches.length === 0 ? "Usuario no encontrado" : "Usuario ambiguo; especifique una cuenta única");
      await revokeAllUserRefreshTokens(matches[0]._id.toString());
      const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));
      const result = await Staff.updateOne(
        { _id: matches[0]._id },
        { $set: { password_hash: hash }, $inc: { auth_version: 1 } },
      );
      if (result.modifiedCount !== 1) throw new Error("No se actualizó la cuenta");
      console.log("Contraseña actualizada");
      await closeRedisConnections();
      await mongoose.disconnect();
    }
    run().catch(e => { console.error(e.message); process.exit(1); });
  ' || err "No se pudo actualizar la contraseña. Verifica que el contenedor backend esté corriendo."

  install -d -m 0700 "$ROOT_DIR/config/secrets"
  printf '%s' "$new_pass" > "$ROOT_DIR/config/secrets/admin_password"
  # Readable by the non-root seed container UID (1001) that bind-mounts it.
  chmod 644 "$ROOT_DIR/config/secrets/admin_password"

  if [[ -f "$ROOT_DIR/.credentials" ]]; then
    local credentials_tmp
    credentials_tmp=$(mktemp "$ROOT_DIR/.credentials.XXXXXX")
    while IFS= read -r credential_line || [[ -n "$credential_line" ]]; do
      case "$credential_line" in
        "Contraseña admin:"*) printf 'Contraseña admin: %s\n' "$new_pass" ;;
        *) printf '%s\n' "$credential_line" ;;
      esac
    done < "$ROOT_DIR/.credentials" > "$credentials_tmp"
    chmod 600 "$credentials_tmp"
    mv -f "$credentials_tmp" "$ROOT_DIR/.credentials"
  else
    printf '# DisherIO — Credenciales\nUsuario admin: %s\nContraseña admin: %s\n' \
      "$admin_user" "$new_pass" > "$ROOT_DIR/.credentials"
    chmod 600 "$ROOT_DIR/.credentials"
  fi

  docker compose restart backend >/dev/null \
    || err "La contraseña cambió, pero no se pudo reiniciar el backend para cerrar sockets activos."
  docker compose up -d --wait backend >/dev/null \
    || err "La contraseña cambió, pero el backend no recuperó el estado saludable."

  echo ""
  echo -e "  ${GREEN}Contraseña actualizada para${RESET} ${BOLD}${admin_user}${RESET}"
  echo -e "  ${YELLOW}Guardada en ${BOLD}$ROOT_DIR/.credentials${RESET} y en el secreto administrativo (0600)."
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
  # Update both DEFAULT_LANGUAGE and the compatibility APP_LANG alias.
  sed_env "DEFAULT_LANGUAGE" "$new_lang"
  sed_env "APP_LANG" "$new_lang"
  log "Idioma actualizado a: $new_lang"
}

# ── View current config ───────────────────────────────────────────────────────
show_current_config() {
  step "Configuración actual"
  echo ""
  grep -v "^#" "$ENV_FILE" | grep -v "^$" \
    | grep -Ev "^(JWT_SECRET|JWT_REFRESH_SECRET|MONGO_ROOT_PASS|MONGO_APP_PASS|MONGODB_URI|REDIS_PASSWORD|ADMIN_PASSWORD|CF_TUNNEL_TOKEN|NGROK_AUTHTOKEN)=" \
    | while IFS='=' read -r key val; do
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
  chmod 600 "$ENV_FILE"
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
