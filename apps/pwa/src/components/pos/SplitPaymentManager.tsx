/**
 * Gestor de Pagos Divididos
 * Componente para agregar, editar y eliminar múltiples métodos de pago
 */

import { useState } from 'react'
import { Plus, Trash2, CreditCard, Wallet, Banknote, DollarSign, AlertCircle } from 'lucide-react'
import { PaymentMethod, SplitPaymentItem } from '@/types/split-payment.types'
import { VENEZUELAN_BANKS } from '@/constants/venezuelan-banks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface SplitPaymentManagerProps {
  payments: SplitPaymentItem[]
  remainingUsd: number
  remainingBs: number
  exchangeRate: number
  isComplete: boolean
  onAddPayment: (payment: Omit<SplitPaymentItem, 'id'>) => void
  onRemovePayment: (paymentId: string) => void
  onUpdatePayment: (paymentId: string, updates: Partial<Omit<SplitPaymentItem, 'id'>>) => void
}

interface NewPaymentForm {
  method: PaymentMethod
  currency: 'USD' | 'BS'
  amount: string
  reference: string
  bank: string
  phone: string
}

export default function SplitPaymentManager({
  payments,
  remainingUsd,
  remainingBs,
  exchangeRate,
  isComplete,
  onAddPayment,
  onRemovePayment,
}: SplitPaymentManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPayment, setNewPayment] = useState<NewPaymentForm>({
    method: 'PAGO_MOVIL',
    currency: 'BS',
    amount: '',
    reference: '',
    bank: '',
    phone: '',
  })

  const paymentMethods: Array<{ id: PaymentMethod; label: string; icon: typeof Wallet; requiresDetails: boolean }> = [
    { id: 'CASH_USD', label: 'Efectivo USD', icon: DollarSign, requiresDetails: false },
    { id: 'CASH_BS', label: 'Efectivo Bs', icon: Banknote, requiresDetails: false },
    { id: 'PAGO_MOVIL', label: 'Pago Móvil', icon: Wallet, requiresDetails: true },
    { id: 'TRANSFER', label: 'Transferencia', icon: CreditCard, requiresDetails: true },
    { id: 'POINT_OF_SALE', label: 'Punto de Venta', icon: CreditCard, requiresDetails: false },
    { id: 'ZELLE', label: 'Zelle', icon: DollarSign, requiresDetails: true },
  ]

  const requiresBank = ['PAGO_MOVIL', 'TRANSFER'].includes(newPayment.method)
  const requiresReference = ['PAGO_MOVIL', 'TRANSFER', 'ZELLE'].includes(newPayment.method)

  const handleAddPayment = () => {
    const amount = parseFloat(newPayment.amount) || 0
    if (amount <= 0) return

    let amountUsd = 0
    let amountBs = 0

    if (newPayment.currency === 'USD') {
      amountUsd = amount
      amountBs = amount * exchangeRate
    } else {
      amountBs = amount
      amountUsd = amount / exchangeRate
    }

    onAddPayment({
      method: newPayment.method,
      amount_usd: Math.round(amountUsd * 100) / 100,
      amount_bs: Math.round(amountBs * 100) / 100,
      reference: newPayment.reference || undefined,
      bank: newPayment.bank || undefined,
      phone: newPayment.phone || undefined,
      confirmed: true,
    })

    // Reset form
    setNewPayment({
      method: 'PAGO_MOVIL',
      currency: 'BS',
      amount: '',
      reference: '',
      bank: '',
      phone: '',
    })
    setShowAddForm(false)
  }

  const getPaymentMethodLabel = (method: PaymentMethod): string => {
    return paymentMethods.find((m) => m.id === method)?.label || method
  }

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    const Icon = paymentMethods.find((m) => m.id === method)?.icon || Wallet
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="space-y-4">
      {/* Header con progreso */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pagos Divididos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Combina múltiples métodos de pago
          </p>
        </div>
        {!showAddForm && !isComplete && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Agregar Pago
          </Button>
        )}
      </div>

      {/* Lista de pagos agregados */}
      {payments.length > 0 && (
        <div className="space-y-2">
          {payments.map((payment) => (
            <Card key={payment.id} className="border border-border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="text-primary mt-0.5">{getPaymentMethodIcon(payment.method)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {getPaymentMethodLabel(payment.method)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-foreground">
                          ${payment.amount_usd.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">≈</span>
                        <span className="text-xs text-muted-foreground">
                          Bs. {payment.amount_bs.toFixed(2)}
                        </span>
                      </div>
                      {payment.reference && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ref: {payment.reference}
                        </p>
                      )}
                      {payment.bank && (
                        <p className="text-xs text-muted-foreground">
                          {VENEZUELAN_BANKS.find((b) => b.code === payment.bank)?.name || payment.bank}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemovePayment(payment.id)}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario para agregar nuevo pago */}
      {showAddForm && (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">Nuevo Pago</h4>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </Button>
            </div>

            {/* Método de pago */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Método de Pago
              </label>
              <Select
                value={newPayment.method}
                onValueChange={(value) =>
                  setNewPayment({ ...newPayment, method: value as PaymentMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Monto
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  placeholder="0.00"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Moneda
                </label>
                <Select
                  value={newPayment.currency}
                  onValueChange={(value) =>
                    setNewPayment({ ...newPayment, currency: value as 'USD' | 'BS' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="BS">Bs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Banco (si aplica) */}
            {requiresBank && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Banco
                </label>
                <Select
                  value={newPayment.bank}
                  onValueChange={(value) => setNewPayment({ ...newPayment, bank: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {VENEZUELAN_BANKS.filter((b) =>
                      newPayment.method === 'PAGO_MOVIL'
                        ? b.supportsPayoMovil
                        : b.supportsTransfer
                    ).map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Referencia (si aplica) */}
            {requiresReference && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Referencia
                </label>
                <Input
                  type="text"
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                  placeholder="Número de referencia"
                  className="text-sm"
                />
              </div>
            )}

            {/* Teléfono (para pago móvil) */}
            {newPayment.method === 'PAGO_MOVIL' && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Teléfono <span className="text-muted-foreground">(Opcional)</span>
                </label>
                <Input
                  type="tel"
                  value={newPayment.phone}
                  onChange={(e) => setNewPayment({ ...newPayment, phone: e.target.value })}
                  placeholder="0412-1234567"
                  className="text-sm"
                />
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddPayment}
              disabled={!newPayment.amount || parseFloat(newPayment.amount) <= 0}
              className="w-full"
            >
              Agregar Pago
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resumen de restante */}
      {!isComplete && (
        <Card className={cn(
          'border',
          remainingUsd > 0 ? 'border-warning/50 bg-warning/5' : 'border-success/50 bg-success/5'
        )}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className={cn(
                'w-4 h-4',
                remainingUsd > 0 ? 'text-warning' : 'text-success'
              )} />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">
                  {remainingUsd > 0 ? 'Monto Restante por Pagar' : '¡Pago Completo!'}
                </p>
                {remainingUsd > 0 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-foreground">
                      ${remainingUsd.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">≈</span>
                    <span className="text-xs text-muted-foreground">
                      Bs. {remainingBs.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botón rápido para completar con pago móvil */}
      {!isComplete && remainingBs >= 5 && !showAddForm && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewPayment({
              ...newPayment,
              method: 'PAGO_MOVIL',
              currency: 'BS',
              amount: remainingBs.toFixed(2),
            })
            setShowAddForm(true)
          }}
          className="w-full gap-2"
        >
          <Wallet className="w-4 h-4" />
          Completar con Pago Móvil (Bs. {remainingBs.toFixed(2)})
        </Button>
      )}
    </div>
  )
}
