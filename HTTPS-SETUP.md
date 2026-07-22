# Configuración HTTPS de DisherIo

Esta guía resume el comportamiento TLS que implementan actualmente los modos
de despliegue. La referencia operativa completa es
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) y el modelo de amenazas está en
[`docs/SECURITY.md`](docs/SECURITY.md).

## Modos compatibles

| Modo | Transporte del navegador | Uso previsto |
|------|--------------------------|--------------|
| `domain` | HTTPS automático de Caddy | Producción con dominio propio |
| `public-ip` | HTTPS terminado por Cloudflare Tunnel o ngrok | Acceso público mediante túnel |
| `local-ip` | HTTP y WebSocket sin cifrar | LAN de confianza, sin exposición pública |
| `local` | HTTP local | Desarrollo |

No se admite desplegar por HTTP directo en una IP pública. Para Internet use
un dominio o un túnel HTTPS. `local-ip` solo es aceptable si el firewall limita
el puerto a la subred del restaurante y no existe reenvío de puertos.

## Dominio propio (recomendado)

Antes de instalar:

1. Haga que el registro DNS del dominio apunte al servidor.
2. Permita TCP `80` y `443`; permita UDP `443` si desea HTTP/3.
3. Compruebe que ningún otro proceso ocupa esos puertos.

Ejecute el instalador y seleccione dominio:

```bash
sudo ./scripts/install.sh
```

Alternativamente, use el configurador multientorno:

```bash
./infrastructure/scripts/configure.sh
# Seleccione: domain
docker compose config --quiet
docker compose up -d --build --wait
```

El `Caddyfile` generado usa ACME automático, TLS 1.3 como versión mínima,
redirección HTTP a HTTPS, HSTS durante un año y renovación automática. Caddy
conserva certificados y estado en los volúmenes `disherio_caddy_data` y
`disherio_caddy_config`.

## Túnel HTTPS

El modo `public-ip` no publica puertos de Caddy en el host. Cloudflare Tunnel o
ngrok alcanza Caddy por `tunnel_net`, y el backend recibe el esquema público
HTTPS para emitir cookies `Secure`.

```bash
./infrastructure/scripts/configure.sh
# Seleccione public-ip y un solo proveedor
docker compose --profile cloudflare up -d --build --wait
# o
docker compose --profile ngrok up -d --build --wait
```

Los tokens solicitados por el configurador no se guardan en `.env`:

- Cloudflare: `config/secrets/cloudflare_tunnel_token`, consumido con
  `cloudflared --token-file`.
- ngrok: `config/secrets/ngrok_config`, configuración v3 montada como secreto.

Ambos archivos se crean con modo `0600` y están excluidos de Git. No copie el
token a variables Compose, comandos, incidencias o capturas de terminal.

## Certificados propios

El repositorio no incluye un override mantenido para certificados externos. Si
una instalación necesita un certificado propio, trátelo como una extensión del
despliegue: monte certificado y clave como archivos de solo lectura, configure
la directiva `tls` del Caddyfile generado y valide la configuración resuelta.
Nunca copie una clave privada al repositorio ni a una imagen.

```bash
docker compose config --quiet
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
```

No edite `infrastructure/docker-compose.prod.yml` suponiendo que ya monta
`./certs`; esa ruta no forma parte de la configuración actual.

## Cabeceras de producción

El template `Caddyfile.domain` configura:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` con scripts solo desde `'self'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`
- una `Permissions-Policy` restrictiva

`style-src 'unsafe-inline'` es la excepción documentada que necesita el estilo
inyectado por Angular. No se permite `unsafe-inline` ni `unsafe-eval` para
scripts. El modo de producción permite `wss:`; solo los modos HTTP locales
permiten `ws:`.

## Verificación

```bash
docker compose ps
docker compose logs --tail=100 caddy
curl -I http://su-dominio.example
curl -I https://su-dominio.example
openssl s_client -connect su-dominio.example:443 -tls1_3 </dev/null
```

La redirección HTTP debe apuntar a HTTPS y la respuesta HTTPS debe incluir las
cabeceras anteriores. `/metrics` debe devolver `403` a través de Caddy. Los
endpoints `/health*` también están protegidos en el backend: solo aceptan una IP
privada/loopback o `x-internal-token` válido.

## Diagnóstico

Si ACME no emite el certificado, confirme DNS, acceso entrante a TCP `80/443`,
hora del sistema y logs de Caddy. Si Socket.IO falla, confirme que
`FRONTEND_URL` coincide exactamente con el origen HTTPS y que el proxy conserva
`X-Forwarded-Proto`. No desactive `Secure`, HSTS o la validación de origen para
resolver un error de configuración.
