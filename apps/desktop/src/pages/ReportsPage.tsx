import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronUp,
  Percent,
  Wallet,
} from 'lucide-react'
import { reportsService, SalesByDayReport, TopProduct, DebtSummaryReport } from '@/services/reports.service'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

type DateRange = 'today' | 'week' | 'month' | 'custom'
type WeightUnit = 'kg' | 'g' | 'lb' | 'oz' | null

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  FIAO: 'Fiado',
  SPLIT: 'Mixto',
  OTHER: 'Otro',
  unknown: 'Desconocido',
}

const normalizeWeightToKg = (value: number, unit: WeightUnit) => {
  const safeValue = Number(value || 0)
  switch (unit) {
    case 'g':
      return safeValue / 1000
    case 'lb':
      return safeValue * 0.45359237
    case 'oz':
      return safeValue * 0.028349523125
    case 'kg':
    default:
      return safeValue
  }
}

const formatNumber = (value: number, decimals: number) => {
  const safeValue = Number.isFinite(value) ? value : 0
  const fixed = safeValue.toFixed(decimals)
  return fixed.replace(/\.?0+$/, '')
}

const formatQuantity = (
  value: number,
  isWeightProduct: boolean,
  weightUnit: WeightUnit,
) => {
  if (isWeightProduct) {
    const kgValue = normalizeWeightToKg(value, weightUnit)
    return `${formatNumber(kgValue, 3)} kg`
  }
  return `${formatNumber(value, 0)} unid`
}

