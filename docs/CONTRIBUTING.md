# Guía de Contribución — Disher.io

> **English version:** [CONTRIBUTING_EN.md](./CONTRIBUTING_EN.md)

¡Gracias por tu interés en contribuir a Disher.io! Este documento establece las directrices para colaborar de forma efectiva en el proyecto.

---

## Código de Conducta

Al participar en este proyecto, te comprometes a mantener un entorno respetuoso y constructivo. No se tolerará ningún tipo de acoso, discriminación o comportamiento tóxico.

---

## Cómo Contribuir

### 1. Reportar un Bug

Abre un **Issue** en GitHub con la etiqueta `bug` e incluye:

- Descripción clara del problema.
- Pasos para reproducirlo.
- Comportamiento esperado vs. comportamiento actual.
- Capturas de pantalla o logs relevantes.
- Entorno: sistema operativo, arquitectura (AMD64/ARM64), versión de Docker.

### 2. Proponer una Mejora

Abre un **Issue** con la etiqueta `enhancement` describiendo:

- El problema o limitación actual.
- Tu propuesta de solución.
- Alternativas que hayas considerado.

### 3. Enviar un Pull Request

1. **Haz un fork** del repositorio.
2. **Crea una rama** desde `main` con un nombre descriptivo:
   ```bash
   git checkout -b feat/nombre-de-la-feature
   git checkout -b fix/descripcion-del-bug
   ```
3. Realiza tus cambios siguiendo las convenciones del proyecto (ver abajo).
4. **Asegúrate de que los tests pasan** antes de enviar.
5. Abre un **Pull Request** contra `main` con una descripción clara de los cambios.

---

## Configuración del Entorno de Desarrollo

### Requisitos

- **Node.js** >= 20
- **Docker** >= 24.0.0 y **Docker Compose** >= 2.20.0
- **Git**

### Instalación Local

```bash
# Clonar el repositorio
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Backend
cd backend
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npx ng serve
```

### Ejecutar Tests

```bash
# Tests del backend (Jest + mongodb-memory-server)
cd backend
npm test
```

---

## Convenciones de Código

### Estilo General

- **Lenguaje**: TypeScript en todo el proyecto (frontend y backend).
- **Indentación**: 4 espacios.
- **Comillas**: simples (`'`) en TypeScript/JavaScript.
- **Punto y coma**: obligatorio.
- **Ancho máximo de línea**: 100 caracteres (Prettier).

### Frontend (Angular 21)

- Usar **Signals** para gestión de estado reactivo (no RxJS para estado local).
- Componentes **standalone** — no usar `NgModule`.
- Separar lógica en **ViewModels** (`*.viewmodel.ts`) y mantener los componentes ligeros.
- Todas las cadenas visibles al usuario deben usar **ngx-translate** (`| translate` en templates, `translate.instant()` en código).
- Añadir las claves de traducción en **ambos** archivos: `es.json` y `en.json`.
- Seguir el sistema de diseño **Material Design 3** con las clases CSS del proyecto (`md-*`, `btn-primary`, `text-*`).

### Backend (Node.js + Express 5)

- **ESModules** (`import/export`), no CommonJS.
- Linting con **ESLint**: ejecutar `npm run lint` antes de enviar cambios.
- Usar **control de concurrencia optimista** (`__v`) para operaciones de escritura en MongoDB.
- Todas las rutas deben manejar errores y devolver respuestas HTTP consistentes.

### Commits

Seguimos la convención **Conventional Commits**:

```
tipo(alcance): descripción breve

Ejemplos:
feat(pos): add split payment by equal parts
fix(kds): prevent duplicate order updates
docs(readme): update firewall section with port 443
refactor(auth): simplify JWT validation middleware
style(store-config): align form grid spacing
test(api): add integration tests for order endpoints
```

**Tipos permitidos**: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`, `perf`, `ci`.

---

## Estructura del Proyecto

```
disherio/
├── frontend/          # Angular 21 (Signals, standalone components)
│   └── src/
│       ├── app/
│       │   ├── components/   # Módulos funcionales (dashboard, pos, kds...)
│       │   ├── services/     # Servicios compartidos
│       │   └── core/         # Constantes, guards, interceptors
│       └── assets/i18n/      # Traducciones (es.json, en.json)
├── backend/           # Node.js 20 + Express 5 + MongoDB
│   └── src/
│       ├── routes/           # Endpoints REST
│       ├── models/           # Esquemas Mongoose
│       └── middleware/       # Auth, error handling
├── docs/              # Documentación técnica
├── install.sh         # Instalador automatizado
├── show-dns.sh        # Consulta de registros DNS
├── backup.sh          # Script de backups
├── docker-compose.prod.yml
├── Caddyfile          # Configuración del proxy inverso
└── .env.example       # Variables de entorno de referencia
```

---

## Internacionalización (i18n)

Disher.io soporta **español** e **inglés**. Si añades texto visible al usuario:

1. Añade la clave en `frontend/src/assets/i18n/es.json`.
2. Añade la traducción equivalente en `frontend/src/assets/i18n/en.json`.
3. Usa `{{ 'SECCION.CLAVE' | translate }}` en templates o `this.translate.instant('SECCION.CLAVE')` en código.

**No dejes cadenas hardcodeadas** en los templates.

---

## Pull Request Checklist

Antes de enviar tu PR, verifica:

- [ ] El código compila sin errores: `npx ng build --configuration=production`
- [ ] Los tests del backend pasan: `cd backend && npm test`
- [ ] No hay warnings de linting: `cd backend && npm run lint`
- [ ] Las traducciones están en ambos idiomas (es/en).
- [ ] Los commits siguen la convención Conventional Commits.
- [ ] La descripción del PR explica claramente qué cambia y por qué.

---

## Licencia

Al contribuir a Disher.io, aceptas que tus contribuciones se distribuirán bajo la misma licencia **MIT** del proyecto.
