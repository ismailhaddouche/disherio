#!/bin/bash

# Disher.io - Master Installer v2.6.0
# ... (c├│digo de funciones auxiliares, estilos y comprobaciones sin cambios) ...

# --- Security ---
echo -e "\n${CYAN}[6/9] Configurando Seguridad...${NC}"
# ... (c├│digo de generaci├│n de JWT_SECRET y credenciales de MongoDB sin cambios) ...

# Generar contrase├▒as seguras para los usuarios iniciales
ADMIN_PASS=$(openssl rand -base64 16)
WAITER_PASS=$(openssl rand -base64 12)

# --- Environment ---
echo -e "\n${CYAN}[7/9] Guardando Configuraci├│n...${NC}"
# ... (c├│digo de guardado de .env sin cambios, no guardamos las contrase├▒as de los usuarios aqu├¡ por seguridad) ...

# --- Infrastructure ---
echo -e "\n${CYAN}[8/9] Levantando Servicios...${NC}"
$DOCKER_CMD down --remove-orphans || true
$DOCKER_CMD up -d --build

# --- Initial Store Setup (Only on New Install) ---
if [ "$UPDATE_MODE" = "false" ]; then
    echo -e "\n${CYAN}[9/9] Configurando Tienda Inicial...${NC}"
    sleep 10

    # Pasamos las contrase├▒as generadas al script de inicializaci├│n
    $DOCKER_CMD exec -e MONGO_URI="$MONGODB_URI" \
                   -e INIT_ADMIN_PASS="$ADMIN_PASS" \
                   -e INIT_WAITER_PASS="$WAITER_PASS" \
                   backend sh -c "node init-store.js"
fi

# --- Firewall ---
# ... (c├│digo de firewall sin cambios) ...

# --- Summary ---
echo -e "\n${GREEN}============================================${NC}"
if [ "$UPDATE_MODE" = "true" ]; then
    echo -e "${GREEN}   DISHER.IO ACTUALIZADO CORRECTAMENTE${NC}"
else
    echo -e "${GREEN}   DISHER.IO INSTALADO CORRECTAMENTE${NC}"
fi
echo -e "${GREEN}============================================${NC}"
echo -e "  Acceso: ${CYAN}$CADDY_DOMAIN${NC}"

if [ "$UPDATE_MODE" = "false" ]; then
    echo -e "\n${YELLOW}--- Credenciales Iniciales (guardar en lugar seguro) ---${NC}"
    echo -e "  Usuario Admin: ${CYAN}admin${NC}"
    echo -e "  Contrase├▒a Admin: ${CYAN}$ADMIN_PASS${NC}"
    echo -e "\n  Usuario Camarero: ${CYAN}waiter${NC}"
    echo -e "  Contrase├▒a Camarero: ${CYAN}$WAITER_PASS${NC}"
fi
echo ""
