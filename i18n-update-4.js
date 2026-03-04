const fs = require('fs');

const STRINGS_ES = {
    "POS": {
        "TITLE": "Terminal de Caja",
        "SUBTITLE": "Gestión de comandas, cobros y mesas activas.",
        "TABLES": "MESAS",
        "HISTORY": "HISTORIAL",
        "EDIT_MODE": "Modo Edición Activo",
        "EDIT": "Editar",
        "DONE": "Listo",
        "SPLIT": "Dividir",
        "BREAKDOWN": "Desglose por Comensales",
        "CUSTOM_ITEM": "Personalizado",
        "BASE_PRICE": "Base Imponible",
        "VAT": "IVA",
        "VAT_WARNING": "⚠️ IVA no configurado",
        "VAT_HINT": "Configure el IVA en Configuración para generar tickets.",
        "TOTAL_TIP": "TOTAL CON PROPINA",
        "EMPTY_TITLE": "Mesa Vacía",
        "EMPTY_DESC": "no tiene una sesión activa.",
        "OPEN_TABLE": "Abrir Mesa (Manual)",
        "NO_SELECTION_TITLE": "Selecciona una mesa para gestionar la caja",
        "NO_SELECTION_DESC": "Monitorea pedidos en tiempo real y finaliza tickets.",
        "ADD_MENU_ITEM": "Añadir Producto del Menú",
        "CANCEL": "Cancelar",
        "ADD_CUSTOM_LINE": "Añadir Línea Personalizada",
        "CUSTOM_NAME": "Nombre del servicio/producto",
        "CUSTOM_NAME_PH": "Ej: Servicio extra, Descorche, etc.",
        "PRICE": "Precio (€)",
        "ADD": "Añadir",
        "TOTAL_SIMPLE": "TOTAL",
        "PAYMENT": "Cobrar"
    },
    "KDS": {
        "SUBTITLE": "Gestión de comandas y estado de preparación.",
        "ORDERS": "Pedidos",
        "SYNCING": "Sincronizando cocina...",
        "CANCELLED": "ANULADO",
        "EMPTY_TITLE": "Cocina en calma",
        "EMPTY_DESC": "No hay pedidos pendientes en este momento.",
        "AVAILABILITY": "Disponibilidad de Productos"
    },
    "USER_MGMT": {
        "SYSTEM_ROLE": "Rol del sistema:",
        "ACCESS_DATA": "Datos de Acceso",
        "USERNAME": "Nombre de Usuario",
        "NEW_PASS": "Nueva Contraseña",
        "OPTIONAL": "(Opcional)",
        "PRINT_CONFIG": "Configuración de Impresión",
        "DEF_PRINTER": "Impresora Predeterminada",
        "NO_PRINTER_T": "Ninguna (Usar sistema)",
        "HEADER_MSG": "Mensaje de Cabecera",
        "HEADER_PH": "Ej: C/ Falsa 123... (Tel: 555-0123)",
        "FOOTER_MSG": "Mensaje de Pie",
        "FOOTER_PH": "Ej: ¡Gracias por su visita!",
        "SAVE": "Guardar Cambios",
        "SUBTITLE": "Crea y gestiona cuentas con roles específicos (KDS, POS, Admin).",
        "LOADING": "Cargando usuarios...",
        "NO_PRINTER": "Sin impresora asignada"
    },
    "SIDEBAR": {
        "MAIN": "Principal",
        "WAITER": "Camarero",
        "OPERATIONS": "Operaciones",
        "TOTEMS": "Tótems",
        "THEME": "Tema",
        "DASHBOARD": "Panel",
        "USERS": "Usuarios",
        "CASHIER": "Caja",
        "KITCHEN": "Cocina",
        "MENU": "Menú",
        "CONFIG": "Configuración"
    }
};

