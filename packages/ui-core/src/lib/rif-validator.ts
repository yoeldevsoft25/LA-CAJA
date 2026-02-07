/**
 * Utilidades para validar y formatear RIF venezolano
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
        .replace(/[^A-Z0-9]/g, '')
}

/**
 * Calcula el dígito verificador de un RIF
 */
function calculateCheckDigit(type: RIFType, numbers: string): number {
    const typeValues: Record<RIFType, number> = {
        V: 1,
        E: 2,
        J: 3,
        P: 4,
        G: 5,
        C: 0,
    }

    const multipliers = [4, 3, 2, 7, 6, 5, 4, 3, 2]
    let sum = typeValues[type] * 4

    for (let i = 0; i < 8 && i < numbers.length; i++) {
        sum += parseInt(numbers[i], 10) * multipliers[i + 1]
    }

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

    const numbersWithCheck = cleaned.slice(1)

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

    const numbers = numbersWithCheck.slice(0, 8).padStart(8, '0')
    const providedCheckDigit = numbersWithCheck.length >= 9
        ? numbersWithCheck.slice(8, 9)
        : null

    const expectedCheckDigit = calculateCheckDigit(type, numbers)

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
