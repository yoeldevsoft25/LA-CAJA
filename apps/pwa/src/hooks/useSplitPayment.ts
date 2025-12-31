/**
 * Hook para gestionar pagos divididos
 * Permite combinar múltiples métodos de pago en una sola transacción
 */

import { useState, useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  SplitPaymentItem,
  SplitPaymentState,
  PaymentSuggestion,
} from '@/types/split-payment.types'

interface UseSplitPaymentProps {
  totalDueUsd: number
  exchangeRate: number
}

export function useSplitPayment({ totalDueUsd, exchangeRate }: UseSplitPaymentProps) {
  const [payments, setPayments] = useState<SplitPaymentItem[]>([])

  const totalDueBs = useMemo(() => totalDueUsd * exchangeRate, [totalDueUsd, exchangeRate])

  const state: SplitPaymentState = useMemo(() => {
    const totalPaidUsd = payments.reduce((sum, p) => sum + p.amount_usd, 0)
    const totalPaidBs = payments.reduce((sum, p) => sum + p.amount_bs, 0)
    const remainingUsd = Math.max(0, totalDueUsd - totalPaidUsd)
    const remainingBs = Math.max(0, totalDueBs - totalPaidBs)

    const isComplete = remainingUsd <= 0.01 && remainingBs <= 0.01

    let overpayment: SplitPaymentState['overpayment'] | undefined

    if (totalPaidUsd > totalDueUsd) {
      overpayment = {
        amount_usd: totalPaidUsd - totalDueUsd,
        amount_bs: (totalPaidUsd - totalDueUsd) * exchangeRate,
        action: 'adjust_last_payment',
      }
    } else if (totalPaidBs > totalDueBs && totalPaidUsd <= totalDueUsd) {
      overpayment = {
        amount_usd: (totalPaidBs - totalDueBs) / exchangeRate,
        amount_bs: totalPaidBs - totalDueBs,
        action: 'adjust_last_payment',
      }
    }

    return {
      payments,
      total_due_usd: totalDueUsd,
      total_due_bs: totalDueBs,
      total_paid_usd: totalPaidUsd,
      total_paid_bs: totalPaidBs,
      remaining_usd: remainingUsd,
      remaining_bs: remainingBs,
      is_complete: isComplete,
      overpayment,
    }
  }, [payments, totalDueUsd, totalDueBs, exchangeRate])

  const addPayment = useCallback((payment: Omit<SplitPaymentItem, 'id'>) => {
    const newPayment: SplitPaymentItem = {
      ...payment,
      id: uuidv4(),
    }
    setPayments((prev) => [...prev, newPayment])
  }, [])

  const removePayment = useCallback((paymentId: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== paymentId))
  }, [])

  const updatePayment = useCallback(
    (paymentId: string, updates: Partial<Omit<SplitPaymentItem, 'id'>>) => {
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, ...updates } : p))
      )
    },
    []
  )

  const clearPayments = useCallback(() => {
    setPayments([])
  }, [])

  const getSuggestions = useCallback((): PaymentSuggestion[] => {
    const suggestions: PaymentSuggestion[] = []

    const { remaining_usd, remaining_bs } = state

    // Si no queda nada por pagar, no sugerir
    if (remaining_usd <= 0.01 && remaining_bs <= 0.01) {
      return []
    }

    // Sugerencia 1: Pago completo en USD
    if (remaining_usd > 0) {
      suggestions.push({
        method: 'CASH_USD',
        amount_usd: remaining_usd,
        amount_bs: 0,
        reason: 'Pago completo en dólares',
        priority: 9,
      })
    }

    // Sugerencia 2: Pago completo en Bs
    if (remaining_bs > 0) {
      suggestions.push({
        method: 'PAGO_MOVIL',
        amount_usd: 0,
        amount_bs: remaining_bs,
        reason: 'Pago móvil por el monto restante',
        priority: 10, // Más común en Venezuela
      })

      suggestions.push({
        method: 'CASH_BS',
        amount_usd: 0,
        amount_bs: remaining_bs,
        reason: 'Efectivo en bolívares',
        priority: 7,
      })

      suggestions.push({
        method: 'TRANSFER',
        amount_usd: 0,
        amount_bs: remaining_bs,
        reason: 'Transferencia bancaria',
        priority: 8,
      })
    }

    // Sugerencia 3: Redondear USD y resto en Bs
    if (remaining_usd >= 1) {
      const roundedUsd = Math.floor(remaining_usd)
      const remainderInBs = (remaining_usd - roundedUsd) * exchangeRate

      if (remainderInBs >= 5) {
        // Solo si el resto es significativo
        suggestions.push({
          method: 'CASH_USD',
          amount_usd: roundedUsd,
          amount_bs: 0,
          reason: `$${roundedUsd} USD + Bs. ${remainderInBs.toFixed(2)} en pago móvil`,
          priority: 8,
        })
      }
    }

    // Ordenar por prioridad
    return suggestions.sort((a, b) => b.priority - a.priority)
  }, [state, exchangeRate])

  const getTopSuggestion = useCallback((): PaymentSuggestion | null => {
    const suggestions = getSuggestions()
    return suggestions.length > 0 ? suggestions[0] : null
  }, [getSuggestions])

  return {
    state,
    payments,
    addPayment,
    removePayment,
    updatePayment,
    clearPayments,
    getSuggestions,
    getTopSuggestion,
  }
}
