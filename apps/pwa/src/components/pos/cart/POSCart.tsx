import { memo, useCallback, useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CartItem } from '@/stores/cart.store'
import { CartTabs } from './CartTabs'
import { CartList } from './CartList'
import { CartSummary } from './CartSummary'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
interface POSCartProps {
    items: CartItem[]
    cartSummaries: Array<{ id: string; count: number; totalUsd: number }>
    activeCartId: string
    total: { bs: number; usd: number }
    totalDiscountUsd: number
    hasOpenCash: boolean
    isMobile: boolean
    isTabletLandscape: boolean
    invalidCartProductIds: string[]
    shouldPrint: boolean
    setShouldPrint: (val: boolean) => void
    onSwitchCart: (id: string) => void
    onCheckout: () => void
    onUpdateQty: (id: string, qty: number) => void
    onRemoveItem: (id: string) => void
    onClearCart: () => void
    exchangeRate: number
}

const POSCart = memo(function POSCart({
    items,
    cartSummaries,
    activeCartId,
    total,
    totalDiscountUsd,
    hasOpenCash,
    isMobile,
    isTabletLandscape,
    invalidCartProductIds,
    shouldPrint,
    setShouldPrint,
    onSwitchCart,
    onCheckout,
    onUpdateQty,
    onRemoveItem,
    onClearCart,
    exchangeRate,
}: POSCartProps) {
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)

    // Determinar total de ítems
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0)

    const handleClearConfirm = useCallback(() => {
        onClearCart()
        setIsClearDialogOpen(false)
    }, [onClearCart])

    return (
        <div className={cn("h-full min-h-0 flex flex-col", !isTabletLandscape && "lg:col-span-1")}>
            <Card className={cn(
                "bg-white dark:bg-slate-900 rounded-2xl border border-border/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden h-full min-h-0",
                "grid grid-rows-[auto_auto_minmax(0,1fr)_auto]"
            )}>
                {/* Tabs de Carrito */}
                <CartTabs
                    cartSummaries={cartSummaries}
                    activeCartId={activeCartId}
                    onSwitchCart={onSwitchCart}
                />

                {/* Header del Carrito (Título + Limpiar) */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <ShoppingCartIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold text-base leading-none">Carrito</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                {totalQty} {totalQty === 1 ? 'producto' : 'productos'} agregados
                            </p>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsClearDialogOpen(true)}
                                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                <span className="text-xs font-semibold">Limpiar</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Lista de Items */}
                <CartList
                    items={items}
                    isMobile={isMobile}
                    invalidCartProductIds={invalidCartProductIds}
                    onUpdateQty={onUpdateQty}
                    onRemoveItem={onRemoveItem}
                    exchangeRate={exchangeRate}
                />

                {/* Resumen y Checkout */}
                <CartSummary
                    totalUsd={total.usd}
                    totalBs={total.bs}
                    totalDiscountUsd={totalDiscountUsd}
                    hasOpenCash={hasOpenCash}
                    invalidCartProductIds={invalidCartProductIds}
                    itemsCount={items.length}
                    shouldPrint={shouldPrint}
                    setShouldPrint={setShouldPrint}
                    onCheckout={onCheckout}
                />
            </Card>

            {/* Modal de Confirmación de Limpiar */}
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Limpiar carrito?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará todos los productos del carrito actual.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Limpiar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
})

export default POSCart;

function ShoppingCartIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
    )
}
