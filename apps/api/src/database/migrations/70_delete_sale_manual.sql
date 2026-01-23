-- ============================================
-- 70. SCRIPT PARA BORRAR/MODIFICAR VENTA MANUALMENTE
-- ============================================
-- ⚠️ ADVERTENCIA: Este script es para uso manual en casos excepcionales
-- Solo usar cuando la anulación normal no es posible y la venta causa inconsistencias
--
-- INSTRUCCIONES:
-- 1. Reemplazar 'TU_SALE_ID_AQUI' con el ID real de la venta
-- 2. Revisar todas las relaciones antes de ejecutar
-- 3. Ejecutar en una transacción para poder hacer rollback si es necesario
-- 4. Hacer backup antes de ejecutar

-- ============================================
-- PARTE 1: IDENTIFICAR LA VENTA Y SUS RELACIONES
-- ============================================
-- Ejecutar primero para ver qué se va a borrar/modificar

DO $$
DECLARE
    v_sale_id UUID := 'TU_SALE_ID_AQUI'; -- ⚠️ CAMBIAR ESTE ID
    v_store_id UUID;
    v_sale_count INTEGER;
    v_items_count INTEGER;
    v_payments_count INTEGER;
    v_debt_count INTEGER;
    v_fiscal_invoices_count INTEGER;
    v_returns_count INTEGER;
    v_movements_count INTEGER;
    v_journal_entries_count INTEGER;
BEGIN
    -- Verificar que la venta existe
    SELECT COUNT(*), store_id INTO v_sale_count, v_store_id
    FROM sales
    WHERE id = v_sale_id;
    
    IF v_sale_count = 0 THEN
        RAISE EXCEPTION 'Venta no encontrada: %', v_sale_id;
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANÁLISIS DE VENTA: %', v_sale_id;
    RAISE NOTICE 'Store ID: %', v_store_id;
    RAISE NOTICE '========================================';
    
    -- Contar relaciones
    SELECT COUNT(*) INTO v_items_count FROM sale_items WHERE sale_id = v_sale_id;
    SELECT COUNT(*) INTO v_payments_count FROM sale_payments WHERE sale_id = v_sale_id;
    SELECT COUNT(*) INTO v_debt_count FROM debts WHERE sale_id = v_sale_id;
    SELECT COUNT(*) INTO v_fiscal_invoices_count FROM fiscal_invoices WHERE sale_id = v_sale_id;
    SELECT COUNT(*) INTO v_returns_count FROM sale_returns WHERE sale_id = v_sale_id;
    SELECT COUNT(*) INTO v_movements_count FROM inventory_movements 
        WHERE store_id = v_store_id AND ref->>'sale_id' = v_sale_id::text;
    SELECT COUNT(*) INTO v_journal_entries_count FROM journal_entries 
        WHERE source_type = 'sale' AND source_id = v_sale_id;
    
    RAISE NOTICE 'Items de venta: %', v_items_count;
    RAISE NOTICE 'Pagos: %', v_payments_count;
    RAISE NOTICE 'Deudas: %', v_debt_count;
    RAISE NOTICE 'Facturas fiscales: %', v_fiscal_invoices_count;
    RAISE NOTICE 'Devoluciones: %', v_returns_count;
    RAISE NOTICE 'Movimientos de inventario: %', v_movements_count;
    RAISE NOTICE 'Asientos contables: %', v_journal_entries_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Si hay facturas fiscales emitidas, NO BORRAR. Usar anulación normal.';
    RAISE NOTICE 'Si hay asientos contables posteados, crear reversión contable.';
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- PARTE 2: OPCIÓN A - ANULAR LA VENTA (RECOMENDADO)
-- ============================================
-- Esta opción marca la venta como anulada sin borrarla
-- Es más segura porque mantiene el historial

-- BEGIN; -- Descomentar para usar transacción

-- UPDATE sales
-- SET 
--     voided_at = NOW(),
--     voided_by_user_id = (SELECT id FROM profiles WHERE email = 'admin@example.com' LIMIT 1), -- ⚠️ Cambiar por tu user_id
--     void_reason = 'Anulación manual por inconsistencia - ' || NOW()::text
-- WHERE id = 'TU_SALE_ID_AQUI'; -- ⚠️ CAMBIAR ESTE ID

-- -- Revertir movimientos de inventario
-- UPDATE inventory_movements
-- SET 
--     movement_type = 'adjust',
--     qty_delta = ABS(qty_delta), -- Convertir negativo a positivo
--     note = COALESCE(note, '') || ' - Revertido por anulación de venta ' || 'TU_SALE_ID_AQUI'
-- WHERE store_id = (SELECT store_id FROM sales WHERE id = 'TU_SALE_ID_AQUI')
--   AND ref->>'sale_id' = 'TU_SALE_ID_AQUI';

-- -- Devolver stock (crear movimientos de ajuste inversos)
-- INSERT INTO inventory_movements (
--     id, store_id, product_id, movement_type, qty_delta, 
--     unit_cost_bs, unit_cost_usd, note, ref, happened_at
-- )
-- SELECT 
--     gen_random_uuid(),
--     si.sale_id::uuid, -- store_id desde sale
--     si.product_id,
--     'adjust',
--     si.qty, -- Cantidad positiva para devolver
--     si.unit_price_bs,
--     si.unit_price_usd,
--     'Devolución por anulación de venta ' || s.id::text,
--     jsonb_build_object('sale_id', s.id, 'void_reversal', true),
--     NOW()
-- FROM sale_items si
-- JOIN sales s ON si.sale_id = s.id
-- WHERE si.sale_id = 'TU_SALE_ID_AQUI'; -- ⚠️ CAMBIAR ESTE ID

