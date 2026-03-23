# Guía de Inicio Rápido de Disher.io v2.6

Esta guía te permitirá tener una plataforma de restaurante funcional en menos de 5 minutos.

---

## Prerrequisitos

- Un servidor o dispositivo con al menos 1GB de RAM.
- **Docker (v24+)** y **Docker Compose (v2.x)** instalados previamente.
- Git para clonar el repositorio.
- Puerto **80** disponible en el sistema. El **443** también es necesario si usas un dominio público (Let's Encrypt lo requiere para HTTPS automático).
- Si usas un proveedor cloud (Google Cloud, AWS, Azure...), los puertos deben estar **abiertos también en el firewall del proveedor** (ver sección [Proveedores Cloud](#proveedores-cloud-firewall)).

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
3.  **Selección del Modo de Acceso:** Te preguntará cómo deseas acceder a la plataforma. Dependiendo de tu infraestructura, deberás elegir entre una de estas cuatro modalidades:

### 1.1 Variantes de Configuración de Red

Durante la instalación, el script adaptará el comportamiento del Proxy y la seguridad SSL basándose en el entorno que elijas. Conoce las opciones antes de ejecutar el instalador:

- **Dominio Público (Online):** 
  - *Ejemplo:* `app.mirestaurante.com`
  - *Uso:* Para instalaciones en servidores cloud (VPS). Permite a los clientes acceder a la aplicación desde cualquier parte del mundo.
  - *Requisitos:* Un dominio real apuntando a la IP de tu servidor. Caddy provisionará automáticamente un certificado SSL de **Let's Encrypt** (HTTPS). Al finalizar la instalación, se mostrarán los **registros DNS** necesarios (A y CAA).
- **Dominio Local (mDNS / LAN):** 
  - *Ejemplo:* `disher.local`
  - *Uso:* Instalaciones alojadas físicamente en el local (ej. una caja registradora o mini-PC) sin depender de que exista conexión a internet hacia fuera.
  - *Requisitos:* Todos los dispositivos (smartphones de clientes y camareros) deben conectarse a la misma red WiFi del local. No se generan certificados HTTPS.
- **IP Pública (Online):** 
  - *Ejemplo:* `203.0.113.50`
  - *Uso:* Instalación en un proveedor Cloud o VPS público, pero sin un dominio contratado. Se accede utilizando números brutos.
  - *Requisitos:* No genera SSL (viaja por HTTP plano). Todos deben usar la IP para entrar.
- **IP Local (LAN):** 
  - *Ejemplo:* `192.168.1.100`
  - *Uso:* Instalación local on-premise en tu restaurante mediante la IP asiganda por el router.
  - *Requisitos:* Depende en exclusiva de la red WiFi del restaurante. Es esencial configurar esta IP como **estática** en tu router para que los códigos QR no dejen de funcionar si el router reinicia. No genera SSL.

---

## Paso 2 — Primer Inicio de Sesión

Al final de la instalación, el script mostrará un resumen con tus credenciales iniciales. **Guárdalas en un lugar seguro.**

Si has elegido un **dominio público**, también verás una tabla con los registros DNS que debes configurar en tu registrador de dominios (registros A y CAA para Let's Encrypt). Puedes consultar esta información en cualquier momento ejecutando:

```bash
sudo ./show-dns.sh
```

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

## Proveedores Cloud — Firewall

Cuando se instala en un VPS o instancia cloud, el proveedor dispone de un **firewall de red propio**, independiente del sistema operativo. Aunque la aplicación esté corriendo correctamente, el acceso externo quedará bloqueado hasta que se abran los puertos necesarios.

- **Puerto 80** (HTTP) — obligatorio para todas las instalaciones.
- **Puerto 443** (HTTPS) — obligatorio si usas un dominio público con Let's Encrypt.

### Google Cloud (Compute Engine)

La forma más fiable es hacerlo desde la **consola web**, ya que desde la propia VM los permisos suelen estar limitados.

**Opción A — Consola web:**

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Navega a **VPC Network → Firewall**
3. Haz clic en **"+ CREATE FIREWALL RULE"** y usa estos valores:

| Campo | Valor |
|-------|-------|
| Name | `allow-http-80` |
| Network | `default` |
| Direction of traffic | `Ingress` |
| Action on match | `Allow` |
| Targets | `All instances in the network` |
| Source filter | `IPv4 ranges` |
| Source IPv4 ranges | `0.0.0.0/0` |
| Protocols and ports | `TCP: 80, 443` |

4. Haz clic en **"Create"**. La regla se activa en menos de 30 segundos.

**Opción B — gcloud CLI** (requiere permisos de administrador de red en el proyecto):

```bash
gcloud compute firewall-rules create allow-disher \
  --allow tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "Disher.io HTTP + HTTPS"
```

> **Nota:** Si ves el error `Request had insufficient authentication scopes`, la VM no tiene permisos para gestionar el firewall. Usa la Opción A desde la consola web.

### AWS (EC2)

1. Ve a **EC2 → Instancias → selecciona tu instancia**
2. En la pestaña **Security**, haz clic en el **Security Group**
3. En **Inbound rules**, añade:
   - Type: `HTTP`, Port: `80`, Source: `0.0.0.0/0`
   - Type: `HTTPS`, Port: `443`, Source: `0.0.0.0/0`
4. Guarda los cambios.

### Azure (Virtual Machine)

1. Ve a tu VM en el portal de Azure
2. En **Networking**, añade **Inbound port rules**:
   - Port: `80`, Protocol: `TCP`, Action: `Allow`
   - Port: `443`, Protocol: `TCP`, Action: `Allow`

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
