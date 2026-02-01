-- Migración 94: Template para reporte semanal de owners
-- Fecha: 2026-01-31
-- Descripción: Agrega template de email para resumen semanal con métricas clave

INSERT INTO notification_templates (
  template_key,
  name,
  description,
  content,
  template_type,
  category,
  ml_trigger_config,
  default_priority,
  default_channels,
  email_template,
  store_id
)
VALUES (
  'ml_weekly_report',
  'Resumen Semanal para Owners',
  'Reporte semanal con métricas clave y recomendaciones',
  '{
    "es": {
      "title": "📈 Resumen semanal {{storeName}} ({{date startDate}} - {{date endDate}})",
      "body": "Ventas: {{totalSalesCount}} operaciones. Totales Bs {{totalSalesBs}} / USD {{totalSalesUsd}}. Ganancia Bs {{totalProfitBs}} ({{percent profitMargin}}). Stock bajo: {{lowStockCount}}. Vencen pronto: {{expiringSoonCount}}. Deuda pendiente Bs {{pendingDebtBs}} / USD {{pendingDebtUsd}}. Anomalías: {{anomalyCount}} (críticas {{criticalCount}}). Recomendaciones: {{recommendationCount}}."
    },
    "en": {
      "title": "📈 Weekly Report {{storeName}} ({{date startDate}} - {{date endDate}})",
      "body": "Sales: {{totalSalesCount}} orders. Totals Bs {{totalSalesBs}} / USD {{totalSalesUsd}}. Profit Bs {{totalProfitBs}} ({{percent profitMargin}}). Low stock: {{lowStockCount}}. Expiring soon: {{expiringSoonCount}}. Pending debt Bs {{pendingDebtBs}} / USD {{pendingDebtUsd}}. Anomalies: {{anomalyCount}} (critical {{criticalCount}}). Recommendations: {{recommendationCount}}."
    }
  }',
  'general',
  'general',
  '{}',
  'medium',
  ARRAY['email'],
  '<div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #111827;">\n  <h1 style="margin-bottom: 4px;">📈 Resumen semanal</h1>\n  <p style="margin-top: 0; color: #6b7280;">Hola {{userName}}, aquí está el resumen de {{storeName}}.</p>\n  <p style="color: #6b7280;">Período: <strong>{{date startDate}}</strong> - <strong>{{date endDate}}</strong></p>\n\n  <h2 style="margin-top: 24px;">Métricas clave</h2>\n  <ul>\n    <li>Ventas: <strong>{{totalSalesCount}}</strong> operaciones</li>\n    <li>Total Bs: <strong>{{currency totalSalesBs "Bs"}}</strong> | Total USD: <strong>{{currency totalSalesUsd "USD"}}</strong></li>\n    <li>Ganancia: <strong>{{currency totalProfitBs "Bs"}}</strong> | <strong>{{currency totalProfitUsd "USD"}}</strong> ({{percent profitMargin}})</li>\n    <li>Stock bajo: <strong>{{lowStockCount}}</strong> | Vencen pronto: <strong>{{expiringSoonCount}}</strong></li>\n    <li>Deuda pendiente: <strong>{{currency pendingDebtBs "Bs"}}</strong> | <strong>{{currency pendingDebtUsd "USD"}}</strong></li>\n    <li>Anomalías: <strong>{{anomalyCount}}</strong> (Críticas {{criticalCount}}, Altas {{highCount}})</li>\n    <li>Recomendaciones: <strong>{{recommendationCount}}</strong></li>\n  </ul>\n\n  <h2 style="margin-top: 24px;">Top productos</h2>\n  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">\n    <thead>\n      <tr>\n        <th style="text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px 4px;">#</th>\n        <th style="text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px 4px;">Producto</th>\n        <th style="text-align: right; border-bottom: 1px solid #e5e7eb; padding: 8px 4px;">Cantidad</th>\n        <th style="text-align: right; border-bottom: 1px solid #e5e7eb; padding: 8px 4px;">Ingresos USD</th>\n      </tr>\n    </thead>\n    <tbody>\n      {{#eachWithIndex topProducts}}\n      <tr>\n        <td style="padding: 6px 4px; color: #6b7280;">{{index}}</td>\n        <td style="padding: 6px 4px;">{{name}}</td>\n        <td style="padding: 6px 4px; text-align: right;">{{number quantity 2}}</td>\n        <td style="padding: 6px 4px; text-align: right;">{{currency revenue_usd "USD"}}</td>\n      </tr>\n      {{/eachWithIndex}}\n    </tbody>\n  </table>\n\n  <p style="margin-top: 24px; color: #6b7280;">Puedes ver más detalle en el dashboard.</p>\n</div>',
  NULL
);
