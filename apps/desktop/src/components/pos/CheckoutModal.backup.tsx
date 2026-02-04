import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, CreditCard, Wallet, Banknote, User, Search, Check, Calculator, Split, UserPlus, Loader2, ShoppingCart, ShoppingBag } from 'lucide-react'
import toast from '@/lib/toast'
import { CartItem } from '@/stores/cart.store'
import { exchangeService } from '@/services/exchange.service'
import { customersService } from '@/services/customers.service'
import { paymentsService } from '@/services/payments.service'
import { fastCheckoutService } from '@/services/fast-checkout.service'
import { invoiceSeriesService } from '@/services/invoice-series.service'
import { priceListsService } from '@/services/price-lists.service'
import { promotionsService } from '@/services/promotions.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import SerialSelector from '@/components/serials/SerialSelector'
import SplitPaymentManager from './SplitPaymentManager'
import { SplitPaymentItem, PaymentMethod } from '@/types/split-payment.types'

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
  total: { bs: number; usd: number }
  onConfirm: (data: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO' | 'SPLIT'
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
    split_payments?: SplitPaymentForBackend[]
    customer_id?: string
    customer_name?: string
    customer_document_id?: string
    customer_phone?: string
    customer_note?: string
    note?: string // Nota/comentario de la venta
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
  const { user } = useAuth()
  const [selectedMethod, setSelectedMethod] = useState<'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO'>('CASH_USD')
  const [paymentMode, setPaymentMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE')
  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([])
  const [exchangeRate, setExchangeRate] = useState<number>(36) // Tasa de cambio por defecto
  const [customerName, setCustomerName] = useState<string>('')
  const [customerDocumentId, setCustomerDocumentId] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [customerNote, setCustomerNote] = useState<string>('')
  const [saleNote, setSaleNote] = useState<string>('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState<string>('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false)
  const [quickCustomerName, setQuickCustomerName] = useState<string>('')
  const customerSearchRef = useRef<HTMLDivElement>(null)
  const confirmActionRef = useRef<() => void>(() => { })
  const [error, setError] = useState<string>('')
  const queryClient = useQueryClient()

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

  // Obtener todas las tasas disponibles (multi-tasa)
  // Se puede usar en el futuro para mostrar múltiples tasas en la UI
  const { data: _allRatesData } = useQuery({
    queryKey: ['exchange', 'rates'],
    queryFn: () => exchangeService.getAllRates(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    enabled: isOpen,
    refetchOnWindowFocus: false,
  })
  void _allRatesData // Usado para prefetch de tasas multi-moneda

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

  // Detectar si es móvil para usar bottom sheet - inicializar correctamente
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 // lg breakpoint
    }
    return false
  })

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

  // Mutación para crear cliente rápido
  const createCustomerMutation = useMutation({
    mutationFn: (data: { name: string; document_id?: string; phone?: string }) =>
      customersService.create(data),
    onSuccess: (newCustomer) => {
      toast.success('Cliente creado exitosamente')
      // Seleccionar el cliente recién creado
      setSelectedCustomerId(newCustomer.id)
      setCustomerName(newCustomer.name)
      setCustomerDocumentId(newCustomer.document_id || '')
      setCustomerPhone(newCustomer.phone || '')
      // Cerrar el formulario de creación rápida
      setShowQuickCreateCustomer(false)
      setQuickCustomerName('')
      setShowCustomerResults(false)
      // Invalidar cache de clientes
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear cliente')
    },
  })

  // Handler para crear cliente rápido
  const handleQuickCreateCustomer = () => {
    const name = quickCustomerName.trim() || customerSearch.trim()
    if (!name) {
      toast.error('Ingresa un nombre para el cliente')
      return
    }
    createCustomerMutation.mutate({
      name,
      document_id: customerDocumentId.trim() || undefined,
      phone: customerPhone.trim() || undefined,
    })
  }

  // Limpiar campos cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setCustomerName('')
      setCustomerDocumentId('')
      setCustomerPhone('')
      setCustomerNote('')
      setSaleNote('')
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
      // Limpiar estados de pagos divididos
      setPaymentMode('SINGLE')
      setSplitPayments([])
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

  // Detectar si es móvil para usar bottom sheet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
  const getWeightPriceDecimals = (unit?: string | null) => {
    return unit === 'g' || unit === 'oz' ? 4 : 2
  }

  const formatWeightValue = (value: number, unit?: string | null) => {
    const safeUnit = unit || 'kg'
    const decimals = safeUnit === 'g' || safeUnit === 'oz' ? 0 : 3
    const safeValue = Number.isFinite(value) ? value : 0
    const fixed = safeValue.toFixed(decimals)
    const trimmed = fixed.replace(/\.?0+$/, '')
    return `${trimmed} ${safeUnit}`
  }

  const totalUnits = items.reduce(
    (sum, item) => sum + (item.is_weight_product ? 0 : item.qty),
    0
  )
  const weightLineItems = items.filter((item) => item.is_weight_product).length
  const totalItemsLabel =
    weightLineItems > 0
      ? totalUnits > 0
        ? `${totalUnits} unidades + ${weightLineItems} por peso`
        : `${weightLineItems} por peso`
      : `${totalUnits} unidades`

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

  // ============================================
  // CÁLCULOS PARA PAGOS DIVIDIDOS
  // ============================================

  // Total pagado en USD por pagos divididos
  const splitTotalPaidUsd = splitPayments.reduce((sum, p) => sum + p.amount_usd, 0)
  const splitTotalPaidBs = splitPayments.reduce((sum, p) => sum + p.amount_bs, 0)

  // Restante por pagar
  const splitRemainingUsd = Math.max(0, Math.round((total.usd - splitTotalPaidUsd) * 100) / 100)
  const splitRemainingBs = Math.max(0, Math.round((total.usd * exchangeRate - splitTotalPaidBs) * 100) / 100)

  // ¿Está completo el pago dividido?
  const splitIsComplete = splitRemainingUsd < 0.01

  // Handlers para pagos divididos
  const handleAddSplitPayment = (payment: Omit<SplitPaymentItem, 'id'>) => {
    const newPayment: SplitPaymentItem = {
      ...payment,
      id: crypto.randomUUID(),
    }
    setSplitPayments([...splitPayments, newPayment])
  }

  const handleRemoveSplitPayment = (paymentId: string) => {
    setSplitPayments(splitPayments.filter((p) => p.id !== paymentId))
  }

  const handleUpdateSplitPayment = (paymentId: string, updates: Partial<Omit<SplitPaymentItem, 'id'>>) => {
    setSplitPayments(
      splitPayments.map((p) => (p.id === paymentId ? { ...p, ...updates } : p))
    )
  }

  const handleConfirm = () => {
    if (isLoading || items.length === 0 || exchangeRate <= 0) {
      return
    }
    // Validación: Si hay nombre, la cédula es obligatoria
    if (customerName.trim() && !customerDocumentId.trim()) {
      setError('Si proporcionas el nombre del cliente, la cédula es obligatoria')
      return
    }

    // ⚠️ VALIDACIÓN CRÍTICA FIAO: requiere cliente válido (customer_id O nombre + cédula)
    if (selectedMethod === 'FIAO' && paymentMode === 'SINGLE') {
      const hasCustomerId = !!selectedCustomerId
      const hasCustomerNameAndDoc = !!(customerName.trim() && customerDocumentId.trim())

      if (!hasCustomerId && !hasCustomerNameAndDoc) {
        setError('Las ventas FIAO requieren un cliente. Debes seleccionar un cliente existente o ingresar nombre y cédula para crear uno nuevo.')
        return
      }
    }

    // Validación para modo SPLIT
    if (paymentMode === 'SPLIT') {
      if (splitPayments.length === 0) {
        setError('Debes agregar al menos un método de pago')
        return
      }
      if (!splitIsComplete) {
        setError(`Faltan $${splitRemainingUsd.toFixed(2)} USD por pagar. Agrega más pagos.`)
        return
      }
      if (!isOwner && paymentConfigs) {
        const blocked = splitPayments
          .map((payment) => payment.method)
          .filter((method) =>
            paymentConfigs.find(
              (config) => config.method === method && config.requires_authorization
            )
          )

        if (blocked.length > 0) {
          setError(`Los métodos ${blocked.join(', ')} requieren autorización de owner`)
          return
        }
      }
    }

    // Validación CASH_USD: verificar que el monto recibido sea suficiente (solo en modo SINGLE)
    if (paymentMode === 'SINGLE' && selectedMethod === 'CASH_USD' && receivedUsd < total.usd) {
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
        if (config.requires_authorization && !isOwner) {
          setError(`El método de pago ${selectedMethod} requiere autorización de owner`)
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
      const totalItems = items.reduce(
        (sum, item) => sum + (item.is_weight_product ? 1 : item.qty),
        0
      )
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

    // Preparar información de pago en efectivo USD
    let cashPayment: { received_usd: number; change_bs?: number } | undefined = undefined
    if (finalPaymentMethod === 'CASH_USD' && receivedUsd > 0) {
      cashPayment = {
        received_usd: Math.round(receivedUsd * 100) / 100,
      }

      const rawChangeBs = (receivedUsd * exchangeRate) - (total.usd * exchangeRate)
      if (giveChangeInBs && rawChangeBs > 0) {
        cashPayment.change_bs = Math.round(rawChangeBs * 100) / 100
      }
    }

    // Preparar información de pago en efectivo Bs
    let cashPaymentBs: { received_bs: number; change_bs?: number } | undefined = undefined
    if (finalPaymentMethod === 'CASH_BS' && receivedBs > 0) {
      cashPaymentBs = {
        received_bs: Math.round(receivedBs * 100) / 100,
      }

      const rawChangeBs = receivedBs - (total.usd * exchangeRate)
      if (rawChangeBs > 0) {
        cashPaymentBs.change_bs = Math.round(rawChangeBs * 100) / 100
      }
    }

    // Preparar datos para pagos divididos
    let splitPaymentsForBackend: SplitPaymentForBackend[] | undefined = undefined
    if (paymentMode === 'SPLIT' && splitPayments.length > 0) {
      splitPaymentsForBackend = splitPayments.map((p) => ({
        method: p.method,
        amount_usd: p.amount_usd,
        amount_bs: p.amount_bs,
        reference: p.reference,
        bank_code: p.bank,
        phone: p.phone,
        card_last_4: p.card_last_4,
        note: p.notes,
      }))
    }

    onConfirm({
      payment_method: selectedMethod === 'FIAO' ? 'FIAO' : (paymentMode === 'SPLIT' ? 'SPLIT' : selectedMethod),
      currency: selectedMethod === 'CASH_USD' ? 'USD' : (selectedMethod === 'CASH_BS' ? 'BS' : 'MIXED'),
      exchange_rate: exchangeRate,
      cash_payment: cashPayment,
      cash_payment_bs: cashPaymentBs,
      customer_id: selectedCustomerId || undefined,
      customer_name: customerName || undefined,
      customer_document_id: customerDocumentId || undefined,
      customer_phone: customerPhone || undefined,
      customer_note: customerNote || undefined,
      note: saleNote || undefined,
      split_payments: splitPaymentsForBackend,
      serials: selectedSerials,
      invoice_series_id: selectedInvoiceSeriesId,
      price_list_id: selectedPriceListId,
      promotion_id: selectedPromotionId,
      warehouse_id: selectedWarehouseId
    })

    setError('')
  }


  useEffect(() => {
    confirmActionRef.current = handleConfirm
  }, [handleConfirm])

  // Resetear campos cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setSaleNote('')
      setCustomerNote('')
      setCustomerName('')
      setCustomerDocumentId('')
      setCustomerPhone('')
      setSelectedCustomerId(null)
      setCustomerSearch('')
      setError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      event.preventDefault()
      confirmActionRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

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

  const isOwner = user?.role === 'owner'

  const methodDefinitions = [
    { id: 'CASH_USD', label: 'Efectivo USD', icon: Banknote, color: 'text-success' },
    { id: 'CASH_BS', label: 'Efectivo Bs', icon: Banknote, color: 'text-success' },
    { id: 'PAGO_MOVIL', label: 'Pago Móvil', icon: Wallet, color: 'text-info' },
    { id: 'TRANSFER', label: 'Transferencia', icon: Wallet, color: 'text-primary' },
    { id: 'OTHER', label: 'Otro', icon: CreditCard, color: 'text-muted-foreground' },
    { id: 'FIAO', label: 'FIAO', icon: User, color: 'text-warning' },
  ]

  const methods = [...methodDefinitions].sort((a, b) => {
    const fallbackOrder = (id: string) =>
      methodDefinitions.findIndex((m) => m.id === id) * 10
    const configA = paymentConfigs?.find((config) => config.method === a.id)
    const configB = paymentConfigs?.find((config) => config.method === b.id)
    const orderA =
      configA && typeof configA.sort_order === 'number' && configA.sort_order > 0
        ? configA.sort_order
        : fallbackOrder(a.id)
    const orderB =
      configB && typeof configB.sort_order === 'number' && configB.sort_order > 0
        ? configB.sort_order
        : fallbackOrder(b.id)
    return orderA - orderB
  })

  // Contenido del modal/sheet (reutilizable)
  const modalContent = (
    <>
      {/* Content - Two columns on desktop */}
      <CardContent className="p-3 sm:p-4 lg:p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 sm:space-y-6 lg:space-y-0">
          {/* LEFT COLUMN */}
          <div className="space-y-4 sm:space-y-6">
            {/* Resumen Premium */}
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
                                      getWeightPriceDecimals(item.weight_unit)
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
                                  ? formatWeightValue(
                                    Number(item.qty),
                                    item.weight_unit
                                  )
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
                      {totalItemsLabel}
                    </span>
                  </div>
                  <div className="rounded-lg bg-primary/5 p-3 border border-primary/20">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-foreground font-semibold">Total USD:</span>
                      <span className="text-xl font-bold text-primary tabular-nums">${calculatedTotal.usd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Equivalente en Bs (tasa {exchangeRate.toFixed(2)}):</span>
                      <span className="tabular-nums">Bs. {calculatedTotal.bsFromUsd.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 border border-border/30">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-foreground font-semibold">Total Bs:</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">Bs. {calculatedTotal.bsFromTasa.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tasa: {exchangeRate.toFixed(2)}</span>
                      <span className="tabular-nums">${calculatedTotal.usdFromBsCalculado.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selector de Modo de Pago: SINGLE vs SPLIT */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Modo de pago
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => {
                    setPaymentMode('SINGLE')
                    setError('')
                  }}
                  className={cn(
                    "p-3 border rounded-lg transition-all flex flex-col items-center",
                    paymentMode === 'SINGLE'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <CreditCard className={cn(
                    "w-5 h-5 mb-2",
                    paymentMode === 'SINGLE' ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <p className={cn(
                    "text-xs font-medium",
                    paymentMode === 'SINGLE' ? 'text-primary' : 'text-foreground'
                  )}>
                    Pago Único
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Un solo método</p>
                </button>
                <button
                  onClick={() => {
                    setPaymentMode('SPLIT')
                    setError('')
                  }}
                  className={cn(
                    "p-3 border rounded-lg transition-all flex flex-col items-center",
                    paymentMode === 'SPLIT'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Split className={cn(
                    "w-5 h-5 mb-2",
                    paymentMode === 'SPLIT' ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <p className={cn(
                    "text-xs font-medium",
                    paymentMode === 'SPLIT' ? 'text-primary' : 'text-foreground'
                  )}>
                    Pago Dividido
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Múltiples métodos</p>
                </button>
              </div>
            </div>

            {/* Método de pago único (modo SINGLE) */}
            {paymentMode === 'SINGLE' && (
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
                          if (!config) return false
                          return !config.enabled || (!isOwner && config.requires_authorization)
                        })()}
                        className={cn(
                          "p-3 border rounded-lg transition-all",
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50',
                          (() => {
                            const config = paymentConfigs?.find((c) => c.method === method.id)
                            return config && (!config.enabled || (!isOwner && config.requires_authorization))
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
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
            )}

            {/* Gestor de Pagos Divididos (modo SPLIT) */}
            {paymentMode === 'SPLIT' && (
              <SplitPaymentManager
                payments={splitPayments}
                remainingUsd={splitRemainingUsd}
                remainingBs={splitRemainingBs}
                exchangeRate={exchangeRate}
                isComplete={splitIsComplete}
                onAddPayment={handleAddSplitPayment}
                onRemovePayment={handleRemoveSplitPayment}
                onUpdatePayment={handleUpdateSplitPayment}
              />
            )}

            {/* Captura de efectivo USD con cálculo de cambio (solo modo SINGLE) */}
            {paymentMode === 'SINGLE' && selectedMethod === 'CASH_USD' && (
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
                        inputMode="decimal"
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
                              <Card className="border border-amber-300 bg-amber-50">
                                <CardContent className="p-2">
                                  <p className="text-xs text-amber-800 font-medium">
                                    💡 Excedente mínimo de {excessFromUsd.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                                  </p>
                                </CardContent>
                              </Card>
                            )}
                            <div className="text-xs">
                              <p className="font-medium mb-1 text-slate-700">Desglose por denominaciones:</p>
                              <p className="text-slate-600">{changeBreakdownFormattedFromUsd || 'Sin desglose disponible'}</p>
                              <p className="mt-2 text-slate-500">
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

            {/* Captura de efectivo Bs con cálculo de cambio (solo modo SINGLE) */}
            {paymentMode === 'SINGLE' && selectedMethod === 'CASH_BS' && (
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
                        inputMode="decimal"
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
                              <Card className="border border-amber-300 bg-amber-50">
                                <CardContent className="p-2">
                                  <p className="text-xs text-amber-800 font-medium">
                                    💡 Excedente mínimo de {excessFromBs.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                                  </p>
                                </CardContent>
                              </Card>
                            )}
                            {changeBsRaw !== roundedChangeBs && excessFromBs > 5 && (
                              <div className="text-xs text-amber-600 mb-2">
                                Cambio exacto: {changeBsRaw.toFixed(2)} Bs → Redondeado a: {roundedChangeBs.toFixed(2)} Bs (favorece al POS)
                              </div>
                            )}
                            <div className="text-xs">
                              <p className="font-medium mb-1 text-slate-700">Desglose por denominaciones:</p>
                              <p className="text-slate-600">{changeBsBreakdownFormatted || 'Sin desglose disponible'}</p>
                            </div>
                          </>
                        ) : (
                          // Cuando el cambio es menor a 5 y se redondea a 0
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-slate-700">Cambio exacto:</span>
                              <span className="text-lg font-bold text-info">
                                {changeBsRaw.toFixed(2)} Bs
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mb-2">
                              No se dará cambio (menor a la menor denominación común)
                            </div>
                            {excessFromBs > 0 && excessFromBs <= 5 && (
                              <Card className="border border-amber-300 bg-amber-50">
                                <CardContent className="p-2">
                                  <p className="text-xs text-amber-800 font-medium">
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
          </div>

          {/* RIGHT COLUMN - Tasa + Cliente */}
          <div className="space-y-4 sm:space-y-6">
            {/* Tasa de cambio */}
            <Card className="border border-border">
              <CardContent className="p-3 sm:p-4">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Tasa de Cambio (Bs/USD)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
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
              </CardContent>
            </Card>

            {/* Información del Cliente (Opcional para todas las ventas) */}
            <Card className="border border-border">
              <CardContent className="p-3 sm:p-4">
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
                                <div className="p-3 space-y-2">
                                  <p className="text-center text-sm text-muted-foreground">
                                    No se encontraron clientes
                                  </p>
                                  {/* Botón para crear cliente rápido */}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                                    onClick={() => {
                                      setShowQuickCreateCustomer(true)
                                      setQuickCustomerName(customerSearch.trim())
                                    }}
                                    disabled={createCustomerMutation.isPending}
                                  >
                                    <UserPlus className="w-4 h-4" />
                                    Crear "{customerSearch.trim()}" como nuevo cliente
                                  </Button>
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

                    {/* Mini formulario de creación rápida */}
                    {showQuickCreateCustomer && (
                      <Card className="absolute z-50 w-full mt-1 border border-primary/30 shadow-lg bg-primary/5">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-primary flex items-center gap-2">
                              <UserPlus className="w-4 h-4" />
                              Crear cliente rápido
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setShowQuickCreateCustomer(false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Input
                              type="text"
                              placeholder="Nombre del cliente *"
                              value={quickCustomerName}
                              onChange={(e) => setQuickCustomerName(e.target.value)}
                              className="h-9"
                              autoFocus
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="text"
                                placeholder="Cédula/RIF (opcional)"
                                value={customerDocumentId}
                                onChange={(e) => setCustomerDocumentId(e.target.value)}
                                className="h-9"
                              />
                              <Input
                                type="tel"
                                placeholder="Teléfono (opcional)"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setShowQuickCreateCustomer(false)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1 gap-2"
                              onClick={handleQuickCreateCustomer}
                              disabled={createCustomerMutation.isPending || !quickCustomerName.trim()}
                            >
                              {createCustomerMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Creando...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  Crear y seleccionar
                                </>
                              )}
                            </Button>
                          </div>
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
              </CardContent>
            </Card>

            {/* Notas de la venta */}
            <Card>
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Notas de la venta <span className="text-muted-foreground/70">(Opcional)</span>
                  </label>
                  <textarea
                    value={saleNote}
                    onChange={(e) => {
                      setSaleNote(e.target.value)
                      setError('')
                    }}
                    placeholder="Notas adicionales sobre esta venta (ej: entrega especial, instrucciones, etc.)"
                    rows={2}
                    className="w-full px-3 sm:px-4 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring resize-none bg-background text-foreground"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <Card className="border border-destructive/50 bg-destructive/5">
                <CardContent className="p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </CardContent>

      {/* Footer Premium */}
      <div className="flex-shrink-0 border-t border-border/40 bg-gradient-to-r from-muted/20 via-background to-muted/20 px-4 sm:px-5 lg:px-6 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row gap-3 lg:max-w-md lg:ml-auto">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11 border-border/60 hover:bg-muted/50 hover:border-border transition-all"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || items.length === 0 || exchangeRate <= 0}
            className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Confirmar Venta</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </>
  )

  // No renderizar si no está abierto
  if (!isOpen) return null

  // Usar Sheet en móvil, modal en desktop
  if (isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}>
          <SheetContent
            side="bottom"
            className="h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0 z-[100]"
            overlayClassName="z-[100]"
          >
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>Procesar Venta</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              {modalContent}
            </div>
          </SheetContent>
        </Sheet>

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
      </>
    )
  }

  // Modal en desktop
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-1 sm:p-4 z-[100]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      >
        <Card
          className="w-full max-w-md lg:max-w-4xl xl:max-w-5xl h-[85vh] sm:h-[90vh] lg:h-[85vh] flex flex-col border border-border overflow-hidden relative z-[101]"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {/* Header Premium */}
          <div className="sticky top-0 bg-gradient-to-r from-primary/5 via-background to-primary/5 backdrop-blur-xl border-b border-border/40 px-4 sm:px-5 lg:px-6 py-4 sm:py-5 flex items-center justify-between z-10 rounded-t-lg shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 backdrop-blur-sm">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Procesar Venta</h2>
                <p className="text-xs text-muted-foreground">Completa los datos de pago</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {modalContent}
          </div>
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
        </Card>
      </div>
    </>
  )
}
