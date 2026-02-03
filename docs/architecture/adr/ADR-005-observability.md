# ADR-005: SRE + Observabilidad Estandar

## Estado
Aceptada

## Contexto
La operacion a escala requiere visibilidad real. Logs dispersos no son suficientes para diagnosticar problemas de latencia o disponibilidad en un sistema distribuido/modular.

## Decision
Adoptar estandares de SRE y Observabilidad:
1.  **OpenTelemetry:** Como estandar de instrumentacion para trazas y metricas.
2.  **SLOs (Service Level Objectives):** Definir objetivos claros de disponibilidad y latencia.
3.  **Error Budgets:** Monitorear el consumo de presupuesto de error para decidir releases.

## Consecuencias
### Positivas
- MTTR (Mean Time To Recovery) reducido radicalmente.
- Decisiones basadas en datos reales de operacion.
- Trazabilidad end-to-end entre frontend y backend.

### Negativas
- Costo inicial de instrumentacion.
- Curva de aprendizaje de conceptos SRE.

## Alternativas Consideradas
- Logs simples: Rechazado por incapacidad de correlacion efectiva.
