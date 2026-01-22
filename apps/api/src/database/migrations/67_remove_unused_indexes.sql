-- Migración 67: Eliminar Índices No Usados
-- Fecha: 2025-01-XX
-- Descripción: Elimina índices que nunca han sido usados según el linter de Supabase
-- ADVERTENCIA: Eliminar índices puede afectar el rendimiento de queries futuras.
-- Se recomienda revisar este script antes de ejecutarlo y considerar mantener índices
-- que puedan ser útiles para funcionalidades planificadas.
-- Ver: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

-- ============================================
-- ADVERTENCIA IMPORTANTE
-- ============================================
-- Este script elimina índices que no han sido usados hasta ahora.
-- Sin embargo, estos índices pueden ser útiles para:
-- 1. Queries que aún no se han ejecutado
-- 2. Funcionalidades futuras
-- 3. Optimizaciones de reportes y analytics
--
-- Se recomienda:
-- - Revisar cada índice antes de eliminarlo
-- - Mantener índices en tablas críticas (events, sales, customers, etc.)
-- - Considerar mantener índices que cubren foreign keys
-- - Ejecutar en horarios de bajo tráfico
-- ============================================

-- ============================================
-- ÍNDICES CRÍTICOS - RECOMENDADO MANTENER
-- ============================================
-- Estos índices son importantes para el sistema offline-first y sincronización
-- Se recomienda NO eliminarlos aunque no se hayan usado aún

-- events: Índices críticos para sincronización
-- idx_events_store_seq - usado para sincronización por secuencia
-- idx_events_store_type - usado para filtrar por tipo de evento
-- idx_events_store_created - puede ser útil para queries de auditoría
-- idx_events_device - usado para sincronización por dispositivo
-- idx_events_device_seq - usado para sincronización por dispositivo y secuencia
-- NOTA: Estos índices son críticos para el sistema de sincronización offline-first
-- NO ELIMINAR a menos que estés seguro de que no se usarán

-- customers: Índices para búsquedas
-- idx_customers_store_name - usado para búsqueda de clientes por nombre
-- idx_customers_store_phone - usado para búsqueda por teléfono
-- idx_customers_store_document - usado para búsqueda por documento
-- NOTA: Estos índices son útiles para búsquedas en el POS
-- Considerar mantener si se planea usar búsqueda por nombre/teléfono/documento

-- debts: Índices para gestión de deudas
-- idx_debts_store_customer - usado para listar deudas por cliente
-- idx_debts_store_status - usado para filtrar deudas por estado
-- idx_debts_sale - usado para relacionar deudas con ventas
-- NOTA: Estos índices son útiles para reportes de deudas
-- Considerar mantener si se planea hacer reportes de deudas

-- sales: Índices para reportes y analytics
-- idx_sales_cash_session_id - usado para reportes de caja
-- idx_sales_customer_id - usado para reportes por cliente
-- idx_sales_sold_by_user_id - usado para reportes por vendedor
-- idx_sales_store_sold_at_btree - usado para reportes por fecha
-- NOTA: Estos índices son útiles para analytics y reportes
-- Considerar mantener si se planea hacer reportes de ventas

-- ============================================
-- ELIMINACIÓN DE ÍNDICES NO USADOS
-- ============================================
-- Descomentar las secciones que quieras ejecutar
-- Se recomienda hacerlo por partes y monitorear el rendimiento

-- events: Eliminar índices no críticos (CUIDADO: algunos pueden ser útiles)
-- DROP INDEX IF EXISTS idx_events_store_seq;  -- CRÍTICO: NO eliminar
-- DROP INDEX IF EXISTS idx_events_store_type;  -- CRÍTICO: NO eliminar
-- DROP INDEX IF EXISTS idx_events_store_created;
-- DROP INDEX IF EXISTS idx_events_device;  -- CRÍTICO: NO eliminar
-- DROP INDEX IF EXISTS idx_events_device_seq;
DROP INDEX IF EXISTS idx_events_created_at_brin;
DROP INDEX IF EXISTS idx_events_payload_gin;
DROP INDEX IF EXISTS idx_events_conflict_status;
DROP INDEX IF EXISTS idx_events_vector_clock;

