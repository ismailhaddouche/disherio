# Política de Seguridad

## Versiones Soportadas

| Versión | Soportada |
|---------|-----------|
| 1.0.x | Sí |

---

## Reportar una Vulnerabilidad

**No abras un issue público de GitHub para vulnerabilidades de seguridad.**

Si descubres una vulnerabilidad de seguridad en Disher.io, por favor repórtala de manera responsable:

1. **Email:** Abre un [Aviso de Seguridad Privado de GitHub](https://github.com/ismailhaddouche/disherio/security/advisories/new) en este repositorio.
2. **Incluye en tu reporte:**
   - Una descripción de la vulnerabilidad
   - Pasos para reproducirla
   - Impacto potencial
   - Cualquier mitigación conocida

3. **Qué esperar después de reportar:**
   - Acusaremos recibo de tu reporte dentro de 48 horas
   - Evaluaremos la vulnerabilidad y determinaremos su severidad
   - Te informaremos sobre nuestro plan para abordarla
   - Te avisaremos antes de hacer pública cualquier corrección

---

## Política de Divulgación

- **Tiempo de corrección:** Nos comprometemos a lanzar una corrección dentro de 30 días para vulnerabilidades críticas y 90 días para vulnerabilidades de menor severidad.
- **Divulgación coordinada:** Trabajaremos contigo para determinar el momento apropiado para la divulgación pública.
- **Reconocimiento:** Agradeceremos tu contribución en los lanzamientos de seguridad (si lo deseas).

---

## Mejores Prácticas de Seguridad

Para usuarios que despliegan Disher.io:

### Instalación
- Siempre usa la última versión estable
- Cambia las contraseñas por defecto después de la instalación
- Configura HTTPS con certificados válidos para despliegues públicos
- Mantén el sistema actualizado (Docker, sistema operativo)

### Operación
- Limita el acceso de red a solo los puertos necesarios (80, 443)
- Usa firewalls para restringir el acceso al backend
- Realiza copias de seguridad regulares de la base de datos
- Monitorea los logs en busca de actividades sospechosas

### Datos
- Encripta las copias de seguridad en reposo
- Usa conexiones seguras (HTTPS/WSS) en producción
- Considera cifrado de disco para datos sensibles
- Implementa políticas de retención de datos apropiadas

---

## Contacto de Seguridad

Para preguntas sobre seguridad que no sean vulnerabilidades específicas:

- **Email de seguridad:** Por favor usa el sistema de avisos de seguridad de GitHub mencionado arriba
- **Asuntos generales:** Abre un issue normal con la etiqueta `security-question`

---

## Agradecimientos

Agradecemos a todos los investigadores de seguridad que ayudan a mantener Disher.io seguro para toda la comunidad.
