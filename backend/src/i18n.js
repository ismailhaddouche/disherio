import i18n from 'i18next';
import middleware from 'i18next-http-middleware';
import es from './locales/es.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };

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

export { i18n, middleware };
