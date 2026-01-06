import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, CreditCard, Wallet, Banknote, User, Search, Check, Calculator } from 'lucide-react'
import { CartItem } from '@/stores/cart.store'
import { exchangeService } from '@/services/exchange.service'
import { customersService } from '@/services/customers.service'
import { calculateRoundedChange, roundToNearestDenomination, calculateChange, formatChangeBreakdown } from '@/utils/vzla-denominations'

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

  // Obtener tasa BCV automáticamente cuando se abre el modal
  const { data: bcvRateData, isLoading: isLoadingBCV } = useQuery({
    queryKey: ['bcvRate'],
    queryFn: () => exchangeService.getBCVRate(),
    enabled: isOpen, // Solo obtener cuando el modal está abierto
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    refetchOnWindowFocus: false,
  })

  // Prellenar la tasa cuando se obtiene del backend
  useEffect(() => {
    if (isOpen && bcvRateData?.available && bcvRateData?.rate) {
      setExchangeRate(bcvRateData.rate)
    }
  }, [isOpen, bcvRateData])

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
    }
  }, [isOpen])

  // Cuando cambia el método de pago, resetear los montos recibidos
  useEffect(() => {
    if (selectedMethod === 'CASH_USD') {
      setReceivedBs(0)
      if (receivedUsd === 0) {
        // Prellenar con el total exacto
        setReceivedUsd(total.usd)
      }
    } else if (selectedMethod === 'CASH_BS') {
      setReceivedUsd(0)
      setGiveChangeInBs(false)
      if (receivedBs === 0) {
        // Prellenar con el total en Bs según la tasa
        setReceivedBs(Math.round(total.usd * exchangeRate * 100) / 100)
      }
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
  const totalBsFromUsd = total.usd * exchangeRate
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
  const changeBreakdownFromUsd = roundedChangeResultUsd.breakdown
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

    // Determinar currency basado en el método de pago
    let currency: 'BS' | 'USD' | 'MIXED' = 'USD'
    if (selectedMethod === 'CASH_BS' || selectedMethod === 'PAGO_MOVIL' || selectedMethod === 'TRANSFER') {
      currency = 'BS'
    } else if (selectedMethod === 'CASH_USD') {
      currency = 'USD'
    }

    // Preparar información de pago en efectivo USD
    // IMPORTANTE: Solo enviamos change_bs si es > 0 (redondeado)
    // Si es 0, no se envía, y el backend NO descuenta nada (excedente a favor del POS)
    let cashPayment: { received_usd: number; change_bs?: number } | undefined = undefined
    if (selectedMethod === 'CASH_USD' && receivedUsd > 0) {
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
    if (selectedMethod === 'CASH_BS' && receivedBs > 0) {
      cashPaymentBs = {
        received_bs: Math.round(receivedBs * 100) / 100,
      }
      
      // Solo incluir change_bs si es mayor a 0 (cambio redondeado)
      // Si es 0, el excedente queda a favor del POS y NO se descuenta de la caja
      if (roundedChangeBs > 0) {
        cashPaymentBs.change_bs = Math.round(roundedChangeBs * 100) / 100
      }
    }

    onConfirm({
      payment_method: selectedMethod,
      currency,
      exchange_rate: exchangeRate,
      cash_payment: cashPayment,
      cash_payment_bs: cashPaymentBs,
      customer_id: selectedCustomerId || undefined,
      customer_name: customerName.trim() || undefined,
      customer_document_id: customerDocumentId.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      customer_note: customerNote.trim() || undefined,
    })
    setError('')
  }

  const methods = [
    { id: 'CASH_USD', label: 'Efectivo USD', icon: Banknote, color: 'text-green-600' },
    { id: 'CASH_BS', label: 'Efectivo Bs', icon: Banknote, color: 'text-green-600' },
    { id: 'PAGO_MOVIL', label: 'Pago Móvil', icon: Wallet, color: 'text-blue-600' },
    { id: 'TRANSFER', label: 'Transferencia', icon: Wallet, color: 'text-purple-600' },
    { id: 'OTHER', label: 'Otro', icon: CreditCard, color: 'text-gray-600' },
    { id: 'FIAO', label: 'FIAO', icon: User, color: 'text-orange-600' },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Procesar Venta</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Resumen */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Resumen de la venta</h3>
            <div className="space-y-3 text-sm">
              {/* Lista de productos */}
              <div className="space-y-2 h-24 sm:h-28 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start pb-2 border-b border-gray-200 last:border-0">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium text-gray-900 truncate" title={item.product_name}>
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        ${Number(item.unit_price_usd).toFixed(2)} c/u
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900">x{item.qty}</p>
                      <p className="text-xs text-gray-500">
                        ${(item.qty * Number(item.unit_price_usd)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Resumen de cantidades */}
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-gray-600 font-medium">Total Items:</span>
                <span className="font-semibold text-gray-900">
                  {items.reduce((sum, item) => sum + item.qty, 0)} unidades
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between text-base font-semibold mb-1">
                  <span>Total USD:</span>
                  <span>${calculatedTotal.usd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Equivalente en Bs (tasa {exchangeRate.toFixed(2)}):</span>
                  <span>Bs. {calculatedTotal.bsFromUsd.toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between text-base font-semibold mb-1">
                  <span>Total Bs (tasa {exchangeRate.toFixed(2)}):</span>
                  <span>Bs. {calculatedTotal.bsFromTasa.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Equivalente en USD:</span>
                  <span>${calculatedTotal.usdFromBsCalculado.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                    className={`
                      p-3 border-2 rounded-lg transition-all
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${isSelected ? method.color : 'text-gray-400'}`} />
                    <p className={`text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                      {method.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Captura de efectivo USD con cálculo de cambio */}
          {selectedMethod === 'CASH_USD' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-sm font-semibold text-green-900">Pago en Efectivo USD</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto Recibido (USD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min={total.usd}
                    value={receivedUsd || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      setReceivedUsd(value)
                      setError('')
                    }}
                    className="w-full pl-8 pr-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-semibold"
                    placeholder={total.usd.toFixed(2)}
                    disabled={isLoading}
                  />
                </div>
                {receivedUsd > 0 && receivedUsd < total.usd && (
                  <p className="text-xs text-red-600 mt-1">
                    El monto debe ser al menos ${total.usd.toFixed(2)}
                  </p>
                )}
              </div>

              {changeUsd > 0 && (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-green-300">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Cambio en USD:</span>
                      <span className="text-lg font-bold text-green-700">
                        ${changeUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="giveChangeInBs"
                      checked={giveChangeInBs}
                      onChange={(e) => {
                        setGiveChangeInBs(e.target.checked)
                        setError('')
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      disabled={isLoading}
                    />
                    <label htmlFor="giveChangeInBs" className="ml-2 text-sm font-medium text-gray-700">
                      Dar cambio en Bolívares (usando tasa BCV)
                    </label>
                  </div>

                  {giveChangeInBs && changeBsFromUsd > 0 && (
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-blue-900">Cambio en Bs:</span>
                        <span className="text-xl font-bold text-blue-700">
                          {changeBsFromUsd.toFixed(2)} Bs
                        </span>
                      </div>
                      {excessFromUsd > 0 && excessFromUsd <= 5 && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-2">
                          <p className="text-xs text-yellow-800 font-medium">
                            💡 Excedente mínimo de {excessFromUsd.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                          </p>
                        </div>
                      )}
                      <div className="text-xs text-blue-700">
                        <p className="font-medium mb-1">Desglose por denominaciones:</p>
                        <p className="text-blue-800">{changeBreakdownFormattedFromUsd || 'Sin desglose disponible'}</p>
                        <p className="text-blue-600 mt-2">
                          Calculado: ${changeUsd.toFixed(2)} USD × {exchangeRate.toFixed(2)} (tasa BCV) = {changeBsFromUsd.toFixed(2)} Bs
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Captura de efectivo Bs con cálculo de cambio */}
          {selectedMethod === 'CASH_BS' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-sm font-semibold text-green-900">Pago en Efectivo Bs</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto Recibido (Bs) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">Bs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min={totalBs}
                    value={receivedBs || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      setReceivedBs(value)
                      setError('')
                    }}
                    className="w-full pl-12 pr-4 py-2.5 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-semibold"
                    placeholder={totalBs.toFixed(2)}
                    disabled={isLoading}
                  />
                </div>
                {receivedBs > 0 && receivedBs < totalBs && (
                  <p className="text-xs text-red-600 mt-1">
                    El monto debe ser al menos Bs. {totalBs.toFixed(2)}
                  </p>
                )}
              </div>

              {changeBsRaw > 0 && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 space-y-2">
                  {roundedChangeBs > 0 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-blue-900">Cambio en Bs (redondeado):</span>
                        <span className="text-xl font-bold text-blue-700">
                          {roundedChangeBs.toFixed(2)} Bs
                        </span>
                      </div>
                      {excessFromBs > 0 && excessFromBs <= 5 && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-2">
                          <p className="text-xs text-yellow-800 font-medium">
                            💡 Excedente mínimo de {excessFromBs.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                          </p>
                        </div>
                      )}
                      {changeBsRaw !== roundedChangeBs && excessFromBs > 5 && (
                        <div className="text-xs text-orange-600 mb-2">
                          Cambio exacto: {changeBsRaw.toFixed(2)} Bs → Redondeado a: {roundedChangeBs.toFixed(2)} Bs (favorece al POS)
                        </div>
                      )}
                      <div className="text-xs text-blue-700">
                        <p className="font-medium mb-1">Desglose por denominaciones:</p>
                        <p className="text-blue-800">{changeBsBreakdownFormatted || 'Sin desglose disponible'}</p>
                      </div>
                    </>
                  ) : (
                    // Cuando el cambio es menor a 5 y se redondea a 0
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-blue-900">Cambio exacto:</span>
                        <span className="text-lg font-bold text-blue-700">
                          {changeBsRaw.toFixed(2)} Bs
                        </span>
                      </div>
                      <div className="text-xs text-blue-600 mb-2">
                        No se dará cambio (menor a la menor denominación común)
                      </div>
                      {excessFromBs > 0 && excessFromBs <= 5 && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-2">
                          <p className="text-xs text-yellow-800 font-medium">
                            💡 Excedente mínimo de {excessFromBs.toFixed(2)} Bs a nuestro favor. Considera dar un dulce como gesto de cortesía.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tasa de cambio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tasa de Cambio (Bs/USD)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0
                  setExchangeRate(rate)
                  setError('')
                }}
                className="w-full px-3 sm:px-4 py-2 text-base sm:text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="36.00"
                disabled={isLoadingBCV}
              />
              {isLoadingBCV && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-gray-500">Obteniendo...</span>
                </div>
              )}
              {!isLoadingBCV && bcvRateData?.available && bcvRateData?.rate && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-xs text-green-600 font-medium">
                    ✓ Tasa BCV: {bcvRateData.rate}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isLoadingBCV
                ? 'Obteniendo tasa oficial del BCV...'
                : bcvRateData?.available && bcvRateData?.rate
                  ? 'Tasa obtenida automáticamente del BCV. Puede ajustarla si lo desea.'
                  : 'Tasa de cambio oficial del BCV. Usada para calcular totales mixtos'}
            </p>
          </div>

          {/* Información del Cliente (Opcional para todas las ventas) */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                Información del Cliente (Opcional)
              </label>
              {selectedMethod === 'FIAO' && (
                <span className="text-xs text-orange-600 font-medium">Requerido para FIAO</span>
              )}
            </div>
            <div className="space-y-3">
              {/* Búsqueda de cliente existente */}
              <div className="relative" ref={customerSearchRef}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Buscar Cliente (por nombre o cédula)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
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
                    className="w-full pl-10 pr-3 sm:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {/* Resultados de búsqueda */}
                {showCustomerResults && customerSearch.trim().length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {isLoadingCustomers ? (
                      <div className="p-3 text-center text-sm text-gray-500">
                        Buscando...
                      </div>
                    ) : customerSearchResults.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">
                        No se encontraron clientes
                      </div>
                    ) : (
                      <div className="py-1">
                        {customerSearchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                              selectedCustomerId === customer.id ? 'bg-blue-100' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                                {customer.document_id && (
                                  <p className="text-xs text-gray-500">CI: {customer.document_id}</p>
                                )}
                                {customer.phone && (
                                  <p className="text-xs text-gray-500">Tel: {customer.phone}</p>
                                )}
                              </div>
                              {selectedCustomerId === customer.id && (
                                <Check className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Campos de cliente (se llenan automáticamente o manualmente) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nombre {customerName.trim() && <span className="text-red-500">*</span>}
                </label>
                <input
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
                  className="w-full px-3 sm:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={selectedMethod === 'FIAO'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cédula de Identidad {customerName.trim() && <span className="text-red-500">*</span>}
                </label>
                <input
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
                  className="w-full px-3 sm:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={customerName.trim().length > 0}
                />
                {customerName.trim() && (
                  <p className="text-xs text-gray-500 mt-1">
                    Obligatorio cuando se proporciona el nombre
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Teléfono <span className="text-gray-400">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value)
                    setError('')
                  }}
                  placeholder="Ej: 0412-1234567"
                  className="w-full px-3 sm:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Notas <span className="text-gray-400">(Opcional)</span>
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => {
                    setCustomerNote(e.target.value)
                    setError('')
                  }}
                  placeholder="Notas adicionales sobre el cliente"
                  rows={2}
                  className="w-full px-3 sm:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedMethod === 'FIAO'
                ? 'Los datos del cliente son requeridos para ventas FIAO (nombre y cédula)'
                : 'Opcional: Si proporcionas el nombre, la cédula es obligatoria'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

        </div>

        <div className="flex-shrink-0 border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg font-semibold text-sm sm:text-base text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || items.length === 0 || exchangeRate <= 0}
              className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {isLoading ? 'Procesando...' : 'Confirmar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
