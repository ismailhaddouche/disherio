const fs = require('fs');

const STRINGS_ES = {
    "CHECKOUT": {
        "BACK": "← Botón Volver",
        "TITLE": "Finalizar Cuenta",
        "CALCULATING": "Calculando costes...",
        "NO_ACCOUNT": "No hay una cuenta activa para esta mesa.",
        "BACK_TO_MENU": "Volver a la carta",
        "MODE_TOTAL": "Total",
        "MODE_INDIVIDUAL": "Comensal",
        "MODE_EQUITATIVE": "Equitativo",
        "TOTAL_PAY": "Total a Pagar",
        "BREAKDOWN_USER": "Desglose por Comensal",
        "EQUITATIVE_PARTS": "A partes iguales",
        "EQUITATIVE_HELPER": "Cada persona paga una parte proporcional de la cuenta total.",
        "PROCEED_PAY": "Proceder al Pago",
        "PERS": "pers."
    },
    "CUSTOMER": {
        "CONNECTING": "Conectando con la mesa...",
        "HELLO": "¡Hola!",
        "HOW_TO_CALL": "¿Cómo prefieres que te llamemos?",
        "YOUR_NAME": "Tu nombre...",
        "START_ORDERING": "Comenzar a pedir",
        "TOTEM_ASSIGNED": "Tótem asignado:",
        "IN_SESSION": "En Sesión",
        "MY_ACCOUNT": "Mi Cuenta",
        "TIME_TO_EAT": "¡Hora de comer! 👋",
        "ADD_TO_CART_INFO": "Añade tus platos al carrito global. <br>Tus elecciones quedarán marcadas a tu nombre.",
        "FROM": "Desde",
        "SOLD_OUT": "AGOTADO",
        "CUSTOMIZE_ORDER": "Personaliza tu pedido",
        "SELECT_OPTION": "Selecciona una opción",
        "EXTRAS_OPTIONAL": "Extras (Opcional)",
        "ADD_TO_CART": "Añadir al carrito",
        "YOUR_ORDER": "Vuestra Comanda",
        "IN_KITCHEN": "En Cocina",
        "RECEIVED": "Recibido",
        "ON_FIRE": "En Fuego",
        "SERVED": "Servido",
        "COMPLETED": "Completado",
        "TOTAL_ACCUMULATED": "Total acumulado:",
        "NEW_CHOICES": "Tus nuevas elecciones",
        "CART_SUBTITLE": "Pulsa \"Pedir Ahora\" para enviar estos platos a la cocina.",
        "YOU": "Tú",
        "DISHES": "platos",
        "TOTAL": "Total",
        "ORDER_NOW": "Pedir Ahora"
    },
    "LOGIN": {
        "ACCESS_TERMINAL": "Acceso a Terminal de Gestión",
        "USER": "Usuario",
        "USER_PLACEHOLDER": "ej: cocina",
        "PASSWORD": "Contraseña",
        "AUTHENTICATING": "AUTENTICANDO...",
        "ENTER_SYSTEM": "ENTRAR AL SISTEMA",
        "ERROR_CREDS": "Credenciales incorrectas o red no disponible.",
        "ERROR_SYSTEM": "Error en el sistema. Inténtalo más tarde."
    }
};

const STRINGS_EN = {
    "CHECKOUT": {
        "BACK": "← Back",
        "TITLE": "Checkout",
        "CALCULATING": "Calculating costs...",
        "NO_ACCOUNT": "No active account for this table.",
        "BACK_TO_MENU": "Back to menu",
        "MODE_TOTAL": "Total",
        "MODE_INDIVIDUAL": "Individual",
        "MODE_EQUITATIVE": "Equitable",
        "TOTAL_PAY": "Total to Pay",
        "BREAKDOWN_USER": "Breakdown by User",
        "EQUITATIVE_PARTS": "Equal parts",
        "EQUITATIVE_HELPER": "Each person pays a proportional part of the total bill.",
        "PROCEED_PAY": "Proceed to Payment",
        "PERS": "pers."
    },
    "CUSTOMER": {
        "CONNECTING": "Connecting to the table...",
        "HELLO": "Hello!",
        "HOW_TO_CALL": "How should we call you?",
        "YOUR_NAME": "Your name...",
        "START_ORDERING": "Start Ordering",
        "TOTEM_ASSIGNED": "Assigned Totem:",
        "IN_SESSION": "In Session",
        "MY_ACCOUNT": "My Account",
        "TIME_TO_EAT": "Time to eat! 👋",
        "ADD_TO_CART_INFO": "Add your dishes to the global cart. <br>Your choices will be marked under your name.",
        "FROM": "From",
        "SOLD_OUT": "SOLD OUT",
        "CUSTOMIZE_ORDER": "Customize your order",
        "SELECT_OPTION": "Select an option",
        "EXTRAS_OPTIONAL": "Extras (Optional)",
        "ADD_TO_CART": "Add to cart",
        "YOUR_ORDER": "Your Order",
        "IN_KITCHEN": "In Kitchen",
        "RECEIVED": "Received",
        "ON_FIRE": "Preparing",
        "SERVED": "Served",
        "COMPLETED": "Completed",
        "TOTAL_ACCUMULATED": "Accumulated total:",
        "NEW_CHOICES": "Your new choices",
        "CART_SUBTITLE": "Press 'Order Now' to send these dishes to the kitchen.",
        "YOU": "You",
        "DISHES": "dishes",
        "TOTAL": "Total",
        "ORDER_NOW": "Order Now"
    },
    "LOGIN": {
        "ACCESS_TERMINAL": "Management Terminal Access",
        "USER": "User",
        "USER_PLACEHOLDER": "e.g., kitchen",
        "PASSWORD": "Password",
        "AUTHENTICATING": "AUTHENTICATING...",
        "ENTER_SYSTEM": "ENTER SYSTEM",
        "ERROR_CREDS": "Invalid credentials or network unavailable.",
        "ERROR_SYSTEM": "System error. Try again later."
    }
};

try {
    const esData = JSON.parse(fs.readFileSync('frontend/src/assets/i18n/es.json'));
    const enData = JSON.parse(fs.readFileSync('frontend/src/assets/i18n/en.json'));

    Object.assign(esData, STRINGS_ES);
    Object.assign(enData, STRINGS_EN);

    fs.writeFileSync('frontend/src/assets/i18n/es.json', JSON.stringify(esData, null, 2));
    fs.writeFileSync('frontend/src/assets/i18n/en.json', JSON.stringify(enData, null, 2));
    console.log("Translation files updated.");
} catch (e) {
    console.error(e);
}