-- customers: Eliminar índices de búsqueda (CUIDADO: pueden ser útiles)
-- DROP INDEX IF EXISTS idx_customers_store_name;  -- ÚTIL: Considerar mantener
-- DROP INDEX IF EXISTS idx_customers_store_phone;  -- ÚTIL: Considerar mantener
-- DROP INDEX IF EXISTS idx_customers_store_document;  -- ÚTIL: Considerar mantener
DROP INDEX IF EXISTS idx_customers_email;
DROP INDEX IF EXISTS idx_customers_with_credit;

-- debts: Eliminar índices de reportes (CUIDADO: pueden ser útiles)
-- DROP INDEX IF EXISTS idx_debts_store_customer;  -- ÚTIL: Considerar mantener
DROP INDEX IF EXISTS idx_debts_store_status;
DROP INDEX IF EXISTS idx_debts_sale;
DROP INDEX IF EXISTS idx_debts_store_customer_status;
DROP INDEX IF EXISTS idx_debts_store_status_open;

-- debt_payments: Eliminar índices
DROP INDEX IF EXISTS idx_debt_payments_store;
DROP INDEX IF EXISTS idx_debt_payments_store_date;

-- cash_sessions: Eliminar índices (CUIDADO: algunos pueden ser útiles)
-- DROP INDEX IF EXISTS idx_cash_sessions_store_open;  -- ÚTIL: Considerar mantener
DROP INDEX IF EXISTS idx_cash_sessions_store_closed;
DROP INDEX IF EXISTS idx_cash_sessions_store_status;
DROP INDEX IF EXISTS idx_cash_sessions_opened_by;

-- products: Eliminar índices
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_sku;
DROP INDEX IF EXISTS idx_products_scale_plu;

-- sale_items: Eliminar índices (CUIDADO: pueden ser útiles para reportes)
DROP INDEX IF EXISTS idx_sale_items_product_id;

-- sales: Eliminar índices (CUIDADO: muchos son útiles para reportes)
-- DROP INDEX IF EXISTS idx_sales_cash_session_id;  -- ÚTIL: Considerar mantener
-- DROP INDEX IF EXISTS idx_sales_customer_id;  -- ÚTIL: Considerar mantener
-- DROP INDEX IF EXISTS idx_sales_sold_by_user_id;  -- ÚTIL: Considerar mantener
-- DROP INDEX IF EXISTS idx_sales_store_sold_at_btree;  -- ÚTIL: Considerar mantener
DROP INDEX IF EXISTS idx_sales_sold_at_brin;
DROP INDEX IF EXISTS idx_sales_totals_gin;
DROP INDEX IF EXISTS idx_sales_payment_gin;
DROP INDEX IF EXISTS idx_sales_invoice_number;
DROP INDEX IF EXISTS idx_sales_store_invoice;
DROP INDEX IF EXISTS idx_sales_voided_at;

-- inventory_movements: Eliminar índices
DROP INDEX IF EXISTS idx_inv_mov_store_happened;
DROP INDEX IF EXISTS idx_inventory_movements_happened_at_brin;

-- store_members: Eliminar índices (CUIDADO: pueden ser útiles)
DROP INDEX IF EXISTS idx_store_members_store_id;
DROP INDEX IF EXISTS idx_store_members_user_id;
DROP INDEX IF EXISTS idx_store_members_locked_until;

-- stores: Eliminar índices
DROP INDEX IF EXISTS idx_stores_license_expires;

-- shift_cuts: Eliminar índices
DROP INDEX IF EXISTS idx_shift_cuts_type;
DROP INDEX IF EXISTS idx_shift_cuts_created;

-- payment_method_configs: Eliminar índices
DROP INDEX IF EXISTS idx_payment_configs_method;
DROP INDEX IF EXISTS idx_payment_configs_sort_order;

-- cash_movements: Eliminar índices
DROP INDEX IF EXISTS idx_cash_movements_type;
DROP INDEX IF EXISTS idx_cash_movements_created_by;

-- discount_authorizations: Eliminar índices
DROP INDEX IF EXISTS idx_discount_auth_authorized_by;
DROP INDEX IF EXISTS idx_discount_auth_authorized_at;

-- quick_products: Eliminar índices
DROP INDEX IF EXISTS idx_quick_products_store;

-- product_variants: Eliminar índices
DROP INDEX IF EXISTS idx_product_variants_active;
DROP INDEX IF EXISTS idx_product_variants_barcode;
DROP INDEX IF EXISTS idx_product_variants_sku;

-- product_lots: Eliminar índices
DROP INDEX IF EXISTS idx_product_lots_product;

