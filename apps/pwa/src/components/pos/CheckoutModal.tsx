import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Loader2, ShoppingBag, Receipt, CheckCircle2, ShieldCheck } from 'lucide-react'
import { CartItem } from '@/stores/cart.store'
import { useAuth } from '@/stores/auth.store'
import { calculateRoundedChangeWithMode, roundToNearestDenomination, roundToNearestDenominationUp } from '@/utils/vzla-denominations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogHeader, DialogDescription, AccessibleDialogTitle } from '@/components/ui/dialog'
import { CheckoutDialogContent } from './CheckoutDialogContent'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import SerialSelector from '@/components/serials/SerialSelector'
import SplitPaymentManager from './SplitPaymentManager'
import { SplitPaymentItem, PaymentMethod } from '@/types/split-payment.types'
import PaymentMethodSelector from './checkout/PaymentMethodSelector'
import CashPaymentSection from './checkout/CashPaymentSection'
import CustomerSearchSection from './checkout/CustomerSearchSection'
import InvoiceConfigSection from './checkout/InvoiceConfigSection'
import CheckoutSummary from './checkout/CheckoutSummary'
import { QuickActionsBar } from './checkout/QuickActionsBar'
import { useCheckoutState } from '@/hooks/pos/useCheckoutState'
import { useCheckoutData } from '@/hooks/pos/useCheckoutData'
import { useCheckoutValidation } from '@/hooks/pos/useCheckoutValidation'
import { Badge } from '@/components/ui/badge'
import { stockValidatorService, StockWarning } from '@/services/stock-validator.service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  // Defer expensive data work until modal entrance animation completes.
  const [isInteractionReady, setIsInteractionReady] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedCustomerSearch(state.customerData.search)
    }, 250)
    return () => clearTimeout(handle)
  }, [state.customerData.search])

  const checkoutData = useCheckoutData({
    storeId: storeId || undefined,
    isOpen: isOpen && isInteractionReady,
    customerSearch: debouncedCustomerSearch,
    selectedCustomerId: state.customerData.selectedId,
  })
  const validation = useCheckoutValidation()

  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([])
  const [selectedSerials, setSelectedSerials] = useState<Record<string, string[]>>({})
  const [serialSelectorItem, setSerialSelectorItem] = useState<{ productId: string; productName: string; quantity: number } | null>(null)

  // Stock Validation State
  const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([])
  const [showStockWarningDialog, setShowStockWarningDialog] = useState(false)
  const [isValidatingStock, setIsValidatingStock] = useState(false)

  // Local processing state to bridge the gap between click and parent isLoading
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Small delay to allow CSS animation to start/finish smoothly before heavy rendering
      const timer = setTimeout(() => {
        setIsInteractionReady(true)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      actions.reset()
      setSplitPayments([])
      setSelectedSerials({})
      setIsProcessing(false)
      setIsInteractionReady(false)
    }
  }, [isOpen, actions.reset])

  const { splitRemainingUsd, splitRemainingBs, splitIsComplete } = useMemo(() => {
    const remainingUsd = total.usd - splitPayments.reduce((sum, payment) => {
      const usd = payment.amount_usd || 0
      const bs = payment.amount_bs || 0
      return sum + usd + (bs / checkoutData.exchangeRate)
    }, 0)

    return {
      splitRemainingUsd: remainingUsd,
      splitRemainingBs: remainingUsd * checkoutData.exchangeRate,
      splitIsComplete: Math.abs(remainingUsd) < 0.01,
    }
  }, [total.usd, splitPayments, checkoutData.exchangeRate])

  const handleAddSplitPayment = useCallback((payment: Omit<SplitPaymentItem, 'id'>) => {
    const newPayment: SplitPaymentItem = {
      ...payment,
      id: `payment-${Date.now()}-${Math.random()}`,
    }
    setSplitPayments((prev) => [...prev, newPayment])
  }, [])

  const handleRemoveSplitPayment = useCallback((paymentId: string) => {
    setSplitPayments((prev) => prev.filter((payment) => payment.id !== paymentId))
  }, [])

  const handleUpdateSplitPayment = useCallback((paymentId: string, updates: Partial<Omit<SplitPaymentItem, 'id'>>) => {
    setSplitPayments((prev) => prev.map((payment) => payment.id === paymentId ? { ...payment, ...updates } : payment))
  }, [])

  const handleSerialSelect = useCallback((serials: string[]) => {
    if (serialSelectorItem) {
      setSelectedSerials((prev) => ({
        ...prev,
        [serialSelectorItem.productId]: serials,
      }))
      setSerialSelectorItem(null)
    }
  }, [serialSelectorItem])

  const handleConfirm = async (confirmedWarnings = false) => {
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

    // Indicate processing immediately to prevent UI freeze/flicker
    setIsProcessing(true)

    // ---------------------------------------------------------
    // STOCK VALIDATION (Phase 2 Defensiva)
    // ---------------------------------------------------------
    if (!confirmedWarnings) {
      setIsValidatingStock(true)
      try {
        const validationItems = items.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          name: i.product_name
        }))
        const isOnline = navigator.onLine

        const stockResult = await stockValidatorService.validateBeforeSale(validationItems, isOnline)

        if (!stockResult.valid) {
          // Bloqueo total (Error offline con stock <= 0)
          const errorMsg = stockResult.errors.map(e => `• ${e.product_name}: ${e.message}`).join('\n')
          actions.setError(`STOCK INSUFICIENTE (OFFLINE):\n${errorMsg}`)
          setIsValidatingStock(false)
          setIsProcessing(false) // Stop processing locally
          return
        }

        if (stockResult.warnings.length > 0) {
          // Mostrar warnings y pedir confirmación
          setStockWarnings(stockResult.warnings)
          setShowStockWarningDialog(true)
          setIsValidatingStock(false)
          setIsProcessing(false) // Stop processing locally to wait for user confirmation
          return
        }
      } catch (err) {
        console.warn('Stock validation failed, fail-open', err)
      } finally {
        setIsValidatingStock(false)
      }
    }
    // ---------------------------------------------------------

    if (
      state.paymentMode === 'SINGLE'
      && (state.selectedMethod === 'CASH_BS' || (state.selectedMethod === 'CASH_USD' && state.cash.giveChangeInBs))
      && state.cash.changeRoundingMode === 'MERCHANT'
      && !state.cash.changeRoundingConsent
    ) {
      actions.setError('Debes confirmar que el cliente acepta el redondeo a favor de la tienda.')
      setIsProcessing(false)
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
      confirmData.split_payments = splitPayments.map((payment) => ({
        method: payment.method,
        amount_usd: payment.amount_usd,
        amount_bs: payment.amount_bs,
        reference: payment.reference,
        phone: payment.phone,
        card_last_4: payment.card_last_4,
      }))
    } else {
      if (state.selectedMethod === 'CASH_USD') {
        const changeUsd = state.cash.receivedUsd - total.usd
        const roundingResult = state.cash.giveChangeInBs
          ? calculateRoundedChangeWithMode(changeUsd, checkoutData.exchangeRate, state.cash.changeRoundingMode)
          : undefined

        confirmData.cash_payment = {
          received_usd: state.cash.receivedUsd,
          change_bs: roundingResult?.changeBs,
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
          change_bs: roundedChangeBs,
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

    try {
      // Treat onConfirm as a potential promise to keep spinner active until parent resolves
      // or modal closes
      await onConfirm(confirmData)
    } catch (e) {
      console.error('Payment confirmation error:', e)
      setIsProcessing(false)
    }
  }

  const totalBs = total.usd * checkoutData.exchangeRate

  const loadingSkeleton = (
    <div className="space-y-6 h-full p-1 animate-in fade-in duration-300">
      {/* Summary Skeleton */}
      <section className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-20" />
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-border/50">
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </section>

      {/* Controls Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-xl" /> {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" /> {/* Config */}
      </div>
    </div>
  )

  const summaryPanel = (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5" />
          Detalle del pedido
        </h3>

        <div className="max-h-56 overflow-y-auto rounded-xl border border-border/90 bg-muted/30">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5',
                index < items.length - 1 && 'border-b border-border/70',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.product_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.qty} {item.is_weight_product ? item.weight_unit : 'unid.'} x ${Number(item.unit_price_usd).toFixed(2)}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums text-foreground">
                ${(item.qty * Number(item.unit_price_usd)).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-linear-to-br from-primary/10 via-card to-card p-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Total pagable</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-3xl font-black tracking-tight text-foreground tabular-nums sm:text-4xl">
            ${total.usd.toFixed(2)}
          </p>
          <Badge variant="outline" className="border-primary/25 bg-card/80 text-primary">
            Tasa {checkoutData.exchangeRate.toFixed(2)}
          </Badge>
        </div>
        <p className="mt-1 text-sm font-medium text-muted-foreground tabular-nums">
          Bs. {totalBs.toFixed(2)}
        </p>
      </section>

      <CheckoutSummary
        subtotal={total.usd}
        discount={0}
        total={total.usd}
        currency="USD"
        exchangeRate={checkoutData.exchangeRate}
      />
    </div>
  )

  const checkoutControls = (
    <div className="space-y-4">
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
        <div className="space-y-4">
          <PaymentMethodSelector
            value={state.selectedMethod}
            onChange={actions.setPaymentMethod}
            disabled={false}
          />

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

          {state.selectedMethod === 'CASH_BS' && (
            <CashPaymentSection
              mode="BS"
              totalAmount={totalBs}
              exchangeRate={checkoutData.exchangeRate}
              receivedAmount={state.cash.receivedBs}
              onAmountChange={actions.setReceivedBs}
              roundingMode={state.cash.changeRoundingMode}
              onRoundingModeChange={actions.setChangeRoundingMode}
              roundingConsent={state.cash.changeRoundingConsent}
              onRoundingConsentChange={actions.setChangeRoundingConsent}
            />
          )}
        </div>
      )}

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

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Procesamiento operativo
        </h4>

        <div className="space-y-4">
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
            <Label className="text-xs font-semibold text-foreground/80">Nota interna</Label>
            <Input
              value={state.saleNote}
              onChange={(e) => actions.setSaleNote(e.target.value)}
              placeholder="Ej: cliente frecuente, delivery prioritario"
              className="h-10 rounded-xl border-border bg-muted/40"
            />
          </div>
        </div>
      </section>
    </div>
  )

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isLoading && !isProcessing) onClose() }}>
        <CheckoutDialogContent
          className="[&>button]:hidden w-[calc(100vw-1rem)] max-w-[1180px] h-[calc(100dvh-1rem)] sm:w-[calc(100vw-2rem)] sm:h-[calc(100dvh-2rem)] lg:h-[min(860px,calc(100dvh-3rem))] overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl grid grid-rows-[auto_minmax(0,1fr)_auto] duration-200 sm:rounded-(--radius)"
        >
          <DialogHeader className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <AccessibleDialogTitle className="truncate text-lg font-black tracking-tight text-foreground sm:text-xl">
                    Finalizar venta
                  </AccessibleDialogTitle>
                  <DialogDescription className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Confirma el pago y genera el comprobante
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isLoading || isProcessing}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Cerrar checkout"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 lg:hidden">
              {isInteractionReady ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {summaryPanel}
                  {checkoutControls}
                </div>
              ) : (
                <div className="space-y-4">
                  {loadingSkeleton}
                </div>
              )}
            </div>

            <div className="hidden h-full lg:grid lg:grid-cols-[minmax(320px,38%)_1fr] lg:divide-x lg:divide-border">
              <aside className="min-h-0 overflow-y-auto overscroll-contain bg-background/30 p-6">
                {isInteractionReady ? (
                  <div className="animate-in fade-in duration-300">
                    {summaryPanel}
                  </div>
                ) : loadingSkeleton}
              </aside>
              <section className="min-h-0 overflow-y-auto overscroll-contain bg-background/30 p-6">
                {isInteractionReady ? (
                  <div className="animate-in fade-in duration-300">
                    {checkoutControls}
                  </div>
                ) : loadingSkeleton}
              </section>
            </div>
          </div>

          <footer className="border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
            {state.error && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-semibold text-destructive" role="alert" aria-live="assertive">
                <X className="h-4 w-4" />
                {state.error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading || isProcessing}
                className="h-11 flex-1 rounded-xl border-border"
                aria-label="Cancelar y volver al carrito"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleConfirm()}
                disabled={isLoading || isValidatingStock || items.length === 0 || isProcessing}
                className="h-11 flex-[1.25] rounded-xl font-bold"
                aria-label="Confirmar pago y finalizar venta"
              >
                {isLoading || isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isValidatingStock ? 'Validando...' : 'Procesando...'}
                  </>
                ) : (
                  <>
                    Confirmar pago
                    <Receipt className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </footer>

          <SerialSelector
            isOpen={!!serialSelectorItem}
            onClose={() => setSerialSelectorItem(null)}
            productId={serialSelectorItem?.productId || ''}
            productName={serialSelectorItem?.productName || ''}
            quantity={serialSelectorItem?.quantity || 0}
            onSelect={handleSerialSelect}
          />
        </CheckoutDialogContent>
      </Dialog>

      <AlertDialog open={showStockWarningDialog} onOpenChange={setShowStockWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advertencia de Stock</AlertDialogTitle>
            <AlertDialogDescription>
              Se detectaron los siguientes problemas de inventario:
              <ul className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 list-disc pl-5">
                {stockWarnings.map((w, idx) => (
                  <li key={idx}>
                    <strong>{w.product_name}:</strong> {w.message}
                  </li>
                ))}
              </ul>
              <div className="mt-4 font-bold">
                ¿Deseas continuar de todos modos?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowStockWarningDialog(false)
              handleConfirm(true) // Re-run confirm skipping validation
            }}>
              Continuar (Overselling)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
