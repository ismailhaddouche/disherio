# Guía de Inicio Rápido de Disher.io v2.6

Esta guía te permitirá tener una plataforma de restaurante funcional en menos de 5 minutos.

---

## Prerrequisitos

- Un servidor o dispositivo con al menos 1GB de RAM.
- **Docker (v24+)** y **Docker Compose (v2.x)**.
- Git para clonar el repositorio.
- Puertos **80** y **443** disponibles.

---

## Paso 1 — Instalación Automatizada y Segura

El instalador automatizado es el único método recomendado. Se encarga de todo, desde la configuración y la seguridad hasta el despliegue de los servicios.

```bash
# 1. Clona el repositorio
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# 2. Concede permisos de ejecución al instalador
chmod +x install.sh

# 3. Ejecuta el instalador con privilegios de superusuario
sudo ./install.sh
```

El script realizará las siguientes acciones de forma automática:
1.  **Verificación del Sistema:** Comprobará que Docker, Docker Compose y la RAM mínima están disponibles.
2.  **Configuración de Seguridad:** Generará secretos (`JWT_SECRET`) y credenciales seguras para la base de datos.
3.  **Selección del Modo de Acceso:** Te preguntará cómo deseas acceder a la plataforma (dominio local, IP o dominio público con HTTPS).
4.  **Despliegue de Servicios:** Levantará y configurará todos los contenedores.
5.  **Configuración Inicial de la Tienda:** Creará el restaurante por defecto y generará **contraseñas aleatorias y seguras** para los usuarios `admin` y `waiter`.

---

## Paso 2 — Primer Inicio de Sesión

Al final de la instalación, el script mostrará un resumen con tus credenciales iniciales. **Guárdalas en un lugar seguro.**

- **URL de Acceso:** La que seleccionaste durante la instalación (ej. `http://disher.local` o `https://tu-dominio.com`).
- **Credenciales de Administrador:**
  - **Usuario:** `admin`
  - **Contraseña:** La contraseña segura generada por el instalador.

Simplemente accede a la URL e inicia sesión con estas credenciales.

---

## Paso 3 — Configura Tu Restaurante

Una vez dentro del panel de administración, puedes empezar a personalizar tu restaurante:

1.  **Crea tu Menú:** Ve a `/admin/menu` para añadir categorías, platos, variantes y extras.
2.  **Define tus Mesas:** En `/admin/config` -> `Mesas`, genera los códigos QR únicos para cada mesa.
3.  **Crea Cuentas para el Personal:** En `/admin/users`, añade más usuarios con roles de `cocina` y `cajero`.
4.  **Abre las Estaciones de Trabajo:**
    - **Vista de Cocina (KDS):** `.../admin/kds`
    - **Terminal Punto de Venta (TPV):** `.../admin/pos`

---

## Mantenimiento y Gestión

Para tareas de mantenimiento como cambiar contraseñas, hacer backups o actualizar la aplicación, utiliza el script `configure.sh`.

```bash
sudo ./configure.sh
```

El menú interactivo te guiará a través de las opciones disponibles. Para más detalles, consulta la [Guía de Mantenimiento](./MAINTENANCE.md).

---

## Comandos Útiles de Docker

```bash
# Ver el estado de los servicios
sudo docker compose ps

# Ver los logs de todos los servicios en tiempo real
sudo docker compose logs -f

# Reiniciar un servicio específico (ej. backend)
sudo docker compose restart backend

# Detener todos los servicios
sudo docker compose down
```
