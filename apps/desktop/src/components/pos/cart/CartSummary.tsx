import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Tag } from 'lucide-react'

interface CartSummaryProps {
    totalUsd: number
    totalBs: number
    totalDiscountUsd: number
    hasOpenCash: boolean
    invalidCartProductIds: string[]
    itemsCount: number
    shouldPrint: boolean
    setShouldPrint: (val: boolean) => void
    onCheckout: () => void
}

export function CartSummary({
    totalUsd,
    totalBs,
    totalDiscountUsd,
    hasOpenCash,
    invalidCartProductIds,
    itemsCount,
    shouldPrint,
    setShouldPrint,
    onCheckout
}: CartSummaryProps) {
    // Nota: totalUsd ya viene con el descuento restado si se usa la lógica anterior, 
    // pero el componente original hacia: (total.usd + totalDiscountUsd) para mostrar subtotal.
    // Asumiremos que totalUsd es el TOTAL A PAGAR.

    const subtotalUsd = totalUsd + totalDiscountUsd

    return (
        <div className="flex-none p-4 sm:p-5 border-t border-border/40 bg-gradient-to-t from-background via-background/95 to-background/50 backdrop-blur-sm space-y-4">
            {!hasOpenCash && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 font-medium flex items-center justify-center shadow-sm">
                    ⚠️ Debes abrir caja para procesar ventas
                </div>
            )}
            {invalidCartProductIds.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium flex items-center justify-center shadow-sm">
                    Hay productos inválidos en el carrito
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-4 py-2.5 shadow-sm">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-semibold text-foreground/80">Imprimir ticket</Label>
                        <p className="text-[10px] text-muted-foreground">
                            Ahorra papel si no es necesario
                        </p>
                    </div>
                    <Switch checked={shouldPrint} onCheckedChange={setShouldPrint} className="scale-90" />
                </div>

                {/* Tarjeta de Totales Flotante Premium */}
                <div className="rounded-2xl bg-gradient-to-br from-card to-card/95 border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-70" />

                    <div className="p-5 space-y-4 relative">
                        {/* Subtotal y Descuentos */}
                        {totalDiscountUsd > 0 && (
                            <div className="space-y-2 pb-3 border-b border-dashed border-border/60">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground font-medium">Subtotal</span>
                                    <span className="text-foreground tabular-nums opacity-70">${subtotalUsd.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-primary">
                                    <div className="flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5" />
                                        <span className="font-semibold">Descuento</span>
                                    </div>
                                    <span className="font-bold tabular-nums">-${totalDiscountUsd.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* Total Principal */}
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <span className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider block">Total a Pagar</span>
                                <div className="text-sm font-medium text-muted-foreground tabular-nums flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-md w-fit">
                                    <span>Bs</span>
                                    <span>{totalBs.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-4xl font-extrabold text-foreground tracking-tighter tabular-nums leading-none">
                                    <span className="text-xl align-top text-primary mr-0.5 fixed-dollar-sign">$</span>
                                    {totalUsd.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Button
                onClick={onCheckout}
                disabled={itemsCount === 0 || !hasOpenCash || invalidCartProductIds.length > 0}
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all rounded-xl relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:animate-shine" />
                <ShoppingCart className="w-5 h-5 mr-2.5" />
                Procesar Venta
            </Button>
        </div>
    )
}
