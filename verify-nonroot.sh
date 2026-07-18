#!/bin/bash
# Script para verificar configuración de usuario no-root en DisherIO

set -e

echo "=== Verificación de Usuario No-Root en DisherIO ==="
echo ""

# Verificar que los archivos existen
echo "1. Verificando archivos de configuración..."
if [ -f "backend/Dockerfile" ]; then
    echo "   [OK] backend/Dockerfile encontrado"
else
    echo "   [NO] backend/Dockerfile NO encontrado"
    exit 1
fi

if [ -f "frontend/Dockerfile" ]; then
    echo "   [OK] frontend/Dockerfile encontrado"
else
    echo "   [NO] frontend/Dockerfile NO encontrado"
    exit 1
fi

if [ -f "docker-compose.yml" ]; then
    echo "   [OK] docker-compose.yml encontrado"
else
    echo "   [NO] docker-compose.yml NO encontrado"
    exit 1
fi

echo ""
echo "2. Verificando backend/Dockerfile..."

# Verificar creación de grupo
if grep -q "addgroup -g 1001" backend/Dockerfile; then
    echo "   [OK] Grupo 'nodejs' (GID 1001) será creado"
else
    echo "   [NO] Grupo 'nodejs' NO configurado"
fi

# Verificar creación de usuario
if grep -q "adduser -u 1001.*nodejs" backend/Dockerfile; then
    echo "   [OK] Usuario 'nodejs' (UID 1001) será creado"
else
    echo "   [NO] Usuario 'nodejs' NO configurado"
fi

# Verificar cambio de ownership
if grep -q "chown -R nodejs:nodejs /app" backend/Dockerfile; then
    echo "   [OK] Ownership de /app cambiado a nodejs:nodejs"
else
    echo "   [NO] Ownership de /app NO configurado"
fi

# Verificar directorio uploads
if grep -q "mkdir -p /app/uploads" backend/Dockerfile; then
    echo "   [OK] Directorio /app/uploads creado"
else
    echo "   [NO] Directorio /app/uploads NO configurado"
fi

# Verificar USER instruction
if grep -q "^USER nodejs" backend/Dockerfile; then
    echo "   [OK] Instrucción USER nodejs presente"
else
    echo "   [NO] Instrucción USER nodejs NO presente"
fi

echo ""
echo "3. Verificando docker-compose.yml..."

# Verificar user en servicio backend
if grep -A 10 "backend:" docker-compose.yml | grep -q 'user: "1001:1001"'; then
    echo "   [OK] user: \"1001:1001\" configurado en servicio backend"
else
    echo "   [NO] user: \"1001:1001\" NO configurado en servicio backend"
fi

echo ""
echo "4. Verificando frontend/Dockerfile..."

# caddy:2-alpine no fija usuario: sin una instrucción USER explícita el
# contenedor corre como root.
if grep -qE "^USER " frontend/Dockerfile; then
    echo "   [OK] Instrucción USER presente en frontend/Dockerfile"
elif grep -q "FROM caddy:2-alpine" frontend/Dockerfile; then
    echo "   [WARN] caddy:2-alpine sin USER explícito: el frontend corre como root"
else
    echo "   [WARN] No usa caddy:2-alpine - verificar configuración manual"
fi

echo ""
echo "=== Verificación completada ==="
echo ""
echo "Para construir y probar los contenedores (desde el directorio del proyecto):"
echo "  docker compose build --no-cache backend"
echo "  docker compose up -d"
echo ""
echo "Para verificar el usuario dentro del contenedor:"
echo "  docker exec disherio_backend id"
echo "  docker exec disherio_backend ps aux"
echo ""
echo "Para probar escritura en uploads:"
echo "  docker exec disherio_backend touch /app/uploads/test.txt"
