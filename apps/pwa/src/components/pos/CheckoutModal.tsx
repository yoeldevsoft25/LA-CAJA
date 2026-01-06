import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, CreditCard, Wallet, Banknote, User, Search, Check, Calculator } from 'lucide-react'
import { CartItem } from '@/stores/cart.store'
import { exchangeService } from '@/services/exchange.service'
import { customersService } from '@/services/customers.service'
import { paymentsService } from '@/services/payments.service'
import { fastCheckoutService } from '@/services/fast-checkout.service'
import { invoiceSeriesService } from '@/services/invoice-series.service'
import { priceListsService } from '@/services/price-lists.service'
import { promotionsService } from '@/services/promotions.service'
import { warehousesService } from '@/services/warehouses.service'
import { calculateRoundedChange, roundToNearestDenomination, calculateChange, formatChangeBreakdown } from '@/utils/vzla-denominations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import SerialSelector from '@/components/serials/SerialSelector'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  total: { bs: number; usd: number }
  onConfirm: (data: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO'
    currency: 'BS' | 'USD' | 'MIXED'
    exchange_rate: number
    cash_payment?: {
      received_usd: number
      change_bs?: number
    }
    cash_payment_bs?: {
      received_bs: number
      change_bs?: number
    }
    customer_id?: string
    customer_name?: string
    customer_document_id?: string
    customer_phone?: string
    customer_note?: string
    serials?: Record<string, string[]> // product_id -> serial_numbers[]
    invoice_series_id?: string | null // ID de la serie de factura a usar
    price_list_id?: string | null // ID de la lista de precio a usar
    promotion_id?: string | null // ID de la promoción a aplicar
    warehouse_id?: string | null // ID de la bodega de donde se vende
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
  const [selectedMethod, setSelectedMethod] = useState<'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO'>('CASH_USD')
  const [exchangeRate, setExchangeRate] = useState<number>(36) // Tasa de cambio por defecto
  const [customerName, setCustomerName] = useState<string>('')
  const [customerDocumentId, setCustomerDocumentId] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [customerNote, setCustomerNote] = useState<string>('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState<string>('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>('')
  
  // Estados para manejo de efectivo USD con cambio en Bs
  const [receivedUsd, setReceivedUsd] = useState<number>(0)
  const [giveChangeInBs, setGiveChangeInBs] = useState<boolean>(false)
  
  // Estados para manejo de efectivo Bs con cambio en Bs
  const [receivedBs, setReceivedBs] = useState<number>(0)

  // Estados para seriales
  const [selectedSerials, setSelectedSerials] = useState<Record<string, string[]>>({})
  const [serialSelectorItem, setSerialSelectorItem] = useState<{
    productId: string
    productName: string
    quantity: number
    itemId: string
  } | null>(null)

  // Obtener tasa BCV automáticamente cuando se abre el modal
  // Usa la misma queryKey que el prefetch para aprovechar el cache
  const { data: bcvRateData, isLoading: isLoadingBCV } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen, // Solo obtener cuando el modal está abierto
    refetchOnWindowFocus: false,
  })

  // Obtener configuraciones de métodos de pago para validar topes
  const { data: paymentConfigs } = useQuery({
    queryKey: ['payments', 'methods'],
    queryFn: () => paymentsService.getPaymentMethodConfigs(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener configuración de modo rápido
  const { data: fastCheckoutConfig } = useQuery({
    queryKey: ['fast-checkout', 'config'],
    queryFn: () => fastCheckoutService.getFastCheckoutConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener series de factura disponibles
  const { data: invoiceSeries } = useQuery({
    queryKey: ['invoice-series'],
    queryFn: () => invoiceSeriesService.getSeriesByStore(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener serie por defecto
  const { data: defaultSeries } = useQuery({
    queryKey: ['invoice-series', 'default'],
    queryFn: () => invoiceSeriesService.getDefaultSeries(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener listas de precio
  const { data: priceLists } = useQuery({
    queryKey: ['price-lists'],
    queryFn: () => priceListsService.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener lista por defecto
  const { data: defaultPriceList } = useQuery({
    queryKey: ['price-lists', 'default'],
    queryFn: () => priceListsService.getDefault(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener promociones activas
  const { data: activePromotions } = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: () => promotionsService.getActive(),
    staleTime: 1000 * 60 * 2, // 2 minutos (más frecuente porque cambian más)
    enabled: isOpen,
  })

  // Obtener bodegas
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  // Obtener bodega por defecto
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['warehouses', 'default'],
    queryFn: () => warehousesService.getDefault(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: isOpen,
  })

  const [selectedInvoiceSeriesId, setSelectedInvoiceSeriesId] = useState<string | null>(null)
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(null)
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null)
  const [promotionCode, setPromotionCode] = useState<string>('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)

  // Prellenar la tasa cuando se obtiene del backend
  useEffect(() => {
    if (isOpen && bcvRateData?.available && bcvRateData?.rate) {
      setExchangeRate(bcvRateData.rate)
    }
  }, [isOpen, bcvRateData])

  // Prellenar serie por defecto
  useEffect(() => {
    if (isOpen && defaultSeries && !selectedInvoiceSeriesId) {
      setSelectedInvoiceSeriesId(defaultSeries.id)
    }
  }, [isOpen, defaultSeries, selectedInvoiceSeriesId])

  // Prellenar lista de precio por defecto
  useEffect(() => {
    if (isOpen && defaultPriceList && !selectedPriceListId) {
      setSelectedPriceListId(defaultPriceList.id)
    }
  }, [isOpen, defaultPriceList, selectedPriceListId])

  // Prellenar bodega por defecto
  useEffect(() => {
    if (isOpen && defaultWarehouse && !selectedWarehouseId) {
      setSelectedWarehouseId(defaultWarehouse.id)
    }
  }, [isOpen, defaultWarehouse, selectedWarehouseId])

  // Buscar clientes cuando se escribe en el campo de búsqueda
  const { data: customerSearchResults = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', 'search', customerSearch],
    queryFn: () => customersService.search(customerSearch),
    enabled: isOpen && customerSearch.trim().length >= 2, // Buscar solo si hay 2+ caracteres
    staleTime: 1000 * 30, // 30 segundos de cache
  })

    // Limpiar campos cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setCustomerName('')
      setCustomerDocumentId('')
      setCustomerPhone('')
      setCustomerNote('')
      setSelectedCustomerId(null)
      setCustomerSearch('')
      setShowCustomerResults(false)
      setError('')
      setReceivedUsd(0)
      setGiveChangeInBs(false)
      setReceivedBs(0)
      setSelectedInvoiceSeriesId(null)
      setSelectedPriceListId(null)
      setSelectedPromotionId(null)
      setPromotionCode('')
      setSelectedWarehouseId(null)
      setSelectedSerials({})
      setSerialSelectorItem(null)
    }
  }, [isOpen])

  // Cuando cambia el método de pago, resetear los montos recibidos
  useEffect(() => {
    if (selectedMethod === 'CASH_USD') {
      setReceivedBs(0)
      // Prellenar con el total exacto
      setReceivedUsd((prev) => (prev === 0 ? total.usd : prev))
    } else if (selectedMethod === 'CASH_BS') {
      setReceivedUsd(0)
      setGiveChangeInBs(false)
      // Prellenar con el total en Bs según la tasa
      const defaultBs = Math.round(total.usd * exchangeRate * 100) / 100
      setReceivedBs((prev) => (prev === 0 ? defaultBs : prev))
    } else {
      setReceivedUsd(0)
      setGiveChangeInBs(false)
      setReceivedBs(0)
    }
  }, [selectedMethod, total.usd, exchangeRate])

  // Cerrar resultados al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Seleccionar cliente de los resultados
  const handleSelectCustomer = (customer: { id: string; name: string; document_id: string | null; phone: string | null; note: string | null }) => {
    setSelectedCustomerId(customer.id)
    setCustomerName(customer.name)
    setCustomerDocumentId(customer.document_id || '')
    setCustomerPhone(customer.phone || '')
    setCustomerNote(customer.note || '')
    setCustomerSearch(customer.name)
    setShowCustomerResults(false)
    setError('')
  }

  // Calcular totales según la tasa de cambio
  // Arriba: Total USD + Equivalente en Bs (USD * tasa)
  // Abajo: Total Bs según tasa (USD * tasa) + Equivalente en USD (Bs / tasa)
  const calculatedTotal = {
    // Total USD original
    usd: total.usd,
    // Equivalente en Bs según la tasa (USD * tasa)
    bsFromUsd: total.usd * exchangeRate,
    // Total Bs según la tasa (igual al equivalente de arriba)
    bsFromTasa: total.usd * exchangeRate,
    // Equivalente en USD del total Bs calculado (Bs / tasa = USD)
    usdFromBsCalculado: exchangeRate > 0 ? (total.usd * exchangeRate) / exchangeRate : total.usd,
  }

  // Calcular cambio cuando se paga con USD físico
  const changeUsd = receivedUsd > 0 && receivedUsd >= total.usd 
    ? Math.round((receivedUsd - total.usd) * 100) / 100 
    : 0
  
  // Calcular cambio en Bs cuando se paga con USD físico (cambio en Bs)
  const roundedChangeResultUsd = giveChangeInBs && changeUsd > 0 && exchangeRate > 0
    ? calculateRoundedChange(changeUsd, exchangeRate)
    : { changeBs: 0, breakdown: {}, breakdownFormatted: '' }
  
  // Calcular cambio cuando se paga con Bs físico
  const totalBs = total.usd * exchangeRate
  const changeBsRaw = receivedBs > 0 && receivedBs >= totalBs
    ? Math.round((receivedBs - totalBs) * 100) / 100
    : 0
  
  // Redondear el cambio en Bs según denominaciones (favoreciendo al POS)
  const roundedChangeBs = changeBsRaw > 0 
    ? roundToNearestDenomination(changeBsRaw)
    : 0
  
  // Desglose del cambio en Bs
  const changeBsBreakdown = roundedChangeBs > 0 
    ? calculateChange(roundedChangeBs) 
    : {}
  const changeBsBreakdownFormatted = Object.keys(changeBsBreakdown).length > 0
    ? formatChangeBreakdown(changeBsBreakdown)
    : ''
  
  // Para USD con cambio en Bs
  const changeBsFromUsd = roundedChangeResultUsd.changeBs
  const changeBreakdownFormattedFromUsd = roundedChangeResultUsd.breakdownFormatted
  
  // Calcular excedente para USD con cambio en Bs (diferencia entre cambio exacto y redondeado)
  const changeBsExactFromUsd = giveChangeInBs && changeUsd > 0 
    ? Math.round(changeUsd * exchangeRate * 100) / 100 
    : 0
  const excessFromUsd = changeBsExactFromUsd > 0 && changeBsFromUsd > 0
    ? Math.round((changeBsExactFromUsd - changeBsFromUsd) * 100) / 100
    : 0
  
  // Calcular excedente para CASH_BS (diferencia entre cambio exacto y redondeado)
  // Si el cambio es menor a 5, roundedChangeBs será 0, pero aún hay excedente
  const excessFromBs = changeBsRaw > 0
    ? Math.round((changeBsRaw - roundedChangeBs) * 100) / 100
    : 0

  if (!isOpen) return null

  const handleConfirm = () => {
    // Validación: Si hay nombre, la cédula es obligatoria
    if (customerName.trim() && !customerDocumentId.trim()) {
      setError('Si proporcionas el nombre del cliente, la cédula es obligatoria')
      return
    }

    // Validación FIAO: requiere información del cliente
    if (selectedMethod === 'FIAO' && !customerName.trim() && !customerDocumentId.trim()) {
      setError('Para ventas FIAO debes ingresar al menos el nombre y la cédula del cliente')
      return
    }

    // Validación CASH_USD: verificar que el monto recibido sea suficiente
    if (selectedMethod === 'CASH_USD' && receivedUsd < total.usd) {
      setError(`El monto recibido ($${receivedUsd.toFixed(2)}) debe ser mayor o igual al total ($${total.usd.toFixed(2)})`)
      return
    }

    // Validación de topes de métodos de pago
    if (paymentConfigs) {
      const config = paymentConfigs.find((c) => c.method === selectedMethod)
      
      if (config) {
        // Verificar si el método está habilitado
        if (!config.enabled) {
          setError(`El método de pago ${selectedMethod} está deshabilitado`)
          return
        }

        // Validar topes en Bs
        if (config.min_amount_bs !== null && total.bs < config.min_amount_bs) {
          setError(
            `El monto mínimo para ${selectedMethod} es ${Number(config.min_amount_bs).toFixed(2)} Bs. Total actual: ${total.bs.toFixed(2)} Bs`
          )
          return
        }
        if (config.max_amount_bs !== null && total.bs > config.max_amount_bs) {
          setError(
            `El monto máximo para ${selectedMethod} es ${Number(config.max_amount_bs).toFixed(2)} Bs. Total actual: ${total.bs.toFixed(2)} Bs`
          )
          return
        }

        // Validar topes en USD
        if (config.min_amount_usd !== null && total.usd < config.min_amount_usd) {
          setError(
            `El monto mínimo para ${selectedMethod} es $${Number(config.min_amount_usd).toFixed(2)} USD. Total actual: $${total.usd.toFixed(2)} USD`
          )
          return
        }
        if (config.max_amount_usd !== null && total.usd > config.max_amount_usd) {
          setError(
            `El monto máximo para ${selectedMethod} es $${Number(config.max_amount_usd).toFixed(2)} USD. Total actual: $${total.usd.toFixed(2)} USD`
          )
          return
        }
      }
    }

    // Validación de modo caja rápida
    if (fastCheckoutConfig?.enabled) {
      // Validar límite de items
      const totalItems = items.reduce((sum, item) => sum + item.qty, 0)
      if (totalItems > fastCheckoutConfig.max_items) {
        setError(
          `El modo caja rápida permite máximo ${fastCheckoutConfig.max_items} items. Total actual: ${totalItems} items`
        )
        return
      }

      // Validar descuentos
      if (!fastCheckoutConfig.allow_discounts) {
        const hasDiscounts = items.some(
          (item) => (item.discount_bs && item.discount_bs > 0) || (item.discount_usd && item.discount_usd > 0)
        )
        if (hasDiscounts) {
          setError('El modo caja rápida no permite descuentos')
          return
        }
      }

      // Validar selección de cliente
      if (!fastCheckoutConfig.allow_customer_selection) {
        if (selectedCustomerId || customerName.trim() || customerDocumentId.trim()) {
          setError('El modo caja rápida no permite seleccionar cliente')
          return
        }
      }

      // Aplicar método de pago por defecto si está configurado
      if (fastCheckoutConfig.default_payment_method && selectedMethod !== fastCheckoutConfig.default_payment_method) {
        // Solo mostrar advertencia, no bloquear
        // El backend también validará esto
      }
    }

    // Aplicar método de pago por defecto del modo rápido si está configurado
    let finalPaymentMethod = selectedMethod
    if (fastCheckoutConfig?.enabled && fastCheckoutConfig.default_payment_method) {
      finalPaymentMethod = fastCheckoutConfig.default_payment_method as any
    }

    // Determinar currency basado en el método de pago
    let currency: 'BS' | 'USD' | 'MIXED' = 'USD'
    if (finalPaymentMethod === 'CASH_BS' || finalPaymentMethod === 'PAGO_MOVIL' || finalPaymentMethod === 'TRANSFER') {
      currency = 'BS'
    } else if (finalPaymentMethod === 'CASH_USD') {
      currency = 'USD'
    }

    // Preparar información de pago en efectivo USD
    // IMPORTANTE: Solo enviamos change_bs si es > 0 (redondeado)
    // Si es 0, no se envía, y el backend NO descuenta nada (excedente a favor del POS)
    let cashPayment: { received_usd: number; change_bs?: number } | undefined = undefined
    if (finalPaymentMethod === 'CASH_USD' && receivedUsd > 0) {
      cashPayment = {
        received_usd: Math.round(receivedUsd * 100) / 100,
      }
      
      // Solo incluir change_bs si es mayor a 0 (cambio redondeado)
      // Si es 0, el excedente queda a favor del POS y NO se descuenta de la caja
      if (giveChangeInBs && changeBsFromUsd > 0) {
        cashPayment.change_bs = Math.round(changeBsFromUsd * 100) / 100
      }
    }

    // Preparar información de pago en efectivo Bs
    // IMPORTANTE: Solo enviamos change_bs si es > 0 (redondeado)
    // Si es 0, no se envía, y el backend NO descuenta nada (excedente a favor del POS)
    let cashPaymentBs: { received_bs: number; change_bs?: number } | undefined = undefined
    if (finalPaymentMethod === 'CASH_BS' && receivedBs > 0) {
      cashPaymentBs = {
        received_bs: Math.round(receivedBs * 100) / 100,
      }
      
      // Solo incluir change_bs si es mayor a 0 (cambio redondeado)
      // Si es 0, el excedente queda a favor del POS y NO se descuenta de la caja
      if (roundedChangeBs > 0) {
        cashPaymentBs.change_bs = Math.round(roundedChangeBs * 100) / 100
      }
    }

    // Verificar si hay productos que requieren seriales
    // Por ahora, omitimos la verificación automática y permitimos que el usuario seleccione seriales opcionalmente
    // En una implementación completa, verificaríamos con la API si el producto tiene seriales disponibles

    onConfirm({
      payment_method: finalPaymentMethod,
      currency,
      exchange_rate: exchangeRate,
      cash_payment: cashPayment,
      cash_payment_bs: cashPaymentBs,
      customer_id: selectedCustomerId || undefined,
      customer_name: customerName.trim() || undefined,
      customer_document_id: customerDocumentId.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      customer_note: customerNote.trim() || undefined,
      serials: Object.keys(selectedSerials).length > 0 ? selectedSerials : undefined,
      invoice_series_id: selectedInvoiceSeriesId,
      price_list_id: selectedPriceListId,
      promotion_id: selectedPromotionId,
      warehouse_id: selectedWarehouseId,
    })
    setError('')
  }

  // Handler para buscar promoción por código
  const handlePromotionCodeSearch = async () => {
    if (!promotionCode.trim()) {
      setError('Ingresa un código de promoción')
      return
    }

    try {
      const promotion = await promotionsService.getByCode(promotionCode.trim().toUpperCase())
      setSelectedPromotionId(promotion.id)
      setPromotionCode('')
      setError('')
    } catch (error: any) {
      if (error.response?.status === 404) {
        setError('Promoción no encontrada')
      } else {
        setError('Error al buscar promoción')
      }
    }
  }

  const handleSerialSelect = (serialNumbers: string[]) => {
    if (serialSelectorItem) {
      setSelectedSerials({
        ...selectedSerials,
        [serialSelectorItem.productId]: serialNumbers,
      })
      setSerialSelectorItem(null)
    }
  }

  const methods = [
    { id: 'CASH_USD', label: 'Efectivo USD', icon: Banknote, color: 'text-success' },
    { id: 'CASH_BS', label: 'Efectivo Bs', icon: Banknote, color: 'text-success' },
    { id: 'PAGO_MOVIL', label: 'Pago Móvil', icon: Wallet, color: 'text-info' },
    { id: 'TRANSFER', label: 'Transferencia', icon: Wallet, color: 'text-primary' },
    { id: 'OTHER', label: 'Otro', icon: CreditCard, color: 'text-muted-foreground' },
    { id: 'FIAO', label: 'FIAO', icon: User, color: 'text-warning' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1 sm:p-4">
      <Card className="max-w-md w-full h-[85vh] sm:h-[90vh] flex flex-col border border-border overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between z-10 rounded-t-lg">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Procesar Venta</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <CardContent className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {/* Resumen */}
          <Card className="border border-border">
            <CardContent className="p-3 sm:p-4">
              <h3 className="font-semibold text-foreground mb-3">Resumen de la venta</h3>
            <div className="space-y-3 text-sm">
              {/* Lista de productos */}
                <div className="h-24 sm:h-28">
                  <ScrollArea className="h-full">
                    <div>
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex justify-between items-start pb-2",
                            index < items.length - 1 && "border-b border-border mb-2"
                          )}
                        >
                    <div className="flex-1 min-w-0 mr-2">
                            <p className="font-medium text-foreground truncate" title={item.product_name}>
                              {item.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                        ${Number(item.unit_price_usd).toFixed(2)} c/u
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-foreground">x{item.qty}</p>
                            <p className="text-xs text-muted-foreground">
                        ${(item.qty * Number(item.unit_price_usd)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                    </div>
                  </ScrollArea>
              </div>
              
              {/* Resumen de cantidades */}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground font-medium">Total Items:</span>
                  <span className="font-semibold text-foreground">
                  {items.reduce((sum, item) => sum + item.qty, 0)} unidades
                </span>
              </div>
                <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-base font-semibold mb-1">
                    <span className="text-foreground">Total USD:</span>
                    <span className="text-foreground">${calculatedTotal.usd.toFixed(2)}</span>
                </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Equivalente en Bs (tasa {exchangeRate.toFixed(2)}):</span>
                  <span>Bs. {calculatedTotal.bsFromUsd.toFixed(2)}</span>
                </div>
              </div>
                <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-base font-semibold mb-1">
                    <span className="text-foreground">Total Bs (tasa {exchangeRate.toFixed(2)}):</span>
                    <span className="text-foreground">Bs. {calculatedTotal.bsFromTasa.toFixed(2)}</span>
                </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Equivalente en USD:</span>
                  <span>${calculatedTotal.usdFromBsCalculado.toFixed(2)}</span>
                </div>
              </div>
            </div>
            </CardContent>
          </Card>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Método de pago
            </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {methods.map((method) => {
                const Icon = method.icon
                const isSelected = selectedMethod === method.id
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedMethod(method.id as any)
                      setError('')
                    }}
                    disabled={(() => {
                      const config = paymentConfigs?.find((c) => c.method === method.id)
                      return config ? !config.enabled : false
                    })()}
                    className={cn(
                      "p-3 border rounded-lg transition-all",
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50',
                      (() => {
                        const config = paymentConfigs?.find((c) => c.method === method.id)
                        return config && !config.enabled ? 'opacity-50 cursor-not-allowed' : ''
                      })()
                    )}
                  >
                    <Icon className={cn(
                      "w-5 h-5 mx-auto mb-2",
                      isSelected ? method.color : 'text-muted-foreground'
                    )} />
                    <p className={cn(
                      "text-xs font-medium",
                      isSelected ? 'text-primary' : 'text-foreground'
                    )}>
                      {method.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Captura de efectivo USD con cálculo de cambio */}
          {selectedMethod === 'CASH_USD' && (
            <Card className="border border-border bg-success/5">
              <CardContent className="p-4 space-y-4">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-success mr-2" />
                <h3 className="text-sm font-semibold text-foreground">Pago en Efectivo USD</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Monto Recibido (USD) <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-semibold z-10">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={total.usd}
                    value={receivedUsd || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      setReceivedUsd(value)
                      setError('')
                    }}
                    className="pl-8 pr-4 py-2.5 text-lg font-semibold"
                    placeholder={total.usd.toFixed(2)}
                    disabled={isLoading}
                  />
                </div>
                {receivedUsd > 0 && receivedUsd < total.usd && (
                  <p className="text-xs text-destructive mt-1">
                    El monto debe ser al menos ${total.usd.toFixed(2)}
                  </p>
                )}
              </div>

              {changeUsd > 0 && (
                <div className="space-y-3">
                  <Card className="border border-border">
                    <CardContent className="p-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-foreground">Cambio en USD:</span>
                        <span className="text-lg font-bold text-success">
                        ${changeUsd.toFixed(2)}
                      </span>
                    </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="giveChangeInBs"
                      checked={giveChangeInBs}
                      onChange={(e) => {
                        setGiveChangeInBs(e.target.checked)
                        setError('')
                      }}
                      className="w-4 h-4 text-success border-border rounded focus:ring-primary"
                      disabled={isLoading}
                    />
                    <label htmlFor="giveChangeInBs" className="ml-2 text-sm font-medium text-foreground">
                      Dar cambio en Bolívares (usando tasa BCV)
                    </label>
                  </div>

                  {giveChangeInBs && changeBsFromUsd > 0 && (
                    <Card className="border border-border bg-info/5">
                      <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground">Cambio en Bs:</span>
                        <span className="text-xl font-bold text-info">
                          {changeBsFromUsd.toFixed(2)} Bs
                        </span>
                      </div>
                      {excessFromUsd > 0 && excessFromUsd <= 5 && (
                        <Card className="border border-warning/50 bg-warning/5">
                          <CardContent className="p-2">
                            <p className="text-xs text-warning-foreground font-medium">
                            💡 Excedente mínimo de {excessFromUsd.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                          </p>
                          </CardContent>
                        </Card>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1 text-foreground">Desglose por denominaciones:</p>
                        <p className="text-foreground">{changeBreakdownFormattedFromUsd || 'Sin desglose disponible'}</p>
                        <p className="mt-2">
                          Calculado: ${changeUsd.toFixed(2)} USD × {exchangeRate.toFixed(2)} (tasa BCV) = {changeBsFromUsd.toFixed(2)} Bs
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Captura de efectivo Bs con cálculo de cambio */}
          {selectedMethod === 'CASH_BS' && (
            <Card className="border border-border bg-success/5">
              <CardContent className="p-4 space-y-4">
              <div className="flex items-center mb-3">
                  <Calculator className="w-5 h-5 text-success mr-2" />
                  <h3 className="text-sm font-semibold text-foreground">Pago en Efectivo Bs</h3>
              </div>

              <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Monto Recibido (Bs) <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-semibold z-10">Bs.</span>
                    <Input
                    type="number"
                    step="0.01"
                    min={totalBs}
                    value={receivedBs || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      setReceivedBs(value)
                      setError('')
                    }}
                      className="pl-12 pr-4 py-2.5 text-lg font-semibold"
                    placeholder={totalBs.toFixed(2)}
                    disabled={isLoading}
                  />
                </div>
                {receivedBs > 0 && receivedBs < totalBs && (
                    <p className="text-xs text-destructive mt-1">
                    El monto debe ser al menos Bs. {totalBs.toFixed(2)}
                  </p>
                )}
              </div>

              {changeBsRaw > 0 && (
                  <Card className="border border-border bg-info/5">
                    <CardContent className="p-4 space-y-2">
                  {roundedChangeBs > 0 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground">Cambio en Bs (redondeado):</span>
                        <span className="text-xl font-bold text-info">
                          {roundedChangeBs.toFixed(2)} Bs
                        </span>
                      </div>
                      {excessFromBs > 0 && excessFromBs <= 5 && (
                        <Card className="border border-warning/50 bg-warning/5">
                          <CardContent className="p-2">
                            <p className="text-xs text-warning-foreground font-medium">
                            💡 Excedente mínimo de {excessFromBs.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                          </p>
                          </CardContent>
                        </Card>
                      )}
                      {changeBsRaw !== roundedChangeBs && excessFromBs > 5 && (
                        <div className="text-xs text-warning mb-2">
                          Cambio exacto: {changeBsRaw.toFixed(2)} Bs → Redondeado a: {roundedChangeBs.toFixed(2)} Bs (favorece al POS)
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1 text-foreground">Desglose por denominaciones:</p>
                        <p className="text-foreground">{changeBsBreakdownFormatted || 'Sin desglose disponible'}</p>
                      </div>
                    </>
                  ) : (
                    // Cuando el cambio es menor a 5 y se redondea a 0
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-foreground">Cambio exacto:</span>
                        <span className="text-lg font-bold text-info">
                          {changeBsRaw.toFixed(2)} Bs
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        No se dará cambio (menor a la menor denominación común)
                      </div>
                      {excessFromBs > 0 && excessFromBs <= 5 && (
                        <Card className="border border-warning/50 bg-warning/5">
                          <CardContent className="p-2">
                            <p className="text-xs text-warning-foreground font-medium">
                            💡 Excedente mínimo de {excessFromBs.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                          </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                    </CardContent>
                  </Card>
              )}
              </CardContent>
            </Card>
          )}

          {/* Serie de Factura (Opcional) */}
          {invoiceSeries && invoiceSeries.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Serie de Factura (Opcional)
              </label>
              <Select
                value={selectedInvoiceSeriesId || 'default'}
                onValueChange={(value) => {
                  setSelectedInvoiceSeriesId(value === 'default' ? null : value)
                  setError('')
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usar serie por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Usar serie por defecto</SelectItem>
                  {invoiceSeries
                    .filter((s) => s.is_active)
                    .map((serie) => (
                      <SelectItem key={serie.id} value={serie.id}>
                        {serie.name} ({serie.series_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Si no se selecciona, se usará la serie por defecto activa
              </p>
            </div>
          )}

          {/* Lista de Precio (Opcional) */}
          {priceLists && priceLists.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Lista de Precio (Opcional)
              </label>
              <Select
                value={selectedPriceListId || 'default'}
                onValueChange={(value) => {
                  setSelectedPriceListId(value === 'default' ? null : value)
                  setError('')
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usar lista por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Usar lista por defecto</SelectItem>
                  {priceLists
                    .filter((list) => list.is_active)
                    .map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} {list.is_default && '(Por defecto)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Si no se selecciona, se usará la lista por defecto activa
              </p>
            </div>
          )}

          {/* Promoción (Opcional) */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Promoción (Opcional)
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={promotionCode}
                  onChange={(e) => {
                    setPromotionCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  placeholder="Código de promoción (ej: DESC20)"
                  className="flex-1"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handlePromotionCodeSearch()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePromotionCodeSearch}
                  disabled={isLoading || !promotionCode.trim()}
                >
                  Buscar
                </Button>
              </div>
              {activePromotions && activePromotions.length > 0 && (
                <Select
                  value={selectedPromotionId || 'none'}
                  onValueChange={(value) => {
                    setSelectedPromotionId(value === 'none' ? null : value)
                    setError('')
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar promoción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin promoción</SelectItem>
                    {activePromotions.map((promotion) => (
                      <SelectItem key={promotion.id} value={promotion.id}>
                        {promotion.name} {promotion.code && `(${promotion.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedPromotionId && activePromotions && (
                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const promotion = activePromotions.find((p) => p.id === selectedPromotionId)
                    if (!promotion) return null
                    return (
                      <div className="p-2 bg-primary/5 rounded border border-primary/20">
                        <p className="font-medium text-foreground">{promotion.name}</p>
                        {promotion.description && (
                          <p className="text-muted-foreground mt-1">{promotion.description}</p>
                        )}
                        {promotion.promotion_type === 'percentage' && promotion.discount_percentage && (
                          <p className="text-primary font-semibold mt-1">
                            Descuento: {promotion.discount_percentage}%
                          </p>
                        )}
                        {promotion.promotion_type === 'fixed_amount' && (
                          <p className="text-primary font-semibold mt-1">
                            Descuento: {promotion.discount_amount_usd ? `$${promotion.discount_amount_usd} USD` : `Bs. ${promotion.discount_amount_bs}`}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Bodega (Opcional) */}
          {warehouses.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Bodega de Venta (Opcional)
              </label>
              <Select
                value={selectedWarehouseId || 'default'}
                onValueChange={(value) => {
                  setSelectedWarehouseId(value === 'default' ? null : value)
                  setError('')
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usar bodega por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Usar bodega por defecto</SelectItem>
                  {warehouses
                    .filter((w) => w.is_active)
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} {w.is_default && '(Por defecto)'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Si no se selecciona, se usará la bodega por defecto para descontar el stock
              </p>
            </div>
          )}

          {/* Tasa de cambio */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Tasa de Cambio (Bs/USD)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0
                  setExchangeRate(rate)
                  setError('')
                }}
                className="w-full px-3 sm:px-4 py-2 text-base sm:text-lg"
                placeholder="36.00"
                disabled={isLoadingBCV}
              />
              {isLoadingBCV && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-muted-foreground">Obteniendo...</span>
                </div>
              )}
              {!isLoadingBCV && bcvRateData?.available && bcvRateData?.rate && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-success font-medium">
                    ✓ Tasa BCV: {bcvRateData.rate}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoadingBCV
                ? 'Obteniendo tasa oficial del BCV...'
                : bcvRateData?.available && bcvRateData?.rate
                  ? 'Tasa obtenida automáticamente del BCV. Puede ajustarla si lo desea.'
                  : 'Tasa de cambio oficial del BCV. Usada para calcular totales mixtos'}
            </p>
          </div>

          {/* Información del Cliente (Opcional para todas las ventas) */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-foreground">
                Información del Cliente (Opcional)
              </label>
              {selectedMethod === 'FIAO' && (
                <span className="text-xs text-warning font-medium">Requerido para FIAO</span>
              )}
            </div>
            <div className="space-y-3">
              {/* Búsqueda de cliente existente */}
              <div className="relative" ref={customerSearchRef}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Buscar Cliente (por nombre o cédula)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setShowCustomerResults(e.target.value.trim().length >= 2)
                      if (!e.target.value.trim()) {
                        // Si se borra la búsqueda, limpiar cliente seleccionado
                        setSelectedCustomerId(null)
                        setCustomerName('')
                        setCustomerDocumentId('')
                        setCustomerPhone('')
                        setCustomerNote('')
                      }
                      setError('')
                    }}
                    placeholder="Escribe nombre o cédula para buscar..."
                    className="pl-10 pr-3 sm:pl-10 sm:pr-4 py-2 text-sm"
                  />
                </div>
                {/* Resultados de búsqueda */}
                {showCustomerResults && customerSearch.trim().length >= 2 && (
                  <Card className="absolute z-50 w-full mt-1 border border-border shadow-lg max-h-48">
                    <CardContent className="p-0">
                      <ScrollArea className="h-full max-h-48">
                        <div>
                    {isLoadingCustomers ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                        Buscando...
                      </div>
                    ) : customerSearchResults.length === 0 ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                        No se encontraron clientes
                      </div>
                    ) : (
                      <div className="py-1">
                              {customerSearchResults.map((customer, index) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                                    selectedCustomerId === customer.id && 'bg-accent',
                                    index > 0 && "border-t border-border"
                                  )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground truncate">{customer.name}</p>
                                {customer.document_id && (
                                        <p className="text-xs text-muted-foreground">CI: {customer.document_id}</p>
                                )}
                                {customer.phone && (
                                        <p className="text-xs text-muted-foreground">Tel: {customer.phone}</p>
                                )}
                              </div>
                              {selectedCustomerId === customer.id && (
                                      <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Campos de cliente (se llenan automáticamente o manualmente) */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nombre {customerName.trim() && <span className="text-destructive">*</span>}
                </label>
                <Input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value)
                    if (selectedCustomerId) {
                      // Si se modifica manualmente, deseleccionar cliente
                      setSelectedCustomerId(null)
                      setCustomerSearch('')
                    }
                    setError('')
                  }}
                  placeholder="Nombre completo del cliente"
                  className="w-full px-3 sm:px-4 py-2 text-sm"
                  required={selectedMethod === 'FIAO'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Cédula de Identidad {customerName.trim() && <span className="text-destructive">*</span>}
                </label>
                <Input
                  type="text"
                  value={customerDocumentId}
                  onChange={(e) => {
                    setCustomerDocumentId(e.target.value)
                    if (selectedCustomerId) {
                      // Si se modifica manualmente, deseleccionar cliente
                      setSelectedCustomerId(null)
                      setCustomerSearch('')
                    }
                    setError('')
                  }}
                  placeholder="Ej: V-12345678"
                  className="w-full px-3 sm:px-4 py-2 text-sm"
                  required={customerName.trim().length > 0}
                />
                {customerName.trim() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Obligatorio cuando se proporciona el nombre
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Teléfono <span className="text-muted-foreground/70">(Opcional)</span>
                </label>
                <Input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value)
                    setError('')
                  }}
                  placeholder="Ej: 0412-1234567"
                  className="w-full px-3 sm:px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Notas <span className="text-muted-foreground/70">(Opcional)</span>
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => {
                    setCustomerNote(e.target.value)
                    setError('')
                  }}
                  placeholder="Notas adicionales sobre el cliente"
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring resize-none bg-background text-foreground"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMethod === 'FIAO'
                ? 'Los datos del cliente son requeridos para ventas FIAO (nombre y cédula)'
                : 'Opcional: Si proporcionas el nombre, la cédula es obligatoria'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <Card className="border border-destructive/50 bg-destructive/5">
              <CardContent className="p-3">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

        </CardContent>

        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
              disabled={isLoading || items.length === 0 || exchangeRate <= 0}
              className="flex-1"
            >
              {isLoading ? 'Procesando...' : 'Confirmar Venta'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Selector de seriales */}
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
    </div>
  )
}
