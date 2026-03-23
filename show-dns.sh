#!/bin/bash

# Disher.io - DNS Configuration Viewer
# Run this script at any time to see the DNS records for your deployment.
# Usage: sudo ./show-dns.sh

# Styles
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# --- Check .env exists ---
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at ${ENV_FILE}${NC}"
    echo -e "Run the installer first: ${CYAN}sudo ./install.sh${NC}"
    exit 1
fi

# --- Read config from .env ---
DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2)
PROTOCOL=$(grep '^PROTOCOL=' "$ENV_FILE" | cut -d= -f2)
HTTP_PORT=$(grep '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2)
HTTPS_PORT=$(grep '^HTTPS_PORT=' "$ENV_FILE" | cut -d= -f2)

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: DOMAIN not configured in .env${NC}"
    exit 1
fi

# --- Detect language from .env ---
DEFAULT_LANG=$(grep '^DEFAULT_LANG=' "$ENV_FILE" | cut -d= -f2)
DEFAULT_LANG=${DEFAULT_LANG:-es}

if [ "$DEFAULT_LANG" = "en" ]; then
    L_TITLE="DISHER.IO — DNS CONFIGURATION"
    L_CURRENT="Current Deployment Configuration"
    L_DOMAIN="Domain"
    L_PROTOCOL="Protocol"
    L_HTTP="HTTP Port"
    L_HTTPS="HTTPS Port"
    L_PUBLIC_IP="Server Public IP"
    L_LOCAL_IP="Server Local IP"
    L_DETECTING="Detecting IPs..."
    L_NOT_DETECTED="Not detected"
    L_ACCESS="Access URL"
    L_DNS_REQUIRED="REQUIRED DNS RECORDS"
    L_DNS_RECOMMENDED="RECOMMENDED DNS RECORDS (SSL & Security)"
    L_TYPE="Type"
    L_HOST="Host"
    L_VALUE="Value"
    L_NOTE="Notes"
    L_CAA_NOTE="CAA records authorize Let's Encrypt to issue SSL certificates for your domain."
    L_PROPAGATION="DNS propagation can take from a few minutes to 48 hours."
    L_LETSENCRYPT="Caddy will automatically provision a Let's Encrypt SSL certificate once DNS is configured."
    L_NOT_PUBLIC="This deployment uses a local domain or IP. No public DNS records are needed."
    L_HOWTO="HOW TO CONFIGURE"
    L_STEP1="1. Go to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.)"
    L_STEP2="2. Navigate to DNS Management for your domain"
    L_STEP3="3. Add the records shown above"
    L_STEP4="4. Wait for DNS propagation (check with: dig +short YOUR_DOMAIN)"
    L_STEP5="5. Restart Caddy if needed: docker compose restart caddy"
else
    L_TITLE="DISHER.IO — CONFIGURACIÓN DNS"
    L_CURRENT="Configuración Actual del Despliegue"
    L_DOMAIN="Dominio"
    L_PROTOCOL="Protocolo"
    L_HTTP="Puerto HTTP"
    L_HTTPS="Puerto HTTPS"
    L_PUBLIC_IP="IP Pública del Servidor"
    L_LOCAL_IP="IP Local del Servidor"
    L_DETECTING="Detectando IPs..."
    L_NOT_DETECTED="No detectada"
    L_ACCESS="URL de Acceso"
    L_DNS_REQUIRED="REGISTROS DNS OBLIGATORIOS"
    L_DNS_RECOMMENDED="REGISTROS DNS RECOMENDADOS (SSL y Seguridad)"
    L_TYPE="Tipo"
    L_HOST="Host"
    L_VALUE="Valor"
    L_NOTE="Notas"
    L_CAA_NOTE="Los registros CAA autorizan a Let's Encrypt a emitir certificados SSL para tu dominio."
    L_PROPAGATION="La propagación DNS puede tardar desde minutos hasta 48 horas."
    L_LETSENCRYPT="Caddy provisionará automáticamente un certificado SSL de Let's Encrypt una vez configurado el DNS."
    L_NOT_PUBLIC="Este despliegue usa un dominio local o IP. No se necesitan registros DNS públicos."
    L_HOWTO="CÓMO CONFIGURAR"
    L_STEP1="1. Ve a tu registrador de dominios (Namecheap, Cloudflare, GoDaddy, etc.)"
    L_STEP2="2. Navega a la gestión DNS de tu dominio"
    L_STEP3="3. Añade los registros mostrados arriba"
    L_STEP4="4. Espera la propagación DNS (verifica con: dig +short TU_DOMINIO)"
    L_STEP5="5. Reinicia Caddy si es necesario: docker compose restart caddy"
fi

# --- Detect IPs ---
echo -e "${CYAN}${L_DETECTING}${NC}"
PUBLIC_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || curl -4 -s --max-time 5 api.ipify.org 2>/dev/null || curl -4 -s --max-time 5 icanhazip.com 2>/dev/null)
LOCAL_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v ':' | head -n 1)
PUBLIC_IP=${PUBLIC_IP:-$L_NOT_DETECTED}
LOCAL_IP=${LOCAL_IP:-$L_NOT_DETECTED}

