# Uninstallation Guide

[Spanish Version (UNINSTALL_es.md)](UNINSTALL_es.md) | [French Version (UNINSTALL_fr.md)](UNINSTALL_fr.md)

This document describes the procedures for completely removing the DisherIo platform from your system.

> **Warning:** All operations on this page are irreversible. Back up your data before proceeding.

---

## 1. Stop and Remove Containers

Stop all services and remove containers, networks, volumes, and orphaned containers:

```bash
cd disherio
docker compose down --volumes --remove-orphans
```

This command:
- Stops and removes all DisherIo containers (`disherio_mongo`, `disherio_backend`, `disherio_frontend`, `disherio_caddy`)
- Removes associated Docker networks (`disherio_disherio_net`)
- Removes persistent volumes (`mongo_data`, `uploads`, `caddy_data`, `caddy_config`)
- Removes any orphaned containers not defined in the current `docker-compose.yml`

---

## 2. Remove Custom Images

Remove the application images built during installation:

```bash
docker rmi disherio-backend:latest disherio-frontend:latest
```

---

## 3. Prune Unused Base Images

Remove base images pulled during installation that are no longer in use:

```bash
docker image prune -af
```

This removes all dangling and unused images from the system, including `mongo:7`, `caddy:2-alpine`, and `node:20-alpine` if no other project references them.

---

## 4. Remove the Project Directory

```bash
rm -rf /path/to/disherio
```

Replace `/path/to/disherio` with the actual path to your installation directory.

---

## Summary

| Step | Command | Effect |
|------|---------|--------|
| 1 | `docker compose down --volumes --remove-orphans` | Removes containers, networks, volumes, orphans |
| 2 | `docker rmi disherio-backend:latest disherio-frontend:latest` | Removes custom images |
| 3 | `docker image prune -af` | Removes unused base images |
| 4 | `rm -rf /path/to/disherio` | Removes project directory |
