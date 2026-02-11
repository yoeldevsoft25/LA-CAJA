-- 100_fix_duplicate_debts_by_sale_id.sql
--
-- Objetivo:
-- 1) Consolidar deudas duplicadas por (store_id, sale_id) cuando sale_id IS NOT NULL.
-- 2) Reasignar pagos al registro "keeper" para no perder abonos.
-- 3) Recalcular estado de deuda (open/partial/paid).
-- 4) Blindar con índice único parcial para evitar recurrencia.
--
-- Recomendado: ejecutar primero el bloque "dry-run" de abajo y respaldar la BD.

-- ==========================
-- DRY-RUN (solo diagnóstico)
-- ==========================
-- SELECT
--   store_id,
--   sale_id,
--   COUNT(*) AS duplicate_count,
--   ARRAY_AGG(id ORDER BY created_at, id) AS debt_ids
-- FROM debts
-- WHERE sale_id IS NOT NULL
-- GROUP BY store_id, sale_id
-- HAVING COUNT(*) > 1
-- ORDER BY duplicate_count DESC, store_id, sale_id;

BEGIN;

-- 1) Marcar duplicadas y keeper por (store_id, sale_id)
WITH ranked AS (
  SELECT
    id,
    store_id,
    sale_id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, sale_id
      ORDER BY created_at ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY store_id, sale_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM debts
  WHERE sale_id IS NOT NULL
),
dups AS (
  SELECT id AS dup_id, keep_id
  FROM ranked
  WHERE rn > 1
)
-- 2) Mover pagos a keeper
UPDATE debt_payments p
SET debt_id = d.keep_id
FROM dups d
WHERE p.debt_id = d.dup_id;

-- 3) Corregir parent_debt_id si apunta a duplicada
WITH ranked AS (
  SELECT
    id,
    store_id,
    sale_id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, sale_id
      ORDER BY created_at ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY store_id, sale_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM debts
  WHERE sale_id IS NOT NULL
),
dups AS (
  SELECT id AS dup_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE debts d
SET parent_debt_id = x.keep_id
FROM dups x
WHERE d.parent_debt_id = x.dup_id;

-- 4) Eliminar filas duplicadas
WITH ranked AS (
  SELECT
    id,
    store_id,
    sale_id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, sale_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM debts
  WHERE sale_id IS NOT NULL
)
DELETE FROM debts d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- 5) Recalcular estado de deudas con sale_id
WITH paid AS (
  SELECT
    d.id,
    COALESCE(SUM(dp.amount_usd), 0) AS paid_usd,
    COALESCE(SUM(dp.amount_bs), 0) AS paid_bs,
    COALESCE(d.amount_usd, 0) AS amount_usd,
    COALESCE(d.amount_bs, 0) AS amount_bs
  FROM debts d
  LEFT JOIN debt_payments dp ON dp.debt_id = d.id
  WHERE d.sale_id IS NOT NULL
  GROUP BY d.id, d.amount_usd, d.amount_bs
)
UPDATE debts d
SET status = CASE
  WHEN (
    p.amount_usd > 0.01
    AND p.paid_usd >= (p.amount_usd - 0.01)
  ) THEN 'paid'
  WHEN (
    p.amount_usd <= 0.01
    AND p.amount_bs > 0.01
    AND p.paid_bs >= (p.amount_bs - 0.01)
  ) THEN 'paid'
  WHEN (
    p.amount_usd <= 0.01
    AND p.amount_bs <= 0.01
    AND (p.paid_usd > 0.01 OR p.paid_bs > 0.01)
  ) THEN 'paid'
  WHEN (p.paid_usd > 0.01 OR p.paid_bs > 0.01) THEN 'partial'
  ELSE 'open'
END
FROM paid p
WHERE d.id = p.id;

COMMIT;

-- 6) Blindaje (previene duplicados por venta a futuro)
CREATE UNIQUE INDEX IF NOT EXISTS idx_debts_store_sale_unique_not_null
  ON debts(store_id, sale_id)
  WHERE sale_id IS NOT NULL;

