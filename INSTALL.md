# Installation Guide

## Requirements

- Ubuntu 20.04+ or Debian 11+
- Root access or `sudo`
- Ports 80 and 443 available
- 2 GB RAM recommended

## Steps

### 1. Clone the repository

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
```

### 2. Run the installer

```bash
sudo ./scripts/install.sh
```

The installer will:

1. Ask how to expose the application (public domain, public IP, or local IP)
2. Install Docker and Docker Compose if not present
3. Configure the firewall (ports 22, 80, 443)
4. Generate a random `JWT_SECRET` and admin password
5. Write `.env` and `Caddyfile`
6. Build Docker images
7. Start all services
8. Create the admin user in the database
9. Print the access URL and credentials

### 3. Output

When installation completes you will see:

```
URL         :  http://1.2.3.4
Admin user  :  admin
Password    :  <randomly generated>
```

Save the password. It is not stored anywhere in plain text after this point.

---

## Cloud Provider Network Rules

Open ports 80 and 443 before running the installer.

### Google Cloud Platform

```bash
gcloud compute firewall-rules create allow-http \
  --direction=INGRESS --rules=tcp:80 \
  --source-ranges=0.0.0.0/0 --target-tags=http-server

gcloud compute firewall-rules create allow-https \
  --direction=INGRESS --rules=tcp:443 \
  --source-ranges=0.0.0.0/0 --target-tags=https-server

gcloud compute instances add-tags INSTANCE_NAME \
  --tags=http-server,https-server --zone=ZONE
```

### AWS

Add an inbound rule to the Security Group allowing TCP 80 and 443 from `0.0.0.0/0`.

### Azure

Add inbound rules to the Network Security Group for ports 80 and 443.

---

## Access Modes

### Public domain with HTTPS

Choose option 1 and enter your domain (e.g. `app.example.com`). Caddy will obtain and renew a Let's Encrypt certificate automatically.

DNS records required before the installer runs:

```
A   @    <server public IP>
A   www  <server public IP>
```

### Public IP

Choose option 2. The app is served over HTTP on port 80 using the detected public IP.

### Local IP

Choose option 3. The app is served over HTTP on port 80 using the machine's LAN IP. Suitable for local network deployments.

---

## Post-Installation Management

| Script | Purpose |
|--------|---------|
| `sudo ./scripts/configure.sh` | Change domain, port, or admin password |
| `sudo ./scripts/backup.sh` | Back up the database |
| `sudo ./scripts/info.sh` | Show service status and access URLs |

---

## Troubleshooting

### Backend does not start

```bash
sudo docker logs disherio_backend --tail 50
```

Common cause: `JWT_SECRET` missing or too short. Check `.env`.

### HTTP 502 Bad Gateway

```bash
sudo docker ps                         # verify all containers are running
sudo docker restart disherio_caddy     # reload the proxy
sudo docker logs disherio_caddy --tail 20
```

### Cannot log in

Verify the admin user exists:

```bash
sudo docker compose exec mongo mongosh disherio \
  --eval "db.staffs.find({ username: 'admin' }).pretty()"
```

Reset the admin password:

```bash
sudo ./scripts/configure.sh
# Select option 3: Reset admin password
```

### Low memory (under 1 GB available)

The backend container may be killed by the OS. Check:

```bash
free -h
sudo docker logs disherio_backend --tail 50
```

Consider upgrading the server or reducing other running processes.
