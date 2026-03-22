# Contexto del Proyecto Disherio - Hito Hackathon

## Estado del Proyecto: **Production-Ready** 🚀
El sistema ha completado su fase de refactorización integral y está optimizado para su despliegue en la Hackathon. Se han implementado estándares de arquitectura limpia y reactividad moderna.

## Resumen de Refactorizaciones y Mejoras

### 1. Backend: Clean Architecture & Robustez
- **Arquitectura Limpia**: Transición hacia una estructura de capas (Entidades, Casos de Uso, Controladores y Adaptadores) para mejorar la testabilidad y el mantenimiento.
- **Validación Estricta**: Implementación de Joi para la validación de esquemas en todos los puntos de entrada.
- **Gestión de Errores**: Middleware centralizado para respuestas uniformes y auditoría automática de fallos.
- **Base de Datos**: Esquemas de Mongoose optimizados con índices para alto rendimiento y soporte nativo para transacciones.

### 2. Frontend: Angular 21 & Reactividad (Signals)
- **Signals API**: Sustitución de flujos complejos de RxJS por Angular Signals para una gestión de estado más eficiente y predecible.
- **Arquitectura ViewModel**: Separación clara entre la lógica de vista (`.viewmodel.ts`) y los componentes visuales (`.ts` / `.html`).
- **Rendimiento**: Componentes `standalone` y carga diferida (Lazy Loading) optimizada para tiempos de carga mínimos.

### 3. UI/UX: Material Design 3 (MD3)
- **Diseño Moderno**: Implementación de componentes basados en MD3 para una interfaz táctil amigable (POS-ready).
- **Tematización Dinámica**: Soporte completo para modo oscuro/claro y paletas de colores accesibles.
- **Iconografía**: Uso de `lucide-angular` para una estética limpia y consistente.

### 4. Infraestructura y CI/CD
- **Dockerización Avanzada**: Imágenes multi-stage optimizadas. Soporte nativo para Raspberry Pi (`docker-compose.rpi.yml`) y producción (`docker-compose.prod.yml`).
- **Pipeline CI/CD**: Automatización de pruebas unitarias e integración en cada commit/PR.
- **Reverse Proxy**: Caddy v2 gestionando TLS automático y compresión de assets.

### 5. Calidad y QA
- **Cobertura de Tests**: Suite de pruebas con Jest (Backend) y Vitest (Frontend) validando flujos críticos (Checkout, Concurrencia, Auth).
- **Estándares de Código**: ESLint y Prettier configurados para mantener la consistencia en el equipo.
- **Auditoría**: Logs de actividad detallados para trazabilidad completa de operaciones en el POS.

## Decisiones Técnicas Clave
- **Sincronización en Tiempo Real**: Socket.io se mantiene como el núcleo para KDS y POS para garantizar latencia mínima.
- **Arquitectura Offline-First (Parcial)**: Estrategias de caché en frontend para resiliencia ante cortes de red.
- **I18n nativo**: Soporte multilingüe desde el núcleo para escalabilidad internacional.

## Reglas del PM/Tech Lead
- Todo código nuevo debe pasar la suite de tests (QA) antes de fusionarse.
- Uso obligatorio de `gh pr create` para proponer cambios significativos.
- Documentar hitos clave en Engram para persistencia de contexto.
