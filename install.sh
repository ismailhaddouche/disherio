#!/bin/bash

# Disher.io - Master Installer v2.6.0
# ... (código de funciones auxiliares, estilos y comprobaciones sin cambios) ...

echo -e "Selecciona el idioma / Select language:"
echo -e "1) Español"
echo -e "2) English"
read -p "Opcion [1-2] (default: 1): " LANG_OPT

if [ "$LANG_OPT" = "2" ]; then
    MSG_SEC="[6/9] Configuring Security..."
    MSG_ENV="[7/9] Saving Configuration..."
    MSG_SRV="[8/9] Starting Services..."
    MSG_INIT="[9/9] Configuring Initial Store..."
    MSG_UPD="DISHER.IO UPDATED SUCCESSFULLY"
    MSG_INST="DISHER.IO INSTALLED SUCCESSFULLY"
    MSG_CRED="--- Initial Credentials (save in a secure place) ---"
    MSG_USRADM="Admin User: "
    MSG_PWDADM="Admin Password: "
    MSG_USRWT="Waiter User: "
    MSG_PWDWT="Waiter Password: "
    MSG_ACCESS="Access: "
else
    MSG_SEC="[6/9] Configurando Seguridad..."
    MSG_ENV="[7/9] Guardando Configuración..."
    MSG_SRV="[8/9] Levantando Servicios..."
    MSG_INIT="[9/9] Configurando Tienda Inicial..."
    MSG_UPD="DISHER.IO ACTUALIZADO CORRECTAMENTE"
    MSG_INST="DISHER.IO INSTALADO CORRECTAMENTE"
    MSG_CRED="--- Credenciales Iniciales (guardar en lugar seguro) ---"
    MSG_USRADM="Usuario Admin: "
    MSG_PWDADM="Contraseña Admin: "
    MSG_USRWT="Usuario Camarero: "
    MSG_PWDWT="Contraseña Camarero: "
    MSG_ACCESS="Acceso: "
fi

# --- Security ---
echo -e "\n${CYAN}${MSG_SEC}${NC}"
# ... (código de generación de JWT_SECRET y credenciales de MongoDB sin cambios) ...

# Generar contraseñas seguras para los usuarios iniciales
ADMIN_PASS=$(openssl rand -base64 16)
WAITER_PASS=$(openssl rand -base64 12)

# --- Environment ---
echo -e "\n${CYAN}${MSG_ENV}${NC}"
# ... (código de guardado de .env sin cambios, no guardamos las contraseñas de los usuarios aquí por seguridad) ...

# --- Infrastructure ---
echo -e "\n${CYAN}${MSG_SRV}${NC}"
$DOCKER_CMD down --remove-orphans || true
$DOCKER_CMD up -d --build

# --- Initial Store Setup (Only on New Install) ---
if [ "$UPDATE_MODE" = "false" ]; then
    echo -e "\n${CYAN}${MSG_INIT}${NC}"
    sleep 10

    # Pasamos las contraseñas generadas al script de inicialización
    $DOCKER_CMD exec -e MONGO_URI="$MONGODB_URI" \
                   -e INIT_ADMIN_PASS="$ADMIN_PASS" \
                   -e INIT_WAITER_PASS="$WAITER_PASS" \
                   backend sh -c "node init-store.js"
fi

# --- Firewall ---
# ... (código de firewall sin cambios) ...

# --- Summary ---
echo -e "\n${GREEN}============================================${NC}"
if [ "$UPDATE_MODE" = "true" ]; then
    echo -e "${GREEN}   ${MSG_UPD}${NC}"
else
    echo -e "${GREEN}   ${MSG_INST}${NC}"
fi
echo -e "${GREEN}============================================${NC}"
echo -e "  ${MSG_ACCESS}${CYAN}$CADDY_DOMAIN${NC}"

if [ "$UPDATE_MODE" = "false" ]; then
    echo -e "\n${YELLOW}${MSG_CRED}${NC}"
    echo -e "  ${MSG_USRADM}${CYAN}admin${NC}"
    echo -e "  ${MSG_PWDADM}${CYAN}$ADMIN_PASS${NC}"
    echo -e "\n  ${MSG_USRWT}${CYAN}waiter${NC}"
    echo -e "  ${MSG_PWDWT}${CYAN}$WAITER_PASS${NC}"
fi
echo ""
