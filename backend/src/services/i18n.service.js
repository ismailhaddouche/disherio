import es from '../locales/es.json' with { type: 'json' };

/**
 * Simple translation service to replace i18next.
 * Currently supports only Spanish as the primary language.
 */
export const t = (key, params = {}) => {
    if (!key) return '';

    // Split keys like 'ERRORS.USER_NOT_FOUND'
    const parts = key.split('.');
    let value = es;

    for (const part of parts) {
        if (value && value[part]) {
            value = value[part];
        } else {
            // Fallback if key not found
            return key;
        }
    }

    if (typeof value !== 'string') return key;

    // Basic parameter interpolation: {{param}}
    let translated = value;
    Object.keys(params).forEach(p => {
        translated = translated.replace(new RegExp(`{{${p}}}`, 'g'), params[p]);
    });

    return translated;
};

export const i18nMiddleware = (req, res, next) => {
    req.t = t;
    next();
};
