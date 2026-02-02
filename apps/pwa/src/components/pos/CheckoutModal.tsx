import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Loader2, ShoppingBag, Receipt, CheckCircle2, ShieldCheck } from 'lucide-react'
import { CartItem } from '@/stores/cart.store'
import { useAuth } from '@/stores/auth.store'
import { calculateRoundedChangeWithMode, roundToNearestDenomination, roundToNearestDenominationUp } from '@/utils/vzla-denominations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import SerialSelector from '@/components/serials/SerialSelector'
import SplitPaymentManager from './SplitPaymentManager'
import { SplitPaymentItem, PaymentMethod } from '@/types/split-payment.types'

// Componentes modulares
import PaymentMethodSelector from './checkout/PaymentMethodSelector'
import CashPaymentSection from './checkout/CashPaymentSection'
import CustomerSearchSection from './checkout/CustomerSearchSection'
import InvoiceConfigSection from './checkout/InvoiceConfigSection'
import CheckoutSummary from './checkout/CheckoutSummary'
import { QuickActionsBar } from './checkout/QuickActionsBar'

// Hooks
import { useCheckoutState } from '@/hooks/pos/useCheckoutState'
import { useCheckoutData } from '@/hooks/pos/useCheckoutData'
import { useCheckoutValidation } from '@/hooks/pos/useCheckoutValidation'
import { Badge } from '@/components/ui/badge'

interface SplitPaymentForBackend {
  method: PaymentMethod
  amount_usd?: number
  amount_bs?: number
  reference?: string
  bank_code?: string
  phone?: string
  card_last_4?: string
  note?: string
}

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  total: {
    usd: number
    bs: number
  }
  onConfirm: (data: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO' | 'SPLIT'
    currency: 'BS' | 'USD' | 'MIXED'
    exchange_rate: number
    cash_payment?: {
      received_usd: number
      change_bs?: number
      change_rounding?: {
        mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT'
        exact_change_bs: number
        rounded_change_bs: number
        adjustment_bs: number
        consented?: boolean
      }
    }
    cash_payment_bs?: {
      received_bs: number
      change_bs?: number
      change_rounding?: {
        mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT'
        exact_change_bs: number
        rounded_change_bs: number
        adjustment_bs: number
        consented?: boolean
      }
    }
    split_payments?: SplitPaymentForBackend[]
    customer_id?: string
    customer_name?: string
    customer_document_id?: string
    customer_phone?: string
    customer_note?: string
    note?: string
    serials?: Record<string, string[]>
    invoice_series_id?: string | null
    price_list_id?: string | null
    promotion_id?: string | null
    warehouse_id?: string | null
    generate_fiscal_invoice?: boolean
  }) => void
  isLoading?: boolean
}

