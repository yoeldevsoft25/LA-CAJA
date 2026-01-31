/**
 * Cono Monetario Venezolano 2025
 * Denominaciones actuales de billetes y monedas
 */

export interface Denomination {
  value: number // Valor en Bs
  label: string // Etiqueta descriptiva
  type: 'bill' | 'coin' // Tipo: billete o moneda
  isCommon: boolean // Si es de uso común
}

/**
 * Denominaciones del cono monetario venezolano 2025
 * Valores actualizados según circulación actual
 */
export const VZLA_DENOMINATIONS: Denomination[] = [
  // Billetes
  { value: 200, label: 'Bs. 200', type: 'bill', isCommon: true },
  { value: 100, label: 'Bs. 100', type: 'bill', isCommon: true },
  { value: 50, label: 'Bs. 50', type: 'bill', isCommon: true },
  { value: 20, label: 'Bs. 20', type: 'bill', isCommon: true },
  { value: 10, label: 'Bs. 10', type: 'bill', isCommon: true },
  { value: 5, label: 'Bs. 5', type: 'bill', isCommon: true },
  { value: 2, label: 'Bs. 2', type: 'bill', isCommon: true },
  { value: 1, label: 'Bs. 1', type: 'bill', isCommon: true },
  
  // Monedas (menos comunes pero aún en circulación)
  { value: 0.50, label: 'Bs. 0.50', type: 'coin', isCommon: false },
  { value: 0.25, label: 'Bs. 0.25', type: 'coin', isCommon: false },
  { value: 0.10, label: 'Bs. 0.10', type: 'coin', isCommon: false },
  { value: 0.05, label: 'Bs. 0.05', type: 'coin', isCommon: false },
]

/**
 * Calcula el desglose de vueltas usando el algoritmo del cajero (greedy)
 * Retorna un objeto con las cantidades de cada denominación necesaria
 */
export function calculateChange(amount: number): Record<string, number> {
  // Redondear a 2 decimales
  let remaining = Math.round(amount * 100) / 100
  
  // Ordenar denominaciones de mayor a menor
  const sortedDenoms = [...VZLA_DENOMINATIONS]
    .filter(d => d.isCommon) // Solo usar denominaciones comunes
    .sort((a, b) => b.value - a.value)
  
  const result: Record<string, number> = {}
  
  for (const denom of sortedDenoms) {
    if (remaining >= denom.value) {
      const count = Math.floor(remaining / denom.value)
      result[denom.label] = count
      remaining = Math.round((remaining - count * denom.value) * 100) / 100
      
      // Si ya completamos (con tolerancia de centavos)
      if (remaining < 0.01) {
        break
      }
    }
  }
  
  // Si queda un residuo menor a 1 céntimo, ajustar con la menor denominación
  if (remaining >= 0.005 && remaining < 0.01) {
    const smallestDenom = sortedDenoms[sortedDenoms.length - 1]
    if (smallestDenom) {
      result[smallestDenom.label] = (result[smallestDenom.label] || 0) + 1
    }
  }
  
  return result
}

/**
 * Formatea el desglose de vueltas para mostrarlo al usuario
 */