const getQuantityMetric = (product: TopProduct) => {
  if (product.is_weight_product) {
    return Number(product.quantity_sold_kg ?? normalizeWeightToKg(product.quantity_sold, product.weight_unit))
  }
  return Number(product.quantity_sold_units ?? product.quantity_sold)
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showDebtors, setShowDebtors] = useState(true)
  const [showProducts, setShowProducts] = useState(true)
  const [showDaily, setShowDaily] = useState(true)

  // Calcular fechas según el rango seleccionado
  const { startDate, endDate } = useMemo(() => {
    const today = new Date()
    let start: Date
    let end: Date = today

    switch (dateRange) {
      case 'today':
        start = today
        break
      case 'week':
        start = startOfWeek(today, { weekStartsOn: 1 })
        break
      case 'month':
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case 'custom':
        start = customStartDate ? new Date(customStartDate) : subDays(today, 7)
        end = customEndDate ? new Date(customEndDate) : today
        break
      default:
        start = today
    }

    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    }
  }, [dateRange, customStartDate, customEndDate])

  // Query: Ventas por día
  const { data: salesReport, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['reports', 'sales-by-day', startDate, endDate],
    queryFn: () => reportsService.getSalesByDay({ start_date: startDate, end_date: endDate }),
  })

  // Query: Top productos
  const { data: topProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['reports', 'top-products', startDate, endDate],
    queryFn: () => reportsService.getTopProducts(10, { start_date: startDate, end_date: endDate }),
  })

  // Query: Resumen de deudas
  const { data: debtSummary, isLoading: loadingDebts } = useQuery({
    queryKey: ['reports', 'debt-summary'],
    queryFn: () => reportsService.getDebtSummary(),
  })

  const isLoading = loadingSales || loadingProducts || loadingDebts

  // Exportar CSV
  const handleExportCSV = async () => {
    try {
      const blob = await reportsService.exportSalesCSV({ start_date: startDate, end_date: endDate })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas-${startDate}-a-${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Archivo CSV descargado')
    } catch (error) {
      toast.error('Error al exportar CSV')
    }
  }

  // Refrescar todos los reportes
  const handleRefresh = () => {
    refetchSales()
    toast.success('Reportes actualizados')
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 mr-2 text-blue-600" />
              Reportes
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Análisis de ventas, productos y deudas
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors touch-manipulation"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isLoading}
              className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors touch-manipulation"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setDateRange('today')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
              dateRange === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setDateRange('week')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
              dateRange === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
              dateRange === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
              dateRange === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Personalizado
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Desde</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hasta</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 text-sm text-gray-600">
          <Calendar className="inline w-4 h-4 mr-1" />
          Período: {format(new Date(startDate), "dd 'de' MMMM", { locale: es })} al{' '}
          {format(new Date(endDate), "dd 'de' MMMM, yyyy", { locale: es })}
        </div>
      </div>

      {/* Resumen Principal de Ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-600">Total Ventas</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">
            {salesReport?.total_sales || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">transacciones</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-600">Ingresos USD</span>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            ${(salesReport?.total_amount_usd || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(salesReport?.total_amount_bs || 0).toFixed(2)} Bs
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-green-700">Ganancia Neta</span>
            <Wallet className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            ${(salesReport?.total_profit_usd || 0).toFixed(2)}
          </p>
          <p className="text-xs text-green-600 mt-1">
            {(salesReport?.total_profit_bs || 0).toFixed(2)} Bs
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-purple-700">Margen</span>
            <Percent className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">
            {(salesReport?.profit_margin || 0).toFixed(1)}%
          </p>
          <p className="text-xs text-purple-600 mt-1">de ganancia</p>
        </div>
      </div>

      {/* Resumen de Costos y Deuda */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-600">Costo Total</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-red-600">
            ${(salesReport?.total_cost_usd || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(salesReport?.total_cost_bs || 0).toFixed(2)} Bs
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-600">Deuda Pendiente</span>
            <AlertCircle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-orange-600">
            ${(debtSummary?.total_pending_usd || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">por cobrar (FIAO)</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-600">Deudas Abiertas</span>
            <Users className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            {(debtSummary?.by_status.open || 0) + (debtSummary?.by_status.partial || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">clientes con deuda</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-600">Ticket Promedio</span>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            ${salesReport && salesReport.total_sales > 0
              ? (salesReport.total_amount_usd / salesReport.total_sales).toFixed(2)
              : '0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">USD por venta</p>
        </div>
      </div>

      {/* Ventas por Método de Pago */}
      {salesReport && Object.keys(salesReport.by_payment_method).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
              Ventas por Método de Pago
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(salesReport.by_payment_method).map(([method, data]) => (
                <div
                  key={method}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-800">
                      {paymentMethodLabels[method] || method}
                    </span>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {data.count} ventas
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>{data.amount_bs.toFixed(2)} Bs</p>
                    <p className="font-medium text-gray-900">${data.amount_usd.toFixed(2)} USD</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resumen de Deudas */}
      {debtSummary && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6">
          <button
            onClick={() => setShowDebtors(!showDebtors)}
            className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-orange-600" />
              Resumen de FIAO / Deudas
            </h2>
            {showDebtors ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showDebtors && (
            <div className="p-4">
              {/* Stats de deudas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500">Total Fiado</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${debtSummary.total_debt_usd.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Total Cobrado</p>
                  <p className="text-lg font-bold text-green-600">
                    ${debtSummary.total_paid_usd.toFixed(2)}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-500">Pendiente</p>
                  <p className="text-lg font-bold text-orange-600">
                    ${debtSummary.total_pending_usd.toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-gray-500">Deudas Abiertas</p>
                  <p className="text-lg font-bold text-blue-600">
                    {debtSummary.by_status.open + debtSummary.by_status.partial}
                  </p>
                </div>
              </div>

              {/* Top deudores */}
              {debtSummary.top_debtors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 10 Deudores</h3>
                  <div className="space-y-2">
                    {debtSummary.top_debtors.map((debtor, index) => (
                      <div
                        key={debtor.customer_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                              index < 3
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-300 text-gray-700'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{debtor.customer_name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-orange-600">${debtor.pending_usd.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{debtor.pending_bs.toFixed(2)} Bs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Productos */}
      {topProducts && topProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6">
          <button
            onClick={() => setShowProducts(!showProducts)}
            className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Package className="w-5 h-5 mr-2 text-purple-600" />
              Top 10 Productos Más Vendidos
            </h2>
            {showProducts ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showProducts && (
            <div className="p-4">
              <div className="space-y-2">
                {(() => {
                  const weightValues = topProducts
                    .filter((p) => p.is_weight_product)
                    .map(getQuantityMetric)
                  const unitValues = topProducts
                    .filter((p) => !p.is_weight_product)
                    .map(getQuantityMetric)
                  const weightMax = weightValues.length > 0 ? Math.max(...weightValues) : 1
                  const unitMax = unitValues.length > 0 ? Math.max(...unitValues) : 1

                  return topProducts.map((product, index) => {
                    const maxQty = product.is_weight_product ? weightMax : unitMax
                    const percentage = (getQuantityMetric(product) / maxQty) * 100

                    return (
                      <div
                        key={product.product_id}
                        className="relative bg-gray-50 rounded-lg p-3 border border-gray-200 overflow-hidden"
                      >
                        {/* Barra de progreso */}
                        <div
                          className="absolute inset-0 bg-purple-100 opacity-50"
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center flex-1 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 ${
                                index < 3
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-gray-300 text-gray-700'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{product.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {formatQuantity(
                                  product.quantity_sold,
                                  product.is_weight_product,
                                  product.weight_unit,
                                )}{' '}
                                vendidos • ${product.revenue_usd.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right ml-3 flex-shrink-0">
                            <p className="font-bold text-green-600">
                              +${product.profit_usd.toFixed(2)}
                            </p>
                            <p className="text-xs text-purple-600">
                              {product.profit_margin.toFixed(0)}% margen
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ventas Diarias */}
      {salesReport && salesReport.daily.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6">
          <button
            onClick={() => setShowDaily(!showDaily)}
            className="w-full p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-green-600" />
              Desglose Diario
            </h2>
            {showDaily ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showDaily && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                      Ventas
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      Ingresos
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase hidden sm:table-cell">
                      Costo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      Ganancia
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesReport.daily.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {format(new Date(day.date + 'T12:00:00'), "EEE dd/MM", {
                            locale: es,
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {day.sales_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-gray-900">${day.total_usd.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-red-600">${day.cost_usd.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-green-600">${day.profit_usd.toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {salesReport.total_sales}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      ${salesReport.total_amount_usd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600 hidden sm:table-cell">
                      ${salesReport.total_cost_usd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      ${salesReport.total_profit_usd.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && (!salesReport || salesReport.total_sales === 0) && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos para mostrar</h3>
          <p className="text-gray-500">
            No se encontraron ventas en el período seleccionado. Intenta con un rango de fechas diferente.
          </p>
        </div>
      )}
    </div>
  )
}
