const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'backend', 'src', 'locales');
const esPath = path.join(localesDir, 'es.json');
const enPath = path.join(localesDir, 'en.json');

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const newTranslations = {
    ERRORS: {
        USER_NOT_FOUND: "Usuario no encontrado",
        ACCESS_DENIED_ADMIN: "Acceso denegado: Se requiere rol de administrador",
        USERNAME_IN_USE: "El nombre de usuario ya está en uso",
        SOURCE_USER_NOT_FOUND: "Usuario origen no encontrado",
        TARGET_USER_NOT_FOUND: "Usuario destino no encontrado",
        NO_IMAGE_PROVIDED: "No se proporcionó imagen",
        DUPLICATE_TOTEM_NAME: "Ya existe un tótem con ese nombre",
        RESTAURANT_NOT_FOUND: "Restaurante no encontrado",
        TOTEM_NOT_FOUND: "Tótem no encontrado",
        TICKET_NOT_FOUND: "Ticket no encontrado",
        ORDER_NOT_FOUND: "Pedido no encontrado",
        ITEM_NOT_FOUND: "Artículo no encontrado",
        NO_VALID_FIELDS: "No se proporcionaron campos válidos para actualizar",
        INVALID_CREDENTIALS: "Credenciales inválidas o incorrectas",
        LOGGED_OUT: "Sesión cerrada correctamente"
    },
    AUTH: {
        REQ_USERNAME: "El nombre de usuario es obligatorio",
        REQ_PASSWORD: "La contraseña es obligatoria",
        REQ_SLUG: "El identificador del restaurante es obligatorio",
        REQ_TOTEM: "El ID del tótem es obligatorio",
        REQ_GUEST: "El nombre del invitado es obligatorio"
    }
};

const newTranslationsEn = {
    ERRORS: {
        USER_NOT_FOUND: "User not found",
        ACCESS_DENIED_ADMIN: "Access denied: Administrator role required",
        USERNAME_IN_USE: "Username already in use",
        SOURCE_USER_NOT_FOUND: "Source user not found",
        TARGET_USER_NOT_FOUND: "Target user not found",
        NO_IMAGE_PROVIDED: "No image provided",
        DUPLICATE_TOTEM_NAME: "A totem with that name already exists",
        RESTAURANT_NOT_FOUND: "Restaurant not found",
        TOTEM_NOT_FOUND: "Totem not found",
        TICKET_NOT_FOUND: "Ticket not found",
        ORDER_NOT_FOUND: "Order not found",
        ITEM_NOT_FOUND: "Item not found",
        NO_VALID_FIELDS: "No valid fields provided for update",
        INVALID_CREDENTIALS: "Invalid credentials",
        LOGGED_OUT: "Logged out successfully"
    },
    AUTH: {
        REQ_USERNAME: "Username is required",
        REQ_PASSWORD: "Password is required",
        REQ_SLUG: "Restaurant slug is required",
        REQ_TOTEM: "Totem ID is required",
        REQ_GUEST: "Guest name is required"
    }
};

if (!esData.ERRORS) esData.ERRORS = {};
if (!esData.AUTH) esData.AUTH = {};
Object.assign(esData.ERRORS, newTranslations.ERRORS);
Object.assign(esData.AUTH, newTranslations.AUTH);

if (!enData.ERRORS) enData.ERRORS = {};
if (!enData.AUTH) enData.AUTH = {};
Object.assign(enData.ERRORS, newTranslationsEn.ERRORS);
Object.assign(enData.AUTH, newTranslationsEn.AUTH);

fs.writeFileSync(esPath, JSON.stringify(esData, null, 4));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

const routesDir = path.join(__dirname, 'backend', 'src', 'routes');

const replacements = [
    { target: /'User not found'/g, replace: "req.t('ERRORS.USER_NOT_FOUND')" },
    { target: /'Acceso denegado: Se requiere rol de administrador'/g, replace: "req.t('ERRORS.ACCESS_DENIED_ADMIN')" },
    { target: /'Username already in use'/g, replace: "req.t('ERRORS.USERNAME_IN_USE')" },
    { target: /'Source user not found'/g, replace: "req.t('ERRORS.SOURCE_USER_NOT_FOUND')" },
    { target: /'Target user not found'/g, replace: "req.t('ERRORS.TARGET_USER_NOT_FOUND')" },
    { target: /'No image provided'/g, replace: "req.t('ERRORS.NO_IMAGE_PROVIDED')" },
    { target: /'Ya existe un tótem con ese nombre'/g, replace: "req.t('ERRORS.DUPLICATE_TOTEM_NAME')" },
    { target: /'Ya existe otro tótem con ese nombre'/g, replace: "req.t('ERRORS.DUPLICATE_TOTEM_NAME')" },
    { target: /'Restaurant not found'/g, replace: "req.t('ERRORS.RESTAURANT_NOT_FOUND')" },
    { target: /'Totem not found'/g, replace: "req.t('ERRORS.TOTEM_NOT_FOUND')" },
    { target: /'Ticket not found'/g, replace: "req.t('ERRORS.TICKET_NOT_FOUND')" },
    { target: /'Order not found'/g, replace: "req.t('ERRORS.ORDER_NOT_FOUND')" },
    { target: /'Item not found'/g, replace: "req.t('ERRORS.ITEM_NOT_FOUND')" },
    { target: /'No valid fields provided for update'/g, replace: "req.t('ERRORS.NO_VALID_FIELDS')" },
    { target: /'Invalid credentials'/g, replace: "req.t('ERRORS.INVALID_CREDENTIALS')" },
    { target: /'Logged out successfully'/g, replace: "req.t('ERRORS.LOGGED_OUT')" }
];

const files = fs.readdirSync(routesDir);
for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    for (const r of replacements) {
        content = content.replace(r.target, r.replace);
    }

    // express-validator replacements mapping
    const valReplacements = [
        { target: /'Username is required'/g, replace: "(value, { req }) => req.t('AUTH.REQ_USERNAME')" },
        { target: /'Password is required'/g, replace: "(value, { req }) => req.t('AUTH.REQ_PASSWORD')" },
        { target: /'Restaurant slug is required'/g, replace: "(value, { req }) => req.t('AUTH.REQ_SLUG')" },
        { target: /'Totem ID is required'/g, replace: "(value, { req }) => req.t('AUTH.REQ_TOTEM')" },
        { target: /'Guest name is required'/g, replace: "(value, { req }) => req.t('AUTH.REQ_GUEST')" }
    ];
    for (const v of valReplacements) {
        content = content.replace(v.target, v.replace);
    }

    fs.writeFileSync(filePath, content);
}

console.log("Backend routes updated successfully.");
