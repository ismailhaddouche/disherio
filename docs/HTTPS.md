# HTTPS and TLS Setup

This guide explains how DisherIo serves traffic over HTTPS in each deployment
mode, how to verify a correct setup, and how to diagnose common TLS problems.
The operational reference for deployment modes is
[Deployment and Infrastructure Guide](DEPLOYMENT.md); the trust model is
[Security Model and Audit Guide](SECURITY.md).

---

## Supported Modes

| Mode | Browser transport | Intended use |
|------|-------------------|--------------|
| `domain` | Automatic HTTPS from Caddy | Production with your own domain |
| `public-ip` | HTTPS terminated by Cloudflare Tunnel or ngrok | Public access through a tunnel |
| `local-ip` | Unencrypted HTTP and WebSocket | Trusted LAN, no public exposure |
| `local` | Local HTTP | Development |

Serving plain HTTP directly on a public IP is not supported. For Internet
exposure use a domain or an HTTPS tunnel. `local-ip` is only acceptable when
the firewall restricts the port to the restaurant subnet and no port
forwarding exists.

---

## Own Domain (Recommended)

Before installing:

1. Point the domain's DNS record at the server.
2. Allow TCP `80` and `443`; allow UDP `443` if you want HTTP/3.
3. Confirm no other process is bound to those ports.

Run the installer and choose the domain mode:

```bash
sudo ./scripts/install.sh
```

Alternatively, use the multi-environment configurator:

```bash
./infrastructure/scripts/configure.sh
# Select: domain
docker compose config --quiet
docker compose up -d --build --wait
```

The generated `Caddyfile` uses automatic ACME, TLS 1.3 as minimum version,
HTTP-to-HTTPS redirect, one-year HSTS, and automatic renewal. Caddy keeps
certificates and state in the `disherio_caddy_data` and
`disherio_caddy_config` volumes.

---

## HTTPS Tunnel

The `public-ip` mode does not publish Caddy ports on the host. Cloudflare
Tunnel or ngrok reaches Caddy through `tunnel_net`, and the backend receives
the public HTTPS scheme so it can issue `Secure` cookies.

```bash
./infrastructure/scripts/configure.sh
# Select public-ip and a single provider
docker compose --profile cloudflare up -d --build --wait
# or
docker compose --profile ngrok up -d --build --wait
```

Tokens requested by the configurator are not stored in `.env`:

- Cloudflare: `config/secrets/cloudflare_tunnel_token`, consumed with
  `cloudflared --token-file`.
- ngrok: `config/secrets/ngrok_config`, a v3 configuration mounted as a
  secret.

Both files are created with mode `0600` and are excluded from Git. Do not copy
the token into Compose variables, commands, issues, or terminal screenshots.

---

## Custom Certificates

The repository does not ship a maintained override for externally issued
certificates. If an installation needs its own certificate, treat it as a
deployment extension: mount the certificate and key as read-only files, set
the `tls` directive in the generated Caddyfile, and validate the resolved
configuration. Never copy a private key into the repository or an image.

```bash
docker compose config --quiet
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
```

Do not edit `infrastructure/docker-compose.prod.yml` assuming it already
mounts `./certs`; that path is not part of the current configuration.

---

## Production Security Headers

The `Caddyfile.domain` template sets:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` with scripts only from `'self'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`
- A restrictive `Permissions-Policy`

`style-src 'unsafe-inline'` is the documented exception required by Angular's
injected runtime styles. Neither `unsafe-inline` nor `unsafe-eval` is allowed
for scripts. Production modes permit `wss:`; only the local HTTP modes permit
`ws:`. The shared header block lives in
`infrastructure/caddy-templates/security-headers.conf` and is imported by the
domain/tunnel templates.

---

## Verification

```bash
docker compose ps
docker compose logs --tail=100 caddy
curl -I http://your-domain.example
curl -I https://your-domain.example
openssl s_client -connect your-domain.example:443 -tls1_3 </dev/null
```

The HTTP response must redirect to HTTPS, and the HTTPS response must include
the headers listed above. `/metrics` must return `403` through Caddy. The
`/health*` endpoints are also restricted in the backend: they only accept a
private/loopback source IP or a valid `x-internal-token`.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| ACME does not issue the certificate | DNS resolution, inbound TCP `80/443`, system clock, Caddy logs |
| Socket.IO fails to connect | `FRONTEND_URL` matches the HTTPS origin exactly; the proxy preserves `X-Forwarded-Proto` |
| Login works but the session is lost | Cookies must be `Secure` on HTTPS; confirm the browser is not blocking third-party context |

Do not disable `Secure` cookies, HSTS, or origin validation to work around a
configuration error.
