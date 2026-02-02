import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

import { ShoppingBag, Package } from 'lucide-react'

interface DebtItemsModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    items: any[]
}

export default function DebtItemsModal({
    isOpen,
    onClose,
    title,
    items,
}: DebtItemsModalProps) {
    // Calcular total basado en los items (si tienen precio)
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.unit_price_usd) * Number(item.qty)), 0)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-primary" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {items.length} artículo{items.length !== 1 ? 's' : ''} en total
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                            <Package className="w-12 h-12 mb-2 opacity-20" />
                            <p>No hay artículos registrados para esta deuda.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={index} className="flex justify-between items-start pb-4 border-b last:border-0 last:pb-0">
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">
                                            {item.product?.name || item.product_name || 'Producto desconocido'}
                                        </p>
                                        {item.variant && (
                                            <p className="text-xs text-muted-foreground">
                                                {item.variant.name || item.variant_name}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] h-5 px-1 bg-slate-50">
                                                x{item.qty}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                a ${Number(item.unit_price_usd).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="font-semibold text-sm">
                                        ${(Number(item.unit_price_usd) * Number(item.qty)).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {totalAmount > 0 && (
                    <div className="p-4 bg-muted/30 border-t flex justify-between items-center">
                        <span className="font-semibold text-sm">Total Artículos:</span>
                        <Badge variant="default" className="text-base px-3 py-1">
                            ${totalAmount.toFixed(2)}
                        </Badge>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
