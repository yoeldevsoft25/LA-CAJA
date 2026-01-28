import { useRef, useEffect, useState, useMemo } from 'react'
import { Package, Coffee, Apple, Beef, Shirt, Home, Cpu, Pill, ShoppingBag, Scale, Search, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Definición de tipos mínimos necesarios si no se importan de /services
interface Product {
    id: string
    name: string
    price_bs: number
    price_usd: number
    category?: string | null
    image_url?: string | null
    is_weight_product?: boolean
    weight_unit?: string | null
    price_per_weight_bs?: number
    price_per_weight_usd?: number
    barcode?: string | null
    low_stock_threshold?: number
}

interface ProductCatalogProps {
    products: Product[]
    isLoading: boolean
    isError: boolean
    searchQuery: string
    lowStockIds: Set<string>
    onProductClick: (product: Product) => void
}

export function ProductCatalog({
    products,
    isLoading,
    isError,
    searchQuery,
    lowStockIds,
    onProductClick
}: ProductCatalogProps) {
    const listViewportRef = useRef<HTMLDivElement | null>(null)
    const [listScrollTop, setListScrollTop] = useState(0)
    const [listViewportHeight, setListViewportHeight] = useState(0)

    // Lógica de virtualización
    useEffect(() => {
        if (!listViewportRef.current) return
        const updateHeight = () => {
            setListViewportHeight(listViewportRef.current?.clientHeight || 0)
        }
        updateHeight()

        const observer = new ResizeObserver(updateHeight)
        observer.observe(listViewportRef.current)
        return () => observer.disconnect()
    }, [])

    const PRODUCT_ROW_HEIGHT = 112 // Aumentado para dar espacio y evitar cortes (104px card + 8px gap)
    const PRODUCT_OVERSCAN = 12 // Aumentado para mejor experiencia de scroll
    // Altura mínima para asegurar scroll si hay pocos productos pero llenan pantalla
    const listTotalHeight = Math.max(products.length * PRODUCT_ROW_HEIGHT, listViewportHeight + 1)

    const startIndex = Math.max(
        0,
        Math.floor(listScrollTop / PRODUCT_ROW_HEIGHT) - PRODUCT_OVERSCAN
    )
    const endIndex = Math.min(
        products.length,
        Math.ceil((listScrollTop + listViewportHeight) / PRODUCT_ROW_HEIGHT) + PRODUCT_OVERSCAN
    )

    const visibleProducts = useMemo(
        () => products.slice(startIndex, endIndex).map((product, index) => ({
            product,
            originalIndex: startIndex + index
        })),
        [products, startIndex, endIndex]
    )

    // Helper de iconos (extraído de POSPage para mantener consistencia)
    const getCategoryIcon = (category?: string | null) => {
        if (!category) return Package
        const normalized = category.toLowerCase()

        if (normalized.includes('bebida') || normalized.includes('drink') || normalized.includes('refresco')) return Coffee
        if (normalized.includes('fruta') || normalized.includes('verdura') || normalized.includes('vegetal')) return Apple
        if (normalized.includes('carne') || normalized.includes('pollo') || normalized.includes('proteina')) return Beef
        if (normalized.includes('ropa') || normalized.includes('vestir') || normalized.includes('moda')) return Shirt
        if (normalized.includes('hogar') || normalized.includes('casa')) return Home
        if (normalized.includes('electron') || normalized.includes('tecno') || normalized.includes('gadget')) return Cpu
        if (normalized.includes('farmacia') || normalized.includes('salud') || normalized.includes('medic')) return Pill
        if (normalized.includes('accesorio') || normalized.includes('general')) return ShoppingBag

        return Package
    }

    if (isLoading && products.length === 0) {
        return (
            <div className="grid grid-cols-1 gap-2 p-1">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-[60%]" />
                            <Skeleton className="h-3 w-[40%]" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (isError || (products.length === 0 && searchQuery.length >= 2)) {
        return (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground bg-muted/10 rounded-xl border border-border/50 p-6 text-center">
                {isError ? (
                    <>
                        <WifiOff className="w-12 h-12 mb-3 opacity-50" />
                        <p className="font-medium">Error al cargar productos</p>
                        <p className="text-sm mt-1">Verifica tu conexión e intenta de nuevo</p>
                    </>
                ) : (
                    <>
                        <Search className="w-12 h-12 mb-3 opacity-50" />
                        <p className="font-medium">No se encontraron productos</p>
                        <p className="text-sm mt-1">Intenta con otro término de búsqueda</p>
                    </>
                )}
            </div>
        )
    }

    if (products.length === 0 && searchQuery.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center bg-muted/5 rounded-xl border border-dashed border-border/60">
                <Search className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">Empieza a escribir para buscar</p>
                <p className="text-xs mt-1 max-w-[200px]">
                    Busca por nombre, código de barras o categoría
                </p>
            </div>
        )
    }

    return (
        <div className="h-full w-full relative bg-background/50 rounded-xl border border-border/50 overflow-hidden shadow-inner">
            <ScrollArea
                className="h-full"
                viewportRef={listViewportRef}
                viewportProps={{
                    onScroll: (e) => {
                        const target = e.currentTarget as HTMLDivElement
                        setListScrollTop(target.scrollTop)
                    }
                }}
            >
                <div
                    style={{ height: listTotalHeight }}
                    className="relative w-full"
                >
                    {visibleProducts.map(({ product, originalIndex }) => {
                        const CategoryIcon = getCategoryIcon(product.category)
                        const isLowStock = lowStockIds.has(product.id)

                        return (
                            <div
                                key={product.id}
                                className="absolute left-0 right-0 px-2"
                                style={{
                                    top: originalIndex * PRODUCT_ROW_HEIGHT,
                                    height: PRODUCT_ROW_HEIGHT
                                }}
                            >
                                <button
                                    onClick={() => onProductClick(product)}
                                    className="w-full h-[104px] text-left group relative bg-gradient-to-br from-card/90 to-card/50 hover:from-card hover:to-card/80 backdrop-blur-md transition-all duration-300 rounded-2xl border border-white/10 hover:border-primary/20 shadow-sm hover:shadow-lg hover:-translate-y-0.5 overflow-hidden p-3 sm:p-4 flex items-center gap-3 sm:gap-4 active:scale-[0.98] ring-1 ring-transparent hover:ring-primary/10"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover:bg-primary transition-all duration-300" />

                                    {/* Icono / Imagen */}
                                    <div className={cn(
                                        "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-inner",
                                        isLowStock
                                            ? "bg-warning/10 text-warning ring-1 ring-warning/20"
                                            : "bg-gradient-to-br from-primary/10 to-primary/5 text-primary group-hover:from-primary/20 group-hover:to-primary/10 ring-1 ring-primary/10"
                                    )}>
                                        {product.is_weight_product ? (
                                            <Scale className={cn("w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110", isLowStock && "animate-pulse")} />
                                        ) : (
                                            <CategoryIcon className={cn("w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110", isLowStock && "animate-pulse")} />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center h-full py-0.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-sm sm:text-base text-foreground/90 leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200">
                                                {product.name}
                                            </h3>
                                            {isLowStock && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-warning/10 text-warning border-warning/30 flex-shrink-0">
                                                    Bajo Stock
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mt-auto">
                                            {product.category && (
                                                <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[100px] hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted/30 border border-white/5">
                                                    {product.category}
                                                </span>
                                            )}
                                            {product.barcode && (
                                                <span className="text-[10px] text-muted-foreground/50 font-mono hidden sm:inline-block truncate tracking-wider">
                                                    {product.barcode}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Precio */}
                                    <div className="text-right flex-shrink-0 flex flex-col justify-center h-full pl-2">
                                        <div className="flex flex-col items-end">
                                            {product.is_weight_product ? (
                                                <span className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/50 border border-white/5">
                                                    /{product.weight_unit || 'kg'}
                                                </span>
                                            ) : null}
                                            <span className="font-extrabold text-lg sm:text-xl text-primary tabular-nums tracking-tighter drop-shadow-sm">
                                                ${Number(product.is_weight_product ? product.price_per_weight_usd : product.price_usd || 0).toFixed(2)}
                                            </span>
                                            <span className="text-[11px] sm:text-xs text-muted-foreground/80 font-medium tabular-nums mt-0.5">
                                                Bs {Number(product.is_weight_product ? product.price_per_weight_bs : product.price_bs || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
