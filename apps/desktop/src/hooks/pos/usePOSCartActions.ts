import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useCart } from '@/stores/cart.store'
import { inventoryService } from '@/services/inventory.service'
import { productVariantsService, ProductVariant } from '@/services/product-variants.service'
import { productsService } from '@/services/products.service'
import { WeightProduct } from '@/components/pos/WeightInputModal'

interface UsePOSCartActionsProps {
    storeId?: string
    isOnline: boolean
}

export function usePOSCartActions({ storeId, isOnline }: UsePOSCartActionsProps) {
    const { items, addItem, updateItem } = useCart()
    const MAX_QTY_PER_PRODUCT = 999

    // Estados locales necesarios para interactuar con modales
    const [showVariantSelector, setShowVariantSelector] = useState(false)
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<{ id: string; name: string } | null>(null)
    const [showWeightModal, setShowWeightModal] = useState(false)
    const [selectedWeightProduct, setSelectedWeightProduct] = useState<WeightProduct | null>(null)

    // 1. Helper: Validar Stock
    const checkStock = useCallback(async (productId: string, currentQty: number, addedQty: number, isWeightProduct: boolean) => {
        if (!isOnline || isWeightProduct) return true // Offline o peso => confiar/permitir

        try {
            const stockInfo = await inventoryService.getProductStock(productId)
            const availableStock = stockInfo.current_stock
            const newTotal = currentQty + addedQty

            if (newTotal > availableStock) {
                if (availableStock <= 0) {
                    toast.error('Sin stock disponible', { icon: '📦' })
                } else {
                    toast.warning(`Stock insuficiente. Disponible: ${availableStock}`, { icon: '⚠️' })
                }
                return false
            }
            return true
        } catch (e) {
            console.warn('[POS] Error verificando stock', e)
            return true // Fallback permisivo
        }
    }, [isOnline])

    // 2. Acción: Agregar al carrito (Core logic)
    const handleAddToCart = useCallback(async (product: any, variant: ProductVariant | null = null, qty: number = 1) => {
        const priceBs = variant?.price_bs ? Number(variant.price_bs) : Number(product.price_bs)
        const priceUsd = variant?.price_usd ? Number(variant.price_usd) : Number(product.price_usd)

        const productName = variant
            ? `${product.name} (${variant.variant_type}: ${variant.variant_value})`
            : product.name

        const existingItem = items.find(
            (item) => item.product_id === product.id && (item.variant_id ?? null) === (variant?.id ?? null)
        )

        const currentQty = existingItem ? existingItem.qty : 0

        if (!product.is_weight_product && (currentQty + qty) > MAX_QTY_PER_PRODUCT) {
            toast.error(`Límite de cantidad alcanzado (${MAX_QTY_PER_PRODUCT})`)
            return
        }

        const hasStock = await checkStock(product.id, currentQty, qty, !!product.is_weight_product)
        if (!hasStock) return

        if (existingItem) {
            updateItem(existingItem.id, { qty: existingItem.qty + qty })
        } else {
            addItem({
                product_id: product.id,
                product_name: productName,
                qty: qty,
                unit_price_bs: priceBs,
                unit_price_usd: priceUsd,
                variant_id: variant?.id || null,
                variant_name: variant ? `${variant.variant_type}: ${variant.variant_value}` : null,
            })
        }
        toast.success(`${productName} agregado`)
    }, [addItem, items, updateItem, checkStock])

    // 3. Helper: Normalizar producto por peso (lógica que estaba en POSPage)
    const resolveWeightProduct = useCallback(async (source: any): Promise<WeightProduct | null> => {
        const normalize = (item: any): WeightProduct | null => {
            const pricePerWeightBs = Number(item.price_per_weight_bs) || 0
            const pricePerWeightUsd = Number(item.price_per_weight_usd) || 0
            if (pricePerWeightBs <= 0 && pricePerWeightUsd <= 0) return null

            return {
                id: item.id,
                name: item.name,
                weight_unit: item.weight_unit || 'kg',
                price_per_weight_bs: pricePerWeightBs,
                price_per_weight_usd: pricePerWeightUsd,
                min_weight: item.min_weight != null ? Number(item.min_weight) : null,
                max_weight: item.max_weight != null ? Number(item.max_weight) : null,
            }
        }

        let p = normalize(source)
        if (p && source.weight_unit) return p

        try {
            const fresh = await productsService.getById(source.id, storeId)
            return normalize(fresh)
        } catch { return null }
    }, [storeId])

    // 4. Handler Principal: Click en producto (Grid o Scanner)
    const handleProductClick = useCallback(async (product: any) => {
        // A) Producto por peso
        if (product.is_weight_product) {
            const wp = await resolveWeightProduct(product)
            if (!wp) {
                toast.error('Producto por peso sin precio configurado')
                return
            }
            setSelectedWeightProduct(wp)
            setShowWeightModal(true)
            return
        }

        // B) Variantes
        try {
            // Optimizacion: Si el producto ya trae variantes cargadas (no siempre pasa), usarlas.
            // Pero por seguridad consultamos el servicio.
            const variants = await productVariantsService.getVariantsByProduct(product.id)
            const activeVariants = variants.filter((v) => v.is_active)

            if (activeVariants.length > 0) {
                setSelectedProductForVariant({ id: product.id, name: product.name })
                setShowVariantSelector(true)
            } else {
                // C) Producto simple
                await handleAddToCart(product)
            }
        } catch (e) {
            // Fallback a simple en error
            await handleAddToCart(product)
        }
    }, [handleAddToCart, resolveWeightProduct])


    // 5. Handlers de Modales
    const handleVariantSelect = useCallback(async (variant: ProductVariant | null) => {
        // productData es opcional, si no viene usamos el ID guardado para buscarlo en la lista 'items' o refetchear
        // Para simplificar, asumimos que POSPage pasará el producto completo o lo buscaremos luego.
        // Mejor estrategia: Que handleVariantSelect reciba el ID y lo resuelva aquí o que usemos el state 'selectedProductForVariant'
        // PERO: handleAddToCart necesita el objeto `product` completo para precios base si falla variante etc.

        // Solución: Necesitamos acceder a la lista de productos global (products) O fetchearlo.
        // Como este hook no tiene acceso a 'products' (query del padre), fetchearemos si es necesario
        // O mejor: confiamos en que 'handleAddToCart' sabe manejarlo.

        // Ajuste: handleVariantSelect solo cierra modal y llama a addToCart.
        // Pero necesitamos el objeto `product` original.
        // Lo recuperamos via servicio si no lo tenemos a mano, O pasamos `products` al hook (muy pesado).
        // Fetchear by ID es seguro.
        if (!selectedProductForVariant) return;

        try {
            const product = await productsService.getById(selectedProductForVariant.id, storeId)
            await handleAddToCart(product, variant)
        } catch (e) { toast.error('Error procesando variante') }

        setShowVariantSelector(false)
        setSelectedProductForVariant(null)
    }, [selectedProductForVariant, storeId, handleAddToCart])


    const handleWeightConfirm = useCallback((weightValue: number) => {
        if (!selectedWeightProduct) return
        if (weightValue <= 0) {
            toast.error('Peso inválido')
            return
        }

        // Agregar item manual
        const unitLabel = selectedWeightProduct.weight_unit || 'kg'
        addItem({
            product_id: selectedWeightProduct.id,
            product_name: `${selectedWeightProduct.name} (${weightValue} ${unitLabel})`,
            qty: weightValue,
            unit_price_bs: selectedWeightProduct.price_per_weight_bs,
            unit_price_usd: selectedWeightProduct.price_per_weight_usd,
            is_weight_product: true,
            weight_unit: selectedWeightProduct.weight_unit,
            weight_value: weightValue,
            price_per_weight_bs: selectedWeightProduct.price_per_weight_bs,
            price_per_weight_usd: selectedWeightProduct.price_per_weight_usd,
        })
        toast.success('Agregado correctamente')
        setShowWeightModal(false)
        setSelectedWeightProduct(null)
    }, [addItem, selectedWeightProduct])


    return {
        handleProductClick,
        handleAddToCart,
        // Modales states
        showVariantSelector, setShowVariantSelector,
        selectedProductForVariant, setSelectedProductForVariant,
        handleVariantSelect,
        showWeightModal, setShowWeightModal,
        selectedWeightProduct, setSelectedWeightProduct,
        handleWeightConfirm
    }
}
