#!/usr/bin/env bash
# =============================================================================
# DisherIo - restart.sh
# Reinicio controlado + healthcheck completo de todos los contenedores.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

HC_RETRIES="${HC_RETRIES:-12}"
HC_WAIT="${HC_WAIT:-5}"

log()  { echo -e "${GREEN}[OK]${RESET} $*"; }
warn() { echo -e "${YELLOW}[WAIT]${RESET} $*"; }
err()  { echo -e "${RED}[FAIL]${RESET} $*"; }
step() { echo -e "\n${BLUE}▶${RESET} ${BOLD}$*${RESET}"; }

# ── Cargar .env ────────────────────────────────────────────────────────────────
load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
  fi
}

# ── Reinicio ───────────────────────────────────────────────────────────────────
do_restart() {
  step "Deteniendo servicios..."
  cd "$ROOT_DIR"
  docker compose down --timeout 30
  log "Servicios detenidos"

  step "Iniciando servicios..."
  docker compose up -d
  log "Servicios iniciados"
}

# ── Healthcheck por contenedor ─────────────────────────────────────────────────
check_container() {
  local name="$1"
  local check_cmd="$2"
  local friendly="$3"

  for i in $(seq 1 $HC_RETRIES); do
    if eval "$check_cmd" &>/dev/null; then
      echo -e "  ${GREEN}✓${RESET} ${friendly}"
      return 0
    fi
    warn "[$friendly] Intento $i/$HC_RETRIES..."
    sleep $HC_WAIT
  done

  # Falló — imprimir logs del contenedor
  echo ""
  err "[$friendly] No respondió tras $HC_RETRIES intentos"
  echo -e "${RED}  ── Últimas líneas de log del contenedor '$name': ──${RESET}"
  docker compose logs --tail=20 "$name" 2>/dev/null | sed 's/^/  /' || true
  return 1
}

run_healthchecks() {
  step "Verificación de salud de los servicios"
  echo ""

  local port="${PORT:-80}"
  local api_url="http://localhost:${port}/health"
  local all_ok=true

  # MongoDB
  check_container "mongo" \
    "docker compose exec -T mongo mongosh --quiet --eval 'db.runCommand({ping:1}).ok' disherio 2>/dev/null | grep -q '1'" \
    "MongoDB" || all_ok=false

  # Backend API
  check_container "backend" \
    "curl -sf --max-time 5 '${api_url}'" \
    "Backend API (/api/health)" || all_ok=false

  # Frontend
  check_container "frontend" \
    "curl -sf --max-time 5 'http://localhost:4200'" \
    "Frontend (Angular)" || all_ok=false

  # Caddy proxy
  check_container "caddy" \
    "curl -sf --max-time 5 -o /dev/null -w '%{http_code}' 'http://localhost:${port}' | grep -qE '^[23]'" \
    "Caddy (proxy → :${port})" || all_ok=false

  echo ""
  if $all_ok; then
    log "Todos los servicios están saludables"
    return 0
  else
    err "Uno o más servicios fallaron. Revisa los logs anteriores."
    return 1
  fi
}

# ── Estado final ───────────────────────────────────────────────────────────────
print_status() {
  step "Estado actual de los contenedores"
  echo ""
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
    | awk 'NR==1{print "  "$0} NR>1{
        if ($0 ~ /running|Up/) print "  \033[0;32m"$0"\033[0m"
        else print "  \033[0;31m"$0"\033[0m"
      }'
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}DisherIo — Reinicio con Healthcheck${RESET}"
  echo ""
  load_env
  do_restart
  sleep 3
  run_healthchecks
  print_status

  FRONTEND_URL="${FRONTEND_URL:-http://localhost}"
  echo -e "  ${GREEN}Sistema operativo — Accede en: ${BOLD}${FRONTEND_URL}${RESET}"
  echo ""
}

main "$@"