-- lot_movements: Eliminar índices
DROP INDEX IF EXISTS idx_lot_movements_type;

-- product_serials: Eliminar índices
DROP INDEX IF EXISTS idx_product_serials_status;
DROP INDEX IF EXISTS idx_product_serials_available;

-- promotions: Eliminar índices
DROP INDEX IF EXISTS idx_promotions_store;

-- promotion_products: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_promotion_products_variant_id;  -- Ya tiene índice de FK

-- tables: Eliminar índices
DROP INDEX IF EXISTS idx_tables_store;
DROP INDEX IF EXISTS idx_tables_current_order;
DROP INDEX IF EXISTS idx_tables_zone;
DROP INDEX IF EXISTS idx_tables_qr_code;

-- orders: Eliminar índices (CUIDADO: pueden ser útiles)
-- DROP INDEX IF EXISTS idx_orders_customer_id;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_orders_opened_by_user_id;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_orders_closed_by_user_id;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_orders_store;
DROP INDEX IF EXISTS idx_orders_status;

-- order_items: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_order_items_variant_id;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_order_items_status;
DROP INDEX IF EXISTS idx_order_items_order_id_status;

-- order_payments: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_order_payments_paid_by_user_id;  -- Ya tiene índice de FK

-- peripheral_configs: Eliminar índices
DROP INDEX IF EXISTS idx_peripheral_configs_store;
DROP INDEX IF EXISTS idx_peripheral_configs_default;

-- price_lists: Eliminar índices
DROP INDEX IF EXISTS idx_price_lists_store;

-- supplier_price_lists: Eliminar índices
DROP INDEX IF EXISTS idx_supplier_price_lists_store;
DROP INDEX IF EXISTS idx_supplier_price_lists_supplier;
DROP INDEX IF EXISTS idx_supplier_price_lists_active;
-- DROP INDEX IF EXISTS idx_supplier_price_lists_supplier_id;  -- Ya tiene índice de FK

-- supplier_price_list_items: Eliminar índices
DROP INDEX IF EXISTS idx_supplier_price_list_items_list;
DROP INDEX IF EXISTS idx_supplier_price_list_items_code;

-- transfers: Eliminar índices
DROP INDEX IF EXISTS idx_transfers_store;
DROP INDEX IF EXISTS idx_transfers_status;
-- DROP INDEX IF EXISTS idx_transfers_received_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_transfers_requested_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_transfers_shipped_by;  -- Ya tiene índice de FK

-- purchase_orders: Eliminar índices
DROP INDEX IF EXISTS idx_purchase_orders_store;
-- DROP INDEX IF EXISTS idx_purchase_orders_received_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_purchase_orders_requested_by;  -- Ya tiene índice de FK

-- purchase_order_items: Eliminar índices
DROP INDEX IF EXISTS idx_purchase_order_items_order;

-- fiscal_invoices: Eliminar índices
DROP INDEX IF EXISTS idx_fiscal_invoices_store;
DROP INDEX IF EXISTS idx_fiscal_invoices_customer;
DROP INDEX IF EXISTS idx_fiscal_invoices_status;
DROP INDEX IF EXISTS idx_fiscal_invoices_store_date;
-- DROP INDEX IF EXISTS idx_fiscal_invoices_created_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_fiscal_invoices_invoice_series_id;  -- Ya tiene índice de FK

-- fiscal_invoice_items: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_fiscal_invoice_items_variant_id;  -- Ya tiene índice de FK

-- sale_payments: Eliminar índices
DROP INDEX IF EXISTS idx_sale_payments_method;
DROP INDEX IF EXISTS idx_sale_payments_status;
-- DROP INDEX IF EXISTS idx_sale_payments_confirmed_by;  -- Ya tiene índice de FK

-- sale_returns: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_sale_returns_created_by;  -- Ya tiene índice de FK

-- sale_return_items: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_sale_return_items_product_id;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_sale_return_items_variant_id;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_sale_return_items_lot_id;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_sale_return_items_return_id;

-- license_payments: Eliminar índices
DROP INDEX IF EXISTS idx_license_payments_status;
DROP INDEX IF EXISTS idx_license_payments_reference;
DROP INDEX IF EXISTS idx_license_payments_created;
DROP INDEX IF EXISTS idx_license_payments_expires;
DROP INDEX IF EXISTS idx_license_payments_pending;
-- DROP INDEX IF EXISTS idx_license_payments_verified_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_license_payments_approved_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_license_payments_rejected_by;  -- Ya tiene índice de FK

