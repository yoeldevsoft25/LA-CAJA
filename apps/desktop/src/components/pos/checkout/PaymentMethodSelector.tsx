import { memo } from 'react'
import { CreditCard, Wallet, Banknote, Split, Fingerprint, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
    icon: React.ReactNode
}> = [
        { value: 'CASH_USD', label: 'Efectivo USD', icon: <Wallet className="h-4 w-4" /> },
        { value: 'CASH_BS', label: 'Efectivo Bs', icon: <Banknote className="h-4 w-4" /> },
        { value: 'PAGO_MOVIL', label: 'Pago Móvil', icon: <Smartphone className="h-4 w-4" /> },
        { value: 'TRANSFER', label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> },
        { value: 'OTHER', label: 'BioPago', icon: <Fingerprint className="h-4 w-4" /> },
        { value: 'FIAO', label: 'FIAO', icon: <Split className="h-4 w-4" /> },
    ]

const PaymentMethodSelector = memo(function PaymentMethodSelector({
    value,
    onChange,
    disabled = false,
    className,
}: PaymentMethodSelectorProps) {
    return (
        <Card className={className}>
            <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3">Método de Pago</h3>
                <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => (
                        <Button
                            key={method.value}
                            variant={value === method.value ? 'default' : 'outline'}
                            className={cn(
                                'justify-start gap-2',
                                value === method.value && 'bg-primary text-primary-foreground'
                            )}
                            onClick={() => onChange(method.value)}
                            disabled={disabled}
                        >
                            {method.icon}
                            {method.label}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
})

export default PaymentMethodSelector
