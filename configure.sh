#!/bin/bash

# Disher.io - Asistente de Configuración v2.6.0

# ... (código de funciones auxiliares y estilos sin cambios) ...

# --- Menú Principal ---
echo -e "Selecciona el idioma / Select language:"
echo -e "1) Español"
echo -e "2) English"
read -p "Opcion [1-2] (default: 1): " LANG_OPT

if [ "$LANG_OPT" = "2" ]; then
    MSG_SEL="Select an option:"
    MSG_OP1="1) Change a user password"
    MSG_OP2="2) Change Domain / Access Mode"
    MSG_OP3="3) Reset Database (DANGER!)"
    MSG_OP4="4) View Services Status"
    MSG_OP5="5) Create Database Backup"
    MSG_OP6="6) Export Diagnostic Logs"
    MSG_OP7="7) Exit"
else
    MSG_SEL="Selecciona una opción:"
    MSG_OP1="1) Cambiar la contraseña de un usuario"
    MSG_OP2="2) Cambiar Dominio / Modo de Acceso"
    MSG_OP3="3) Resetear Base de Datos (¡PELIGRO!)"
    MSG_OP4="4) Ver Estado de los Servicios"
    MSG_OP5="5) Crear Backup de Base de Datos"
    MSG_OP6="6) Exportar Logs de Diagnóstico"
    MSG_OP7="7) Salir"
fi

echo -e "\n${MSG_SEL}"
echo "${MSG_OP1}"
echo "${MSG_OP2}"
echo "${MSG_OP3}"
echo "${MSG_OP4}"
echo "${MSG_OP5}"
echo "${MSG_OP6}"
echo "${MSG_OP7}"
read -p "> " OPTION

case $OPTION in
    1)
        # --- Gestión de Contraseñas ---
        echo -e "\n${BLUE}--- Cambiar Contraseña de Usuario ---${NC}"
        read -p "Nombre de usuario a modificar: " TARGET_USER
        read -s -p "Nueva contraseña: " NEW_PASS
        echo

        if [ -z "$TARGET_USER" ] || [ -z "$NEW_PASS" ]; then
            echo -e "${RED}Error: El nombre de usuario y la contraseña no pueden estar vacíos.${NC}"
            exit 1
        fi

        echo -e "\n${YELLOW}Actualizando contraseña para '$TARGET_USER'...${NC}"

        COMMAND_TO_RUN='''
            const mongoose = require("mongoose");
            const User = require("./src/models/User");
            async function run() {
                try {
                    await mongoose.connect(process.env.MONGO_URI);
                    const user = await User.findOne({ username: process.env.TARGET_USER });
                    if (!user) { throw new Error("usuario no encontrado"); }
                    user.password = process.env.NEW_PASS;
                    await user.save();
                    console.log(`Contraseña para ${process.env.TARGET_USER} actualizada.`);
                    process.exit(0);
                } catch (e) {
                    console.error(`Error: ${e.message}`);
                    process.exit(1);
                }
            }();
        '''

        $DOCKER_CMD exec \
            -e MONGO_URI="$MONGODB_URI" \
            -e TARGET_USER="$TARGET_USER" \
            -e NEW_PASS="$NEW_PASS" \
            backend node -e "$COMMAND_TO_RUN"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Operación completada con éxito.${NC}"
        else
            echo -e "${RED}Falló la actualización de la contraseña.${NC}"
        fi
        ;;

    2)
        # --- Cambio de Red / Dominio ---
        # ... (código sin cambios) ...
        ;;

    3)
        echo -e "\n${RED}PELIGRO: ESTO BORRARÁ TODOS LOS DATOS.${NC}"
        read -p "Escribe 'BORRAR' para confirmar: " CONFIRM

        if [ "$CONFIRM" == "BORRAR" ]; then
            echo -e "\n${YELLOW}Reseteando la base de datos y generando nuevas credenciales...${NC}"
            
            NEW_ADMIN_PASS=$(openssl rand -base64 16)
            NEW_WAITER_PASS=$(openssl rand -base64 12)

            $DOCKER_CMD exec \
                -e MONGO_URI="$MONGODB_URI" \
                -e INIT_RESET='true' \
                -e INIT_ADMIN_PASS="$NEW_ADMIN_PASS" \
                -e INIT_WAITER_PASS="$NEW_WAITER_PASS" \
                backend node init-store.js

            if [ $? -eq 0 ]; then
                echo -e "\n${GREEN}Base de datos reseteada con éxito.${NC}"
                echo -e "${YELLOW}--- Nuevas Credenciales (guardar en lugar seguro) ---${NC}"
                echo -e "  Usuario Admin: ${CYAN}admin${NC}"
                echo -e "  Contraseña Admin: ${CYAN}$NEW_ADMIN_PASS${NC}"
                echo -e "\n  Usuario Camarero: ${CYAN}waiter${NC}"
                echo -e "  Contraseña Camarero: ${CYAN}$NEW_WAITER_PASS${NC}"
            else
                echo -e "\n${RED}Error durante el reseteo de la base de datos.${NC}"
            fi
        else
            echo "Operación cancelada."
        fi
        ;;

    # ... (resto de opciones 4, 5, 6, 7 sin cambios) ...

esac