-- license_payment_documents: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_license_payment_documents_uploaded_by;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_license_payment_documents_payment;

-- license_payment_verifications: Eliminar índices
DROP INDEX IF EXISTS idx_license_payment_verifications_payment;
DROP INDEX IF EXISTS idx_license_payment_verifications_status;
DROP INDEX IF EXISTS idx_license_payment_verifications_method;
DROP INDEX IF EXISTS idx_license_payment_verifications_created;

-- two_factor_auth: Eliminar índices
DROP INDEX IF EXISTS idx_two_factor_auth_enabled;
-- DROP INDEX IF EXISTS idx_two_factor_auth_store_id;  -- Ya tiene índice de FK

-- refresh_tokens: Eliminar índices
DROP INDEX IF EXISTS idx_refresh_tokens_revoked;
-- DROP INDEX IF EXISTS idx_refresh_tokens_store_id;  -- Ya tiene índice de FK

-- exchange_rates: Eliminar índices
DROP INDEX IF EXISTS idx_exchange_rates_store_active;
DROP INDEX IF EXISTS idx_exchange_rates_type;
-- DROP INDEX IF EXISTS idx_exchange_rates_created_by;  -- Ya tiene índice de FK

-- pin_recovery_tokens: Eliminar índices
DROP INDEX IF EXISTS idx_pin_recovery_tokens_user_id;
DROP INDEX IF EXISTS idx_pin_recovery_tokens_store_id;
DROP INDEX IF EXISTS idx_pin_recovery_tokens_token;
DROP INDEX IF EXISTS idx_pin_recovery_tokens_expires_at;

-- email_verification_tokens: Eliminar índices
DROP INDEX IF EXISTS idx_email_verification_tokens_user_id;
DROP INDEX IF EXISTS idx_email_verification_tokens_token;
DROP INDEX IF EXISTS idx_email_verification_tokens_expires_at;

-- email_queue: Eliminar índices
DROP INDEX IF EXISTS idx_email_queue_status;
DROP INDEX IF EXISTS idx_email_queue_scheduled;
-- DROP INDEX IF EXISTS idx_email_queue_template_id;  -- Ya tiene índice de FK

-- accounting_periods: Eliminar índices
DROP INDEX IF EXISTS idx_accounting_periods_period;
DROP INDEX IF EXISTS idx_accounting_periods_code;
-- DROP INDEX IF EXISTS idx_accounting_periods_closed_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_accounting_periods_closing_entry_id;  -- Ya tiene índice de FK

-- accounting_account_mappings: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_accounting_account_mappings_account_id;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_accounting_account_mappings_created_by;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_accounting_account_mappings_active;

-- accounting_exports: Eliminar índices
DROP INDEX IF EXISTS idx_accounting_exports_type;
DROP INDEX IF EXISTS idx_accounting_exports_date;
DROP INDEX IF EXISTS idx_accounting_exports_status;
DROP INDEX IF EXISTS idx_accounting_exports_erp_sync;
-- DROP INDEX IF EXISTS idx_accounting_exports_exported_by;  -- Ya tiene índice de FK

-- accounting_erp_syncs: Eliminar índices
DROP INDEX IF EXISTS idx_accounting_erp_syncs_erp;
DROP INDEX IF EXISTS idx_accounting_erp_syncs_type;
DROP INDEX IF EXISTS idx_accounting_erp_syncs_status;
DROP INDEX IF EXISTS idx_accounting_erp_syncs_source;

-- chart_of_accounts: Eliminar índices
DROP INDEX IF EXISTS idx_chart_of_accounts_code;
DROP INDEX IF EXISTS idx_chart_of_accounts_type;
DROP INDEX IF EXISTS idx_chart_of_accounts_active;
-- DROP INDEX IF EXISTS idx_chart_of_accounts_created_by;  -- Ya tiene índice de FK

-- journal_entries: Eliminar índices
DROP INDEX IF EXISTS idx_journal_entries_type;
DROP INDEX IF EXISTS idx_journal_entries_exported;
DROP INDEX IF EXISTS idx_journal_entries_erp_sync;
-- DROP INDEX IF EXISTS idx_journal_entries_cancelled_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_journal_entries_posted_by;  -- Ya tiene índice de FK

