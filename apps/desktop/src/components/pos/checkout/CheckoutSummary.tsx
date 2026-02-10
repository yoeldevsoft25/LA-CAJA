import { memo, useMemo } from 'react'
import { Receipt, TrendingUp, BadgeDollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, convertUsdToBs } from '@/utils/checkout-utils'
import { cn } from '@/lib/utils'

interface CheckoutSummaryProps {
    subtotal: number
    discount: number
    total: number
    currency: 'USD' | 'BS'
    exchangeRate: number
    className?: string
}

const CheckoutSummary = memo(function CheckoutSummary({
    subtotal,
    discount,
    total,
    currency,
    exchangeRate,
    className,
}: CheckoutSummaryProps) {
    const { totalBs, totalUsd } = useMemo(() => ({
        totalBs: currency === 'USD' ? convertUsdToBs(total, exchangeRate) : total,
        totalUsd: currency === 'BS' ? total / exchangeRate : total,
    }), [total, currency, exchangeRate])

    return (
        <Card className={cn('border-border bg-card shadow-sm', className)}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Resumen de pago</p>
                    <Receipt className="h-4 w-4 text-muted-foreground/60" />
                </div>

                <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold text-foreground">{formatCurrency(subtotal, currency)}</span>
                    </div>

                    {discount > 0 && (
                        <div className="flex items-center justify-between text-sm text-success">
                            <span className="inline-flex items-center gap-1">
                                <TrendingUp className="h-3.5 w-3.5" />
                                Descuento aplicado
                            </span>
                            <span className="font-semibold">-{formatCurrency(discount, currency)}</span>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">Total a cobrar</p>
                            <p className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                                {formatCurrency(total, currency)}
                            </p>
                        </div>
                        <BadgeDollarSign className="h-5 w-5 text-primary" />
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground/80 italic">
                        {currency === 'USD'
                            ? `Equivale a ${formatCurrency(totalBs, 'BS')} a tasa ${exchangeRate.toFixed(2)}`
                            : `Equivale a ${formatCurrency(totalUsd, 'USD')} a tasa ${exchangeRate.toFixed(2)}`}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
})

export default CheckoutSummary
