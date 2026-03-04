# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x | Yes |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Disher.io, please report it responsibly:

1. **Email:** Open a private [GitHub Security Advisory](https://github.com/ismailhaddouche/disherio/security/advisories/new) in this repository.
2. **Include in your report:**
   - A description of the vulnerability
   - Steps to reproduce it
   - The potential impact
   - Any suggested fix (optional)

We will acknowledge your report within **72 hours** and aim to release a fix within **14 days** for critical issues.

We will credit you in the release notes unless you prefer to remain anonymous.

---

## Security Architecture

Disher.io implements the following security controls:

### Transport
- Caddy enforces HTTPS with automatic TLS (Let's Encrypt)
- HTTP Strict Transport Security (HSTS) with a 1-year max-age
- TLS applies to all production deployments automatically

### HTTP Headers (via Helmet)
- `Content-Security-Policy` — restricts resource loading
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation

### Authentication
- JWT tokens with HS256 signing and 24-hour expiry
- Passwords hashed with bcrypt (cost factor 10)
- Inactive accounts cannot log in (`active: false` flag)

### Authorization
- Role-Based Access Control (RBAC): `admin`, `kitchen`, `pos`, `customer`
- Every protected route checks token validity before executing
- Admin-only endpoints verify the `admin` role explicitly

### Rate Limiting
- Global: 100 requests per 15 minutes per IP address
- Login endpoint: 10 attempts per 15 minutes per IP (brute-force protection)
- Request body size: 1 MB limit on all endpoints

### Input Validation
- All route handlers validate and sanitize input using `express-validator`
- MongoDB IDs validated as valid ObjectIds before any query
- Enum fields (role, status, payment method) validated against allowed values
- Required fields rejected with 400 if missing or empty

### Container Security
- Backend and frontend run as non-root user (UID 1001)
- Caddy admin API is disabled in production

---

## Known Limitations

- **MongoDB authentication:** The default Docker Compose configuration does not enable MongoDB authentication. For production deployments, enable `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` in your `.env` and update `MONGODB_URI` accordingly.
- **Default credentials:** The development seed creates an admin account with `admin`/`password`. This must be changed before any non-development use.

---

## Security Best Practices for Operators

### Before Going Live

- [ ] Change the default `admin` password
- [ ] Set a strong, random `JWT_SECRET` (minimum 32 characters, use `openssl rand -hex 32`)
- [ ] Set `DOMAIN` to your actual domain — do not leave it as `localhost` in production
- [ ] Set `INSTALL_MODE=production` for internet-facing deployments
- [ ] Enable MongoDB authentication if running on a shared or internet-accessible server

### Ongoing

- [ ] Keep Docker base images updated (`docker compose pull && docker compose up -d --build`)
- [ ] Review activity logs periodically (`GET /api/logs`)
- [ ] Rotate the `JWT_SECRET` if you suspect it has been exposed (this signs out all users)
- [ ] Monitor Trivy scan results in your CI/CD pipeline for new CVEs in dependencies
- [ ] Back up the database daily and test restores periodically

### Network

- [ ] Restrict port 27017 (MongoDB) so it is not accessible from outside the Docker network
- [ ] Use a firewall to allow only ports 80 and 443 from the internet
- [ ] In local mode, restrict access to your LAN subnet only