const STRINGS_EN = {
    "POS": {
        "TITLE": "Point of Sale",
        "SUBTITLE": "Management of orders, payments, and active tables.",
        "TABLES": "TABLES",
        "HISTORY": "HISTORY",
        "EDIT_MODE": "Edit Mode Active",
        "EDIT": "Edit",
        "DONE": "Done",
        "SPLIT": "Split",
        "BREAKDOWN": "Breakdown by Diners",
        "CUSTOM_ITEM": "Custom",
        "BASE_PRICE": "Tax Base",
        "VAT": "VAT",
        "VAT_WARNING": "⚠️ VAT not configured",
        "VAT_HINT": "Configure VAT in Settings to generate receipts.",
        "TOTAL_TIP": "TOTAL WITH TIP",
        "EMPTY_TITLE": "Empty Table",
        "EMPTY_DESC": "has no active session.",
        "OPEN_TABLE": "Open Table (Manual)",
        "NO_SELECTION_TITLE": "Select a table to manage checkout",
        "NO_SELECTION_DESC": "Monitor orders in real-time and finalize receipts.",
        "ADD_MENU_ITEM": "Add Menu Item",
        "CANCEL": "Cancel",
        "ADD_CUSTOM_LINE": "Add Custom Line",
        "CUSTOM_NAME": "Service/product name",
        "CUSTOM_NAME_PH": "E.g., Extra service, Corkage, etc.",
        "PRICE": "Price (€)",
        "ADD": "Add",
        "TOTAL_SIMPLE": "TOTAL",
        "PAYMENT": "Pay"
    },
    "KDS": {
        "SUBTITLE": "Order management and preparation status.",
        "ORDERS": "Orders",
        "SYNCING": "Syncing kitchen...",
        "CANCELLED": "CANCELLED",
        "EMPTY_TITLE": "Calm kitchen",
        "EMPTY_DESC": "No pending orders at the moment.",
        "AVAILABILITY": "Product Availability"
    },
    "USER_MGMT": {
        "SYSTEM_ROLE": "System role:",
        "ACCESS_DATA": "Access Data",
        "USERNAME": "Username",
        "NEW_PASS": "New Password",
        "OPTIONAL": "(Optional)",
        "PRINT_CONFIG": "Print Configuration",
        "DEF_PRINTER": "Default Printer",
        "NO_PRINTER_T": "None (Use system)",
        "HEADER_MSG": "Header Message",
        "HEADER_PH": "E.g.: 123 Fake St... (Tel: 555-0123)",
        "FOOTER_MSG": "Footer Message",
        "FOOTER_PH": "E.g.: Thank you for your visit!",
        "SAVE": "Save Changes",
        "SUBTITLE": "Create and manage accounts with specific roles (KDS, POS, Admin).",
        "LOADING": "Loading users...",
        "NO_PRINTER": "No printer assigned"
    },
    "SIDEBAR": {
        "MAIN": "Main",
        "WAITER": "Waiter",
        "OPERATIONS": "Operations",
        "TOTEMS": "Totems",
        "THEME": "Theme",
        "DASHBOARD": "Dashboard",
        "USERS": "Users",
        "CASHIER": "Cashier",
        "KITCHEN": "Kitchen",
        "MENU": "Menu",
        "CONFIG": "Settings"
    }
};

try {
    let esData = JSON.parse(fs.readFileSync('frontend/src/assets/i18n/es.json'));
    let enData = JSON.parse(fs.readFileSync('frontend/src/assets/i18n/en.json'));

    // Merge deeply
    esData.POS = { ...esData.POS, ...STRINGS_ES.POS };
    esData.KDS = { ...esData.KDS, ...STRINGS_ES.KDS };
    esData.USER_MGMT = { ...esData.USER_MGMT, ...STRINGS_ES.USER_MGMT };
    esData.SIDEBAR = { ...esData.SIDEBAR, ...STRINGS_ES.SIDEBAR };

    enData.POS = { ...enData.POS, ...STRINGS_EN.POS };
    enData.KDS = { ...enData.KDS, ...STRINGS_EN.KDS };
    enData.USER_MGMT = { ...enData.USER_MGMT, ...STRINGS_EN.USER_MGMT };
    enData.SIDEBAR = { ...enData.SIDEBAR, ...STRINGS_EN.SIDEBAR };

    fs.writeFileSync('frontend/src/assets/i18n/es.json', JSON.stringify(esData, null, 2));
    fs.writeFileSync('frontend/src/assets/i18n/en.json', JSON.stringify(enData, null, 2));
    console.log("Translation files updated part 4.");
} catch (e) {
    console.error(e);
}
