#!/usr/bin/env bash
# =============================================================================
# DisherIo - info.sh
# Information panel: IP, domain, DNS, access, service status,
# resource usage, app version.
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; RED='\033[0;31m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

# ── Load .env ─────────────────────────────────────────────────────────────────
load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
  fi
}

# ── Helpers ────────────────────────────────────────────────────────────────────
row() {
  local label="$1" value="$2" extra="${3:-}"
  printf "  ${CYAN}%-22s${RESET} ${BOLD}%-35s${RESET} ${DIM}%s${RESET}\n" "$label" "$value" "$extra"
}

divider() {
  echo -e "  ${BLUE}$(printf '─%.0s' {1..65})${RESET}"
}

status_icon() {
  local state="$1"
  if echo "$state" | grep -qiE "running|Up|healthy"; then
    echo -e "${GREEN}●${RESET}"
  else
    echo -e "${RED}●${RESET}"
  fi
}

# ── Gather network data ───────────────────────────────────────────────────────
gather_network_info() {
  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}' || echo "N/A")
  PUBLIC_IP=$(curl -s --max-time 6 ifconfig.me 2>/dev/null || curl -s --max-time 6 api.ipify.org 2>/dev/null || echo "N/A")
  HOSTNAME=$(hostname -f 2>/dev/null || hostname || echo "N/A")
  FRONTEND_URL="${FRONTEND_URL:-http://localhost}"

  # Detect domain configured in Caddyfile
  CONFIGURED_DOMAIN="N/A"
  if [[ -f "$ROOT_DIR/Caddyfile" ]]; then
    CONFIGURED_DOMAIN=$(grep -Eo '^[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}' "$ROOT_DIR/Caddyfile" 2>/dev/null | head -1 || echo "N/A")
    # If no real domain found, check for :port
    if [[ "$CONFIGURED_DOMAIN" == "N/A" ]]; then
      local port_entry
      port_entry=$(grep -Eo ':[0-9]+' "$ROOT_DIR/Caddyfile" 2>/dev/null | head -1 || echo "")
      [[ -n "$port_entry" ]] && CONFIGURED_DOMAIN="(puerto${port_entry})"
    fi
  fi

  # Detect if SSL is enabled
  SSL_MODE="No"
  if grep -qiE '^https|443' "$ROOT_DIR/Caddyfile" 2>/dev/null; then
    SSL_MODE="Si (Let's Encrypt / Caddy auto)"
  fi
}

# ── DNS Lookup ─────────────────────────────────────────────────────────────────
dns_lookup() {
  local domain="$1"
  if command -v dig &>/dev/null; then
    dig +short A "$domain" 2>/dev/null | head -3 | tr '\n' ' ' || echo "N/A"
  elif command -v nslookup &>/dev/null; then
    nslookup "$domain" 2>/dev/null | awk '/^Address: / && !/127\.0\.0\.1/{print $2}' | head -1 || echo "N/A"
  else
    echo "(dig/nslookup no disponible)"
  fi
}

# ── Network panel ─────────────────────────────────────────────────────────────
print_network_panel() {
  echo ""
  echo -e "  ${BOLD}RED Y ACCESO${RESET}"
  divider
  row "URL de acceso"      "$FRONTEND_URL"
  row "IP local"           "$LOCAL_IP"
  row "IP pública"         "$PUBLIC_IP"
  row "Hostname"           "$HOSTNAME"
  row "Dominio configurado" "$CONFIGURED_DOMAIN"
  row "SSL / HTTPS"        "$SSL_MODE"

  # DNS resolution if there is a real domain
  if [[ "$CONFIGURED_DOMAIN" != "N/A" && "$CONFIGURED_DOMAIN" != *"puerto"* ]]; then
    local resolved
    resolved=$(dns_lookup "$CONFIGURED_DOMAIN")
    row "DNS resuelve a" "$resolved"

    # Check if it matches the public IP
    if [[ -n "$resolved" && "$resolved" != "N/A" ]] && echo "$resolved" | grep -q "$PUBLIC_IP"; then
      row "DNS apunta a este server" "Si — correcto"
    elif [[ "$resolved" == "N/A" || -z "$resolved" ]]; then
      row "DNS apunta a este server" "No resuelto aún — puede tardar hasta 48h"
    else
      row "DNS apunta a este server" "No coincide — resuelve a $resolved, server en $PUBLIC_IP"
    fi

    echo ""
    echo -e "  ${YELLOW}  Registros DNS esperados:${RESET}"
    echo -e "  ${DIM}  Tipo   Host    Valor${RESET}"
    echo -e "    A      @     → ${PUBLIC_IP}"
    echo -e "    A      www   → ${PUBLIC_IP}"
    echo -e "    CNAME  *     → ${CONFIGURED_DOMAIN}  ${DIM}(opcional, wildcard)${RESET}"
  fi
}

