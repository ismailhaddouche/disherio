#!/bin/bash
# =============================================================================
# DisherIo - Quick Start Script
# =============================================================================
# Unifica configuración, verificación e inicio en un solo comando
# =============================================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

clear
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}              🚀 DisherIo - Inicio Rápido${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar si ya está configurado
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}⚠ Primera vez ejecutando DisherIo${NC}"
    echo ""
    echo "Necesitamos configurar el entorno de despliegue."
    echo ""
    read -rp "¿Quieres ejecutar el configurador interactivo? (S/n): " run_config
    
    if [[ ! "$run_config" =~ ^[Nn]$ ]]; then
        "$SCRIPT_DIR/infrastructure/scripts/configure.sh"
    else
        echo ""
        echo -e "${RED}No se puede continuar sin configuración.${NC}"
        echo "Ejecuta manualmente: ./infrastructure/scripts/configure.sh"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Configuración existente encontrada${NC}"
    echo ""
    read -rp "¿Quieres reconfigurar? (s/N): " reconfig
    
    if [[ "$reconfig" =~ ^[Ss]$ ]]; then
        "$SCRIPT_DIR/infrastructure/scripts/configure.sh"
    fi
fi

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}              🔍 Verificando Configuración${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar configuración
if ! "$SCRIPT_DIR/infrastructure/scripts/verify.sh"; then
    echo ""
    echo -e "${RED}La verificación falló. Corrige los errores antes de continuar.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}              🐳 Construyendo e Iniciando${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Cargar variables para el modo
cd "$SCRIPT_DIR"
set -a
source .env 2>/dev/null || true
set +a

# Construir e iniciar según el modo
case "$DEPLOYMENT_MODE" in
    public-ip)
        if [ "$TUNNEL_TYPE" = "cloudflare" ]; then
            echo "Iniciando con Cloudflare Tunnel..."
            docker compose --profile cloudflare up -d --build
        elif [ "$TUNNEL_TYPE" = "ngrok" ]; then
            echo "Iniciando con ngrok..."
            docker compose --profile ngrok up -d --build
        else
            echo "Iniciando sin túnel (modo público)..."
            docker compose up -d --build
        fi
        ;;
    *)
        echo "Iniciando servicios..."
        docker compose up -d --build
        ;;
esac

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}              ✓ DisherIo está iniciando${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Mostrar información de acceso
case "$DEPLOYMENT_MODE" in
    local)
        echo -e "${CYAN}Acceso:${NC}"
        echo -e "  Frontend: ${BOLD}http://localhost:${HTTP_PORT:-4200}${NC}"
        echo -e "  Backend:  ${BOLD}http://localhost:${PORT:-3000}/api${NC}"
        ;;
    local-ip)
        echo -e "${CYAN}Acceso desde esta máquina:${NC}"
        echo -e "  ${BOLD}http://localhost:${HTTP_PORT:-80}${NC}"
        echo ""
        echo -e "${CYAN}Acceso desde red local:${NC}"
        echo -e "  ${BOLD}http://${LOCAL_IP}:${HTTP_PORT:-80}${NC}"
        ;;
    public-ip)
        if [ "$TUNNEL_TYPE" = "cloudflare" ]; then
            echo -e "${CYAN}URL pública (Cloudflare):${NC}"
            echo -e "  ${BOLD}https://${CF_TUNNEL_DOMAIN}${NC}"
            echo ""
            echo "Esperando a que el túnel se conecte..."
            sleep 3
            docker compose logs --tail=5 cloudflared 2>/dev/null || true
        else
            echo -e "${CYAN}URL pública (ngrok):${NC}"
            echo "  Esperando asignación..."
            sleep 5
            docker compose logs --tail=5 ngrok 2>/dev/null || true
        fi
        ;;
    domain)
        echo -e "${CYAN}Acceso:${NC}"
        echo -e "  ${BOLD}https://${DOMAIN}${NC}"
        echo ""
        echo "Esperando certificado SSL..."
        sleep 3
        docker compose logs --tail=10 caddy 2>/dev/null | grep -i "certificate\|tls" || true
        ;;
esac

echo ""
echo -e "${CYAN}Comandos útiles:${NC}"
echo -e "  Ver logs:    ${BOLD}docker compose logs -f${NC}"
echo -e "  Detener:     ${BOLD}docker compose down${NC}"
echo -e "  Reiniciar:   ${BOLD}docker compose restart${NC}"
echo ""
echo -e "${GREEN}¡DisherIo está listo! 🎉${NC}"
