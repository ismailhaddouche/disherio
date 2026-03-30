# Guía de Desinstalación

[English Version (UNINSTALL.md)](UNINSTALL.md) | [Version Française (UNINSTALL_fr.md)](UNINSTALL_fr.md)

Este documento describe los procedimientos para eliminar completamente la plataforma DisherIo del sistema.

> **Advertencia:** Todas las operaciones de esta página son irreversibles. Realiza una copia de seguridad de tus datos antes de continuar.

---

## 1. Detener y Eliminar Contenedores

Detiene todos los servicios y elimina contenedores, redes, volúmenes y contenedores huérfanos:

```bash
cd disherio
docker compose down --volumes --remove-orphans
```

Este comando:
- Detiene y elimina todos los contenedores de DisherIO (`disherio_mongo`, `disherio_backend`, `disherio_frontend`, `disherio_caddy`)
- Elimina las redes Docker asociadas (`disherio_disherio_net`)
- Elimina los volúmenes persistentes (`mongo_data`, `uploads`, `caddy_data`, `caddy_config`)
- Elimina cualquier contenedor huérfano no definido en el `docker-compose.yml` actual

---

## 2. Eliminar Imágenes Personalizadas

Elimina las imágenes de la aplicación construidas durante la instalación:

```bash
docker rmi disherio-backend:latest disherio-frontend:latest
```

---

## 3. Limpiar Imágenes Base Sin Uso

Elimina las imágenes base descargadas durante la instalación que ya no están en uso:

```bash
docker image prune -af
```

Esto elimina todas las imágenes huérfanas y sin uso del sistema, incluyendo `mongo:7`, `caddy:2-alpine` y `node:20-alpine` si ningún otro proyecto las referencia.

---

## 4. Eliminar el Directorio del Proyecto

```bash
rm -rf /ruta/hacia/disherio
```

Reemplaza `/ruta/hacia/disherio` con la ruta real de tu directorio de instalación.

---

## Resumen

| Paso | Comando | Efecto |
|------|---------|--------|
| 1 | `docker compose down --volumes --remove-orphans` | Elimina contenedores, redes, volúmenes y huérfanos |
| 2 | `docker rmi disherio-backend:latest disherio-frontend:latest` | Elimina imágenes personalizadas |
| 3 | `docker image prune -af` | Elimina imágenes base sin uso |
| 4 | `rm -rf /ruta/hacia/disherio` | Elimina el directorio del proyecto |
