# DisherIo Documentation

Central index of the project documentation. All documents are in English.

## For Users

| Document | Description |
|----------|-------------|
| [User Guide](USER_GUIDE.md) | Annotated walkthrough of every module (Admin, KDS, POS, TAS, customer totem) with screenshots |

## For Operators

| Document | Description |
|----------|-------------|
| [Installation Guide](INSTALL.md) | System requirements, guided installer, deployment procedures |
| [Configuration and Maintenance](CONFIGURE.md) | Script usage, hot-reconfiguration, backups, and local resource checks |
| [Deployment and Infrastructure Guide](DEPLOYMENT.md) | Deployment modes, infrastructure topology, security, operation, and scaling |
| [HTTPS and TLS Setup](HTTPS.md) | TLS modes, certificates, security headers, verification, and troubleshooting |
| [Troubleshooting](ERRORS.md) | Error codes, diagnostic procedures, log inspection |
| [Uninstallation Guide](UNINSTALL.md) | Full decommissioning procedures |

## For Developers

| Document | Description |
|----------|-------------|
| [Development Guide](DEVELOPMENT.md) | Local setup, verification commands, frontend build/test standards |
| [Architecture and Technology Stack](ARCHITECTURE.md) | Service topology, design patterns, security model |
| [API Reference](API_CONTRACTS.md) | HTTP routes and Socket.IO event contracts, verified against route definitions |
| [Error Codes Reference](ERROR_CODES.md) | Complete ErrorCode enum with HTTP status mapping |
| [Database Migrations](MIGRATIONS.md) | Versioned migration runner and authoring rules |
| [Complete Technical Documentation](COMPLETE_TECHNICAL_DOCUMENTATION.md) | Consolidated high-level technical reference |

### Architecture Decision Records

| ADR | Decision |
|-----|----------|
| [ADR-001](architecture/ADR-001-folder-structure.md) | Folder structure |
| [ADR-002](architecture/ADR-002-repository-pattern.md) | Repository pattern |
| [ADR-003](architecture/ADR-003-state-management.md) | Frontend state management (Angular Signals) |
| [ADR-004](architecture/ADR-004-validation-types.md) | Shared validation and types (Zod) |

## Security

| Document | Description |
|----------|-------------|
| [Security Model and Audit Guide](SECURITY.md) | Enforced controls, trust boundaries, accepted limitations, audit classification |

## Assets

- `images/` — screenshots for the README gallery and the User Guide, plus the demo totem QR
