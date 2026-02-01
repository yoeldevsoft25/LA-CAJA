import { useCallback } from 'react'
import { SinglePaymentMethod } from '@/types/checkout.types'
import { validateCashAmount, validateSplitPayments } from '@/utils/checkout-utils'

interface ValidationResult {
    valid: boolean
    error?: string
}

/**
 * Hook para validaciones del checkout
 */
export function useCheckoutValidation() {
    /**
     * Valida que el método de pago sea válido
     */
    const validatePaymentMethod = useCallback((
        method: SinglePaymentMethod,
        customerId: string | null
    ): ValidationResult => {
        if (method === 'FIAO' && !customerId) {
            return {
                valid: false,
                error: 'Debes seleccionar un cliente para ventas FIAO'
            }
        }
        return { valid: true }
    }, [])

    /**
     * Valida el pago en efectivo USD
     */
    const validateCashUsd = useCallback((
        receivedUsd: number,
        totalUsd: number
    ): ValidationResult => {
        return validateCashAmount(receivedUsd, totalUsd)
    }, [])

    /**
     * Valida el pago en efectivo BS
     */
    const validateCashBs = useCallback((
        receivedBs: number,
        totalBs: number
    ): ValidationResult => {
        return validateCashAmount(receivedBs, totalBs)
    }, [])

    /**
     * Valida que los pagos divididos sumen el total
     */
    const validateSplit = useCallback((
        totalUsd: number,
        payments: Array<{ amount_usd?: number; amount_bs?: number }>,
        exchangeRate: number
    ): ValidationResult => {
        if (payments.length === 0) {
            return {
                valid: false,
                error: 'Debes agregar al menos un pago'
            }
        }

        return validateSplitPayments(totalUsd, payments, exchangeRate)
    }, [])

    /**
     * Valida fast checkout (Enter rápido)
     */
    const validateFastCheckout = useCallback((
        method: SinglePaymentMethod,
        customerId: string | null
    ): ValidationResult => {
        // Fast checkout solo funciona para métodos que no requieren cliente
        if (method === 'FIAO' && !customerId) {
            return {
                valid: false,
                error: 'No puedes usar fast checkout con FIAO sin cliente'
            }
        }
        return { valid: true }
    }, [])

    return {
        validatePaymentMethod,
        validateCashUsd,
        validateCashBs,
        validateSplit,
        validateFastCheckout,
    }
}
