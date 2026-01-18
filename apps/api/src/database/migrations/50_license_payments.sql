-- Migration: License Payment Verification System
-- Date: 2025-01-XX
-- Description: Sistema completo de verificación de pagos de licencias con soporte para verificación manual y automática

-- ============================================
-- TABLA 1: license_payments
-- ============================================
-- Almacena todas las solicitudes de pago de licencias

CREATE TABLE IF NOT EXISTS license_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Información del plan y facturación
    plan VARCHAR(50) NOT NULL,
    billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
    
    -- Montos
    amount_usd NUMERIC(18, 2) NOT NULL,
    amount_bs NUMERIC(18, 2) NULL,
    exchange_rate NUMERIC(18, 6) NULL,
    
    -- Información del pago
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN (
        'pago_movil', 'transferencia', 'zelle', 'efectivo', 'other'
    )),
    payment_reference VARCHAR(100) NOT NULL,
    bank_code VARCHAR(10) NULL,
    phone_number VARCHAR(20) NULL,
    account_number VARCHAR(50) NULL,
    
    -- Estado y flujo de trabajo
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'verifying', 'verified', 'approved', 'rejected', 'expired'
    )),
    
    -- Verificación
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    auto_verified BOOLEAN NOT NULL DEFAULT false,
    verification_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Aprobación
    approved_at TIMESTAMPTZ NULL,
    approved_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Rechazo
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    
    -- Notas y metadatos
    notes TEXT NULL,
    
    -- Fechas
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT chk_verified_data CHECK (
        (status = 'verified' AND verified_at IS NOT NULL) OR
        (status != 'verified' AND verified_at IS NULL)
    ),
    CONSTRAINT chk_approved_data CHECK (
        (status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL) OR
        (status != 'approved' AND approved_at IS NULL)
    ),
    CONSTRAINT chk_rejected_data CHECK (
        (status = 'rejected' AND rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND rejection_reason IS NOT NULL) OR
        (status != 'rejected' AND rejected_at IS NULL)
    )
);

COMMENT ON TABLE license_payments IS 'Solicitudes de pago de licencias con workflow de verificación y aprobación';
COMMENT ON COLUMN license_payments.plan IS 'Plan solicitado: freemium, basico, profesional, empresarial';
COMMENT ON COLUMN license_payments.billing_period IS 'Período de facturación: monthly o yearly';
COMMENT ON COLUMN license_payments.payment_reference IS 'Referencia del pago (número de transacción, comprobante, etc.)';
COMMENT ON COLUMN license_payments.auto_verified IS 'Indica si el pago fue verificado automáticamente mediante API bancaria';
COMMENT ON COLUMN license_payments.expires_at IS 'Fecha en la que la solicitud expira si no es verificada';

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_license_payments_store ON license_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_license_payments_status ON license_payments(status);
CREATE INDEX IF NOT EXISTS idx_license_payments_reference ON license_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_license_payments_created ON license_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_license_payments_expires ON license_payments(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_license_payments_pending ON license_payments(store_id, status) WHERE status IN ('pending', 'verifying');

-- ============================================
-- TABLA 2: license_payment_documents
-- ============================================
-- Almacena documentos adjuntos (capturas, comprobantes)

CREATE TABLE IF NOT EXISTS license_payment_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES license_payments(id) ON DELETE CASCADE,
    
    -- Información del archivo
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'pdf', 'other')),
    file_size BIGINT NOT NULL,
    
    -- Metadatos
    uploaded_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_positive_file_size CHECK (file_size > 0)
);

COMMENT ON TABLE license_payment_documents IS 'Documentos adjuntos a solicitudes de pago (comprobantes, capturas)';
COMMENT ON COLUMN license_payment_documents.file_path IS 'Ruta completa del archivo en el sistema de almacenamiento';
COMMENT ON COLUMN license_payment_documents.file_type IS 'Tipo de archivo: image (jpg, png), pdf, other';

-- Índices
CREATE INDEX IF NOT EXISTS idx_license_payment_documents_payment ON license_payment_documents(payment_id);

-- ============================================
-- TABLA 3: license_payment_verifications
-- ============================================
-- Historial de intentos de verificación automática

CREATE TABLE IF NOT EXISTS license_payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES license_payments(id) ON DELETE CASCADE,
    
    -- Método y resultado
    verification_method VARCHAR(50) NOT NULL CHECK (verification_method IN (
        'mercantil_api', 'banesco_api', 'manual', 'other'
    )),
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'success', 'failed', 'not_found', 'error'
    )),
    
    -- Datos de respuesta
    response_data JSONB NULL,
    error_message TEXT NULL,
    
    -- Timestamps
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE license_payment_verifications IS 'Historial de intentos de verificación automática de pagos';
COMMENT ON COLUMN license_payment_verifications.verification_method IS 'Método usado: mercantil_api, banesco_api, manual, other';
COMMENT ON COLUMN license_payment_verifications.response_data IS 'Respuesta completa de la API bancaria en formato JSON';
COMMENT ON COLUMN license_payment_verifications.error_message IS 'Mensaje de error si la verificación falló';

-- Índices
CREATE INDEX IF NOT EXISTS idx_license_payment_verifications_payment ON license_payment_verifications(payment_id);
CREATE INDEX IF NOT EXISTS idx_license_payment_verifications_status ON license_payment_verifications(status);
CREATE INDEX IF NOT EXISTS idx_license_payment_verifications_method ON license_payment_verifications(verification_method);
CREATE INDEX IF NOT EXISTS idx_license_payment_verifications_created ON license_payment_verifications(created_at DESC);

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================

CREATE OR REPLACE FUNCTION update_license_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_license_payments_updated_at
    BEFORE UPDATE ON license_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_license_payments_updated_at();
