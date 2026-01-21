-- ============================================
-- 59. ACTUALIZAR URLs DE QR CODES
-- ============================================
-- Actualizar todas las URLs de QR codes para usar la URL de producción
-- en lugar de localhost

-- Actualizar todas las URLs que contengan localhost:5173
UPDATE qr_codes
SET public_url = REPLACE(public_url, 'http://localhost:5173', 'http://la-caja.netlify.app')
WHERE public_url LIKE '%localhost:5173%';

-- También actualizar URLs con https://la-caja.netlify.app a http://la-caja.netlify.app
UPDATE qr_codes
SET public_url = REPLACE(public_url, 'https://la-caja.netlify.app', 'http://la-caja.netlify.app')
WHERE public_url LIKE '%https://la-caja.netlify.app%';

-- Comentario
COMMENT ON TABLE qr_codes IS 'Códigos QR únicos para acceso público a menú desde mesa - URLs actualizadas a producción';
