#!/usr/bin/env bash
# =============================================================================
# DisherIO — Librería común de configuración (.env / Caddyfile / secretos)
# =============================================================================
# Fuente ÚNICA para los flujos que generan o modifican la configuración:
#   - scripts/install.sh                  (instalación guiada / non-interactive)
#   - scripts/configure.sh                (reconfiguración en caliente)
#   - infrastructure/scripts/configure.sh (configurador multi-entorno)
#   - infrastructure/scripts/verify.sh    (solo lectura: env_get)
#
# Regla: hay UN solo generador de .env por modo de despliegue (write_env_file),
# UN solo bloque de headers de seguridad (security-headers.conf, inyectado por
# write_caddyfile) y UNA copia de cada helper (env_get, gen_secret, ...).
# Cualquier cambio de formato se hace AQUÍ, no en los scripts consumidores.
#
# Este archivo está pensado para "source"; no fija set -e/-u por sí mismo.
# =============================================================================

# Raíz del repositorio: esta librería vive en <root>/scripts/lib/
DISHERIO_ROOT="${DISHERIO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DISHERIO_ENV_FILE="${DISHERIO_ENV_FILE:-$DISHERIO_ROOT/.env}"
DISHERIO_CADDYFILE="${DISHERIO_CADDYFILE:-$DISHERIO_ROOT/Caddyfile}"
DISHERIO_CADDY_TEMPLATES="$DISHERIO_ROOT/infrastructure/caddy-templates"
DISHERIO_SECURITY_HEADERS="$DISHERIO_CADDY_TEMPLATES/security-headers.conf"

# ── Lectura/escritura segura de .env (sin source) ────────────────────────────
# Uso: env_get CLAVE [valor_por_defecto] [archivo]
env_get() {
  local key="$1" default="${2:-}" file="${3:-$DISHERIO_ENV_FILE}"
  if [[ -f "$file" ]]; then
    local v
    v=$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d'=' -f2- || true)
    # Quitar comillas si las tiene
    v="${v#\"}"; v="${v%\"}"
    v="${v#\'}"; v="${v%\'}"
    [[ -n "$v" ]] && echo "$v" || echo "$default"
  else
    echo "$default"
  fi
}

# Uso: sed_env CLAVE VALOR [archivo] — actualiza o añade la clave en .env
sed_env() {
  local key="$1" val="$2" file="${3:-$DISHERIO_ENV_FILE}"
  # '&' es especial en el reemplazo de sed; escaparlo para no corromper valores
  val="${val//&/\\&}"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
  chmod 600 "$file"
}

