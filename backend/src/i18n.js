const i18n = require('i18next');
const middleware = require('i18next-http-middleware');
const es = require('./locales/es.json');
const en = require('./locales/en.json');

i18n
    .use(middleware.LanguageDetector)
    .init({
        preload: ['es', 'en'],
        fallbackLng: 'es',
        resources: {
            es: { translation: es },
            en: { translation: en }
        },
        detection: {
            // Configuraciones para detectar por query, header (Accept-Language), cookie, etc.
            order: ['querystring', 'cookie', 'header'],
            caches: ['cookie']
        }
    });

module.exports = { i18n, middleware };