# ── Services panel ────────────────────────────────────────────────────────────
print_services_panel() {
  echo ""
  echo -e "  ${BOLD}ESTADO DE SERVICIOS${RESET}"
  divider

  cd "$ROOT_DIR"
  if ! docker compose ps 2>/dev/null | grep -q .; then
    echo -e "  ${RED}No se puede conectar a Docker / sin contenedores activos${RESET}"
    return
  fi

  while IFS= read -r line; do
    local name status
    name=$(echo "$line" | awk '{print $1}')
    status=$(echo "$line" | awk '{$1=""; print $0}' | xargs)
    icon=$(status_icon "$status")
    printf "  %s  %-28s %s\n" "$icon" "$name" "$status"
  done < <(docker compose ps --format "{{.Name}} {{.Status}}" 2>/dev/null || true)

  echo ""

  # Resource usage
  echo -e "  ${BOLD}USO DE RECURSOS${RESET}"
  divider
  docker stats --no-stream --format "  {{.Name}}\tCPU: {{.CPUPerc}}\tRAM: {{.MemUsage}}" 2>/dev/null \
    | column -t -s $'\t' || echo "  (no disponible)"
}

# ── Storage panel ─────────────────────────────────────────────────────────────
print_storage_panel() {
  echo ""
  echo -e "  ${BOLD}ALMACENAMIENTO${RESET}"
  divider

  # System disk
  local disk_usage
  disk_usage=$(df -h / 2>/dev/null | awk 'NR==2{printf "%s / %s (%s usado)", $3, $2, $5}' || echo "N/A")
  row "Disco raíz" "$disk_usage"

  # Docker volumes
  local vol_size
  vol_size=$(docker system df --format "{{.Type}}\t{{.TotalCount}}\t{{.Size}}" 2>/dev/null \
    | grep -i volume | awk '{printf "%s volúmenes — %s", $2, $3}' || echo "N/A")
  row "Volúmenes Docker" "$vol_size"

  # Backups storage
  local backup_dir="/var/backups/disherio"
  if [[ -d "$backup_dir" ]]; then
    local backup_count backup_size
    backup_count=$(find "$backup_dir" -name "*.tar.gz" 2>/dev/null | wc -l | xargs)
    backup_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1 || echo "N/A")
    row "Backups guardados" "${backup_count} archivo(s) — ${backup_size}"
  else
    row "Backups" "(ninguno aún — ejecuta backup.sh)"
  fi
}

# ── Version panel ─────────────────────────────────────────────────────────────
print_version_panel() {
  echo ""
  echo -e "  ${BOLD}VERSIÓN Y SISTEMA${RESET}"
  divider

  local app_version
  app_version=$(cat "$ROOT_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | tr -d '" ,' | cut -d: -f2 || echo "N/A")
  row "DisherIo versión" "${app_version:-1.0.0}"
  row "Docker"          "$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo 'N/A')"
  row "OS"              "$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)"
  row "Kernel"          "$(uname -r)"
  row "Uptime"          "$(uptime -p 2>/dev/null | sed 's/up //' || uptime | awk '{print $3,$4}' | tr -d ',')"
  row "Idioma app"      "${APP_LANG:-es}"
}

# ── Quick access ──────────────────────────────────────────────────────────────
print_access_summary() {
  local url="${FRONTEND_URL:-http://localhost}"
  echo ""
  divider
  echo ""
  echo -e "  ${BOLD}Accesos rápidos:${RESET}"
  echo -e "    ${CYAN}Panel Admin  ${RESET}→  ${BOLD}${url}/admin${RESET}"
  echo -e "    ${CYAN}POS / Caja   ${RESET}→  ${BOLD}${url}/pos${RESET}"
  echo -e "    ${CYAN}Cocina (KDS) ${RESET}→  ${BOLD}${url}/kds${RESET}"
  echo -e "    ${CYAN}Servicio(TAS)${RESET}→  ${BOLD}${url}/tas${RESET}"
  echo -e "    ${CYAN}Menú cliente ${RESET}→  ${BOLD}${url}/menu/<qr-token>${RESET}"
  echo ""
  echo -e "  ${DIM}Scripts:  configure.sh | backup.sh | restart.sh | info.sh${RESET}"
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${BLUE}  ╔═══════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}  ║              DisherIo — Panel de Información                  ║${RESET}"
  echo -e "${BOLD}${BLUE}  ╚═══════════════════════════════════════════════════════════════╝${RESET}"

  load_env
  gather_network_info

  print_network_panel
  print_services_panel
  print_storage_panel
  print_version_panel
  print_access_summary
}

main "$@"
