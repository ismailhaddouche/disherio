# Guía de Mantenimiento de Disher.io v2.6

Esta guía cubre backups, restauraciones, actualizaciones y seguridad para un despliegue de Disher.io.

---

## Backups y Restauración de la Base de Datos

### 1. Crear un Backup (Recomendado)

Usa el script automatizado `backup.sh` incluido en la raíz del proyecto para crear copias de seguridad consistentes y comprimidas.

```bash
chmod +x backup.sh
sudo ./backup.sh
```

El script generará un archivo `backups/disher_backup_YYYY-MM-DD_HH-MM-SS.tar.gz`. Solo se mantienen las últimas 7 copias para preservar el espacio en disco.

**Guarda este archivo en una ubicación externa y segura.**

### 2. Restaurar desde un Backup

> **Advertencia:** La restauración sobrescribe todos los datos actuales.

```bash
# 1. Carga las variables de entorno desde tu archivo .env
# ¡Este paso es CRÍTICO para la autenticación!
export $(cat .env | grep -v '^#' | xargs)

# 2. Detén el servicio del backend para evitar conflictos
sudo docker compose stop backend

# 3. Ejecuta el comando de restauración
# Usa "database", que es el nombre oficial del servicio.
# Reemplaza "backup-file.tar.gz" con el nombre de tu archivo.
sudo docker exec -i database mongorestore \
    --username="$MONGO_INITDB_ROOT_USERNAME" \
    --password="$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase=admin \
    --archive --gzip --drop < backup-file.tar.gz

# 4. Reinicia el backend
sudo docker compose start backend
```

### 3. Automatización de Backups (Cron Job)

Para automatizar backups, usa un cron job. Asegúrate de que el script que se ejecuta cargue primero las variables de entorno.

**Paso A: Crea un script de backup (`/opt/disher_backup.sh`)**

```bash
#!/bin/bash

# Carga el entorno desde el directorio de Disher.io
cd /home/user/disherio # <-- Ajusta esta ruta a tu directorio de proyecto
export $(cat .env | grep -v '^#' | xargs)

# Define el directorio de backups
BACKUP_DIR="/var/backups/disher"
mkdir -p "$BACKUP_DIR"

# Ejecuta el backup
docker compose exec -T database mongodump \
    --username="$MONGO_INITDB_ROOT_USERNAME" \
    --password="$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase=admin \
    --archive --db=disher --gzip > "$BACKUP_DIR/disher-backup-$(date +%Y-%m-%d).tar.gz"
```

**Paso B: Añade el script al cron**

```bash
# Abre el editor de crontab
crontab -e

# Añade esta línea para un backup diario a las 4:00 AM (ajusta la ruta)
0 4 * * * cd /home/usuario/disherio && ./backup.sh > /dev/null 2>&1
```

---

## Gestión de Credenciales y Seguridad

### Cambiar Contraseñas de Usuario

Utiliza el script de configuración para cambiar contraseñas de forma segura.

```bash
sudo ./configure.sh
```

1.  Selecciona la opción **"1) Cambiar la contraseña de un usuario"**.
2.  Introduce el nombre del usuario (`admin`, `waiter`, etc.) y la nueva contraseña.

### Rotar el Secreto de Sesión (JWT_SECRET)

Si crees que tu secreto de sesión ha sido expuesto, genera uno nuevo.

```bash
# 1. Genera un nuevo secreto
openssl rand -hex 32

# 2. Actualiza el valor de JWT_SECRET en tu archivo .env
sudo nano .env

# 3. Reinicia el backend para aplicar el cambio
# Esto cerrará todas las sesiones activas.
sudo docker compose restart backend
```

---

## Actualizaciones y Diagnósticos

### Actualizar la Aplicación

El script de instalación también sirve para actualizar.

```bash
# 1. Obtén los últimos cambios
git pull origin main

# 2. Ejecuta el instalador en modo actualización
sudo ./install.sh
```

### Exportar Logs de Diagnóstico

Usa la opción **"6) Exportar Logs de Diagnóstico"** en `sudo ./configure.sh` para obtener un archivo con todos los logs del sistema.