-- COMMIT; -- Descomentar si usaste BEGIN

-- ============================================
-- PARTE 3: OPCIÓN B - BORRAR LA VENTA COMPLETAMENTE
-- ============================================
-- ⚠️ SOLO USAR SI:
-- - No hay facturas fiscales emitidas
-- - No hay asientos contables posteados
-- - La venta causa inconsistencias graves
-- - Has hecho backup completo

-- BEGIN; -- Descomentar para usar transacción

-- -- Paso 1: Borrar items de venta (CASCADE automático, pero por si acaso)
-- DELETE FROM sale_items WHERE sale_id = 'TU_SALE_ID_AQUI'; -- ⚠️ CAMBIAR ESTE ID

-- -- Paso 2: Borrar pagos (CASCADE automático)
-- DELETE FROM sale_payments WHERE sale_id = 'TU_SALE_ID_AQUI';

-- -- Paso 3: Borrar cambio (CASCADE automático)
-- DELETE FROM sale_change WHERE sale_id = 'TU_SALE_ID_AQUI';

-- -- Paso 4: Borrar devoluciones (CASCADE automático)
-- DELETE FROM sale_returns WHERE sale_id = 'TU_SALE_ID_AQUI';

-- -- Paso 5: Borrar autorizaciones de descuento (CASCADE automático)
-- DELETE FROM discount_authorizations WHERE sale_id = 'TU_SALE_ID_AQUI';

-- -- Paso 6: Actualizar referencias SET NULL
-- UPDATE debts SET sale_id = NULL WHERE sale_id = 'TU_SALE_ID_AQUI';
-- UPDATE fiscal_invoices SET sale_id = NULL WHERE sale_id = 'TU_SALE_ID_AQUI';
-- UPDATE product_serials SET sale_id = NULL WHERE sale_id = 'TU_SALE_ID_AQUI';
-- UPDATE lot_movements SET sale_id = NULL WHERE sale_id = 'TU_SALE_ID_AQUI';
-- UPDATE order_payments SET sale_id = NULL WHERE sale_id = 'TU_SALE_ID_AQUI';
-- UPDATE promotion_usages SET sale_id = NULL WHERE sale_id = 'TU_SALE_ID_AQUI';

-- -- Paso 7: Revertir movimientos de inventario
-- -- Opción A: Borrar movimientos relacionados
-- DELETE FROM inventory_movements 
-- WHERE store_id = (SELECT store_id FROM sales WHERE id = 'TU_SALE_ID_AQUI')
--   AND ref->>'sale_id' = 'TU_SALE_ID_AQUI';

-- -- Opción B: Actualizar movimientos para marcar como reversión
-- -- UPDATE inventory_movements
-- -- SET movement_type = 'adjust',
-- --     qty_delta = ABS(qty_delta),
-- --     note = COALESCE(note, '') || ' - Revertido por borrado de venta'
-- -- WHERE store_id = (SELECT store_id FROM sales WHERE id = 'TU_SALE_ID_AQUI')
-- --   AND ref->>'sale_id' = 'TU_SALE_ID_AQUI';

-- -- Paso 8: Revertir asientos contables (si no están posteados)
-- -- DELETE FROM journal_entry_lines WHERE entry_id IN (
-- --     SELECT id FROM journal_entries 
-- --     WHERE source_type = 'sale' AND source_id = 'TU_SALE_ID_AQUI' AND status = 'draft'
-- -- );
-- -- DELETE FROM journal_entries 
-- -- WHERE source_type = 'sale' AND source_id = 'TU_SALE_ID_AQUI' AND status = 'draft';

-- -- ⚠️ Si hay asientos posteados, NO BORRAR. Crear reversión contable manual.

-- -- Paso 9: Borrar la venta (último paso)
-- DELETE FROM sales WHERE id = 'TU_SALE_ID_AQUI';

-- COMMIT; -- Descomentar si usaste BEGIN

-- ============================================
-- PARTE 4: VERIFICACIÓN POST-BORRADO
-- ============================================

-- Verificar que no quedan referencias huérfanas
-- SELECT 'sale_items' as tabla, COUNT(*) as registros
-- FROM sale_items WHERE sale_id = 'TU_SALE_ID_AQUI'
-- UNION ALL
-- SELECT 'sale_payments', COUNT(*) FROM sale_payments WHERE sale_id = 'TU_SALE_ID_AQUI'
-- UNION ALL
-- SELECT 'debts', COUNT(*) FROM debts WHERE sale_id = 'TU_SALE_ID_AQUI'
-- UNION ALL
-- SELECT 'fiscal_invoices', COUNT(*) FROM fiscal_invoices WHERE sale_id = 'TU_SALE_ID_AQUI';

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Siempre hacer backup antes de ejecutar
-- 2. Usar transacciones (BEGIN/COMMIT/ROLLBACK)
-- 3. Verificar PARTE 1 antes de ejecutar PARTE 2 o 3
-- 4. Si hay facturas fiscales emitidas, NO BORRAR - usar anulación normal
-- 5. Si hay asientos contables posteados, crear reversión contable manual
-- 6. Revisar movimientos de inventario y ajustar stock manualmente si es necesario
-- 7. Documentar el motivo del borrado/anulación manual
