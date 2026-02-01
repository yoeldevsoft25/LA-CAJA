/**
 * Utilidades para cálculos del checkout
 */

/**
 * Calcula el cambio en la moneda especificada
 */
export function calculateChange(
    received: number,
    total: number
): number {
    return Math.max(0, received - total)
}

/**
 * Calcula el cambio en Bs cuando se paga en USD
 */
export function calculateChangeInBs(
    receivedUsd: number,
    totalUsd: number,
    exchangeRate: number
): number {
    const changeUsd = Math.max(0, receivedUsd - totalUsd)
    return changeUsd * exchangeRate
}

/**
 * Valida que el monto de efectivo sea suficiente
 */
export function validateCashAmount(
    received: number,
    total: number
): { valid: boolean; error?: string } {
    if (received < total) {
        return {
            valid: false,
            error: `Monto insuficiente. Recibido: $${received.toFixed(2)}, Total: $${total.toFixed(2)}`
        }
    }
    return { valid: true }
}

/**
 * Calcula el monto restante en pagos divididos
 */
export function calculateSplitRemaining(
    totalUsd: number,
    payments: Array<{ amount_usd?: number; amount_bs?: number }>,
    exchangeRate: number
): number {
    const paidUsd = payments.reduce((sum, p) => {
        const usd = p.amount_usd || 0
        const bs = p.amount_bs || 0
        return sum + usd + (bs / exchangeRate)
    }, 0)

    return Math.max(0, totalUsd - paidUsd)
}

/**
 * Formatea un monto en la moneda especificada
 */
export function formatCurrency(amount: number, currency: 'USD' | 'BS'): string {
    if (currency === 'USD') {
        return `$${amount.toFixed(2)} USD`
    } else {
        return `Bs. ${amount.toFixed(2)}`
    }
}

/**
 * Convierte USD a BS usando la tasa de cambio
 */
export function convertUsdToBs(usd: number, exchangeRate: number): number {
    return usd * exchangeRate
}

/**
 * Convierte BS a USD usando la tasa de cambio
 */
export function convertBsToUsd(bs: number, exchangeRate: number): number {
    return bs / exchangeRate
}

/**
 * Valida que los pagos divididos sumen el total
 */
export function validateSplitPayments(
    totalUsd: number,
    payments: Array<{ amount_usd?: number; amount_bs?: number }>,
    exchangeRate: number
): { valid: boolean; error?: string; remaining?: number } {
    const remaining = calculateSplitRemaining(totalUsd, payments, exchangeRate)

    if (remaining > 0.01) { // Tolerancia de 1 centavo
        return {
            valid: false,
            error: `Faltan $${remaining.toFixed(2)} USD por pagar`,
            remaining
        }
    }

    return { valid: true }
}
