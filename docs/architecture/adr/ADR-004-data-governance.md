# ADR-004: Data Governance estricto de migraciones

## Estado
Aceptada

## Contexto
El historial de migraciones presenta colisiones de versionado y una mezcla de cambios estructurales con correcciones de datos. Esto genera riesgos al desplegar en nuevos entornos o recuperar backups.

## Decision
Establecer un gobierno estricto de datos:
1.  **Versionado unico:** Timestamp-based o secuencial estricto sin colisiones.
2.  **Separacion de scripts:** Migraciones de esquema (DDL) separadas de correcciones de datos (DML operacional).
3.  **Inmutabilidad:** Las migraciones ya ejecutadas nunca se editan.

## Consecuencias
### Positivas
- Despliegues deterministas y repetibles.
- Menor deuda tecnica en base de datos.
- Facilita la creacion de entornos de staging.

### Negativas
- Requiere disciplina de equipo (code review estricto en SQL).

## Alternativas Consideradas
- Scripts ad-hoc: Rechazado por riesgo de inconsistencia.
