import { GripVertical, Minus, Plus, Scale, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCategoryIcon } from '@/components/pos/utils'
import { CartItem } from '@/stores/cart.store'

interface CartItemRowProps {
    item: CartItem
    isMobile: boolean
    isInvalid: boolean
    onUpdateQty: (id: string, qty: number) => void
    onRemoveItem: (id: string) => void
    exchangeRate: number
}

export function CartItemRow({
    item,
    isMobile,
    isInvalid,
    onUpdateQty,
    onRemoveItem,
    exchangeRate
}: CartItemRowProps) {
    const lineTotalUsd = item.is_weight_product
        ? (item.qty * (item.price_per_weight_usd || 0)) - (item.discount_usd || 0)
        : (item.qty * item.unit_price_usd) - (item.discount_usd || 0)

    // Calcular Bs dinámicamente con la tasa actual
    const lineTotalBs = lineTotalUsd * exchangeRate

    const Icon = getCategoryIcon(item.category)

    return (
        <div
            className={cn(
                "group p-3 mb-2 rounded-xl bg-slate-50 border border-border/40 shadow-sm hover:shadow-md hover:bg-slate-100/80 relative transition-all duration-200",
                isMobile && "pr-12",
                isInvalid && "bg-destructive/5 border-destructive/20"
            )}>
            {isMobile && (
                <div
                    data-swipe-handle
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-5 rounded-md border border-border/50 bg-background/90 flex items-center justify-center text-muted-foreground/70 shadow-sm"
                    aria-label="Deslizar para eliminar"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            )}
            <div className="flex gap-3">
                {/* 1. Icono Grande */}
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors mt-1",
                    isInvalid ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary/70 group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                    {item.is_weight_product ? (
                        <Scale className="w-6 h-6" />
                    ) : (
                        <Icon className="w-6 h-6" />
                    )}
                </div>

                {/* Contenido Principal */}
                <div className="flex-1 min-w-0">
                    {/* Fila Superior: Nombre y Precio Unitario */}
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <span className={cn(
                                "font-semibold text-sm text-foreground block leading-snug",
                                isInvalid && "text-destructive"
                            )}>
                                {item.product_name}
                            </span>
                            {/* Variante o Peso detalle */}
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2 items-center">
                                {item.variant_name && (
                                    <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium border border-border/50">
                                        {item.variant_name}
                                    </span>
                                )}
                                <span className="tabular-nums">
                                    ${Number(item.price_per_weight_usd ?? item.unit_price_usd).toFixed(2)}
                                    <span className="opacity-70 dark:opacity-50 text-[10px] ml-0.5">
                                        {item.is_weight_product ? `/${item.weight_unit || 'kg'}` : ' c/u'}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Botón Eliminar Desktop (visible on hover) */}
                        {!isMobile && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onRemoveItem(item.id)
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-[opacity,background-color,color] hover:bg-destructive hover:text-white"
                                title="Eliminar producto"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Fila Inferior: Controles y Subtotal */}
                    <div className="flex justify-between items-end mt-2">
                        {/* Controles de Cantidad */}
                        {!item.is_weight_product ? (
                            <div className="flex items-center h-8 bg-background border border-border/60 rounded-md shadow-sm">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onUpdateQty(item.id, item.qty - 1)
                                    }}
                                    className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors disabled:opacity-50 rounded-l-md"
                                    disabled={item.qty <= 1}
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <div className="w-8 text-center font-bold text-sm tabular-nums border-x border-border/30 h-4 flex items-center justify-center px-1">
                                    {item.qty}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onUpdateQty(item.id, item.qty + 1)
                                    }}
                                    className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors rounded-r-md"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="px-3 py-1.5 rounded-md bg-muted/50 border border-border/40 text-xs font-semibold tabular-nums border-dashed">
                                {item.qty} {item.weight_unit || 'kg'}
                            </div>
                        )}

                        {/* Subtotal */}
                        <div className="text-right">
                            <div className="font-bold text-base text-primary tabular-nums tracking-tight leading-none">
                                ${lineTotalUsd.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-muted-foreground/70 font-medium tabular-nums mt-0.5">
                                Bs {lineTotalBs.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