export function formatChangeBreakdown(breakdown: Record<string, number>): string {
  const parts = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count}x ${label}`)
  
  return parts.length > 0 ? parts.join(', ') : 'Sin vueltas'
}

/**
 * Obtiene el total de una desglose de vueltas
 */
export function getChangeTotal(breakdown: Record<string, number>): number {
  let total = 0
  for (const [label, count] of Object.entries(breakdown)) {
    // Extraer el valor numérico de la etiqueta (ej: "Bs. 200" -> 200)
    const match = label.match(/[\d.]+/)
    if (match) {
      const value = parseFloat(match[0])
      total += value * count
    }
  }
  return Math.round(total * 100) / 100
}

/**
 * Redondea un monto hacia abajo al múltiplo de 5 o 10 más cercano, siempre favoreciendo al POS
 * Retorna el monto redondeado que puede ser entregado exactamente con las denominaciones disponibles
 * Ejemplo: 108 Bs -> 105 Bs (múltiplo de 5 hacia abajo), 107 Bs -> 105 Bs
 */
export function roundToNearestDenomination(amount: number): number {
  // Redondear hacia abajo (floor) para siempre favorecer al POS
  // Primero intentamos múltiplos de 10, luego de 5, luego de 1
  const amountInt = Math.floor(amount) // Parte entera
  
  // Si es múltiplo de 10, lo dejamos así
  if (amountInt % 10 === 0) {
    return amountInt
  }
  
  // Si no, redondeamos hacia abajo al múltiplo de 5 más cercano
  const roundedTo5 = Math.floor(amountInt / 5) * 5
  
  // Si el monto está muy cerca de un múltiplo de 10 (8 o 9 unidades de diferencia)
  // pero más cerca de un múltiplo de 5, usamos el múltiplo de 5
  // Ejemplo: 108 -> 105 (no 110), 107 -> 105 (no 110)
  
  return roundedTo5
}

/**
 * Redondea un monto hacia arriba al múltiplo de 5 o 10 más cercano,
 * favoreciendo al cliente (entregar más cambio).
 */
export function roundToNearestDenominationUp(amount: number): number {
  const amountInt = Math.ceil(amount)

  if (amountInt % 10 === 0) {
    return amountInt
  }

  const roundedTo5 = Math.ceil(amountInt / 5) * 5

  return roundedTo5
}

export type CashChangeRoundingMode = 'EXACT' | 'CUSTOMER' | 'MERCHANT'

export function calculateRoundedChangeWithMode(
  changeUsd: number,
  exchangeRate: number,
  mode: CashChangeRoundingMode
): {
  changeBs: number
  breakdown: Record<string, number>
  breakdownFormatted: string
  exactChangeBs: number
  adjustmentBs: number
} {
  const initialChangeBs = Math.round(changeUsd * exchangeRate * 100) / 100

  let roundedChangeBs = initialChangeBs
  if (mode === 'MERCHANT') {
    roundedChangeBs = roundToNearestDenomination(initialChangeBs)
  } else if (mode === 'CUSTOMER') {
    roundedChangeBs = roundToNearestDenominationUp(initialChangeBs)
  }

  const breakdown = roundedChangeBs > 0 ? calculateChange(roundedChangeBs) : {}
  const breakdownFormatted = Object.keys(breakdown).length > 0
    ? formatChangeBreakdown(breakdown)
    : ''

  const adjustmentBs = Math.round((initialChangeBs - roundedChangeBs) * 100) / 100

  return {
    changeBs: roundedChangeBs,
    breakdown,
    breakdownFormatted,
    exactChangeBs: initialChangeBs,
    adjustmentBs,
  }
}

/**
 * Calcula el cambio redondeado según las denominaciones disponibles
 * Primero calcula el cambio, luego lo redondea al valor más cercano que pueda entregarse exactamente
 */
export function calculateRoundedChange(changeUsd: number, exchangeRate: number): {
  changeBs: number
  breakdown: Record<string, number>
  breakdownFormatted: string
} {
  // Calcular el cambio inicial en Bs
  const initialChangeBs = Math.round(changeUsd * exchangeRate * 100) / 100
  
  // Redondear al valor más cercano según denominaciones
  const roundedChangeBs = roundToNearestDenomination(initialChangeBs)
  
  // Calcular el desglose del monto redondeado
  const breakdown = roundedChangeBs > 0 ? calculateChange(roundedChangeBs) : {}
  const breakdownFormatted = Object.keys(breakdown).length > 0 
    ? formatChangeBreakdown(breakdown) 
    : ''
  
  return {
    changeBs: roundedChangeBs,
    breakdown,
    breakdownFormatted,
  }
}
