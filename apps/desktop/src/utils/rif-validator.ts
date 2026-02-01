/**
 * Utilidades para validar y formatear RIF venezolano
 * 
 * Formato RIF Venezuela:
 * - J-123456789 (Jurídico)
 * - V-12345678-9 (Natural venezolano)
 * - E-12345678-9 (Extranjero)
 * - P-12345678-9 (Pasaporte)
 * - G-12345678-9 (Gobierno)
 * - C-12345678-9 (Comunal)
 */

export type RIFType = 'J' | 'V' | 'E' | 'P' | 'G' | 'C'

export interface RIFValidationResult {
  isValid: boolean
  formatted: string | null
  type: RIFType | null
  numbers: string | null
  checkDigit: string | null
  error?: string
}

/**
 * Tipos de RIF válidos
 */
export const RIF_TYPES: Record<RIFType, string> = {
  J: 'Jurídico',
  V: 'Natural Venezolano',
  E: 'Extranjero',
  P: 'Pasaporte',
  G: 'Gobierno',
  C: 'Comunal',
}

/**
 * Limpia y normaliza un RIF
 */
function cleanRIF(rif: string): string {
  return rif
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Quitar todo excepto letras y números
}

/**
 * Calcula el dígito verificador de un RIF
 * Algoritmo oficial del SENIAT
 */
function calculateCheckDigit(type: RIFType, numbers: string): number {
  // Valores para el tipo de contribuyente
  const typeValues: Record<RIFType, number> = {
    V: 1,
    E: 2,
    J: 3,
    P: 4,
    G: 5,
    C: 0, // Comunal usa 0
  }

  // Multiplicadores para el cálculo
  const multipliers = [4, 3, 2, 7, 6, 5, 4, 3, 2]

  // Calcular suma ponderada
  let sum = typeValues[type] * 4

  for (let i = 0; i < 8 && i < numbers.length; i++) {
    sum += parseInt(numbers[i], 10) * multipliers[i + 1]
  }

  // Calcular módulo 11
  const remainder = sum % 11
  const checkDigit = remainder > 1 ? 11 - remainder : 0

  return checkDigit
}

/**
 * Valida un RIF venezolano
 */
export function validateRIF(rif: string): RIFValidationResult {
  if (!rif || typeof rif !== 'string') {
    return {
      isValid: false,
      formatted: null,
      type: null,
      numbers: null,
      checkDigit: null,
      error: 'RIF es requerido',
    }
  }

  const cleaned = cleanRIF(rif)

  if (cleaned.length < 9 || cleaned.length > 10) {
    return {
      isValid: false,
      formatted: null,
      type: null,
      numbers: null,
      checkDigit: null,
      error: 'Longitud de RIF inválida',
    }
  }

  // Extraer tipo
  const type = cleaned[0] as RIFType
  if (!RIF_TYPES[type]) {
    return {
      isValid: false,
      formatted: null,
      type: null,
      numbers: null,
      checkDigit: null,
      error: 'Tipo de RIF inválido. Use J, V, E, P, G o C',
    }
  }

  // Extraer números
  const numbersWithCheck = cleaned.slice(1)
  
  // Verificar que solo sean números
  if (!/^\d+$/.test(numbersWithCheck)) {
    return {
      isValid: false,
      formatted: null,
      type,
      numbers: null,
      checkDigit: null,
      error: 'RIF debe contener solo números después del tipo',
    }
  }

  // Separar números y dígito verificador
  const numbers = numbersWithCheck.slice(0, 8).padStart(8, '0')
  const providedCheckDigit = numbersWithCheck.length >= 9 
    ? numbersWithCheck.slice(8, 9) 
    : null

  // Calcular dígito verificador esperado
  const expectedCheckDigit = calculateCheckDigit(type, numbers)

  // Si se proporcionó dígito verificador, validarlo
  if (providedCheckDigit !== null) {
    if (parseInt(providedCheckDigit, 10) !== expectedCheckDigit) {
      return {
        isValid: false,
        formatted: `${type}-${numbers}-${expectedCheckDigit}`,
        type,
        numbers,
        checkDigit: expectedCheckDigit.toString(),
        error: `Dígito verificador incorrecto. Debería ser ${expectedCheckDigit}`,
      }
    }
  }

  // RIF válido
  const formatted = `${type}-${numbers}-${expectedCheckDigit}`

  return {
    isValid: true,
    formatted,
    type,
    numbers,
    checkDigit: expectedCheckDigit.toString(),
  }
}

/**
 * Formatea un RIF para mostrar
 */
export function formatRIF(rif: string): string {
  const result = validateRIF(rif)
  return result.formatted || rif
}

/**
 * Verifica si un string parece ser un RIF
 */
export function looksLikeRIF(value: string): boolean {
  if (!value) return false
  const cleaned = cleanRIF(value)
  return /^[JVEPGC]\d{8,9}$/.test(cleaned)
}

/**
 * Obtiene el nombre del tipo de RIF
 */
export function getRIFTypeName(type: RIFType): string {
  return RIF_TYPES[type] || 'Desconocido'
}
