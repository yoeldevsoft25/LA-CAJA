import { memo, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, convertUsdToBs } from '@/utils/checkout-utils'

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
        totalUsd: currency === 'BS' ? total / exchangeRate : total
    }), [total, currency, exchangeRate])

    return (
        <Card className={className}>
            <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
                </div>

                {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                        <span>Descuento:</span>
                        <span className="font-medium">-{formatCurrency(discount, currency)}</span>
                    </div>
                )}

                <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total:</span>
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                {formatCurrency(total, currency)}
                            </div>
                            {currency === 'USD' && (
                                <div className="text-xs text-muted-foreground">
                                    ≈ {formatCurrency(totalBs, 'BS')}
                                </div>
                            )}
                            {currency === 'BS' && (
                                <div className="text-xs text-muted-foreground">
                                    ≈ {formatCurrency(totalUsd, 'USD')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
})

export default CheckoutSummary