# ── Generación de secretos ────────────────────────────────────────────────────
# Solo alfanuméricos para no romper URIs de MongoDB, shells ni YAML.
# openssl puede faltar en sistemas mínimos; /dev/urandom es el fallback.
_rand_alnum() {
  local len="$1"
  local s=""
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

# PIN de 4 dígitos con CSPRNG (openssl o /dev/urandom)
gen_pin() {
  local pin=""
  if command -v openssl &>/dev/null; then
    pin=$(openssl rand -base64 8 2>/dev/null | tr -dc '0-9' | head -c 4 || true)
  fi
  while [[ ${#pin} -lt 4 ]]; do
    pin="${pin}$(tr -dc '0-9' < /dev/urandom 2>/dev/null | head -c "$((4 - ${#pin}))")"
  done
  echo "${pin:0:4}"
}

# Rellena los secretos que falten (idempotente: no pisa los ya definidos)
ensure_secrets() {
  MONGO_ROOT_PASS="${MONGO_ROOT_PASS:-$(gen_secret 32)}"
  MONGO_APP_PASS="${MONGO_APP_PASS:-$(gen_secret 32)}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-$(gen_secret 24)}"
  JWT_SECRET="${JWT_SECRET:-$(gen_secret 64)}"
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(gen_secret 64)}"
  PIN_LOOKUP_PEPPER="${PIN_LOOKUP_PEPPER:-$(gen_secret 64)}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(gen_secret 20)}"
  ADMIN_PIN="${ADMIN_PIN:-$(gen_pin)}"
}

# ── Secretos de Docker (archivos bajo config/secrets) ────────────────────────
# Lee siempre del .env ya escrito para que install.sh, el configurador y
# restore produzcan exactamente los mismos archivos.
write_docker_secret_files() {
  local env_file="${1:-$DISHERIO_ENV_FILE}"
  local secret_dir="$DISHERIO_ROOT/config/secrets"
  install -d -m 0700 "$secret_dir"

  # Resolver MONGODB_URI por si el .env conserva placeholders ${...} literales
  # (formato antiguo del configurador): se reconstruye desde sus partes.
  local uri
  uri=$(env_get MONGODB_URI "" "$env_file")
  if [[ "$uri" == *'${'* ]]; then
    uri="mongodb://$(env_get MONGO_APP_USER "disherio_app" "$env_file"):$(env_get MONGO_APP_PASS "" "$env_file")@mongo:27017/disherio?authSource=disherio&replicaSet=rs0"
  fi

  printf '%s' "$(env_get MONGO_ROOT_PASS '' "$env_file")" > "$secret_dir/mongo_root_password"
  printf '%s' "$(env_get MONGO_APP_PASS '' "$env_file")" > "$secret_dir/mongo_app_password"
  printf '%s' "$uri" > "$secret_dir/mongodb_uri"
  printf '%s' "$(env_get REDIS_PASSWORD '' "$env_file")" > "$secret_dir/redis_password"
  printf '%s' "$(env_get JWT_SECRET '' "$env_file")" > "$secret_dir/jwt_secret"
  printf '%s' "$(env_get JWT_REFRESH_SECRET '' "$env_file")" > "$secret_dir/jwt_refresh_secret"
  printf '%s' "$(env_get PIN_LOOKUP_PEPPER '' "$env_file")" > "$secret_dir/pin_lookup_pepper"
  printf '%s' "$(env_get ADMIN_PASSWORD '' "$env_file")" > "$secret_dir/admin_password"
  printf '%s' "$(env_get ADMIN_PIN '' "$env_file")" > "$secret_dir/admin_pin"
  chmod 600 "$secret_dir"/*
}

# ── Generador ÚNICO de .env ───────────────────────────────────────────────────
# El caller define DEPLOYMENT_MODE + las variables de su modo y llama:
#   DEPLOYMENT_MODE=local-ip LOCAL_IP=192.168.1.10 FRONTEND_URL=... write_env_file
# Bloque común para todos los modos + bloque pequeño por modo. Así install.sh
# y el configurador de infrastructure generan .env idénticos para el mismo modo.
write_env_file() {
  local env_file="${1:-$DISHERIO_ENV_FILE}"
  local mode="${DEPLOYMENT_MODE:?write_env_file: DEPLOYMENT_MODE es obligatorio}"

  # Defaults dependientes del modo (antes del bloque común)
  case "$mode" in
    local)
      : "${CADDY_PORT:=4200}"
      # En local Caddy escucha en CADDY_PORT dentro del contenedor; alinear
      # HTTP_PORT para que el mapeo del compose base también lo publique.
      HTTP_PORT="$CADDY_PORT"
      ;;
  esac

  # Defaults comunes (no pisan lo que el caller haya definido)
  : "${NODE_ENV:=production}"
  : "${PORT:=3000}"
  : "${HTTP_PORT:=80}"
  : "${HTTPS_PORT:=443}"
  : "${LOG_LEVEL:=info}"
  : "${MONGO_ROOT_USER:=admin}"
  : "${MONGO_APP_USER:=disherio_app}"
  : "${ADMIN_USERNAME:=admin}"
  : "${REDIS_URL:=redis://redis:6379}"
  : "${JWT_EXPIRES:=15m}"
  : "${JWT_REFRESH_EXPIRES:=7d}"
  : "${TRUST_PROXY:=true}"
  : "${MONGODB_MAX_POOL_SIZE:=50}"
  : "${MONGODB_SERVER_SELECTION_TIMEOUT:=30000}"
  : "${MONGODB_SOCKET_TIMEOUT:=45000}"
  : "${DEFAULT_LANGUAGE:=es}"
  : "${DEFAULT_THEME:=dark}"
  : "${DEFAULT_TAX_RATE:=10}"
  : "${DEFAULT_CURRENCY:=EUR}"
  : "${RESTAURANT_NAME:=DisherIO Restaurant}"
  : "${APP_LANG:=$DEFAULT_LANGUAGE}"
  : "${MONGO_KEYFILE:=/data/db/mongo-keyfile}"
  : "${MONGODB_URI:=mongodb://${MONGO_APP_USER}:${MONGO_APP_PASS:-}@mongo:27017/disherio?authSource=disherio&replicaSet=rs0}"
  : "${FRONTEND_URL:?write_env_file: FRONTEND_URL es obligatorio}"

  # Los secretos deben venir generados (ensure_secrets) por el caller
  local v
  for v in MONGO_ROOT_PASS MONGO_APP_PASS REDIS_PASSWORD JWT_SECRET \
           JWT_REFRESH_SECRET PIN_LOOKUP_PEPPER ADMIN_PASSWORD ADMIN_PIN; do
    if [[ -z "${!v:-}" ]]; then
      echo "write_env_file: $v está vacío (ejecuta ensure_secrets antes)" >&2
      return 1
    fi
  done

  cat > "$env_file" <<EOF
# ============================================
# DisherIO - Configuración de despliegue (${mode})
# Generado por scripts/lib/disherio-common.sh (write_env_file)
# ============================================

# Modo de despliegue
DEPLOYMENT_MODE=${mode}

# Entorno
NODE_ENV=${NODE_ENV}

# URLs
FRONTEND_URL="${FRONTEND_URL}"

# Puertos (HTTP_PORT debe coincidir con el puerto del Caddyfile generado;
# cámbialo con scripts/configure.sh, no editando solo una de las dos piezas)
PORT=${PORT}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}

# Seguridad
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES=${JWT_EXPIRES}
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
JWT_REFRESH_EXPIRES=${JWT_REFRESH_EXPIRES}
PIN_LOOKUP_PEPPER="${PIN_LOOKUP_PEPPER}"
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
ADMIN_PIN="${ADMIN_PIN}"

# Base de datos
MONGO_ROOT_USER="${MONGO_ROOT_USER}"
MONGO_ROOT_PASS="${MONGO_ROOT_PASS}"
MONGO_APP_USER="${MONGO_APP_USER}"
MONGO_APP_PASS="${MONGO_APP_PASS}"
MONGODB_URI="${MONGODB_URI}"
MONGODB_MAX_POOL_SIZE=${MONGODB_MAX_POOL_SIZE}
MONGODB_SERVER_SELECTION_TIMEOUT=${MONGODB_SERVER_SELECTION_TIMEOUT}
MONGODB_SOCKET_TIMEOUT=${MONGODB_SOCKET_TIMEOUT}
MONGO_KEYFILE=${MONGO_KEYFILE}

# Redis
REDIS_URL=${REDIS_URL}
REDIS_PASSWORD="${REDIS_PASSWORD}"

# Aplicación / seed
RESTAURANT_NAME="${RESTAURANT_NAME}"
DEFAULT_LANGUAGE=${DEFAULT_LANGUAGE}
APP_LANG=${APP_LANG}
DEFAULT_THEME=${DEFAULT_THEME}
DEFAULT_TAX_RATE=${DEFAULT_TAX_RATE}
DEFAULT_CURRENCY=${DEFAULT_CURRENCY}

# Proxy y logging
TRUST_PROXY=${TRUST_PROXY}
LOG_LEVEL=${LOG_LEVEL}
EOF

  # Bloque específico de cada modo
  case "$mode" in
    local)
      cat >> "$env_file" <<EOF

# Modo local (desarrollo en localhost)
CADDY_PORT=${CADDY_PORT}
BACKEND_URL="${BACKEND_URL:-http://localhost:${PORT}}"
EOF
      ;;
    local-ip)
      cat >> "$env_file" <<EOF

# Modo red local (sin HTTPS)
LOCAL_IP=${LOCAL_IP:?write_env_file: LOCAL_IP es obligatorio en modo local-ip}
TLS_ENABLED=false
BACKEND_URL="${BACKEND_URL:-http://${LOCAL_IP}:${HTTP_PORT}/api}"
EOF
      ;;
    public-ip)
      : "${TUNNEL_TYPE:?write_env_file: TUNNEL_TYPE es obligatorio en modo public-ip}"
      : "${CADDY_INTERNAL_PORT:=8080}"
      : "${PUBLIC_IP:=}"
      : "${TUNNEL_URL:=$FRONTEND_URL}"
      cat >> "$env_file" <<EOF

# Modo IP pública (túnel ${TUNNEL_TYPE})
TUNNEL_TYPE=${TUNNEL_TYPE}
TUNNEL_URL="${TUNNEL_URL}"
PUBLIC_IP=${PUBLIC_IP}
CADDY_INTERNAL_PORT=${CADDY_INTERNAL_PORT}
BACKEND_URL="${BACKEND_URL:-${TUNNEL_URL}/api}"
EOF
      case "$TUNNEL_TYPE" in
        cloudflare)
          cat >> "$env_file" <<EOF
CF_TUNNEL_TOKEN=${CF_TUNNEL_TOKEN:?write_env_file: CF_TUNNEL_TOKEN es obligatorio}
CF_TUNNEL_DOMAIN=${CF_TUNNEL_DOMAIN:?write_env_file: CF_TUNNEL_DOMAIN es obligatorio}
EOF
          ;;
        ngrok)
          cat >> "$env_file" <<EOF
NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN:?write_env_file: NGROK_AUTHTOKEN es obligatorio}
NGROK_DOMAIN=${NGROK_DOMAIN:?write_env_file: NGROK_DOMAIN es obligatorio}
EOF
          ;;
        *)
          echo "write_env_file: TUNNEL_TYPE desconocido '$TUNNEL_TYPE'" >&2
          return 1
          ;;
      esac
      ;;
    domain)
      cat >> "$env_file" <<EOF

# Modo dominio propio (HTTPS automático con Let's Encrypt)
DOMAIN=${DOMAIN:?write_env_file: DOMAIN es obligatorio en modo domain}
EMAIL=${EMAIL:-admin@${DOMAIN}}
TLS_ENABLED=true
TLS_AUTO=true
BACKEND_URL="${BACKEND_URL:-https://${DOMAIN}/api}"
EOF
      ;;
    *)
      echo "write_env_file: DEPLOYMENT_MODE desconocido '$mode'" >&2
      return 1
      ;;
  esac

  chmod 600 "$env_file"
}

# ── Headers de seguridad: bloque único ───────────────────────────────────────
# Variante https → incluye HSTS y connect-src wss:
# Variante http  → sin HSTS y con connect-src ws:
render_security_headers() {
  local variant="$1"
  if [[ "$variant" == "https" ]]; then
    sed -n '/^header {/,$p' "$DISHERIO_SECURITY_HEADERS"
  else
    sed -n '/^header {/,$p' "$DISHERIO_SECURITY_HEADERS" \
      | grep -vE 'HSTS|Strict-Transport-Security' \
      | sed 's/ wss:;/ ws:;/'
  fi
}

# Sustituye el marcador ${SECURITY_HEADERS} de un template (stdin → stdout)
# por el bloque canónico, conservando la indentación del marcador.
inject_security_headers() {
  local variant="$1" line indent rendered
  rendered="$(render_security_headers "$variant")"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == *'${SECURITY_HEADERS}'* ]]; then
      indent="${line%%\$\{SECURITY_HEADERS\}*}"
      while IFS= read -r hline; do
        printf '%s%s\n' "$indent" "$hline"
      done <<< "$rendered"
    else
      printf '%s\n' "$line"
    fi
  done
}

# ── Generador ÚNICO de Caddyfile ──────────────────────────────────────────────
# Genera el Caddyfile desde infrastructure/caddy-templates/Caddyfile.<modo>:
#   1. Inyecta el bloque único de headers de seguridad (${SECURITY_HEADERS})
#   2. Sustituye los placeholders ${VAR} conocidos que estén definidos
# Los placeholders sin valor se dejan intactos para que verify.sh los detecte
# en lugar de arrancar Caddy con una configuración rota en silencio.
write_caddyfile() {
  local mode="$1" out="${2:-$DISHERIO_CADDYFILE}"
  local template="$DISHERIO_CADDY_TEMPLATES/Caddyfile.$mode"
  if [[ ! -f "$template" ]]; then
    echo "write_caddyfile: template no encontrado: $template" >&2
    return 1
  fi

  local variant="http"
  case "$mode" in domain|public-ip) variant="https" ;; esac

  local tmp
  tmp="$(mktemp)"
  inject_security_headers "$variant" < "$template" > "$tmp"

  local key
  for key in DOMAIN EMAIL LOCAL_IP HTTP_PORT HTTPS_PORT CADDY_PORT CADDY_INTERNAL_PORT; do
    if [[ -n "${!key:-}" ]]; then
      sed -i "s|\${${key}}|${!key}|g" "$tmp"
    fi
  done

  install -m 600 "$tmp" "$out"
  rm -f "$tmp"
}
