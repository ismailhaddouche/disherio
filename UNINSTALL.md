# Uninstallation

Warning: this process permanently deletes all application data including the database. Back up first.

## 1. Back up the database (recommended)

```bash
sudo ./scripts/backup.sh
```

Backups are stored in `/var/backups/disherio/`.

## 2. Stop and remove all containers, images, volumes, and networks

```bash
cd disherio
docker compose down --rmi all --volumes --remove-orphans
```

This removes:

- Containers: `disherio_backend`, `disherio_frontend`, `disherio_mongo`, `disherio_caddy`
- Locally built images
- Volumes: `mongo_data`, `disherio_uploads`, `caddy_data`, `caddy_config`
- Network: `disherio_net`

## 3. Delete the project directory

```bash
cd ..
rm -rf disherio
```

## Complete uninstall in one block

```bash
cd disherio
docker compose down --rmi all --volumes --remove-orphans
cd ..
rm -rf disherio
```

## Optional: remove unused Docker resources system-wide

```bash
docker system prune -af --volumes
```

Note: this command affects all Docker resources on the system, not only DisherIo ones. Do not run it if other Docker projects are active on the same machine.
