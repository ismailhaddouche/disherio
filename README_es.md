# DisherIo

[Versión en Inglés (README.md)](README.md) | [Version Française (README_fr.md)](README_fr.md)

DisherIo es una plataforma integrada de gestión de restaurantes que proporciona soluciones para pedidos de autoservicio, asistencia en mesa, sistemas de visualización en cocina (KDS) y operaciones de punto de venta (POS).

## Índice de Documentación

- [Guía de instalación en inglés](docs/INSTALL.md): Requisitos del sistema y procedimientos de despliegue.
- [Configuración y mantenimiento en inglés](docs/CONFIGURE.md): Gestión operativa y uso de scripts.
- [Arquitectura y stack tecnológico en inglés](docs/ARCHITECTURE.md): Resumen técnico y patrones de diseño.
- [Resolución de problemas en inglés](docs/ERRORS.md): Resolución de errores y procedimientos de diagnóstico.

## Módulos Principales

- Tótem de Autoservicio: Interfaz de cliente para la realización de pedidos mediante autenticación por código QR.
- Sistema de Visualización en Cocina (KDS): Gestión del ciclo de vida de pedidos en tiempo real para operaciones de cocina.
- Punto de Venta (POS): Procesamiento de transacciones, pagos e historial. Cerrar una sesión la mantiene disponible para cobrar; archivarla liquida sus tickets, la retira de las vistas activas y la conserva en el historial.
- Servicio de Asistencia en Mesa (TAS): Herramientas digitales para camareros destinadas a la gestión de mesas y solicitudes de servicio.
- Panel Administrativo: Analíticas centralizadas, administración de personal y configuración de menús.

## Stack Tecnológico

- Frontend: Angular 21, TailwindCSS, Socket.IO Client.
- Backend: Node.js (Express 5), Socket.IO, Mongoose 9.
- Base de datos: MongoDB 7.
- Estado compartido: Redis 7 para caché, Socket.IO y ciclo de vida de
  tokens.
- Infraestructura: Docker, Caddy (Proxy Inverso).
- Observabilidad: logs estructurados de Pino, endpoints de salud y `/metrics`
  solo en la red interna del backend.
- Lenguaje: TypeScript 5.

DisherIo no incluye Grafana, un servidor Prometheus, Alertmanager ni
exportadores de métricas. El endpoint interno `/metrics` conserva el formato
de exposición de Prometheus para integraciones externas opcionales, pero Caddy
no lo publica y la topología Compose predeterminada no lo recopila.

Para especificaciones técnicas, consulte la [documentación de arquitectura en inglés](docs/ARCHITECTURE.md).

## Despliegue

Despliegue automatizado estándar en Linux:

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
sudo ./scripts/install.sh
```

Las instrucciones detalladas están disponibles en la [guía de instalación en inglés](docs/INSTALL.md).

## Marco de Mantenimiento

El directorio `scripts/` contiene herramientas para la administración del sistema:

- install.sh: Orquesta el despliegue completo del sistema.
- configure.sh: Gestiona parámetros de red y credenciales administrativas.
- backup.sh: Respalda la base de datos, imágenes y configuración de despliegue.
- restore.sh: Verifica y restaura un respaldo compatible.
- info.sh: Muestra el estado de los servicios y la información de acceso.
- check-resources.sh: Realiza comprobaciones locales de CPU y memoria bajo
  demanda o en una terminal; no es un servicio de monitorización.

Consulte la [guía de configuración en inglés](docs/CONFIGURE.md) para detalles operativos.

## Licencia

DisherIo es software de código abierto publicado bajo la [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). Puede utilizarse, copiarse, modificarse y distribuirse conforme a los términos de esta licencia.

Las versiones modificadas y las obras basadas en DisherIo deben conservar la misma licencia y los avisos de licencia y copyright, indicar los cambios significativos y ofrecer su código fuente correspondiente completo. Esta obligación también se aplica cuando una versión modificada se proporciona a usuarios a través de una red.

Copyright (C) Ismail Haddouche Rhali.
