/**
 * Lógica de Negocio y Validaciones para Productos
 * Compartida entre API y PWA
 */

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface ProductValidationData {
    name?: string;
    price_bs?: number;
    price_usd?: number;
    cost_bs?: number;
    cost_usd?: number;
    barcode?: string | null;
}

/**
 * Normaliza un código de barras (trim, null si vacío)
 */
export function normalizeBarcode(value?: string | null): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Valida los datos básicos de un producto
 */
export function validateProduct(data: ProductValidationData): ValidationResult {
    const errors: string[] = [];

    if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
        errors.push('El nombre del producto es obligatorio');
    }

    if (data.price_bs !== undefined && data.price_bs < 0) {
        errors.push('El precio en Bs no puede ser negativo');
    }

    if (data.price_usd !== undefined && data.price_usd < 0) {
        errors.push('El precio en USD no puede ser negativo');
    }

    if (data.cost_bs !== undefined && data.cost_bs < 0) {
        errors.push('El costo en Bs no puede ser negativo');
    }

    if (data.cost_usd !== undefined && data.cost_usd < 0) {
        errors.push('El costo en USD no puede ser negativo');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
