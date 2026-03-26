# Instalación

## Requisitos

- Sistema operativo: Ubuntu / Debian
- Acceso root o usuario con `sudo`
- Conexión a internet
- **Puertos libres:** 80 (HTTP) y 443 (HTTPS)
- **RAM mínima:** 2GB recomendada (1GB puede funcionar pero es lento)

## Requisitos de Red (Cloud)

### Google Cloud Platform (GCP)

Si despliegas en GCP, debes crear reglas de firewall:

```bash
# HTTP
gcloud compute firewall-rules create allow-http \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server

# HTTPS
gcloud compute firewall-rules create allow-https \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=https-server
```

Y asignar las etiquetas a tu instancia:
```bash
gcloud compute instances add-tags INSTANCE_NAME \
  --tags=http-server,https-server \
  --zone=ZONE
```

### AWS
Configurar Security Group para permitir tráfico en puertos 80 y 443 desde 0.0.0.0/0.

### Azure
Configurar Network Security Group (NSG) para permitir tráfico HTTP/HTTPS.

## Pasos

### 1. Clonar el repositorio

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
```

### 2. Dar permisos al instalador

```bash
chmod +x scripts/install.sh
```

### 3. Ejecutar el instalador

```bash
sudo ./scripts/install.sh
```

El instalador te guiará por los siguientes pasos:

- Selección de idioma
- Instalación de dependencias (Docker, UFW, curl)
- Modo de red:
  - Dominio público con HTTPS (Let's Encrypt)
  - Dominio local
  - IP pública
  - IP local
- Generación de contraseña de administrador
- Construcción e inicio de contenedores
- Carga de datos iniciales (seed)
- Comprobación de salud

Al finalizar se mostrará la URL de acceso y las credenciales de administrador.

### 4. Credenciales por defecto

Si el seed se ejecutó correctamente, las credenciales por defecto son:

```
Email:    admin@disherio.com
Password: admin1234
```

**IMPORTANTE:** Cambia la contraseña después del primer login.

### 5. Verificar instalación

Después de la instalación, ejecuta:

```bash
sudo ./scripts/verify.sh
```

Este script verificará:
- ✅ Contenedores en ejecución
- ✅ Conectividad de red
- ✅ Acceso HTTP desde internet
- ✅ Estado de MongoDB
- ✅ API respondiendo correctamente

## Scripts adicionales

| Script | Descripción |
|---|---|
| `sudo ./scripts/configure.sh` | Reconfigurar red, dominio, contraseña o idioma |
| `sudo ./scripts/backup.sh` | Crear copia de seguridad de la base de datos |
| `sudo ./scripts/restart.sh` | Reiniciar todos los servicios |
| `sudo ./scripts/info.sh` | Ver IP, dominio, DNS y estado de los contenedores |
| `sudo ./scripts/verify.sh` | **Verificar instalación y conectividad** |

## Solución de Problemas

### Error 502 Bad Gateway

Si recibes error 502 al acceder:

1. Verificar que los contenedores están corriendo:
   ```bash
   sudo docker ps
   ```

2. Reiniciar Caddy:
   ```bash
   sudo docker restart disherio_caddy
   ```

3. Verificar logs:
   ```bash
   sudo docker logs disherio_caddy --tail 20
   sudo docker logs disherio_backend --tail 20
   ```

### Backend unhealthy o reiniciándose

Si el backend no se mantiene estable:

1. Verificar memoria disponible:
   ```bash
   free -h
   ```
   
   Si tienes menos de 1GB de RAM disponible, la VM puede estar matando el contenedor.

2. Verificar logs del backend:
   ```bash
   sudo docker logs disherio_backend --tail 50
   ```

3. Recrear el backend:
   ```bash
   cd /home/ubuntu/disherio
   sudo docker-compose stop backend
   sudo docker-compose rm backend
   sudo docker-compose up -d backend
   ```

### No se puede hacer login

Si el login falla con "Invalid credentials":

1. Verificar que el seed se ejecutó:
   ```bash
   sudo docker exec disherio_backend node /app/dist/seeders/index.js
   ```

2. Las credenciales por defecto son:
   - Email: `admin@disherio.com`
   - Password: `admin1234`

### Puerto 80 en uso

Si el puerto 80 está ocupado, el instalador detectará el conflicto. Puedes:
- Detener el servicio que usa el puerto 80
- O usar un puerto diferente editando el archivo `.env`

### Problemas de DNS entre contenedores

Si Caddy no puede conectar al backend:

```bash
# Verificar que los contenedores están en la misma red
sudo docker network inspect disherio_disherio_net

# Reiniciar Caddy para que reconozca los hostnames
sudo docker restart disherio_caddy
```
