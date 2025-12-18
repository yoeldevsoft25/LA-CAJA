-- Migración 33: Security Audit Log
-- Tabla de auditoría de seguridad para registrar eventos críticos
-- Implementa logging de seguridad según OWASP best practices

-- Tabla de auditoría de seguridad
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'blocked')),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejor rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_security_audit_store ON security_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_status ON security_audit_log(status);

-- Índice compuesto para consultas comunes (tienda + tipo + fecha)
CREATE INDEX IF NOT EXISTS idx_security_audit_store_type_created 
ON security_audit_log(store_id, event_type, created_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE security_audit_log IS 'Registro de eventos de seguridad para auditoría y detección de amenazas';
COMMENT ON COLUMN security_audit_log.event_type IS 'Tipo de evento: login_attempt, login_success, login_failure, login_blocked, permission_change, admin_action, sensitive_data_access, unauthorized_access, rate_limit_exceeded';
COMMENT ON COLUMN security_audit_log.status IS 'Estado del evento: success, failure, blocked';
COMMENT ON COLUMN security_audit_log.details IS 'Información adicional del evento en formato JSON';
COMMENT ON COLUMN security_audit_log.ip_address IS 'Dirección IP del cliente (INET para soporte IPv4/IPv6)';


