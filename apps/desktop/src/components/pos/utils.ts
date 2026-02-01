import {
    Apple,
    Beef,
    Coffee,
    Cpu,
    Home,
    Package,
    Pill,
    Shirt,
    ShoppingBag,
} from 'lucide-react'

export const getCategoryIcon = (category?: string | null) => {
    if (!category) return Package
    const normalized = category.toLowerCase()

    if (normalized.includes('bebida') || normalized.includes('drink') || normalized.includes('refresco')) {
        return Coffee
    }
    if (normalized.includes('fruta') || normalized.includes('verdura') || normalized.includes('vegetal')) {
        return Apple
    }
    if (normalized.includes('carne') || normalized.includes('pollo') || normalized.includes('proteina')) {
        return Beef
    }
    if (normalized.includes('ropa') || normalized.includes('vestir') || normalized.includes('moda')) {
        return Shirt
    }
    if (normalized.includes('hogar') || normalized.includes('casa')) {
        return Home
    }
    if (normalized.includes('electron') || normalized.includes('tecno') || normalized.includes('gadget')) {
        return Cpu
    }
    if (normalized.includes('farmacia') || normalized.includes('salud') || normalized.includes('medic')) {
        return Pill
    }
    if (normalized.includes('accesorio') || normalized.includes('general')) {
        return ShoppingBag
    }
    return Package
}

export const getWeightPriceDecimals = (unit?: string | null) => {
    return unit === 'g' || unit === 'oz' ? 4 : 2
}
