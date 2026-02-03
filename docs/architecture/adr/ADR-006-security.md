# ADR-006: Seguridad Continua (ASVS)

## Estado
Aceptada

## Contexto
La seguridad no puede ser un chequeo final. Velox maneja datos sensibles (pagos, clientes) y debe garantizar confianza enterprise.

## Decision
Integrar seguridad en el ciclo de vida (DevSecOps):
1.  **OWASP ASVS L2:** Estandar de verificacion para modulos criticos.
2.  **Escaneo continuo:** Dependencias (`npm audit`) y Secretos en CI.
3.  **Principio de menor privilegio:** En base de datos y accesos de servicio.

## Consecuencias
### Positivas
- Reduccion proactiva de superficie de ataque.
- Confianza para clientes enterprise/corporativos.
- Cumplimiento normativo facilitado.

### Negativas
- Requiere esfuerzo continuo (no es "fire and forget").

## Alternativas Consideradas
- Auditorias puntuales: Rechazado por ventana de vulnerabilidad entre auditorias.
