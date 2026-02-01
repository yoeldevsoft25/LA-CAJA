import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Loader2, ShoppingBag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CartItem } from '@/stores/cart.store'
import { useAuth } from '@/stores/auth.store'
import { calculateRoundedChangeWithMode, roundToNearestDenomination, roundToNearestDenominationUp } from '@/utils/vzla-denominations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import SerialSelector from '@/components/serials/SerialSelector'
import SplitPaymentManager from './SplitPaymentManager'
import { SplitPaymentItem, PaymentMethod } from '@/types/split-payment.types'

// Nuevos componentes modulares
import PaymentMethodSelector from './checkout/PaymentMethodSelector'
import CashPaymentSection from './checkout/CashPaymentSection'
import CustomerSearchSection from './checkout/CustomerSearchSection'
import InvoiceConfigSection from './checkout/InvoiceConfigSection'
import CheckoutSummary from './checkout/CheckoutSummary'
import { QuickActionsBar } from './checkout/QuickActionsBar'

// Nuevos hooks
import { useCheckoutState } from '@/hooks/pos/useCheckoutState'
import { useCheckoutData } from '@/hooks/pos/useCheckoutData'
import { useCheckoutValidation } from '@/hooks/pos/useCheckoutValidation'

// Tipo de pago dividido para el backend
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

  // Hooks personalizados
  const { state, actions } = useCheckoutState()
  const checkoutData = useCheckoutData(storeId || undefined, isOpen)
  const validation = useCheckoutValidation()

  // Estados locales para pagos divididos y seriales
  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([])
  const [selectedSerials, setSelectedSerials] = useState<Record<string, string[]>>({})
  const [serialSelectorItem, setSerialSelectorItem] = useState<{ productId: string; productName: string; quantity: number } | null>(null)

  // Detectar si es móvil
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Resetear estado al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      actions.reset()
      setSplitPayments([])
      setSelectedSerials({})
    }
  }, [isOpen])

  // Calcular montos restantes para pagos divididos con useMemo
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

  // Handlers para pagos divididos (memoizados)
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

  // Handler para selección de seriales (memoizado)
  const handleSerialSelect = useCallback((serials: string[]) => {
    if (serialSelectorItem) {
      setSelectedSerials(prev => ({
        ...prev,
        [serialSelectorItem.productId]: serials
      }))
      setSerialSelectorItem(null)
    }
  }, [serialSelectorItem])

  // Validación y confirmación
  const handleConfirm = () => {
    // Validar método de pago
    if (state.paymentMode === 'SINGLE') {
      const methodValidation = validation.validatePaymentMethod(state.selectedMethod, state.customerData.selectedId)
      if (!methodValidation.valid) {
        actions.setError(methodValidation.error!)
        return
      }

      // Validar efectivo
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
      // Validar pagos divididos
      const splitValidation = validation.validateSplit(total.usd, splitPayments, checkoutData.exchangeRate)
      if (!splitValidation.valid) {
        actions.setError(splitValidation.error!)
        return
      }
    }

    // Validar consentimiento para redondeo a favor de la tienda
    if (
      state.paymentMode === 'SINGLE' &&
      (state.selectedMethod === 'CASH_BS' || (state.selectedMethod === 'CASH_USD' && state.cash.giveChangeInBs)) &&
      state.cash.changeRoundingMode === 'MERCHANT' &&
      !state.cash.changeRoundingConsent
    ) {
      actions.setError('Debes confirmar que el cliente acepta el redondeo a favor de la tienda.')
      return
    }

    // Preparar datos para enviar
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

  const modalContent = (
    <>
      <CardContent className="p-3 sm:p-4 lg:p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 sm:space-y-6 lg:space-y-0">
          {/* LEFT COLUMN */}
          <div className="space-y-4 sm:space-y-6">
            {/* Resumen de venta */}
            <Card className="border border-border/40 bg-gradient-to-br from-card/50 to-card backdrop-blur-sm shadow-lg">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-base">Resumen de la venta</h3>
                </div>
                <div className="space-y-4 text-sm">
                  {/* Lista de productos */}
                  <div className="h-24 sm:h-28 lg:h-40 lg:max-h-48 rounded-lg border border-border/30 bg-muted/20 p-2">
                    <ScrollArea className="h-full pr-2">
                      <div className="space-y-2">
                        {items.map((item, index) => (
                          <div
                            key={item.id}
                            className={cn(
                              "flex justify-between items-start p-2 rounded-lg hover:bg-muted/40 transition-colors",
                              index < items.length - 1 && "border-b border-border/30"
                            )}
                          >
                            <div className="flex-1 min-w-0 mr-3">
                              <p
                                className="font-semibold text-foreground text-sm break-words leading-snug"
                                title={item.product_name}
                              >
                                {item.product_name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.is_weight_product ? (
                                  <>
                                    ${Number(item.price_per_weight_usd ?? item.unit_price_usd).toFixed(
                                      (item.weight_unit === 'g' || item.weight_unit === 'oz') ? 4 : 2
                                    )} / {item.weight_unit || 'kg'}
                                  </>
                                ) : (
                                  <>${Number(item.unit_price_usd).toFixed(2)} c/u</>
                                )}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-foreground text-sm">
                                {item.is_weight_product
                                  ? (() => {
                                    const safeUnit = item.weight_unit || 'kg'
                                    const decimals = safeUnit === 'g' || safeUnit === 'oz' ? 0 : 3
                                    const safeValue = Number.isFinite(item.qty) ? item.qty : 0
                                    const fixed = safeValue.toFixed(decimals)
                                    const trimmed = fixed.replace(/\.?0+$/, '')
                                    return `${trimmed} ${safeUnit}`
                                  })()
                                  : `x${item.qty}`}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                ${(item.qty * Number(item.unit_price_usd)).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Resumen de cantidades */}
                  <div className="flex justify-between items-center pt-3 border-t border-border/40">
                    <span className="text-muted-foreground font-medium text-sm">Total Items:</span>
                    <span className="font-bold text-foreground">
                      {(() => {
                        const totalUnits = items.reduce(
                          (sum, item) => sum + (item.is_weight_product ? 0 : item.qty),
                          0
                        )
                        const weightLineItems = items.filter((item) => item.is_weight_product).length
                        return weightLineItems > 0
                          ? totalUnits > 0
                            ? `${totalUnits} unidades + ${weightLineItems} por peso`
                            : `${weightLineItems} por peso`
                          : `${totalUnits} unidades`
                      })()}
                    </span>
                  </div>
                  <div className="rounded-lg bg-primary/5 p-3 border border-primary/20">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-foreground font-semibold">Total USD:</span>
                      <span className="text-xl font-bold text-primary tabular-nums">${total.usd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Equivalente en Bs (tasa {checkoutData.exchangeRate.toFixed(2)}):</span>
                      <span className="tabular-nums">Bs. {(total.usd * checkoutData.exchangeRate).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 border border-border/30">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-foreground font-semibold">Total Bs:</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">Bs. {(total.usd * checkoutData.exchangeRate).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tasa: {checkoutData.exchangeRate.toFixed(2)}</span>
                      <span className="tabular-nums">${total.usd.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de totales */}
            <CheckoutSummary
              subtotal={total.usd}
              discount={0}
              total={total.usd}
              currency="USD"
              exchangeRate={checkoutData.exchangeRate}
            />

            {/* Pagos divididos */}
            {/* Pagos divididos (MOVIDO A LA DERECHA) */}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 sm:space-y-6">

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
              <>
                {/* Selector de método de pago */}
                <PaymentMethodSelector
                  value={state.selectedMethod}
                  onChange={actions.setPaymentMethod}
                  disabled={false}
                />

                {/* Sección de efectivo USD */}
                {state.selectedMethod === 'CASH_USD' && (
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
                )}

                {/* Sección de efectivo BS */}
                {state.selectedMethod === 'CASH_BS' && (
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
                )}
              </>
            )}

            {/* Búsqueda de cliente */}
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

            {/* Configuración de factura */}
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

            {/* Nota de venta */}
            <Card>
              <CardContent className="p-4">
                <Label htmlFor="sale-note">Nota de venta (opcional)</Label>
                <Input
                  id="sale-note"
                  type="text"
                  placeholder="Agregar nota o comentario..."
                  value={state.saleNote}
                  onChange={(e) => actions.setSaleNote(e.target.value)}
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>

      {/* Footer con botones */}
      <div className="p-3 sm:p-4 lg:p-6 border-t bg-muted/30">
        {state.error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {state.error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || items.length === 0}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              `Confirmar $${total.usd.toFixed(2)}`
            )}
          </Button>
        </div>
      </div>
    </>
  )

  // Renderizar modal o sheet según dispositivo
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col">
          <SheetHeader className="p-3 sm:p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg sm:text-xl">Finalizar Venta</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Confirma los detalles del pago y procesa la venta
            </SheetDescription>
          </SheetHeader>
          {modalContent}
          {serialSelectorItem && (
            <SerialSelector
              isOpen={!!serialSelectorItem}
              onClose={() => setSerialSelectorItem(null)}
              productId={serialSelectorItem.productId}
              productName={serialSelectorItem.productName}
              quantity={serialSelectorItem.quantity}
              onSelect={handleSerialSelect}
            />
          )
          }
        </SheetContent >
      </Sheet >
    )
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99]"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: "-45%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: "-45%" }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              className="fixed left-1/2 top-1/2 z-[100] w-[95vw] max-w-6xl"
            >
              <Card className="w-full max-h-[90vh] flex flex-col shadow-2xl border-white/10 dark:bg-card/95 backdrop-blur-xl">
                <div className="p-4 lg:p-6 border-b flex items-center justify-between flex-shrink-0">
                  <h2 className="text-xl lg:text-2xl font-bold">Finalizar Venta</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {modalContent}
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
    </>
  )
}
