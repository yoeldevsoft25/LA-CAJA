import { Clock, Star } from 'lucide-react'
import { motion } from 'framer-motion'

interface QuickProduct {
    product_id: string
    name: string
    sold_at?: string
    is_weight_product?: boolean
    weight_unit?: string | null
}

interface QuickActionsProps {
    recentProducts: QuickProduct[]
    suggestedProducts: any[]
    onProductClick: (product: any) => void
    onRecentClick: (product: any) => void
}

export function QuickActions({
    recentProducts,
    suggestedProducts,
    onProductClick,
    onRecentClick
}: QuickActionsProps) {
    if (recentProducts.length === 0 && suggestedProducts.length === 0) return null

    return (
        <div className="flex flex-col gap-4 mb-4">
            {/* Sugerencias de búsqueda */}
            {suggestedProducts.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" />
                        Sugerencias
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {suggestedProducts.map((product) => (
                            <motion.button
                                key={product.id}
                                onClick={() => onProductClick(product)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary-foreground hover:text-primary px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-primary/20"
                            >
                                {product.name}
                                {product.is_weight_product && (
                                    <span className="text-[10px] bg-background/50 px-1 rounded">
                                        {product.weight_unit || 'kg'}
                                    </span>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            {/* Recientes */}
            {recentProducts.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Recientes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {recentProducts.map((item) => (
                            <motion.button
                                key={`recent-${item.product_id}`}
                                onClick={() => onRecentClick(item)} // Nota: en POSPage esto requerirá fetch si no tenemos el objeto completo
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-full text-sm transition-colors border border-border/50"
                            >
                                {item.name}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
