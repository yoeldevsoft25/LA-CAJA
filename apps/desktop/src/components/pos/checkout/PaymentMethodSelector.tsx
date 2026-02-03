import { memo } from 'react'
import { CreditCard, Wallet, Banknote, Split, Fingerprint, Smartphone } from 'lucide-react'
import { Button } from '@la-caja/ui-core'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@la-caja/ui-core'
import { SinglePaymentMethod } from '@/types/checkout.types'

interface PaymentMethodSelectorProps {
    value: SinglePaymentMethod
    onChange: (method: SinglePaymentMethod) => void
    disabled?: boolean
    className?: string
}

const paymentMethods: Array<{
    value: SinglePaymentMethod
    label: string
    hint: string
    icon: React.ReactNode
}> = [
        { value: 'CASH_USD', label: 'Efectivo USD', hint: 'Cobro en dolares', icon: <Wallet className="h-4 w-4" /> },
        { value: 'CASH_BS', label: 'Efectivo Bs', hint: 'Cobro en bolivares', icon: <Banknote className="h-4 w-4" /> },
        { value: 'PAGO_MOVIL', label: 'Pago Movil', hint: 'Transferencia instantanea', icon: <Smartphone className="h-4 w-4" /> },
        { value: 'TRANSFER', label: 'Tarjeta', hint: 'Tarjeta o transferencia', icon: <CreditCard className="h-4 w-4" /> },
        { value: 'OTHER', label: 'BioPago', hint: 'Metodo alternativo', icon: <Fingerprint className="h-4 w-4" /> },
        { value: 'FIAO', label: 'FIAO', hint: 'Venta a credito', icon: <Split className="h-4 w-4" /> },
    ]

const PaymentMethodSelector = memo(function PaymentMethodSelector({
    value,
    onChange,
    disabled = false,
    className,
}: PaymentMethodSelectorProps) {
    return (
        <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
            <CardContent className="p-4 space-y-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">Metodo de pago</h3>
                    <p className="text-xs text-slate-500">Selecciona como va a pagar el cliente</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Metodo de pago">
                    {paymentMethods.map((method) => {
                        const isActive = value === method.value
                        return (
                            <Button
                                key={method.value}
                                type="button"
                                variant="outline"
                                role="radio"
                                aria-checked={isActive}
                                className={cn(
                                    'h-auto min-h-14 justify-start gap-3 rounded-xl border px-3 py-2 text-left transition-all',
                                    'hover:bg-slate-50 hover:border-slate-300',
                                    isActive && 'border-primary bg-primary/5 text-primary shadow-sm hover:bg-primary/10',
                                )}
                                onClick={() => onChange(method.value)}
                                disabled={disabled}
                            >
                                <span className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-lg border',
                                    isActive ? 'border-primary/40 bg-primary/10' : 'border-slate-200 bg-slate-50 text-slate-600',
                                )}>
                                    {method.icon}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">{method.label}</span>
                                    <span className="block truncate text-[11px] text-slate-500">{method.hint}</span>
                                </span>
                            </Button>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
})

export default PaymentMethodSelector