export default function CheckoutModal({
  isOpen,
  onClose,
  items,
  total,
  onConfirm,
  isLoading = false,
}: CheckoutModalProps) {
  const { user } = useAuth()
  const storeId = user?.store_id || null

  const { state, actions } = useCheckoutState()
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState(state.customerData.search)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedCustomerSearch(state.customerData.search)
    }, 250)
    return () => clearTimeout(handle)
  }, [state.customerData.search])

  const checkoutData = useCheckoutData({
    storeId: storeId || undefined,
    isOpen,
    customerSearch: debouncedCustomerSearch,
    selectedCustomerId: state.customerData.selectedId,
  })
  const validation = useCheckoutValidation()

  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([])
  const [selectedSerials, setSelectedSerials] = useState<Record<string, string[]>>({})
  const [serialSelectorItem, setSerialSelectorItem] = useState<{ productId: string; productName: string; quantity: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    actions.reset()
    setSplitPayments([])
    setSelectedSerials({})
  }, [isOpen, actions.reset])

  const { splitRemainingUsd, splitRemainingBs, splitIsComplete } = useMemo(() => {
    const remainingUsd = total.usd - splitPayments.reduce((sum, p) => {
      const usd = p.amount_usd || 0
      const bs = p.amount_bs || 0
      return sum + usd + (bs / checkoutData.exchangeRate)
    }, 0)

    return {
      splitRemainingUsd: remainingUsd,
      splitRemainingBs: remainingUsd * checkoutData.exchangeRate,
      splitIsComplete: Math.abs(remainingUsd) < 0.01
    }
  }, [total.usd, splitPayments, checkoutData.exchangeRate])

  const handleAddSplitPayment = useCallback((payment: Omit<SplitPaymentItem, 'id'>) => {
    const newPayment: SplitPaymentItem = {
      ...payment,
      id: `payment-${Date.now()}-${Math.random()}`
    }
    setSplitPayments(prev => [...prev, newPayment])
  }, [])

  const handleRemoveSplitPayment = useCallback((paymentId: string) => {
    setSplitPayments(prev => prev.filter(p => p.id !== paymentId))
  }, [])

  const handleUpdateSplitPayment = useCallback((paymentId: string, updates: Partial<Omit<SplitPaymentItem, 'id'>>) => {
    setSplitPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...updates } : p))
  }, [])

  const handleSerialSelect = useCallback((serials: string[]) => {
    if (serialSelectorItem) {
      setSelectedSerials(prev => ({
        ...prev,
        [serialSelectorItem.productId]: serials
      }))
      setSerialSelectorItem(null)
    }
  }, [serialSelectorItem])

  const handleConfirm = () => {
    if (state.paymentMode === 'SINGLE') {
      const methodValidation = validation.validatePaymentMethod(state.selectedMethod, state.customerData.selectedId)
      if (!methodValidation.valid) {
        actions.setError(methodValidation.error!)
        return
      }

      if (state.selectedMethod === 'CASH_USD') {
        const cashValidation = validation.validateCashUsd(state.cash.receivedUsd, total.usd)
        if (!cashValidation.valid) {
          actions.setError(cashValidation.error!)
          return
        }
      } else if (state.selectedMethod === 'CASH_BS') {
        const cashValidation = validation.validateCashBs(state.cash.receivedBs, total.usd * checkoutData.exchangeRate)
        if (!cashValidation.valid) {
          actions.setError(cashValidation.error!)
          return
        }
      }
    } else {
      const splitValidation = validation.validateSplit(total.usd, splitPayments, checkoutData.exchangeRate)
      if (!splitValidation.valid) {
        actions.setError(splitValidation.error!)
        return
      }
    }

    if (
      state.paymentMode === 'SINGLE' &&
      (state.selectedMethod === 'CASH_BS' || (state.selectedMethod === 'CASH_USD' && state.cash.giveChangeInBs)) &&
      state.cash.changeRoundingMode === 'MERCHANT' &&
      !state.cash.changeRoundingConsent
    ) {
      actions.setError('Debes confirmar que el cliente acepta el redondeo a favor de la tienda.')
      return
    }

    const confirmData: any = {
      payment_method: state.paymentMode === 'SPLIT' ? 'SPLIT' : state.selectedMethod,
      currency: state.paymentMode === 'SPLIT' ? 'MIXED' : (state.selectedMethod === 'CASH_BS' ? 'BS' : 'USD'),
      exchange_rate: checkoutData.exchangeRate,
      note: state.saleNote || undefined,
      serials: Object.keys(selectedSerials).length > 0 ? selectedSerials : undefined,
      invoice_series_id: state.invoice.seriesId || null,
      price_list_id: state.invoice.priceListId || null,
      promotion_id: state.invoice.promotionId || null,
      warehouse_id: state.invoice.warehouseId || null,
      generate_fiscal_invoice: state.invoice.generateFiscalInvoice,
    }

    if (state.paymentMode === 'SPLIT') {
      confirmData.split_payments = splitPayments.map(p => ({
        method: p.method,
        amount_usd: p.amount_usd,
        amount_bs: p.amount_bs,
        reference: p.reference,
        phone: p.phone,
        card_last_4: p.card_last_4,
      }))
    } else {
      if (state.selectedMethod === 'CASH_USD') {
        const changeUsd = state.cash.receivedUsd - total.usd
        const roundingResult = state.cash.giveChangeInBs
          ? calculateRoundedChangeWithMode(changeUsd, checkoutData.exchangeRate, state.cash.changeRoundingMode)
          : undefined

        confirmData.cash_payment = {
          received_usd: state.cash.receivedUsd,
          change_bs: roundingResult?.changeBs
        }

        if (roundingResult) {
          confirmData.cash_payment.change_rounding = {
            mode: state.cash.changeRoundingMode,
            exact_change_bs: roundingResult.exactChangeBs,
            rounded_change_bs: roundingResult.changeBs,
            adjustment_bs: roundingResult.adjustmentBs,
            consented: state.cash.changeRoundingMode === 'MERCHANT' ? state.cash.changeRoundingConsent : undefined,
          }
        }
      } else if (state.selectedMethod === 'CASH_BS') {
        const totalBs = total.usd * checkoutData.exchangeRate
        const changeBsRaw = Math.max(0, state.cash.receivedBs - totalBs)
        let roundedChangeBs = changeBsRaw
        if (state.cash.changeRoundingMode === 'MERCHANT') {
          roundedChangeBs = changeBsRaw > 0 ? roundToNearestDenomination(changeBsRaw) : 0
        } else if (state.cash.changeRoundingMode === 'CUSTOMER') {
          roundedChangeBs = changeBsRaw > 0 ? roundToNearestDenominationUp(changeBsRaw) : 0
        }
        const adjustmentBs = Math.round((changeBsRaw - roundedChangeBs) * 100) / 100
        confirmData.cash_payment_bs = {
          received_bs: state.cash.receivedBs,
          change_bs: roundedChangeBs
        }

        if (changeBsRaw > 0) {
          confirmData.cash_payment_bs.change_rounding = {
            mode: state.cash.changeRoundingMode,
            exact_change_bs: Math.round(changeBsRaw * 100) / 100,
            rounded_change_bs: Math.round(roundedChangeBs * 100) / 100,
            adjustment_bs: adjustmentBs,
            consented: state.cash.changeRoundingMode === 'MERCHANT' ? state.cash.changeRoundingConsent : undefined,
          }
        }
      }
    }

    if (state.customerData.selectedId) {
      confirmData.customer_id = state.customerData.selectedId
    }

    onConfirm(confirmData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95vh] sm:h-[85vh] p-0 overflow-hidden border-none bg-slate-50 shadow-2xl flex flex-col">
        {/* Premium Light Header */}
        <DialogHeader className="px-6 py-4 flex-shrink-0 bg-white border-b border-slate-200 relative z-10 pr-12">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                Finalizar Venta
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 font-bold uppercase tracking-widest">
                Confirma el pago y genera el comprobante
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-slate-50">
          {/* Columna Izquierda: Resumen y Totales */}
          <div className="w-full lg:w-[40%] flex flex-col border-r border-slate-200 bg-white p-6 overscroll-contain overflow-hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Resumen de Items */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5" /> Detalle del Pedido
                  </h3>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                    {items.map((item, idx) => (
                      <div key={item.id} className={cn(
                        "p-4 flex justify-between items-center gap-4",
                        idx < items.length - 1 && "border-b border-slate-100"
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{item.product_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                            {item.qty} {item.is_weight_product ? item.weight_unit : 'unid.'} × ${Number(item.unit_price_usd).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 text-sm tabular-nums">
                            ${(item.qty * Number(item.unit_price_usd)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Light Premium Totals Card */}
                <div className="p-6 rounded-[2rem] bg-gradient-to-br from-primary/10 via-white to-white border border-primary/20 shadow-xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 h-32 w-32 bg-primary/5 rounded-full blur-3xl" />
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 leading-none">Total Pagable</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter tabular-nums">
                      ${total.usd.toFixed(2)}
                    </span>
                    <span className="text-sm font-black text-slate-400">USD</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Monto en BS</span>
                      <span className="text-xl font-black text-slate-700 tabular-nums">Bs. {(total.usd * checkoutData.exchangeRate).toFixed(2)}</span>
                    </div>
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-black text-[10px] px-2">
                      Tasa: {checkoutData.exchangeRate.toFixed(2)}
                    </Badge>
                  </div>
                </div>

                {/* Resumen de Descuentos/Impuestos */}
                <CheckoutSummary
                  subtotal={total.usd}
                  discount={0}
                  total={total.usd}
                  currency="USD"
                  exchangeRate={checkoutData.exchangeRate}
                />
              </div>
            </ScrollArea>
          </div>

          {/* Columna Derecha: Métodos de Pago y Acción */}
          <div className="flex-1 flex flex-col bg-slate-50 p-6 overscroll-contain overflow-hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Quick Actions Bar */}
                <QuickActionsBar
                  isSplitPayment={state.paymentMode === 'SPLIT'}
                  onToggleSplitPayment={() => actions.setPaymentMode(state.paymentMode === 'SPLIT' ? 'SINGLE' : 'SPLIT')}
                  generateFiscalInvoice={state.invoice.generateFiscalInvoice}
                  hasFiscalConfig={checkoutData.invoiceSeries.length > 0}
                  onToggleFiscalInvoice={actions.setGenerateFiscalInvoice}
                  promotions={checkoutData.promotions as any || []}
                  selectedPromotionId={state.invoice.promotionId}
                  onPromotionChange={actions.setPromotion}
                  customers={checkoutData.customers}
                  selectedCustomerId={state.customerData.selectedId}
                  onCustomerChange={actions.setCustomerId}
                  customerSearchTerm={state.customerData.search}
                  onCustomerSearchChange={actions.setCustomerSearch}
                />

                {state.paymentMode === 'SPLIT' ? (
                  <SplitPaymentManager
                    payments={splitPayments}
                    remainingUsd={splitRemainingUsd}
                    remainingBs={splitRemainingBs}
                    exchangeRate={checkoutData.exchangeRate}
                    isComplete={splitIsComplete}
                    onAddPayment={handleAddSplitPayment}
                    onRemovePayment={handleRemoveSplitPayment}
                    onUpdatePayment={handleUpdateSplitPayment}
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Método de Pago</Label>
                      <PaymentMethodSelector
                        value={state.selectedMethod}
                        onChange={actions.setPaymentMethod}
                        disabled={false}
                      />
                    </div>

                    {state.selectedMethod === 'CASH_USD' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <CashPaymentSection
                          mode="USD"
                          totalAmount={total.usd}
                          exchangeRate={checkoutData.exchangeRate}
                          receivedAmount={state.cash.receivedUsd}
                          onAmountChange={actions.setReceivedUsd}
                          giveChangeInBs={state.cash.giveChangeInBs}
                          onGiveChangeInBsChange={actions.setGiveChangeInBs}
                          roundingMode={state.cash.changeRoundingMode}
                          onRoundingModeChange={actions.setChangeRoundingMode}
                          roundingConsent={state.cash.changeRoundingConsent}
                          onRoundingConsentChange={actions.setChangeRoundingConsent}
                        />
                      </div>
                    )}

                    {state.selectedMethod === 'CASH_BS' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <CashPaymentSection
                          mode="BS"
                          totalAmount={total.usd * checkoutData.exchangeRate}
                          exchangeRate={checkoutData.exchangeRate}
                          receivedAmount={state.cash.receivedBs}
                          onAmountChange={actions.setReceivedBs}
                          roundingMode={state.cash.changeRoundingMode}
                          onRoundingModeChange={actions.setChangeRoundingMode}
                          roundingConsent={state.cash.changeRoundingConsent}
                          onRoundingConsentChange={actions.setChangeRoundingConsent}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Cliente si es FIAO */}
                {(state.selectedMethod === 'FIAO' || state.paymentMode === 'SPLIT') && (
                  <CustomerSearchSection
                    customers={checkoutData.customers}
                    selectedCustomerId={state.customerData.selectedId}
                    onSelectCustomer={actions.setCustomerId}
                    searchValue={state.customerData.search}
                    onSearchChange={actions.setCustomerSearch}
                    required={state.selectedMethod === 'FIAO'}
                  />
                )}

                {/* Configuración de factura e inventario */}
                <div className="p-4 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> Procesamiento Operativo
                  </h4>
                  <InvoiceConfigSection
                    invoiceSeries={checkoutData.invoiceSeries as any}
                    priceLists={checkoutData.priceLists}
                    warehouses={checkoutData.warehouses}
                    selectedSeriesId={state.invoice.seriesId}
                    selectedPriceListId={state.invoice.priceListId}
                    selectedWarehouseId={state.invoice.warehouseId}
                    onSeriesChange={actions.setInvoiceSeries}
                    onPriceListChange={actions.setPriceList}
                    onWarehouseChange={actions.setWarehouse}
                    generateFiscalInvoice={state.invoice.generateFiscalInvoice}
                    onGenerateFiscalInvoiceChange={actions.setGenerateFiscalInvoice}
                  />

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600">Nota Interna</Label>
                    <Input
                      value={state.saleNote}
                      onChange={(e) => actions.setSaleNote(e.target.value)}
                      placeholder="Ej: Cliente frecuente, delivery prioritario..."
                      className="bg-slate-50 border-slate-200 rounded-xl h-10 text-sm focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-6 bg-white border-t border-slate-200 flex flex-col gap-4">
          {state.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs font-bold animate-pulse flex items-center gap-2">
              <X className="w-4 h-4" /> {state.error}
            </div>
          )}
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-14 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-bold transition-all"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || items.length === 0}
              className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 group"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  Confirmar Pago
                  <Receipt className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </div>

        {serialSelectorItem && (
          <SerialSelector
            isOpen={!!serialSelectorItem}
            onClose={() => setSerialSelectorItem(null)}
            productId={serialSelectorItem.productId}
            productName={serialSelectorItem.productName}
            quantity={serialSelectorItem.quantity}
            onSelect={handleSerialSelect}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
