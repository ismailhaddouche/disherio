# Guia de Despliegue DisherIo

Esta guia proporciona instrucciones detalladas para desplegar DisherIo en cualquier entorno de forma automatizada y segura.

---

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Resumen de Modos de Despliegue](#resumen-de-modos-de-despliegue)
3. [Inicio Rapido](#inicio-rapido)
4. [Modo Local](#modo-local)
5. [Modo Red Local](#modo-red-local)
6. [Modo IP Publica](#modo-ip-publica)
7. [Modo Dominio Propio](#modo-dominio-propio)
8. [Comandos de Administracion](#comandos-de-administracion)
9. [Solucion de Problemas](#solucion-de-problemas)
10. [Seguridad](#seguridad)
11. [Actualizaciones](#actualizaciones)

---

## Requisitos Previos

### Software Requerido

| Componente | Version Minima | Proposito |
|------------|----------------|-----------|
| Docker | 20.10+ | Contenerizacion de servicios |
| Docker Compose | 2.0+ | Orquestacion de contenedores |
| Git | 2.0+ | Control de versiones |

### Verificacion de Requisitos

Ejecute los siguientes comandos para verificar su instalacion:

```bash
docker --version
docker compose version
git --version
```

### Recursos de Hardware Recomendados

| Entorno | CPU | Memoria RAM | Almacenamiento |
|---------|-----|-------------|----------------|
| Desarrollo (local) | 2 cores | 4 GB | 20 GB |
| Produccion (dominio) | 4 cores | 8 GB | 50 GB |
| Produccion (alta carga) | 8 cores | 16 GB | 100 GB |

---

## Resumen de Modos de Despliegue

DisherIo soporta cuatro modos de despliegue, cada uno optimizado para un escenario especifico:

| Modo | HTTPS | Caso de Uso | Complejidad |
|------|-------|-------------|-------------|
| `local` | No | Desarrollo en maquina local | Baja |
| `local-ip` | No | Red local (restaurante, oficina) | Baja |
| `public-ip` | Si | IP publica sin dominio propio | Media |
| `domain` | Si | Dominio propio con certificado valido | Alta |

### Consideraciones para Seleccion de Modo

**Modo Local**: Utilice este modo unicamente durante el desarrollo. La aplicacion solo sera accesible desde la maquina donde se ejecuta.

**Modo Red Local**: Ideal para restaurantes u oficinas donde todos los dispositivos estan en la misma red WiFi/Ethernet. No requiere configuracion de DNS ni dominio.

**Modo IP Publica**: Para exponer la aplicacion a Internet sin disponer de un dominio propio. Utiliza Cloudflare Tunnel (recomendado) o ngrok para proporcionar HTTPS.

**Modo Dominio Propio**: La solucion mas profesional para produccion. Requiere un dominio registrado y configuracion DNS.

---

## Inicio Rapido

### Instalacion Automatica

```bash
# Clonar el repositorio
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Ejecutar el configurador interactivo
./infrastructure/scripts/configure.sh

# Seguir las instrucciones en pantalla
# Al finalizar, iniciar los servicios:
docker compose up -d --build
```

### Instalacion Rapida (Un Solo Comando)

```bash
./quickstart.sh
```

Este script ejecuta automaticamente: configuracion, verificacion e inicio de servicios.

---

## Modo Local

El modo local esta disenado para desarrollo en la maquina del desarrollador.

### Caracteristicas

- Acceso exclusivo desde localhost (127.0.0.1)
- Sin HTTPS (HTTP plano)
- Puertos configurables
- Hot-reload habilitado para desarrollo

### Procedimiento de Configuracion

1. Ejecute el configurador:

```bash
./infrastructure/scripts/configure.sh
```

2. Seleccione la opcion `1. local`.

3. Configure los puertos cuando se le solicite:
   - Puerto para el servidor web (por defecto: 4200)
   - Puerto para la API backend (por defecto: 3000)

4. Inicie los servicios:

```bash
docker compose up -d --build
```

### URLs de Acceso

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000/api |
| WebSocket | ws://localhost:3000/socket.io |
| Health Check | http://localhost:3000/health |

### Variables de Entorno Generadas

```bash
DEPLOYMENT_MODE=local
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
PORT=3000
CADDY_PORT=4200
```

---

## Modo Red Local

Este modo permite el acceso desde cualquier dispositivo conectado a la misma red local.

### Caracteristicas

- Acceso desde cualquier dispositivo en la red (192.168.x.x, 10.x.x.x)
- Sin HTTPS (limitacion de redes locales)
- Puerto HTTP estandar (80)
- Ideal para totems y tablets en restaurantes

### Procedimiento de Configuracion

1. Identifique la IP de su maquina en la red local:

```bash
# Linux
hostname -I

# macOS
ipconfig getifaddr en0

# Windows
ipconfig
```

2. Ejecute el configurador:

```bash
./infrastructure/scripts/configure.sh
```

3. Seleccione la opcion `2. local-ip`.

4. Ingrese la IP de su red local cuando se le solicite.

5. Configure el puerto HTTP (por defecto: 80).

6. Inicie los servicios:

```bash
docker compose up -d --build
```

### URLs de Acceso

| Origen | URL |
|--------|-----|
| Maquina local | http://localhost |
| Red local | http://192.168.x.x (su IP local) |

### Advertencias de Seguridad del Navegador

Los navegadores modernos muestran advertencias de "Sitio No Seguro" cuando se accede via HTTP. Esto es comportamiento normal y esperado para redes locales sin HTTPS. Los usuarios deben seleccionar "Continuar de todos modos" o similar.

Para evitar estas advertencias en entornos de produccion, considere:
- Crear un dominio local (ej: disherio.local) con certificado autofirmado
- Usar el modo IP Publica con Cloudflare Tunnel
- Configurar un dominio propio con certificado valido

### Configuracion de Firewall

Si no puede acceder desde otros dispositivos, verifique el firewall:

```bash
# Ubuntu/Debian con UFW
sudo ufw allow 80/tcp
sudo ufw reload

# CentOS/RHEL con firewalld
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload

# Verificar estado
sudo ufw status
sudo firewall-cmd --list-ports
```

---

## Modo IP Publica

Este modo permite exponer DisherIo a Internet utilizando una IP publica sin necesidad de un dominio propio.

### Limitacion Importante

Las direcciones IP publicas no pueden obtener certificados SSL de Let's Encrypt directamente. Las Autoridades de Certificacion (CA) solo emiten certificados para nombres de dominio, no para direcciones IP.

### Solucion: Tunelamiento HTTPS

Para proporcionar HTTPS en una IP publica, utilizamos servicios de tunelamiento que:
1. Crean un nombre de dominio temporal/permante
2. Gestionan el certificado SSL
3. Redirigen el trafico a su servidor

### Opcion A: Cloudflare Tunnel (Recomendado)

Cloudflare Tunnel es la solucion recomendada por las siguientes razones:
- URL fija que no cambia al reiniciar
- Proteccion DDoS integrada
- Sin limites de tiempo
- Gratuito para uso basico
- Certificado SSL valido automatico

#### Requisitos Previos

1. Cuenta gratuita en Cloudflare (https://dash.cloudflare.com/sign-up)
2. Acceso a un dominio (puede ser subdominio gratuito de workers.dev)

#### Paso 1: Crear Cuenta y Dominio en Cloudflare

1. Visite https://dash.cloudflare.com/sign-up
2. Complete el registro con su correo electronico
3. Verifique su cuenta via email
4. Agregue un dominio (puede usar uno gratuito o su propio dominio)

#### Paso 2: Crear el Tunel

1. Inicie sesion en Cloudflare Dashboard
2. Navegue a: **Zero Trust** > **Networks** > **Tunnels**
3. Haga clic en **Create a tunnel**
4. Seleccione **Cloudflared** como tipo de conector
5. Asigne un nombre al tunel (ejemplo: "disherio-produccion")
6. En **Choose your environment**, seleccione **Docker**
7. **Copie el token** que aparece en pantalla (string largo de caracteres)

#### Paso 3: Configurar DisherIo

1. Ejecute el configurador:

```bash
./infrastructure/scripts/configure.sh
```

2. Seleccione la opcion `3. public-ip`.

3. Seleccione la opcion `1. Cloudflare Tunnel`.

4. Pegue el token cuando se le solicite.

5. Ingrese el dominio asignado por Cloudflare (ejemplo: tunel-tuuuid.cfargotunnel.com).

6. Inicie los servicios:

```bash
docker compose --profile cloudflare up -d --build
```

#### Paso 4: Verificar Conexion

```bash
# Ver logs del tunel
docker compose logs -f cloudflared
```

Busque el mensaje: `Connection registered connIndex=0`

#### URL de Acceso

Su aplicacion estara disponible en:

```
https://tunel-tuuuid.cfargotunnel.com
```

### Opcion B: ngrok

ngrok es una alternativa adecuada para pruebas temporales.

#### Limitaciones de ngrok (Plan Gratuito)

- La URL cambia cada vez que se reinicia el servicio
- Limite de conexiones simultaneas
- Sesiones expiran despues de tiempo de inactividad

#### Requisitos

1. Cuenta en ngrok (https://dashboard.ngrok.com/signup)
2. Authtoken personal (https://dashboard.ngrok.com/get-started/your-authtoken)

#### Configuracion

1. Ejecute el configurador:

```bash
./infrastructure/scripts/configure.sh
```

2. Seleccione la opcion `3. public-ip`.

3. Seleccione la opcion `2. ngrok`.

4. Ingrese su authtoken de ngrok.

5. Inicie los servicios:

```bash
docker compose --profile ngrok up -d --build
```

6. Obtenga la URL temporal:

```bash
docker compose logs -f ngrok
```

Busque una linea similar a:
```
Forwarding https://abcd1234.ngrok.io -> http://caddy:8080
```

---

## Modo Dominio Propio

Este es el modo recomendado para instalaciones en produccion con requisitos profesionales.

### Caracteristicas

- HTTPS con certificado SSL valido (Let's Encrypt)
- TLS 1.3 minimo
- HTTP/3 (QUIC) soportado
- Redireccion automatica HTTP a HTTPS
- Renovacion automatica de certificados

### Requisitos

1. Dominio registrado (ejemplo: disherio.tunegocio.com)
2. Acceso a configuracion DNS del dominio
3. Puertos 80 y 443 accesibles desde Internet
4. Correo electronico valido (para notificaciones de Let's Encrypt)

### Paso 1: Configuracion DNS

Antes de continuar, debe configurar el DNS de su dominio para apuntar a la IP publica de su servidor.

1. Obtenga su IP publica:

```bash
curl ifconfig.me
```

2. Acceda al panel de control de su registrador de dominios
3. Cree un registro A:
   - Nombre: @ (o subdominio, ej: disherio)
   - Valor: Su IP publica
   - TTL: 300 (o el minimo permitido)

4. Espere la propagacion DNS (puede tomar hasta 24 horas, tipicamente 5-30 minutos)

Verifique la propagacion:

```bash
dig +short su-dominio.com
nslookup su-dominio.com
```

### Paso 2: Configuracion de Firewall

Abra los puertos necesarios:

```bash
# Verificar puertos actuales
sudo ss -tlnp | grep -E ':80|:443'

# Con UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp  # HTTP/3 QUIC
sudo ufw reload

# Con firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Paso 3: Configurar DisherIo

1. Ejecute el configurador:

```bash
./infrastructure/scripts/configure.sh
```

2. Seleccione la opcion `4. domain`.

3. Ingrese su dominio completo (ej: disherio.tunegocio.com).

4. Ingrese su correo electronico (para Let's Encrypt).

5. Confirme que el DNS esta correctamente configurado.

6. Inicie los servicios:

```bash
docker compose up -d --build
```

### Paso 4: Verificacion de Certificado

Los certificados de Let's Encrypt se solicitan automaticamente al primer inicio.

```bash
# Ver logs de Caddy
docker compose logs -f caddy
```

Busque mensajes como:
```
[INFO] Obtaining certificate for su-dominio.com
[INFO] Certificate obtained successfully
```

### Renovacion Automatica

Caddy gestiona automaticamente la renovacion de certificados. No requiere intervencion manual.

---

## Comandos de Administracion

### Gestión de Servicios

```bash
# Iniciar todos los servicios
docker compose up -d

# Iniciar con reconstruccion de imagenes
docker compose up -d --build

# Detener todos los servicios
docker compose down

# Detener y eliminar volumenes (ATENCION: elimina datos)
docker compose down -v

# Reiniciar servicios
docker compose restart

# Reiniciar un servicio especifico
docker compose restart backend
```

### Visualizacion de Logs

```bash
# Logs de todos los servicios (tiempo real)
docker compose logs -f

# Logs de un servicio especifico
docker compose logs -f backend
docker compose logs -f caddy
docker compose logs -f mongo

# Ultimas 100 lineas
docker compose logs --tail=100 backend

# Logs con timestamps
docker compose logs -f -t backend
```

### Estado y Monitoreo

```bash
# Estado de los contenedores
docker compose ps

# Uso de recursos
docker stats

# Espacio en disco usado por Docker
docker system df
```

### Respaldo y Restauracion

```bash
# Crear respaldo de base de datos
docker compose exec mongo mongodump --out /data/backup/$(date +%Y%m%d)

# Copiar respaldo a host
docker cp disherio_mongo:/data/backup ./backups

# Restaurar base de datos
docker compose exec mongo mongorestore /data/backup/20240101/disherio
```

---

## Solucion de Problemas

### Problema: No se puede acceder desde otros dispositivos en la red

**Causas posibles:**
1. Firewall bloqueando el puerto
2. IP incorrecta configurada
3. Configuracion de red del Docker

**Solucion:**

```bash
# Verificar IP actual
hostname -I

# Verificar que la IP en .env coincida
grep LOCAL_IP .env

# Verificar firewall
sudo ufw status
sudo iptables -L | grep 80

# Probar conectividad desde otra maquina
ping 192.168.x.x
curl http://192.168.x.x
```

### Problema: Cloudflare Tunnel no conecta

**Diagnosticos:**

```bash
# Ver logs detallados
docker compose logs -f cloudflared

# Reiniciar el servicio
docker compose restart cloudflared

# Verificar token
grep CF_TUNNEL_TOKEN .env
```

**Soluciones comunes:**
1. Verificar que el token sea correcto (copiar de nuevo desde Cloudflare)
2. Asegurar que Caddy este saludable: `docker compose ps`
3. Verificar conectividad a Internet desde el contenedor

### Problema: Let's Encrypt no emite certificado

**Diagnosticos:**

```bash
# Ver logs de Caddy
docker compose logs -f caddy

# Verificar resolucion DNS
dig +short su-dominio.com
host su-dominio.com

# Verificar puertos abiertos
sudo ss -tlnp | grep -E ':80|:443'
curl -I http://su-dominio.com
```

**Errores comunes:**

| Error | Causa | Solucion |
|-------|-------|----------|
| ` connection refused` | Puerto 80 cerrado | Abrir puerto en firewall |
| `DNS problem: NXDOMAIN` | DNS no propagado | Esperar propagacion o verificar configuracion |
| `too many failed authorizations` | Demasiados intentos fallidos | Esperar 1 hora antes de reintentar |

### Problema: WebSockets no funcionan

**Sintomas:** Las actualizaciones en tiempo real no se reflejan.

**Verificacion:**

```bash
# Probar conexion WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Host: su-dominio.com" \
  -H "Origin: https://su-dominio.com" \
  http://localhost:3000/socket.io/
```

**Soluciones:**

1. **Cloudflare**: Los WebSockets funcionan por defecto, no requieren configuracion adicional.

2. **ngrok**: Use el flag `--ws-check-origin=false` si tiene problemas de CORS.

3. **Dominio propio**: Verifique que Caddy tenga la configuracion correcta para WebSockets.

### Problema: Error "Cannot connect to the Docker daemon"

**Causa**: El usuario no tiene permisos para ejecutar Docker.

**Solucion:**

```bash
# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Cerrar sesion y volver a iniciar
# O ejecutar:
newgrp docker

# Verificar
docker ps
```

---

## Seguridad

### Credenciales por Defecto

Las siguientes contraseñas son configuradas automaticamente pero **deben cambiarse en produccion**:

| Servicio | Usuario | Contraseña por Defecto |
|----------|---------|------------------------|
| MongoDB Root | admin | change-this-secure-password |
| MongoDB App | disherio_app | change-this-app-password |
| Redis | - | redis_secure_password |

### Cambio de Credenciales

Edite el archivo `.env`:

```bash
# Generar contraseñas seguras
openssl rand -base64 32

# Editar archivo
nano .env
```

Modifique estas lineas:
```bash
MONGO_ROOT_PASS=su-nueva-contrasena-root-segura
MONGO_APP_PASS=su-nueva-contrasena-app-segura
REDIS_PASSWORD=su-nueva-contrasena-redis-segura
JWT_SECRET=su-secreto-jwt-muy-largo-y-aleatorio-minimo-64-caracteres
```

Aplique los cambios:

```bash
docker compose down
docker compose up -d
```

**IMPORTANTE**: Cambiar las credenciales de MongoDB despues de la primera inicializacion requiere recrear el volumen de datos:

```bash
docker compose down -v  # ATENCION: Elimina todos los datos
docker compose up -d
```

### Configuracion de Firewall Recomendada

```bash
# Politica por defecto: denegar todo
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (para no perder acceso)
sudo ufw allow 22/tcp

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp  # HTTP/3

# Habilitar firewall
sudo ufw enable

# Verificar reglas
sudo ufw status verbose
```

### Encriptacion de Datos en Reposo

Para instalaciones con requisitos de seguridad estrictos, considere encriptar los volumenes de Docker:

```bash
# Crear volumen encriptado
docker volume create --driver local \
  --opt type=none \
  --opt o=bind \
  --opt device=/ruta/encriptada \
  mongo_data_encrypted
```

---

## Actualizaciones

### Procedimiento de Actualizacion

1. **Crear respaldo de datos**:

```bash
./scripts/backup.sh
# O manualmente:
docker compose exec mongo mongodump --out /data/backup/pre-update-$(date +%Y%m%d)
```

2. **Detener servicios**:

```bash
docker compose down
```

3. **Actualizar codigo**:

```bash
git pull origin main
```

4. **Reconstruir e iniciar**:

```bash
docker compose up -d --build
```

5. **Verificar estado**:

```bash
docker compose ps
docker compose logs -f
```

### Actualizacion de Imagenes Base

Para actualizar las imagenes de MongoDB, Redis, etc:

```bash
# Descargar nuevas versiones
docker compose pull

# Reiniciar con nuevas imagenes
docker compose up -d
```

---

## Soporte y Recursos

### Documentacion Adicional

- [Guia de Configuracion](docs/CONFIGURE.md)
- [Arquitectura del Sistema](docs/ARCHITECTURE.md)
- [Solucion de Errores](docs/ERRORS.md)

### Recursos Externos

- [Documentacion Docker](https://docs.docker.com/)
- [Documentacion Caddy](https://caddyserver.com/docs/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Let's Encrypt](https://letsencrypt.org/docs/)

---

## Licencia

Este software es propietario. Todos los derechos reservados.

---

*Documentacion generada para DisherIo Restaurant Management System*
