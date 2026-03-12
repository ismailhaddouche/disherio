# Disher.io v1.0 — Plataforma Open-Source para Gestión de Restaurantes

Disher.io es una plataforma de gestión de restaurantes autoalojada y lista para producción, diseñada arquitectónicamente para pequeños y medianos establecimientos. Proporciona sincronización de pedidos en tiempo real entre clientes, personal de cocina y cajeros, operando desde un único despliegue unificado y altamente eficiente.

[![CI/CD](https://github.com/ismailhaddouche/disherio/actions/workflows/docker-build.yml/badge.svg)](https://github.com/ismailhaddouche/disherio/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-21-red)](https://angular.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen)](https://mongodb.com)

---

## 1. Introducción al Sistema

Disher.io moderniza el sector de la hostelería eliminando la dependencia de tickets de papel, sistemas de comunicación por radio y puntos de venta (POS) desconectados. Todo el ecosistema opera a través de una red centralizada que se ejecuta sobre tu propia infraestructura de hardware.

Los clientes pueden acceder a la carta y realizar pedidos enviando solicitudes inmediatas a la pantalla de la cocina mediante el escaneo de un código QR. Simultáneamente, el personal de caja tiene una visión general interactiva que permite procesar cobros y dividir cuentas de forma transparente y ágil. 

El sistema ha sido programado con una optimización extrema que permite su ejecución en equipos de recursos limitados (como una Raspberry Pi) hasta entornos en la nube robustos, garantizando total independencia de suscripciones a terceros.

---

## 2. Arquitectura del Sistema

La arquitectura sigue el patrón cliente-servidor, haciendo uso intensivo de WebSockets para comunicación bidireccional en tiempo real, encapsulado totalmente bajo contenedores Docker para un despliegue sin fricción.

```text
                        ┌────────────────────────────────────────────────────────┐
                        │                  Caddy (Proxy Inverso)                 │
                        │           TLS/SSL · Compresión · Enrutamiento          │
                        └──────────────┬─────────────────────────┬───────────────┘
                                       │                         │
                          /api/*  ─────┘                         └─── /* (Static Frontend)
                                       │
              ┌────────────────────────▼────────────────────────────────────────┐
              │              Backend (Node.js 20 + Express)                     │
              │                                                                 │
              │   REST API · JWT Auth · RBAC · Socket.io                        │
              │   Rate Limiting · Helmet · Logs de Actividad                    │
              └──────────────┬───────────────────────────────────┬──────────────┘
                             │                                   │
               ┌─────────────▼────────┐            ┌─────────────▼──────────┐
               │  MongoDB 7           │            │  Socket.io (WS)        │
               │  Pedidos · Menú      │            │  Eventos en tiempo     │
               │  Usuarios · TPV      │            │  real a clientes       │
               └──────────────────────┘            └────────────────────────┘

              ┌─────────────────────────────────────────────────────────────────┐
              │              Frontend (Angular 21)                              │
              │                                                                 │
              │  ┌────────────┐  ┌────────────┐  ┌──────────────┐               │
              │  │  Admin     │  │  KDS       │  │  Camarero    │               │
              │  │  Dashboard │  │  Cocina    │  │  (Waiter)    │               │
              │  └────────────┘  └────────────┘  └──────────────┘               │
              │  ┌────────────┐  ┌────────────┐  ┌──────────────┐               │
              │  │  TPV /     │  │  Editor    │  │  Visualizar  │               │
              │  │  Cajero    │  │  de Menú   │  │  Estado      │               │
              │  └────────────┘  └────────────┘  └──────────────┘               │
              └─────────────────────────────────────────────────────────────────┘
```

---

## 3. Despliegue de Funcionalidades

### 3.1. Experiencia del Cliente
- Interacción inicial mediante código QR localizado por mesa, evitando la necesidad de instalar software en el dispositivo del cliente.
- Menú digital dinámico con estructuración por categorías, gestión de precios por variantes y declaración exhaustiva de alérgenos.
- Sistema automatizado de pedidos directos y seguimiento de los mismos.

### 3.2. Operativa de Sala y Camareros (Waiter View)
- Vista en tiempo real del estado de ocupación de las mesas (libres, ocupadas, con pedidos pendientes o por cobrar).
- Gestión activa de los comensales y seguimiento del progreso de los platos solicitados.
- Notificaciones dinámicas y capacidad de intervenir en nombre del cliente para crear pedidos de forma manual o modificar los existentes.

### 3.3. Operativa de Cocina (KDS - Kitchen Display System)
- Interfaz reactiva adaptada a dispositivos tipo tablet.
- Flujo de estados del pedido: seguimiento granular por plato ("Pendiente", "En preparación", "Listo para servir").
- Alertas visuales y temporizadores para control estricto de los tiempos de espera del cliente.

### 3.4. Punto de Venta (TPV / POS)
- Tablero de gestión interactivo presentando el plano de mesas en tiempo real.
- **Facturación Robusta**: Cálculos exactos de base imponible, IVA y propinas integrados en cada ticket generado.
- **Reparto Inteligente**: Sistema avanzado de división de pagos (equitativo sobre saldo restante o selección manual por comensal).
- Registro categorizado según método de pago (Efectivo/Tarjeta).

### 3.5. Panel de Administración
- Editor gráfico de la base de datos de productos (menús, modificadores y extras).
- Control de acceso basado en roles (RBAC) para el staff del restaurante (Admin, Waiter, Kitchen, POS).
- Estructura de marca blanca que permite configurar identidad corporativa (nombre, colores, logotipos).
- Modulo generador de PDF para la creación dinámica e impresión de tótems con QR asociados a las mesas operativas.
- **Auditoría Profesional**: Registro automático de cada cambio de precio, anulación o modificación de rol, incluyendo historial "antes y después" para máxima trazabilidad.

---

## 4. Requisitos de Instalación

Para asegurar el rendimiento óptimo del sistema, el servidor host debe cumplir con las siguientes especificaciones técnicas:

| Especificación | Entorno Mínimo | Entorno Recomendado (Producción) |
| :--- | :--- | :--- |
| **CPU** | 1 Core (ARM/x86) | 2+ Cores |
| **RAM** | 1 GB (RPi 3/4) | 2 GB+ |
| **Almacenamiento** | 8 GB (SSD/SD Class 10) | 16 GB SSD |
| **OS** | Debian 11+ / Ubuntu 22+ | Ubuntu Server 22.04 LTS |

### 4.1. Instalación de Dependencias (Crítico)
Disher.io requiere que **Docker** y el plugin **Docker Compose** estén instalados previamente. Por seguridad, el instalador no gestiona estas dependencias por ti.

#### En Ubuntu / Debian / Raspberry Pi OS (Recomendado)
```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Instalar Plugin de Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# 3. Dar permisos al usuario actual (opcional)
sudo usermod -aG docker $USER
```

> [!CAUTION]
> **Aviso de Seguridad**: Nunca ejecutes scripts descargados directamente de internet con `sudo` sin revisarlos o confiar plenamente en la fuente oficial. Disher.io utiliza Docker para aislar los procesos y mejorar la seguridad general del servidor.

### 4.1. Instalación de Dependencias (Crítico)
Disher.io requiere que **Docker** y el plugin **Docker Compose** estén instalados previamente. Por seguridad, el instalador no gestiona estas dependencias por ti.

#### En Ubuntu / Debian / Raspberry Pi OS (Recomendado)
```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Instalar Plugin de Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# 3. Dar permisos al usuario actual (opcional)
sudo usermod -aG docker $USER
```

> [!CAUTION]
> **Aviso de Seguridad**: Nunca ejecutes scripts descargados directamente de internet con `sudo` sin revisarlos o confiar plenamente en la fuente oficial. Disher.io utiliza Docker para aislar los procesos y mejorar la seguridad general del servidor.

*Aviso Técnico: La ejecución en dispositivos SBC (como Raspberry Pi) está validada exclusivamente para despliegues intra-red (LAN). Para alojamientos en proveedores en la nube pública (AWS, Google Cloud, Azure) es mandatorio configurar las reglas de entrada en el Firewall del proveedor de red correspondientes a los puertos HTTP/HTTPS.*

---

## 5. Proceso de Despliegue Automatizado

Disher.io proporciona un script de instalación automatizada (`install.sh`) que gestiona integralmente la configuración del entorno, aprovisionamiento de infraestructuras base, inyección de variables de entorno y levantamiento de contenedores. Este es el método de instalación estándar para cualquier servidor.

```bash
# Paso 1: Clonar el código fuente más reciente
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Paso 2: Otorgar permisos de ejecución e iniciar como administrador
chmod +x install.sh
sudo ./install.sh
```

### 5.1 Fases del Instalador

La ejecución guiada del script cubre las siguientes seis etapas críticas:

1. **Configuración de Red:** Selección de tipo de acceso (FQDN para dominio público o acceso por IP local).
2. **Definición de Puertos:** Reasignación de puerto HTTP (default: `80`, alternativo: `8080`) para evitar conflictos de multiplexación.
3. **Criptografía y Seguridad:** Autogeneración de claves aleatorias para el encriptado JWT (`JWT_SECRET`) y credenciales base de MongoDB.
4. **Validación de Dependencias:** Detección e instalación no interactiva de Docker Compose (si no está cubierto por el sistema base).
5. **Orquestación:** Construcción local de imágenes frontend/backend y ejecución asíncrona (`docker compose up -d --build`).
6. **Inicialización de Datos:** Inyección del *store seed* inicial con los parámetros por defecto del restaurante.

### 5.2 Tipología de Acceso

El instalador ajustará el proxy inverso según la decisión de red tomada inicialmente:

- **Dominio Público (FQDN):** Por ejemplo, `app.restaurante.com`. Caddy Server gestionará la obtención y rotación automática de certificados TLS a través de Let's Encrypt / ZeroSSL, forzando todas las comunicaciones hacia HTTPS (puerto 443).
- **Dominio Local (mDNS / LAN):** Orientado a soluciones on-premise puras sin conexión a internet.
- **Direccionamiento IP:** Acceso directo sin dominio (el proxy enrutará sobre el puerto HTTP configurado de forma plana, sin generar certificados SSL). Se divide en dos supuestos:
  - **IP Local (LAN):** Para instalaciones en equipos físicos dentro del restaurante (ej. ordenador en caja o Raspberry Pi). Los dispositivos se conectan a través de la red del router Wi-Fi local. **No requiere conexión a Internet**.
  - **IP Pública (VPS / Nube):** Para alojamiento en servidores externos. Se accede universalmente a la plataforma desde cualquier lugar a través de la IP estática (pública) asignada por el proveedor.

### 5.3 Resumen de Credenciales

Al concluir la inicialización, el instalador imprimirá por salida estándar (STDOUT) las credenciales criptográficas del súper-administrador. **Debe almacenarse esta información inmediatamente en un gestor de contraseñas seguro.**

```text
--- Inicialización Completa ---
Usuario Root:     admin
Password Root:    [Cadena Autogenerada]
URL de Acceso:    http(s)://[host-identificado]
```

Si posteriormente requiere alterar la configuración del entorno, puede lanzar la herramienta de reconfiguración provista en el código base:
`sudo ./configure.sh`

---

## 6. Procedimientos de Baja y Mantenimiento del Servicio

### 6.1 Detención y Borrado Estándar (Retención de Datos)

Permite bajar toda la infraestructura, conservando intactos los volúmenes en disco (base de datos, ficheros almacenados e historial).

```bash
cd disherio
docker compose down
```
*Para revivir el sistema bastará con ejecutar nuevamente `docker compose up -d`.*

### 6.2 Eliminación Total de Infraestructura (Pérdida de Datos)

Acción destructiva. Obliga la eliminación de contenedores, redes, imágenes compiladas y borra de forma segura todos los volúmenes adjuntos a la instancia, purgado el historial de transacciones y base de datos completa.

```bash
cd disherio

# 1. Bajar servicios destruyendo volúmenes, imágenes compiladas y contenedores huérfanos
docker compose down -v --rmi all --remove-orphans

# 2. Purga profunda a nivel de sistema Docker (limpia cachés y datos sin uso)
docker system prune -a --volumes -f

# 3. Eliminación forzada y total del directorio y los recursos locales
cd ..
sudo rm -rf disherio
```

### 6.3 Resolución de Incidencias e Instalación Corrupta

En el supuesto diagnóstico de corrupción del estado (ej., fallo originado por apagón crítico, modificación externa manual en los volúmenes, corrupción en el servicio de Docker), ejecutar la siguiente secuencia de reseteo forzado integral:

```bash
# Diagnóstico preliminar
docker ps -a
docker compose logs backend

# Destrucción exhaustiva de la pila y todos sus rastros asilados
cd disherio
docker compose down -v --rmi all --remove-orphans
docker system prune -a --volumes -f

# Eliminación severa del root path y recombinación pura
cd ..
sudo rm -rf disherio

# Reinstalación limpia desde cero
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
chmod +x install.sh
sudo ./install.sh
```

---

## 7. Copias de Seguridad y Recuperación (Crítico)

> [!CAUTION]
> **SI NO HACES BACKUPS, TUS DATOS DESAPARECERÁN**: Disher.io es un sistema auto-hosteado. Si el hardware falla (ej. corrupción de SD en Raspberry Pi), perderás toda tu configuración, menús e historial de ventas. **Tú eres el único responsable de tus datos.**

### 7.1 Script de Backup Automático
Hemos incluido una utilidad (`backup.sh`) para simplificar esta tarea. El script realiza un volcado completo de la base de datos, lo comprime y mantiene una rotación de los últimos 7 días para no saturar el disco.

```bash
# 1. Dar permisos de ejecución
chmod +x backup.sh

# 2. Ejecutar backup manual
./backup.sh
```
Los archivos se guardarán en la carpeta `./backups/` con el formato `disher_backup_YYYY-MM-DD.tar.gz`.

### 7.2 Programación con Cron (Recomendado)
Para que el sistema haga copias automáticas cada noche (ej. a las 4:00 AM), añade una línea a tu crontab:

```bash
# Abrir editor de cron
crontab -e

# Añadir esta línea al final (ajusta la ruta a tu carpeta disherio)
0 4 * * * cd /ruta/a/disherio && ./backup.sh > /dev/null 2>&1
```

### 7.3 Restauración de Datos
Para restaurar una copia de seguridad en una instalación limpia:

```bash
# 1. Descomprimir el backup
tar -xzf backups/disher_backup_fecha.tar.gz

# 2. Restaurar en el contenedor (asegúrate de que los servicios estén corriendo)
docker exec -i disher-db mongorestore --username root --password tu_password --authenticationDatabase admin --archive < disher_backup_fecha.archive
```

---

## 8. Mapeo de Accesos Operativos

El sistema impone aislamiento rígido de sus módulos. A continuación se define la matriz de accesos y controladores de ruta requeridos para operar:

| Definición Lógica del Módulo | Endpoint Base de Acceso | Privilegio de Acceso Asignado |
|------------------------------|-------------------------|-------------------------------|
| Autenticación de Personal | `/login` | Unauthenticated |
| Panel Estadístico de Administración | `/admin/dashboard` | Administrator |
| Interfaz Operativa de Sala (Camareros) | `/admin/waiter` | Waiter Staff / Administrator |
| Display de Coordinación Cocina (KDS)| `/admin/kds` | Kitchen Staff / Administrator |
| Terminal Integrado de Cobros (TPV) | `/admin/pos` | POS Staff / Administrator |
| Suite de Edición de Catálogo | `/admin/menu` | Administrator |
| Gestión Externa del Personal | `/admin/users` | Administrator |
| Configurador Global Corporativo | `/admin/config` | Administrator |
| Menú Digital (Acceso por Mesa) | `/:tableNumber` | Unauthenticated (User) |
| Menú Digital (Acceso por Sesión Activa) | `/s/:sessionCode` | Unauthenticated (User) |
| Solicitud Física de Cuenta (Petición de Cobro) | `/:tableNumber/checkout`<br>`/s/:sessionCode/checkout`| Unauthenticated (User) |

---

## 8. Modalidades Operativas de Contexto

### 8.1 Topología Intranet On-Premise (Local/LAN)
Arquitectura blindada frente al exterior. El sistema Caddy no intentará adquirir certificados y permitirá las transmisiones HTTP planas dentro del segmento de red privada, requiriéndose únicamente dispositivos de acceso locales (smartphones conectados al Wi-Fi del restaurante).

### 8.2 Topología Pública Externalizada (Producción)
Se enlaza la instancia Docker mediante proxy inverso directamente a una IP expuesta a internet con un FQDN configurado. Caddy server implementa interceptación de tráfico SSL estricta con redirección forzada del puerto 80 al 443. La latencia operativa dependerá del centro de datos del host Cloud aprovisionado.

### 8.3 Contexto Arquitectura SBC (IoT/Raspberry Pi)
Soporte absoluto para arquitecturas ARM64 nativas. Las rutinas de `docker-build.yml` y los scripts base contemplan las necesidades optimizadas requeridas por la limitada computación de memoria disponible en arquitecturas de silicio reducido.

---

## 9. Directorio Documental Secundario

El proyecto engloba módulos específicos de información suplementaria para mantenimiento avanzado e integración. Consultar cada archivo para operaciones específicas:

| Archivo Técnico | Resumen del Alcance Documental |
|-----------------|--------------------------------|
| `docs/QUICK_START.md` | Detalle extenso del flujo de instalación y configuración de cortafuegos cloud. |
| `docs/ARCHITECTURE.md`| Desglose sistemático del pipeline técnico y diagramas de estados. |
| `docs/API.md` | Listado exahustivo formal de la convención de endpoints REST JSON y modelos. |
| `docs/MAINTENANCE.md` | Protocolos de retención de bases de datos, copias de seguridad CRON y rollback. |
| `docs/TESTING_AND_CI.md` | Documentación profunda de integración continua (GitHub Actions), despliegues y pruebas unitarias/E2E (Jest). |
| `CONTRIBUTING.md` | Manual de convenciones de código para desarrolladores externos interesados en el fork. |
| `SECURITY.md` | Flujos de información autorizada referentes al reporte de vulnerabilidades zero-day. |
| `CHANGELOG.md` | Control oficial estricto de revisiones incrementales y cambios consolidados. |

---

## 10. Pila Tecnológica Subyacente

Toda la infraestructura descansa sobre un robusto stack JavaScript/TypeScript optimizado bajo las últimas versiones estables LTS (Long Term Support).

| Capa Conceptual | Stack Lógico Implementado | Versión Validada (LTS) |
|-----------------|---------------------------|------------------------| 
| Servidor Backend | Entorno V8 Node.js + Framework Express | Mínimo 20.x / 5.x |
| Framework Frontend | Framework Angular con Arquitectura Signals API | Versión 21 |
| Persistencia Datos | Clúster de bases de datos no estructuradas MongoDB | Release 7.x |
| Balanceo de Carga | Servidor Caddy (Manejo TLS automatizado) | Serie 2.x |
| Comunicación Bidireccional | API Socket.io (Transporte de Eventos WebSocket Puros) | Release 4.x |
| Encriptación e Identidad | Estándar JsonWebToken (Firmas seguras SHA-256) | Core 9.x |

---

## 11. Conformidad, Seguridad y Auditoría

La revisión y contribución sobre la base de código deben seguir en todo momento los estándares señalados normativamente dentro de `CONTRIBUTING.md`.

Frente al hallazgo de vulnerabilidades de diseño, desbordamiento del sistema, brechas de inyección y/o debilidades estructurales, se ruega encarecidamente la observancia y reporte privado siguiendo las guías provistas en el anexo de `SECURITY.md`. La publicación no autorizada de issues destructivas viola nuestra política de reporte responsable.

### Soporte a través de Inteligencia Artificial

Las fases constructivas del presente repositorio han contado con soporte metodológico derivado de análisis asistidos por IA:

- **Gemini CLI:** Terminal de interacción algorítmica y orquestación asistida.
- **Gemini 3.0:** Modelo fundacional empleado transversalmente durante depuraciones de red, refactorización heurística y optimización semántica.

*La autoría intelectual, gestión de diseño de microservicios, estructura de decisión condicional y revisiones exhaustivas finales son responsabilidad humana innegociable. El asistente actúa de soporte colateral de integración rápida.*

---

## 12. Asignación de Permisos y Licencia Base

El código fuente de Disher.io se halla licenciado y distribuido íntegramente de acuerdo con los términos formales y no exclusivos de la Licencia Open-Source [MIT](./LICENSE). 
Otorga libertad máxima al receptor final en materia de usabilidad, alteración comercial privada y compilación, eximiendo a la fuente del origen de toda obligación contractual por mal funcionamiento.
