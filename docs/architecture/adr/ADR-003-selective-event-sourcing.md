# ADR-003: Event Sourcing selectivo

## Estado
Aceptada (Dominios criticos)

## Contexto
Ciertos dominios de Velox (Ventas, Pagos, Inventario) requieren auditoria estricta, trazabilidad total y soporte para sincronizacion offline. CRUD tradicional pierde la historia de "por que" cambio un estado.

## Decision
Implementar **Event Sourcing** unicamente en los dominios criticos:
- Ventas (Sales)
- Pagos (Payments)
- Inventario (Inventory)
- Sincronizacion (Sync)

Los demas dominios (Catalogo, Clientes simples, Config) pueden mantenerse com CRUD o Event-Driven simple sin sourcing completo.

## Consecuencias
### Positivas
- Auditoria natural (el log es la verdad).
- Reconciliacion robusta para escenarios offline.
- Posibilidad de "Time Travel" debugging.

### Negativas
- Complejidad en modelado y proyecciones (CQRS necesario).
- Versionado de eventos es critico.

## Alternativas Consideradas
- CRUD puro: Rechazado para core transaccional por falta de trazabilidad.
- Event Sourcing global: Rechazado por sobre-ingenieria en dominios simples.