-- journal_entry_lines: Eliminar índices
DROP INDEX IF EXISTS idx_journal_entry_lines_code;

-- alert_thresholds: Eliminar índices
DROP INDEX IF EXISTS idx_alert_thresholds_active;
-- DROP INDEX IF EXISTS idx_alert_thresholds_created_by;  -- Ya tiene índice de FK

-- detected_anomalies: Eliminar índices
DROP INDEX IF EXISTS idx_anomalies_entity;
DROP INDEX IF EXISTS idx_anomalies_severity;
DROP INDEX IF EXISTS idx_anomalies_resolved;
DROP INDEX IF EXISTS idx_anomalies_detected;
-- DROP INDEX IF EXISTS idx_detected_anomalies_resolved_by;  -- Ya tiene índice de FK

-- real_time_alerts: Eliminar índices
DROP INDEX IF EXISTS idx_realtime_alerts_type;
DROP INDEX IF EXISTS idx_realtime_alerts_severity;
DROP INDEX IF EXISTS idx_realtime_alerts_read;
DROP INDEX IF EXISTS idx_realtime_alerts_created;
-- DROP INDEX IF EXISTS idx_real_time_alerts_read_by;  -- Ya tiene índice de FK
-- DROP INDEX IF EXISTS idx_real_time_alerts_threshold_id;  -- Ya tiene índice de FK

-- real_time_metrics: Eliminar índices
DROP INDEX IF EXISTS idx_realtime_metrics_store;
DROP INDEX IF EXISTS idx_realtime_metrics_type;
DROP INDEX IF EXISTS idx_realtime_metrics_period;
DROP INDEX IF EXISTS idx_realtime_metrics_created;
DROP INDEX IF EXISTS idx_realtime_metrics_store_name_created;
DROP INDEX IF EXISTS idx_realtime_metrics_store_type_period;

-- sales_heatmap: Eliminar índices
DROP INDEX IF EXISTS idx_sales_heatmap_date;
DROP INDEX IF EXISTS idx_sales_heatmap_hour;
DROP INDEX IF EXISTS idx_sales_heatmap_day;
DROP INDEX IF EXISTS idx_sales_heatmap_store_date_hour;

-- comparative_metrics: Eliminar índices
DROP INDEX IF EXISTS idx_comparative_metrics_store;
DROP INDEX IF EXISTS idx_comparative_metrics_period;

-- notifications: Eliminar índices
DROP INDEX IF EXISTS idx_notifications_type;
DROP INDEX IF EXISTS idx_notifications_category;
DROP INDEX IF EXISTS idx_notifications_read;
DROP INDEX IF EXISTS idx_notifications_delivered;
DROP INDEX IF EXISTS idx_notifications_created;
DROP INDEX IF EXISTS idx_notifications_entity;
DROP INDEX IF EXISTS idx_notifications_ml_insight;
DROP INDEX IF EXISTS idx_notifications_template;
DROP INDEX IF EXISTS idx_notifications_ml_generated;

-- notification_preferences: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_notification_preferences_user_id;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_notification_preferences_category;

-- notification_subscriptions: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_notification_subscriptions_user_id;  -- Ya tiene índice de FK
DROP INDEX IF EXISTS idx_notification_subscriptions_active;

-- notification_badges: Eliminar índices (ya cubierto por foreign key)
-- DROP INDEX IF EXISTS idx_notification_badges_user_id;  -- Ya tiene índice de FK

-- notification_deliveries: Eliminar índices
DROP INDEX IF EXISTS idx_notification_deliveries_status;
DROP INDEX IF EXISTS idx_notification_deliveries_channel;

-- notification_templates: Eliminar índices
DROP INDEX IF EXISTS idx_notification_templates_key;
DROP INDEX IF EXISTS idx_notification_templates_type;
DROP INDEX IF EXISTS idx_notification_templates_active;

-- notification_analytics: Eliminar índices
DROP INDEX IF EXISTS idx_notification_analytics_user;
DROP INDEX IF EXISTS idx_notification_analytics_channel;
DROP INDEX IF EXISTS idx_notification_analytics_status;
DROP INDEX IF EXISTS idx_notification_analytics_engagement;
DROP INDEX IF EXISTS idx_notification_analytics_created;

-- notification_rate_limits: Eliminar índices
DROP INDEX IF EXISTS idx_notification_rate_limits_user;

