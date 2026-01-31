import { CartItem } from '@/stores/cart.store'
import { SwipeableItem } from '@/components/ui/swipeable-item'
import { Trash2, ShoppingCart } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CartItemRow } from './CartItemRow'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface CartListProps {
    items: CartItem[]
    isMobile: boolean
    invalidCartProductIds: string[]
    onUpdateQty: (id: string, qty: number) => void
    onRemoveItem: (id: string) => void
    exchangeRate: number
}

export function CartList({
    items,
    isMobile,
    invalidCartProductIds,
    onUpdateQty,
    onRemoveItem,
    exchangeRate
}: CartListProps) {
    const allowSwipe = isMobile

    const content = (
        <div className={cn("flex flex-col", items.length === 0 && "h-full justify-center")}>
            {items.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center p-4 text-center h-full min-h-[300px]"
                >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-muted to-muted/30 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 opacity-40 group-hover:scale-110 transition-transform duration-300 group-hover:opacity-60 text-primary/50" />
                    </div>
                    <p className="font-bold text-xl text-foreground/80 mb-2">Tu carrito está vacío</p>
                    <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
                        Escanea un producto o selecciónalo del catálogo para comenzar la venta
                    </p>
                </motion.div>
            ) : (
                <AnimatePresence initial={false}>
                    {items.map((item) => {
                        const isInvalid = invalidCartProductIds.includes(item.id)
                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <SwipeableItem
                                    onSwipeLeft={allowSwipe ? () => onRemoveItem(item.id) : undefined}
                                    leftAction={allowSwipe ? (
                                        <div className="flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-sm font-medium">Eliminar</span>
                                        </div>
                                    ) : undefined}
                                    enabled={allowSwipe}
                                    requireHandle={isMobile}
                                    threshold={80}
                                    className="mb-0 border-b border-border/40"
                                >
                                    <CartItemRow
                                        item={item}
                                        isMobile={isMobile}
                                        isInvalid={isInvalid}
                                        onUpdateQty={onUpdateQty}
                                        onRemoveItem={onRemoveItem}
                                        exchangeRate={exchangeRate}
                                    />
                                </SwipeableItem>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            )}
        </div>
    )

    return (
        <div className="flex-1 min-h-0 relative overflow-hidden">
            {isMobile ? (
                <div className="h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {content}
                </div>
            ) : (
                <ScrollArea className="h-full min-h-0">
                    {content}
                </ScrollArea>
            )}
        </div>
    )
}
