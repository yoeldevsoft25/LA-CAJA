import { useState } from 'react'
import { Plus, Trash2, CreditCard, Wallet, Banknote, DollarSign, AlertCircle, CircleCheckBig } from 'lucide-react'
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
    { id: 'PAGO_MOVIL', label: 'Pago Movil', icon: Wallet, requiresDetails: true },
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
    return paymentMethods.find((paymentMethod) => paymentMethod.id === method)?.label || method
  }

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    const Icon = paymentMethods.find((paymentMethod) => paymentMethod.id === method)?.icon || Wallet
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="space-y-3">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pagos divididos</h3>
              <p className="text-xs text-slate-500">Combina varios metodos hasta completar el total</p>
            </div>
            {!showAddForm && !isComplete && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="h-9 rounded-lg border-slate-200 bg-slate-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            )}
          </div>

          <div className={cn(
            'mt-3 rounded-xl border p-3',
            isComplete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50',
          )}>
            <div className="flex items-center gap-2">
              {isComplete ? <CircleCheckBig className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
              <p className={cn('text-sm font-semibold', isComplete ? 'text-emerald-800' : 'text-amber-800')}>
                {isComplete ? 'Pago completado' : 'Monto pendiente'}
              </p>
            </div>
            {!isComplete && (
              <p className="mt-1 text-xs text-amber-700">
                ${remainingUsd.toFixed(2)} USD (Bs. {remainingBs.toFixed(2)})
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <div className="space-y-2">
          {payments.map((payment) => (
            <Card key={payment.id} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      {getPaymentMethodIcon(payment.method)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{getPaymentMethodLabel(payment.method)}</p>
                      <p className="text-xs text-slate-600">
                        ${payment.amount_usd.toFixed(2)} USD - Bs. {payment.amount_bs.toFixed(2)}
                      </p>
                      {payment.reference && <p className="text-xs text-slate-500">Ref: {payment.reference}</p>}
                      {payment.bank && (
                        <p className="text-xs text-slate-500">
                          {VENEZUELAN_BANKS.find((bank) => bank.code === payment.bank)?.name || payment.bank}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemovePayment(payment.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    aria-label="Eliminar pago"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAddForm && (
        <Card className="border-primary/20 bg-white shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Agregar pago</h4>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancelar</Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Metodo</label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value as PaymentMethod })}
              >
                <SelectTrigger className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Monto</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  placeholder="0.00"
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Moneda</label>
                <Select
                  value={newPayment.currency}
                  onValueChange={(value) => setNewPayment({ ...newPayment, currency: value as 'USD' | 'BS' })}
                >
                  <SelectTrigger className="bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="BS">Bs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {requiresBank && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Banco</label>
                <Select
                  value={newPayment.bank}
                  onValueChange={(value) => setNewPayment({ ...newPayment, bank: value })}
                >
                  <SelectTrigger className="bg-slate-50">
                    <SelectValue placeholder="Seleccionar banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {VENEZUELAN_BANKS.filter((bank) => (
                      newPayment.method === 'PAGO_MOVIL' ? bank.supportsPayoMovil : bank.supportsTransfer
                    )).map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {requiresReference && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Referencia</label>
                <Input
                  type="text"
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                  placeholder="Numero de referencia"
                  className="bg-slate-50"
                />
              </div>
            )}

            {newPayment.method === 'PAGO_MOVIL' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Telefono</label>
                <Input
                  type="tel"
                  value={newPayment.phone}
                  onChange={(e) => setNewPayment({ ...newPayment, phone: e.target.value })}
                  placeholder="0412-1234567"
                  className="bg-slate-50"
                />
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddPayment}
              disabled={!newPayment.amount || parseFloat(newPayment.amount) <= 0}
              className="w-full"
            >
              Agregar pago
            </Button>
          </CardContent>
        </Card>
      )}

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
          className="w-full h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-700"
        >
          <Wallet className="w-4 h-4 mr-2" />
          Completar con Pago Movil (Bs. {remainingBs.toFixed(2)})
        </Button>
      )}
    </div>
  )
}
