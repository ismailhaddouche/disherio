# Testing y CI/CD en Disher.io

Este documento describe la estrategia de pruebas automatizadas y los flujos de Integración y Despliegue Continuo (CI/CD) configurados para el proyecto.

---

## 1. Pruebas Automatizadas (Testing)

El backend de Disher.io cuenta con una suite de pruebas de integración y unitarias basada en **Jest** y **Supertest**. 

Dado que la aplicación gestiona pedidos, facturación e inventario, asegurar la integridad del código es crítico.

### 1.1 Entorno de Pruebas
- **Framework:** `Jest` (con soporte explícito para ECMAScript Modules `export/import`).
- **Peticiones HTTP:** `Supertest` para levantar la API en memoria y atacar los diferentes endpoints.
- **Base de Datos EFÍMERA:** Se utiliza `mongodb-memory-server`. Es un binario de MongoDB que se ejecuta en la RAM temporalmente, garantizando que:
  1. Los tests no sobrescriban la base de datos de desarrollo local.
  2. Todas las pruebas partan de una base de datos 100% en blanco.
  3. No se requiera tener Docker ni Mongo instalado localmente solo para probar.

### 1.2 Ejecutar las Pruebas Localmente

Para correr la suite de pruebas completa:

```bash
cd backend
npm install
npm test
```

Por debajo, el script `test` del `package.json` inyecta las banderas necesarias de Node.js para soportar los Módulos de ES:
`cross-env NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit --detectOpenHandles`

### 1.3 Estructura de los Tests
Los tests se encuentran en el directorio `backend/src/__tests__/`. Todas las rutas protegidas simulan primero un inicio de sesión (`/api/auth/login`) para obtener un token JWT válido (usando la cookie `disher_token`) e inyectarla con Supertest en las peticiones subsecuentes.

---

## 2. GitHub Actions (CI/CD)

Disher.io hace uso intensivo de **GitHub Actions** (`.github/workflows/`) para automatizar compilaciones multiplataforma y la empaquetación de instaladores.

### 2.1 Compilación de Imágenes Docker (`docker-build.yml`)

Este pipeline se lanza automáticamente y se encarga de empaquetar el código fuente en contenedores Docker de producción.

- **Cuándo se ejecuta:** Al hacer `push` en las ramas `main` o `develop`, al pushear un tag (ej. `v2.6`), o en Pull Requests dirigidos a `main`.
- **Qué hace:**
  1. Clona el repositorio y prepara Buildx.
  2. Ejecuta un job `build-amd64` (matriz `frontend`/`backend`) para construir imágenes `linux/amd64`.
  3. Ejecuta un job `build-arm64` (matriz `frontend`/`backend`) para construir imágenes `linux/arm64` de forma aislada (con QEMU en este job).
  4. Publica tags por arquitectura (`-amd64` y `-arm64`) y, en `push`, crea un manifiesto multi-arch final con `docker buildx imagetools`.
  5. Ejecuta además jobs de `test`, `security-scan` y `notify` para validar calidad y estado global del pipeline.

> **Nota para Pull Requests:** En PRs se compilan las imágenes para validar build, pero no se publica manifiesto multi-arquitectura ni push final al registro.

> **Importante:** La alerta temporal de GitHub sobre que ciertas actions se ejecutan en "Node 20 vs Node 24" es una advertencia propia de las librerías oficiales de Docker (acciones de terceros), no un problema de seguridad en el código puro de Disher.io.

### 2.2 Generación del Instalador Offline (`build-installer.yml`)

Este pipeline es **Manual** (`workflow_dispatch`). Esta diseñado para empaquetar todo el ecosistema de Disher en un único archivo comprimido `.tar.gz`, listo para llevarse en un pendrive USB a un restaurante que no tenga acceso a internet en el momento de la instalación.

- **Cómo se ejecuta:** Desde la pestaña "Actions" en GitHub -> Click en "Build Offline Installer" -> "Run workflow".
- **Opciones:** Permite elegir si generar el instalador para `linux/amd64` o `linux/arm64`.
- **Qué hace:**
  1. Compila el frontend y el backend de forma local en los servidores de GitHub.
  2. Descarga localmente las imágenes de `mongo:7` y `caddy:2`.
  3. Ejecuta `docker save` para volcar las 4 imágenes requeridas dentro de un archivo `images.tar` gigante.
  4. Genera automáticamente el fichero `docker-compose.yml` final de producción.
  5. Copia los scripts `install.sh` y `configure.sh`.
  6. Comprime todo en un archivo (ej: `disher-setup-linux-amd64.tar.gz`) que queda disponible para **Descargar** en la misma página de la ejecución durante 30 días.
