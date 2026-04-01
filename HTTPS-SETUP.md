# Configuración HTTPS - DisherIO

## Resumen de Cambios

Se ha configurado HTTPS obligatorio en el proyecto con las siguientes características:

- ✅ Redirección automática HTTP → HTTPS
- ✅ TLS 1.3 como protocolo mínimo
- ✅ Headers de seguridad HSTS activados
- ✅ WebSockets seguros (WSS)
- ✅ HTTP/3 (QUIC) soportado

---

## Certificados TLS

### Opción 1: Let's Encrypt (Recomendado para producción pública)

Caddy obtiene automáticamente certificados de Let's Encrypt cuando:

1. El servidor es accesible públicamente en Internet
2. El dominio apunta a la IP del servidor
3. Los puertos 80 y 443 están abiertos

```bash
# Ejemplo: Si tu dominio es disherio.tudominio.com
# Simplemente configura el DNS y Caddy hará el resto automáticamente
```

### Opción 2: Certificados Personalizados

Si tienes certificados propios (ej: wildcard de tu proveedor):

1. Coloca los archivos en el servidor:
   ```bash
   mkdir -p ./certs
   cp tu-certificado.crt ./certs/cert.pem
   cp tu-llave-privada.key ./certs/key.pem
   ```

2. Modifica el Caddyfile:
   ```caddyfile
   :443 {
       tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem
       # ... resto de configuración
   }
   ```

3. Actualiza docker-compose.prod.yml:
   ```yaml
   caddy:
     volumes:
       - ./certs:/etc/caddy/certs:ro
       # ... otros volúmenes
   ```

### Opción 3: Certificados Autofirmados (Desarrollo/Testing local)

```bash
# Generar certificado autofirmado
mkdir -p ./certs
cd ./certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=ES/ST=State/L=City/O=DisherIO/CN=localhost"

# Modificar Caddyfile para usar certificados locales
tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem
```

---

## Despliegue en Producción

### 1. Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
# Puerto HTTP (redirige a HTTPS)
PORT=80

# Puerto HTTPS
HTTPS_PORT=443

# URL pública del frontend (IMPORTANTE: usar https://)
FRONTEND_URL=https://tudominio.com

# JWT Secret (generar uno seguro)
JWT_SECRET=tu-secreto-muy-seguro-aqui-minimo-32-caracteres

# Nivel de logs
LOG_LEVEL=info
```

### 2. Iniciar Servicios

```bash
# Descargar imágenes y construir
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml build

# Iniciar en modo detached
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f caddy
```

### 3. Verificar HTTPS

```bash
# Test de redirección HTTP→HTTPS
curl -I http://tudominio.com
# Debe retornar: 301 Moved Permanently → https://

# Verificar TLS 1.3
openssl s_client -connect tudominio.com:443 -tls1_3

# Verificar headers de seguridad
curl -I https://tudominio.com
```

---

## Headers de Seguridad Configurados

| Header | Valor | Propósito |
|--------|-------|-----------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Fuerza HTTPS por 1 año |
| `X-Content-Type-Options` | `nosniff` | Previene sniffing MIME |
| `X-Frame-Options` | `SAMEORIGIN` | Protección contra clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Filtro XSS del navegador |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control de referrer |
| `Content-Security-Policy` | Ver Caddyfile | Previene XSS e inyecciones |

---

## Solución de Problemas

### Certificados no se generan

```bash
# Verificar logs de Caddy
docker-compose -f docker-compose.prod.yml logs caddy

# Verificar que los puertos estén abiertos
sudo netstat -tlnp | grep -E '80|443'

# Verificar DNS
dig +short tudominio.com
```

### WebSockets no funcionan (WSS)

```bash
# Verificar que Caddy está redirigiendo /socket.io correctamente
curl -I https://tudominio.com/socket.io/

# El frontend usa automáticamente wss:// cuando la página está en https://
```

### Errores de certificado en navegador

- **Certificado no válido**: Asegúrate de usar un dominio válido para Let's Encrypt
- **Certificado autofirmado**: Agrega excepción en el navegador para testing

---

## Renovación Automática

Caddy renueva automáticamente los certificados de Let's Encrypt antes de que expiren. No se requiere acción manual.

Para monitorear:
```bash
# Ver estado de certificados en el volumen
docker exec disherio_caddy ls -la /data/caddy/certificates/
```

---

## Referencias

- [Caddy HTTPS Documentation](https://caddyserver.com/docs/automatic-https)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