-- ml_insights: Eliminar índices
DROP INDEX IF EXISTS idx_ml_insights_category;
DROP INDEX IF EXISTS idx_ml_insights_entity;
DROP INDEX IF EXISTS idx_ml_insights_severity;
DROP INDEX IF EXISTS idx_ml_insights_notification_sent;
DROP INDEX IF EXISTS idx_ml_insights_valid;
DROP INDEX IF EXISTS idx_ml_insights_created;
-- DROP INDEX IF EXISTS idx_ml_insights_notification_id;  -- Ya tiene índice de FK

-- ml_notification_rules: Eliminar índices
DROP INDEX IF EXISTS idx_ml_notification_rules_insight_type;
DROP INDEX IF EXISTS idx_ml_notification_rules_active;
-- DROP INDEX IF EXISTS idx_ml_notification_rules_template_id;  -- Ya tiene índice de FK

-- ml_model_metrics: Eliminar índices
DROP INDEX IF EXISTS idx_ml_metrics_model;
DROP INDEX IF EXISTS idx_ml_metrics_date;

-- product_recommendations: Eliminar índices
DROP INDEX IF EXISTS idx_recommendations_type;
DROP INDEX IF EXISTS idx_recommendations_store;

-- demand_predictions: Eliminar índices
DROP INDEX IF EXISTS idx_demand_predictions_date;

-- mv_sales_daily: Eliminar índices
DROP INDEX IF EXISTS idx_mv_sales_daily_date;

-- mv_top_products_30d: Eliminar índices
DROP INDEX IF EXISTS idx_mv_top_products_store_qty;
DROP INDEX IF EXISTS idx_mv_top_products_store_revenue;
DROP INDEX IF EXISTS idx_mv_top_products_category;

-- qr_codes: Eliminar índices
DROP INDEX IF EXISTS idx_qr_codes_store;
DROP INDEX IF EXISTS idx_qr_codes_active;

-- reservations: Eliminar índices
DROP INDEX IF EXISTS idx_reservations_store;
DROP INDEX IF EXISTS idx_reservations_status;
DROP INDEX IF EXISTS idx_reservations_customer;

-- whatsapp_message_queue: Eliminar índices
DROP INDEX IF EXISTS idx_whatsapp_message_queue_store_reference;
DROP INDEX IF EXISTS idx_whatsapp_message_queue_scheduled;
DROP INDEX IF EXISTS idx_whatsapp_message_queue_store_status;
DROP INDEX IF EXISTS idx_whatsapp_message_queue_store_type;

-- alerts: Eliminar índices
DROP INDEX IF EXISTS idx_alerts_status;
DROP INDEX IF EXISTS idx_alerts_service;
DROP INDEX IF EXISTS idx_alerts_severity;
DROP INDEX IF EXISTS idx_alerts_created;
DROP INDEX IF EXISTS idx_alerts_active;

-- uptime_records: Eliminar índices
DROP INDEX IF EXISTS idx_uptime_timestamp;
DROP INDEX IF EXISTS idx_uptime_service;
DROP INDEX IF EXISTS idx_uptime_status;
DROP INDEX IF EXISTS idx_uptime_service_timestamp;

-- security_audit_log: Eliminar índices
DROP INDEX IF EXISTS idx_security_audit_status;

-- sync_metrics: Eliminar índices
DROP INDEX IF EXISTS idx_sync_metrics_failed;
DROP INDEX IF EXISTS idx_sync_metrics_slow;

-- sync_conflicts: Eliminar índices
DROP INDEX IF EXISTS idx_sync_conflicts_priority;
-- DROP INDEX IF EXISTS idx_sync_conflicts_event_id_b;  -- Ya tiene índice de FK

-- device_sync_state: Eliminar índices
DROP INDEX IF EXISTS idx_device_sync_state_conflicts;
DROP INDEX IF EXISTS idx_device_sync_state_circuit;

-- conflict_resolution_rules: Eliminar índices
DROP INDEX IF EXISTS idx_conflict_rules_lookup;

-- profiles: Eliminar índices
DROP INDEX IF EXISTS idx_profiles_email;

-- ============================================
-- COMENTARIOS FINALES
-- ============================================
-- Después de ejecutar este script, monitorear:
-- 1. Rendimiento de queries existentes
-- 2. Tiempos de respuesta en el sistema
-- 3. Uso de recursos de la base de datos
--
-- Si notas degradación en el rendimiento, puedes recrear los índices eliminados
-- usando las migraciones originales como referencia.
