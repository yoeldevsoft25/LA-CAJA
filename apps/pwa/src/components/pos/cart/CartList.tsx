import { CartItem } from '@/stores/cart.store'
import { SwipeableItem } from '@/components/ui/swipeable-item'
import { Trash2, ShoppingCart } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CartItemRow } from './CartItemRow'
import { cn } from '@/lib/utils'

interface CartListProps {
    items: CartItem[]
    isMobile: boolean
    invalidCartProductIds: string[]
    onUpdateQty: (id: string, qty: number) => void
    onRemoveItem: (id: string) => void
}

export function CartList({
    items,
    isMobile,
    invalidCartProductIds,
    onUpdateQty,
    onRemoveItem
}: CartListProps) {

    return (
        <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
                <div className={cn("flex flex-col", items.length === 0 && "h-full justify-center")}>
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-muted to-muted/30 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 opacity-40 group-hover:scale-110 transition-transform duration-300 group-hover:opacity-60 text-primary/50" />
                            </div>
                            <p className="font-bold text-xl text-foreground/80 mb-2">Tu carrito está vacío</p>
                            <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
                                Escanea un producto o selecciónalo del catálogo para comenzar la venta
                            </p>
                        </div>
                    ) : (
                        items.map((item) => {
                            const isInvalid = invalidCartProductIds.includes(item.id)
                            return (
                                <SwipeableItem
                                    key={item.id}
                                    onSwipeLeft={isMobile ? () => onRemoveItem(item.id) : undefined}
                                    leftAction={isMobile ? (
                                        <div className="flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-sm font-medium">Eliminar</span>
                                        </div>
                                    ) : undefined}
                                    enabled={isMobile}
                                    threshold={80}
                                    className="mb-0"
                                >
                                    <CartItemRow
                                        item={item}
                                        isMobile={isMobile}
                                        isInvalid={isInvalid}
                                        onUpdateQty={onUpdateQty}
                                        onRemoveItem={onRemoveItem}
                                    />
                                </SwipeableItem>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
