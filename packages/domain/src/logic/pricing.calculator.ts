
export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz';

export const WEIGHT_UNIT_TO_KG: Record<WeightUnit, number> = {
    kg: 1,
    g: 0.001,
    lb: 0.45359237,
    oz: 0.028349523125,
};

export class PricingCalculator {
    /**
     * Redondea un número a 2 decimales
     */
    static roundToTwoDecimals(value: number): number {
        return Math.round(value * 100) / 100;
    }

    /**
     * Redondea un número a N decimales
     */
    static roundToDecimals(value: number, decimals: number): number {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    /**
     * Convierte un valor de peso de una unidad a otra
     */
    static convertWeightValue(
        value: number,
        fromUnit: WeightUnit,
        toUnit: WeightUnit,
    ): number {
        return (
            value * (WEIGHT_UNIT_TO_KG[fromUnit] / WEIGHT_UNIT_TO_KG[toUnit])
        );
    }

    /**
     * Convierte un precio por peso de una unidad a otra
     * (Inverso a la conversión de valor: si 1kg cuesta 10, 1000g deben costar 10, pero el precio unitario por g es 0.01)
     * Precio(to) = Precio(from) * (kg(to) / kg(from))
     */
    static convertWeightPrice(
        value: number,
        fromUnit: WeightUnit,
        toUnit: WeightUnit,
    ): number {
        return (
            value * (WEIGHT_UNIT_TO_KG[toUnit] / WEIGHT_UNIT_TO_KG[fromUnit])
        );
    }

    /**
     * Aplica cambio de precio (porcentaje) y redondeo
     */
    static applyPriceChange(
        currentPrice: number,
        percentageChange: number,
        rounding: 'none' | '0.1' | '0.5' | '1',
    ): number {
        let newPrice = currentPrice * (1 + percentageChange / 100);

        switch (rounding) {
            case '0.1':
                newPrice = Math.round(newPrice * 10) / 10;
                break;
            case '0.5':
                newPrice = Math.round(newPrice * 2) / 2;
                break;
            case '1':
                newPrice = Math.round(newPrice);
                break;
            case 'none':
            default:
                // Redondear a 2 decimales por defecto
                newPrice = this.roundToTwoDecimals(newPrice);
                break;
        }

        // Siempre asegurar máximo 2 decimales al final y que no sea negativo
        return Math.max(0, this.roundToTwoDecimals(newPrice));
    }

    /**
     * Calcula subtotales para un item de venta
     */
    static calculateItemTotals(params: {
        qty: number;
        unitPriceBs: number;
        unitPriceUsd: number;
        discountBs?: number;
        discountUsd?: number;
        isWeightProduct?: boolean;
        weightUnit?: WeightUnit | null;
        weightValue?: number | null;
        pricePerWeightBs?: number | null;
        pricePerWeightUsd?: number | null;
    }): {
        qty: number;
        effectivePriceBs: number;
        effectivePriceUsd: number;
        subtotalBs: number;
        subtotalUsd: number;
        discountBs: number;
        discountUsd: number;
        totalBs: number;
        totalUsd: number;
    } {
        const discountBs = params.discountBs || 0;
        const discountUsd = params.discountUsd || 0;

        if (params.isWeightProduct) {
            const weightValue = params.weightValue || params.qty || 0;
            // Usar precios per weight si existen, si no los unitarios (fallback)
            const pricePerWeightBs = params.pricePerWeightBs ?? 0;
            const pricePerWeightUsd = params.pricePerWeightUsd ?? 0;

            const subtotalBs = weightValue * pricePerWeightBs;
            const subtotalUsd = weightValue * pricePerWeightUsd;

            return {
                qty: weightValue,
                effectivePriceBs: pricePerWeightBs,
                effectivePriceUsd: pricePerWeightUsd,
                subtotalBs,
                subtotalUsd,
                discountBs,
                discountUsd,
                totalBs: subtotalBs - discountBs,
                totalUsd: subtotalUsd - discountUsd,
            };
        }

        const subtotalBs = params.unitPriceBs * params.qty;
        const subtotalUsd = params.unitPriceUsd * params.qty;

        return {
            qty: params.qty,
            effectivePriceBs: params.unitPriceBs,
            effectivePriceUsd: params.unitPriceUsd,
            subtotalBs,
            subtotalUsd,
            discountBs,
            discountUsd,
            totalBs: subtotalBs - discountBs,
            totalUsd: subtotalUsd - discountUsd,
        };
    }
}
