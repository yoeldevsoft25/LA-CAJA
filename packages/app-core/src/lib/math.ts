/**
 * Utilidades matemáticas para manejo de divisas y redondeo
 */

/**
 * Convierte un monto decimal a centavos (evita errores de punto flotante)
 */
export function toCents(amount: number): number {
    return Math.round(amount * 100)
}

/**
 * Convierte centavos a monto decimal
 */
export function fromCents(cents: number): number {
    return cents / 100
}

/**
 * Convierte USD a BS usando la tasa proporcionada
 */
export function usdToBs(amountUsd: number, rate: number): number {
    if (!rate || rate <= 0) {
        throw new Error(`Tasa de cambio inválida: ${rate}`)
    }
    return Math.round(amountUsd * rate * 100) / 100
}

/**
 * Convierte BS a USD usando la tasa proporcionada
 */
export function bsToUsd(amountBs: number, rate: number): number {
    if (!rate || rate <= 0) {
        throw new Error(`Tasa de cambio inválida: ${rate}`)
    }
    return Math.round((amountBs / rate) * 100) / 100
}

/**
 * Redondeo bancario (IEEE 754)
 */
export function bankerRound(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals)
    const scaled = value * factor
    const truncated = Math.trunc(scaled)
    const remainder = scaled - truncated

    if (Math.abs(remainder - 0.5) < 0.0000001) {
        if (truncated % 2 === 0) {
            return truncated / factor
        } else {
            return (truncated + 1) / factor
        }
    }
    return Math.round(value * factor) / factor
}
