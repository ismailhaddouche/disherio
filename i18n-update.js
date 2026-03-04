const fs = require('fs');

const STRINGS_ES = {
    "DASHBOARD": {
        "UPS": "Ups! Algo salió mal",
        "RETRY": "Reintentar",
        "ACTIVE_ORDERS": "Pedidos Activos",
        "DAILY_REVENUE": "Ingresos Hoy",
        "SYS_STATUS": "Estado del Sistema",
        "ERROR_CONN": "Error Conexión",
        "OPERATIONAL": "Operativo",
        "TOTEM_MGT": "Gestión de Tótems Dinámicos",
        "TOTEM_DESC": "Identificadores incrementales para tus mesas.",
        "ADD_TOTEM": "Añadir Nuevo Tótem",
        "VIEW_QR": "Ver QR",
        "EDIT": "Editar",
        "DELETE": "Eliminar",
        "NO_TOTEMS": "No hay tótems configurados.",
        "EDIT_TOTEM": "Editar Tótem",
        "TOTEM_NAME": "Nombre del Tótem / Mesa",
        "CANCEL": "Cancelar",
        "SAVE": "Guardar Cambios",
        "REALTIME": "Pedidos en Tiempo Real",
        "SYNCING": "Sincronizando órdenes...",
        "COMPLETE": "Completar",
        "NO_ORDERS": "No hay pedidos registrados hoy.",
        "ACTIVITY_LOG": "Registro de Actividad",
        "NO_ACTIVITY": "No hay actividad registrada."
    },
    "ROLES": {
        "admin": "Administrador",
        "kitchen": "Cocina",
        "pos": "Caja",
        "customer": "Cliente",
        "waiter": "Camarero",
        "Kitchen": "Cocina",
        "Table": "Mesa",
        "Menu": "Menú",
        "Cashier": "Caja"
    },
    "KDS": {
        "TITLE": "Cocina (KDS)",
        "PENDING": "Pendientes",
        "PREPARING": "En Preparación",
        "READY": "Listos",
        "MARK_PREPARING": "Preparar",
        "MARK_READY": "Listo",
        "MARK_SERVED": "Servir"
    },
    "POS": {
        "TITLE": "Terminal de Venta (TPV)",
        "ORDERS": "Pedidos de Mesas",
        "PAYMENT": "Pago"
    }
};

const STRINGS_EN = {
    "DASHBOARD": {
        "UPS": "Oops! Something went wrong",
        "RETRY": "Retry",
        "ACTIVE_ORDERS": "Active Orders",
        "DAILY_REVENUE": "Daily Revenue",
        "SYS_STATUS": "System Status",
        "ERROR_CONN": "Connection Error",
        "OPERATIONAL": "Operational",
        "TOTEM_MGT": "Dynamic Totems Management",
        "TOTEM_DESC": "Incremental identifiers for your tables.",
        "ADD_TOTEM": "Add New Totem",
        "VIEW_QR": "View QR",
        "EDIT": "Edit",
        "DELETE": "Delete",
        "NO_TOTEMS": "No totems configured.",
        "EDIT_TOTEM": "Edit Totem",
        "TOTEM_NAME": "Totem / Table Name",
        "CANCEL": "Cancel",
        "SAVE": "Save Changes",
        "REALTIME": "Real-time Orders",
        "SYNCING": "Syncing orders...",
        "COMPLETE": "Complete",
        "NO_ORDERS": "No orders registered today.",
        "ACTIVITY_LOG": "Activity Log",
        "NO_ACTIVITY": "No activity registered."
    },
    "ROLES": {
        "admin": "Administrator",
        "kitchen": "Kitchen",
        "pos": "Cashier",
        "customer": "Customer",
        "waiter": "Waiter",
        "Kitchen": "Kitchen",
        "Table": "Table",
        "Menu": "Menu",
        "Cashier": "Cashier"
    },
    "KDS": {
        "TITLE": "Kitchen Display System",
        "PENDING": "Pending",
        "PREPARING": "Preparing",
        "READY": "Ready",
        "MARK_PREPARING": "Prepare",
        "MARK_READY": "Ready",
        "MARK_SERVED": "Serve"
    },
    "POS": {
        "TITLE": "Point of Sale (POS)",
        "ORDERS": "Table Orders",
        "PAYMENT": "Payment"
    }
};

const esData = JSON.parse(fs.readFileSync('frontend/src/assets/i18n/es.json'));
const enData = JSON.parse(fs.readFileSync('frontend/src/assets/i18n/en.json'));

Object.assign(esData, STRINGS_ES);
Object.assign(enData, STRINGS_EN);

fs.writeFileSync('frontend/src/assets/i18n/es.json', JSON.stringify(esData, null, 2));
fs.writeFileSync('frontend/src/assets/i18n/en.json', JSON.stringify(enData, null, 2));

console.log("Translation files updated.");
