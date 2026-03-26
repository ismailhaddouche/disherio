#!/bin/bash
# Script de verificación post-instalación
# Verifica que todos los servicios estén funcionando correctamente

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  Verificación de Instalación DisherIO"
echo "=========================================="
echo ""

# 1. Verificar Docker
echo -n "[1/6] Verificando Docker... "
if command -v docker &> /dev/null && docker ps &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Docker no está instalado o no tiene permisos${NC}"
    exit 1
fi

# 2. Verificar contenedores
echo -n "[2/6] Verificando contenedores... "
REQUIRED_CONTAINERS=("disherio_caddy" "disherio_backend" "disherio_frontend" "disherio_mongo")
MISSING=0

for container in "${REQUIRED_CONTAINERS[@]}"; do
    if ! docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        echo -e "\n  ${RED}✗ ${container} no está corriendo${NC}"
        MISSING=1
    fi
done

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✓ Todos los contenedores activos${NC}"
else
    echo -e "${YELLOW}⚠ Algunos contenedores no están activos${NC}"
    echo "      Ejecuta: sudo docker-compose ps"
fi

# 3. Verificar healthchecks
echo -n "[3/6] Verificando healthchecks... "
UNHEALTHY=$(docker ps --format "{{.Names}}:{{.Status}}" | grep -v "healthy\|Up.*(healthy)" | grep "disherio_" || true)

if [ -z "$UNHEALTHY" ]; then
    echo -e "${GREEN}✓ Todos healthy${NC}"
else
    echo -e "${YELLOW}⚠ Algunos contenedores no son healthy:${NC}"
    echo "$UNHEALTHY" | while read line; do
        echo "      - $line"
    done
    echo "      Nota: MongoDB puede tardar ~60s en volverse healthy"
fi

# 4. Verificar puertos locales
echo -n "[4/6] Verificando puertos locales... "
if ss -tlnp | grep -q ":80"; then
    echo -e "${GREEN}✓ Puerto 80 abierto${NC}"
else
    echo -e "${RED}✗ Puerto 80 no está escuchando${NC}"
fi

# 5. Verificar IP pública
echo -n "[5/6] Detectando IP pública... "
PUBLIC_IP=$(curl -s -4 --max-time 5 ifconfig.me 2>/dev/null || echo "")

if [ -n "$PUBLIC_IP" ]; then
    echo -e "${GREEN}✓ IP: $PUBLIC_IP${NC}"
    
    # 6. Verificar acceso HTTP
    echo -n "[6/6] Verificando acceso HTTP... "
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$PUBLIC_IP" 2>/dev/null || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ HTTP 200 OK${NC}"
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  ¡Instalación verificada exitosamente!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "  Acceso: http://$PUBLIC_IP"
        echo ""
    elif [ "$HTTP_STATUS" = "502" ]; then
        echo -e "${YELLOW}⚠ HTTP 502 (Backend temporalmente no disponible)${NC}"
        echo "      Espera 30 segundos y vuelve a ejecutar este script"
    elif [ "$HTTP_STATUS" = "000" ]; then
        echo -e "${RED}✗ No se puede conectar${NC}"
        echo ""
        echo -e "${YELLOW}⚠ Posible problema de firewall${NC}"
        echo ""
        echo "  Si estás en GCP, ejecuta:"
        echo "    gcloud compute firewall-rules create allow-http \\"
        echo "      --direction=INGRESS --rules=tcp:80 \\"
        echo "      --source-ranges=0.0.0.0/0 --target-tags=http-server"
        echo ""
        echo "    gcloud compute instances add-tags \$(hostname) \\"
        echo "      --tags=http-server,https-server --zone=\$(curl -s metadata.google.internal/computeMetadata/v1/instance/zone -H Metadata-Flavor:Google | cut -d/ -f4)"
        echo ""
    else
        echo -e "${YELLOW}⚠ HTTP $HTTP_STATUS${NC}"
    fi
else
    echo -e "${YELLOW}⚗ No se pudo detectar IP pública${NC}"
    echo -n "[6/6] Verificando acceso local... "
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost" 2>/dev/null || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ Acceso local OK${NC}"
    else
        echo -e "${YELLOW}⚗ HTTP $HTTP_STATUS${NC}"
    fi
fi

echo ""
echo "=========================================="
echo "  Estado de Contenedores"
echo "=========================================="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep disherio_ || echo "No se encontraron contenedores"

echo ""
echo "=========================================="
echo "  Logs recientes"
echo "=========================================="
echo "Para ver logs: sudo docker logs <nombre_contenedor> --tail 20"
echo ""
echo "Contenedores disponibles:"
docker ps --format "  - {{.Names}}" | grep disherio_ || echo "  (ninguno)"
echo ""
