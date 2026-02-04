import { cn } from '@/lib/utils'

interface CartSummary {
    id: string
    count: number
    totalUsd: number
}

interface CartTabsProps {
    cartSummaries: CartSummary[]
    activeCartId: string
    onSwitchCart: (id: string) => void
}

export function CartTabs({ cartSummaries, activeCartId, onSwitchCart }: CartTabsProps) {
    return (
        <div className="px-3 pt-3 pb-2 border-b border-border/40 bg-gradient-to-r from-muted/20 via-background to-muted/20 flex-shrink-0">
            <div className="flex gap-2">
                {cartSummaries.map((s, i) => {
                    const isActive = s.id === activeCartId
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => onSwitchCart(s.id)}
                            className={cn(
                                'flex-1 min-w-0 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
                                isActive
                                    ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:shadow-md'
                            )}
                            title={`Venta ${i + 1}${s.count > 0 ? ` · ${s.count} ítems · $${s.totalUsd.toFixed(2)}` : ''}`}
                        >
                            <span className="truncate block">{i + 1}</span>
                            {s.count > 0 && (
                                <span className="tabular-nums">({s.count})</span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