# --- Build access URL ---
if [ "$PROTOCOL" = "https" ]; then
    if [ "$HTTPS_PORT" = "443" ] || [ -z "$HTTPS_PORT" ]; then
        ACCESS_URL="https://${DOMAIN}"
    else
        ACCESS_URL="https://${DOMAIN}:${HTTPS_PORT}"
    fi
else
    if [ "$HTTP_PORT" = "80" ] || [ -z "$HTTP_PORT" ]; then
        ACCESS_URL="http://${DOMAIN}"
    else
        ACCESS_URL="http://${DOMAIN}:${HTTP_PORT}"
    fi
fi

# --- Determine if public domain ---
IS_PUBLIC_DOMAIN="false"
if [ "$PROTOCOL" = "https" ] && [[ "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    # Not an IP, has a TLD → public domain
    if [[ ! "$DOMAIN" =~ \.local$ ]] && [[ ! "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        IS_PUBLIC_DOMAIN="true"
    fi
fi

# --- Header ---
clear 2>/dev/null || true
echo -e ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}${L_TITLE}${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"

# --- Current config summary ---
echo -e ""
echo -e "  ${BOLD}${L_CURRENT}${NC}"
echo -e "  ─────────────────────────────────────────"
echo -e "  ${L_DOMAIN}:      ${CYAN}${DOMAIN}${NC}"
echo -e "  ${L_PROTOCOL}:    ${CYAN}${PROTOCOL}${NC}"
echo -e "  ${L_HTTP}:  ${CYAN}${HTTP_PORT:-80}${NC}"
echo -e "  ${L_HTTPS}: ${CYAN}${HTTPS_PORT:-443}${NC}"
echo -e "  ${L_PUBLIC_IP}: ${CYAN}${PUBLIC_IP}${NC}"
echo -e "  ${L_LOCAL_IP}:  ${CYAN}${LOCAL_IP}${NC}"
echo -e "  ${L_ACCESS}:     ${GREEN}${ACCESS_URL}${NC}"

# --- DNS Records ---
if [ "$IS_PUBLIC_DOMAIN" = "true" ]; then
    echo -e ""
    echo -e "  ${GREEN}━━ ${L_DNS_REQUIRED} ━━${NC}"
    echo -e ""
    echo -e "  ┌──────────┬─────────────────────────┬──────────────────────────────────┐"
    printf  "  │ %-8s │ %-23s │ %-32s │\n" "${L_TYPE}" "${L_HOST}" "${L_VALUE}"
    echo -e "  ├──────────┼─────────────────────────┼──────────────────────────────────┤"
    printf  "  │ ${GREEN}%-8s${NC} │ ${CYAN}%-23s${NC} │ ${CYAN}%-32s${NC} │\n" "A" "${DOMAIN}" "${PUBLIC_IP}"
    printf  "  │ ${GREEN}%-8s${NC} │ ${CYAN}%-23s${NC} │ ${CYAN}%-32s${NC} │\n" "A" "www.${DOMAIN}" "${PUBLIC_IP}"
    echo -e "  └──────────┴─────────────────────────┴──────────────────────────────────┘"

    echo -e ""
    echo -e "  ${YELLOW}━━ ${L_DNS_RECOMMENDED} ━━${NC}"
    echo -e ""
    echo -e "  ┌──────────┬─────────────────────────┬──────────────────────────────────┐"
    printf  "  │ %-8s │ %-23s │ %-32s │\n" "${L_TYPE}" "${L_HOST}" "${L_VALUE}"
    echo -e "  ├──────────┼─────────────────────────┼──────────────────────────────────┤"
    printf  "  │ ${GREEN}%-8s${NC} │ ${CYAN}%-23s${NC} │ ${CYAN}%-32s${NC} │\n" "CAA" "${DOMAIN}" "0 issue \"letsencrypt.org\""
    printf  "  │ ${GREEN}%-8s${NC} │ ${CYAN}%-23s${NC} │ ${CYAN}%-32s${NC} │\n" "CAA" "${DOMAIN}" "0 issuewild \"letsencrypt.org\""
    echo -e "  └──────────┴─────────────────────────┴──────────────────────────────────┘"

    echo -e ""
    echo -e "  ${YELLOW}${L_CAA_NOTE}${NC}"
    echo -e "  ${YELLOW}${L_PROPAGATION}${NC}"
    echo -e "  ${GREEN}${L_LETSENCRYPT}${NC}"

    # --- How-to steps ---
    echo -e ""
    echo -e "  ${BOLD}${L_HOWTO}${NC}"
    echo -e "  ─────────────────────────────────────────"
    echo -e "  ${L_STEP1}"
    echo -e "  ${L_STEP2}"
    echo -e "  ${L_STEP3}"
    echo -e "  ${L_STEP4}"
    echo -e "  ${L_STEP5}"
else
    echo -e ""
    echo -e "  ${YELLOW}${L_NOT_PUBLIC}${NC}"
fi

echo -e ""
