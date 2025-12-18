-- Migración 34: Refresh Tokens
-- Implementa sistema de refresh tokens para mayor seguridad
-- Access tokens cortos (15-30 min) + Refresh tokens largos (7-30 días)

-- Tabla de refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID,
  device_info TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_store ON refresh_tokens(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked_at) WHERE revoked_at IS NOT NULL;

-- Índice compuesto para búsquedas comunes
-- NOTA: No podemos usar NOW() en predicado de índice (no es IMMUTABLE)
-- La función cleanup_expired_refresh_tokens() usará los índices individuales
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_revoked 
ON refresh_tokens(expires_at, revoked_at);

-- Comentarios para documentación
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens para renovar access tokens. Permite access tokens cortos y refresh tokens largos.';
COMMENT ON COLUMN refresh_tokens.token IS 'Token único (hash) para identificar el refresh token';
COMMENT ON COLUMN refresh_tokens.device_id IS 'ID del dispositivo que solicitó el token';
COMMENT ON COLUMN refresh_tokens.device_info IS 'Información del dispositivo (user agent, etc.)';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Fecha de expiración del refresh token';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'Fecha de revocación (si fue revocado)';
COMMENT ON COLUMN refresh_tokens.revoked_reason IS 'Razón de revocación (logout, security, etc.)';
COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Última vez que se usó el token para refrescar';

-- Función para limpiar tokens expirados (opcional, puede ejecutarse periódicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens
  WHERE expires_at < NOW() - INTERVAL '1 day'
     OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Limpia tokens expirados y revocados antiguos. Ejecutar periódicamente.';

