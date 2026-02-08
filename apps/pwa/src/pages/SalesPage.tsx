import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Eye, Calendar as CalendarIcon, AlertCircle, Printer, Receipt, Download, Filter, X, Cloud, CloudOff, DollarSign as DollarSignIcon, UserCircle } from 'lucide-react'
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { salesService, Sale } from '@/services/sales.service'
import { useAuth } from '@/stores/auth.store'
import SaleDetailModal from '@/components/sales/SaleDetailModal'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { exportToCSV } from '@/utils/export-excel'
import toast from '@/lib/toast'
import DailySalesChart from '@/components/sales/DailySalesChart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SalesSkeleton } from '@/components/ui/module-skeletons'
import { PremiumEmptyState } from '@/components/ui/premium-empty-state'
import { useSmoothLoading } from '@/hooks/use-smooth-loading'
import { cn } from '@/lib/utils'
import { formatDateInAppTimeZone, getTimeZoneLabel } from '@/lib/timezone'
import { printService } from '@/services/print.service'
import { SwipeableItem } from '@/components/ui/swipeable-item'
import { useMobileDetection } from '@/hooks/use-mobile-detection'
import { StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper'

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Tarjeta',
  OTHER: 'Biopago',
  SPLIT: 'Mixto',
  FIAO: 'Fiado',
}

const currencyLabels: Record<string, string> = {
  BS: 'Bs',
  USD: 'USD',
  MIXED: 'Mixto',
}

// Componente helper para Date Picker
function DatePicker({
  date,
  onDateChange,
  label,
}: {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  label: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs sm:text-sm font-semibold">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP', { locale: es }) : <span>Seleccionar fecha</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            initialFocus
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function SalesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isOwner = user?.role === 'owner'
  const isMobile = useMobileDetection()
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date())
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  // Filtros avanzados
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all')
  const [debtFilter, setDebtFilter] = useState<'all' | 'with_debt' | 'without_debt' | 'paid'>('all')
  const [minAmountUsd, setMinAmountUsd] = useState<string>('')
  const [maxAmountUsd, setMaxAmountUsd] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Presets de fecha
  const setDatePreset = (preset: 'today' | 'yesterday' | 'week') => {
    const now = new Date()
    switch (preset) {
      case 'today':
        setDateFrom(now)
        setDateTo(now)
        break
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        setDateFrom(yesterday)
        setDateTo(yesterday)
        break
      case 'week':
        const weekAgo = new Date(now)
        weekAgo.setDate(now.getDate() - 7)
        setDateFrom(weekAgo)
        setDateTo(now)
        break
    }
    setCurrentPage(1)
  }

  // Convertir fechas a formato string para la API (usando zona horaria configurada)
  const effectiveDateFrom = dateFrom ? formatDateInAppTimeZone(dateFrom) : formatDateInAppTimeZone()
  const effectiveDateTo = dateTo ? formatDateInAppTimeZone(dateTo) : formatDateInAppTimeZone()

  // SIEMPRE usar solo el store_id del usuario - no permitir ver otras tiendas
  const effectiveStoreId = user?.store_id || ''

  // Obtener datos del prefetch como placeholderData (últimas 50 ventas)
  const prefetchedSales = queryClient.getQueryData<{ sales: Sale[]; total: number }>(['sales', 'list', effectiveStoreId, { limit: 10 }])

  // Obtener ventas
  const { data: salesData, isLoading, isFetching, isError, error, refetch } = useQuery<{ sales: Sale[]; total: number }>({
    queryKey: ['sales', 'list', effectiveDateFrom, effectiveDateTo, effectiveStoreId, currentPage],
    queryFn: () =>
      salesService.list({
        date_from: effectiveDateFrom,
        date_to: effectiveDateTo,
        // NO enviar store_id - el backend usará el del JWT del usuario
        limit,
        offset: (currentPage - 1) * limit,
      }),
    placeholderData: currentPage === 1 && !effectiveDateFrom && !effectiveDateTo ? prefetchedSales : undefined, // Usar cache del prefetch si es la primera página sin filtros
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: Infinity, // Nunca eliminar
    refetchOnMount: false, // Usar cache si existe
  })

  useEffect(() => {
    // Manejar errores de autorización
    if (salesData === undefined && isLoading === false) {
      // El error se maneja en el servicio, pero podemos mostrar un toast si es necesario
    }
  }, [salesData, isLoading]);

  const rawSales = salesData?.sales || []
  const total = salesData?.total || 0

  // Verificar si las fechas seleccionadas son del mismo día para mostrar gráfico
  const isSameDaySelected = useMemo(() => {
    if (!dateFrom || !dateTo) return false
    return isSameDay(dateFrom, dateTo)
  }, [dateFrom, dateTo])

  // Obtener TODAS las ventas del día para el gráfico (sin paginación, solo si es el mismo día y es owner)
  const { data: allDaySalesData, isLoading: isLoadingAllDaySales } = useQuery<{ sales: Sale[]; total: number }>({
    queryKey: ['sales', 'list-all-day', effectiveDateFrom, effectiveDateTo, effectiveStoreId],
    queryFn: () =>
      salesService.list({
        date_from: effectiveDateFrom,
        date_to: effectiveDateTo,
        limit: 10000, // Obtener todas las ventas del día
        offset: 0,
      }),
    enabled: isOwner && isSameDaySelected && !!effectiveDateFrom && !!user?.store_id,
    staleTime: 1000 * 60 * 5, // 5 minutos de caché fresca
  })

  // Smooth loading state to prevent skeleton flickering
  const isSmoothLoading = useSmoothLoading(isLoading || isFetching)

  // Filtrar ventas del día (aplicar mismos filtros que las ventas principales, pero sin anuladas para el gráfico)
  const daySalesForChart = useMemo(() => {
    if (!allDaySalesData?.sales) return []

    return allDaySalesData.sales.filter((sale: Sale) => {
      // No mostrar ventas anuladas en el gráfico
      if (sale.voided_at) return false

      // Aplicar filtros de método de pago
      if (paymentMethodFilter !== 'all' && sale.payment.method !== paymentMethodFilter) {
        return false
      }

      // Aplicar filtro de deuda
      if (debtFilter === 'with_debt') {
        if (!sale.debt || (sale.debt.status !== 'open' && sale.debt.status !== 'partial')) {
          return false
        }
      } else if (debtFilter === 'without_debt') {
        if (sale.debt && (sale.debt.status === 'open' || sale.debt.status === 'partial')) {
          return false
        }
      } else if (debtFilter === 'paid') {
        if (!sale.debt || sale.debt.status !== 'paid') {
          return false
        }
      }

      // Aplicar filtro de rango de montos
      const amountUsd = Number(sale.totals.total_usd)
      if (minAmountUsd && amountUsd < Number(minAmountUsd)) {
        return false
      }
      if (maxAmountUsd && amountUsd > Number(maxAmountUsd)) {
        return false
      }

      // Aplicar filtro de búsqueda de cliente
      if (customerSearch.trim()) {
        const searchLower = customerSearch.toLowerCase().trim()
        const customerName = sale.customer?.name?.toLowerCase() || ''
        const customerDoc = sale.customer?.document_id?.toLowerCase() || ''
        if (!customerName.includes(searchLower) && !customerDoc.includes(searchLower)) {
          return false
        }
      }

      return true
    })
  }, [allDaySalesData, paymentMethodFilter, debtFilter, minAmountUsd, maxAmountUsd, customerSearch])

  // Aplicar filtros avanzados (filtrado en frontend)
  const sales = rawSales.filter((sale: Sale) => {
    // Filtro por método de pago
    if (paymentMethodFilter !== 'all' && sale.payment.method !== paymentMethodFilter) {
      return false
    }

    // Filtro por estado (anulada/no anulada)
    if (statusFilter === 'voided' && !sale.voided_at) {
      return false
    }
    if (statusFilter === 'completed' && sale.voided_at) {
      return false
    }

    // Filtro por deuda
    if (debtFilter === 'with_debt') {
      if (!sale.debt || (sale.debt.status !== 'open' && sale.debt.status !== 'partial')) {
        return false
      }
    } else if (debtFilter === 'without_debt') {
      if (sale.debt && (sale.debt.status === 'open' || sale.debt.status === 'partial')) {
        return false
      }
    } else if (debtFilter === 'paid') {
      if (!sale.debt || sale.debt.status !== 'paid') {
        return false
      }
    }

    // Filtro por rango de montos (USD)
    const amountUsd = Number(sale.totals.total_usd)
    if (minAmountUsd && amountUsd < Number(minAmountUsd)) {
      return false
    }
    if (maxAmountUsd && amountUsd > Number(maxAmountUsd)) {
      return false
    }

    // Filtro por búsqueda de cliente
    if (customerSearch.trim()) {
      const searchLower = customerSearch.toLowerCase().trim()
      const customerName = sale.customer?.name?.toLowerCase() || ''
      const customerDoc = sale.customer?.document_id?.toLowerCase() || ''
      if (!customerName.includes(searchLower) && !customerDoc.includes(searchLower)) {
        return false
      }
    }

    return true
  })

  const totalPages = Math.ceil(total / limit)

  // Calcular totales (de las ventas filtradas)
  const totalSalesBs = sales.reduce(
    (sum: number, sale: Sale) => sum + Number(sale.totals.total_bs),
    0
  )
  const totalSalesUsd = sales.reduce(
    (sum: number, sale: Sale) => sum + Number(sale.totals.total_usd),
    0
  )

  // Contar filtros activos
  const activeFiltersCount = [
    paymentMethodFilter !== 'all',
    statusFilter !== 'all',
    debtFilter !== 'all',
    minAmountUsd !== '' || maxAmountUsd !== '',
    customerSearch.trim() !== '',
  ].filter(Boolean).length

  const handleResetAdvancedFilters = () => {
    setPaymentMethodFilter('all')
    setStatusFilter('all')
    setDebtFilter('all')
    setMinAmountUsd('')
    setMaxAmountUsd('')
    setCustomerSearch('')
  }

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailModalOpen(true)
  }

  const handlePrint = (sale: Sale) => {
    try {
      printService.printSale(sale, {
        storeName: 'Velox POS',
        cashierName: sale.sold_by_user?.full_name || undefined,
      })
    } catch (err) {
      console.warn('[Sales] No se pudo imprimir el ticket:', err)
    }
  }

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false)
    setSelectedSale(null)
  }

  const handleResetDates = () => {
    setDateFrom(new Date())
    setDateTo(new Date())
    setCurrentPage(1)
  }

  // Exportar ventas a Excel
  const handleExportExcel = () => {
    if (sales.length === 0) {
      toast.error('No hay ventas para exportar')
      return
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd')
    const dateRangeStr = dateFrom && dateTo
      ? `${format(dateFrom, 'dd-MM-yyyy')}_a_${format(dateTo, 'dd-MM-yyyy')}`
      : timestamp

    exportToCSV(
      sales,
      [
        {
          header: 'Fecha',
          accessor: (sale) => format(new Date(sale.sold_at), 'dd/MM/yyyy HH:mm'),
        },
        {
          header: 'Factura',
          accessor: (sale) => sale.invoice_full_number || '-',
        },
        {
          header: 'Productos',
          accessor: (sale) => sale.items.length,
          format: 'number',
        },
        {
          header: 'Total Bs',
          accessor: (sale) => Number(sale.totals.total_bs),
          format: 'currency',
        },
        {
          header: 'Total USD',
          accessor: (sale) => Number(sale.totals.total_usd),
          format: 'currency',
        },
        {
          header: 'Moneda',
          accessor: (sale) => currencyLabels[sale.currency] || sale.currency,
        },
        {
          header: 'Método de Pago',
          accessor: (sale) => paymentMethodLabels[sale.payment.method] || sale.payment.method,
        },
        {
          header: 'Responsable',
          accessor: (sale) => sale.sold_by_user?.full_name || 'N/A',
        },
        {
          header: 'Cliente',
          accessor: (sale) => sale.customer?.name || '-',
        },
        {
          header: 'Cédula Cliente',
          accessor: (sale) => sale.customer?.document_id || '-',
        },
        {
          header: 'Estado',
          accessor: (sale) => sale.voided_at ? 'Anulada' : 'Completada',
        },
        {
          header: 'Estado Deuda',
          accessor: (sale) => {
            if (sale.payment.method !== 'FIAO') return '-'
            if (!sale.debt) return 'Sin deuda'
            switch (sale.debt.status) {
              case 'paid': return 'Pagado'
              case 'partial': return 'Parcial'
              case 'open': return 'Pendiente'
              default: return sale.debt.status
            }
          },
        },
      ],
      {
        filename: `Ventas_${dateRangeStr}`,
      }
    )

    toast.success(`${sales.length} ventas exportadas a Excel`)
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight">Historial de Ventas</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {activeFiltersCount > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{sales.length}</span> de {rawSales.length} ventas
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{total}</span> venta{total !== 1 ? 's' : ''}
                  </>
                )}
              </p>
              <span className="text-muted-foreground/30 hidden sm:inline">•</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                <Cloud className="w-3 h-3 h-3" />
                Zona: {getTimeZoneLabel()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-2 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-xs text-primary/70 font-bold uppercase tracking-wider">Total Bs</span>
              <span className="text-sm sm:text-lg font-black text-primary tabular-nums">
                {totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-xs text-emerald-600/70 font-bold uppercase tracking-wider">Total USD</span>
              <span className="text-sm sm:text-lg font-black text-emerald-600 tabular-nums">
                ${totalSalesUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="col-span-2 sm:col-auto h-10 sm:h-12 border-muted/40 hover:bg-muted shadow-sm font-semibold"
              disabled={sales.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="sm:hidden lg:inline">Exportar Excel</span>
              <span className="hidden sm:inline lg:hidden">Exportar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            {/* Filtros de fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
              <DatePicker
                date={dateFrom}
                onDateChange={(date) => {
                  setDateFrom(date)
                  setCurrentPage(1)
                }}
                label="Desde"
              />
              <DatePicker
                date={dateTo}
                onDateChange={(date) => {
                  setDateTo(date)
                  setCurrentPage(1)
                }}
                label="Hasta"
              />

              {/* Presets rápidos */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs sm:text-sm font-semibold mb-2 block">Accesos Rápidos</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 border-muted/40 bg-muted/50 hover:bg-muted text-xs font-medium"
                    onClick={() => setDatePreset('today')}
                  >
                    Hoy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 border-muted/40 bg-muted/50 hover:bg-muted text-xs font-medium"
                    onClick={() => setDatePreset('yesterday')}
                  >
                    Ayer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 border-muted/40 bg-muted/50 hover:bg-muted text-xs font-medium"
                    onClick={() => setDatePreset('week')}
                  >
                    7 días
                  </Button>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={handleResetDates}
                  className="w-full h-10 text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-widest"
                >
                  Reiniciar Fechas
                </Button>
              </div>
            </div>

            {/* Filtros avanzados */}
            <div className="border-t border-border pt-3 sm:pt-4 mt-3 sm:mt-4">
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filtros Avanzados
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAdvancedFilters}
                    className="text-xs gap-1"
                  >
                    <X className="w-3 h-3" />
                    Limpiar
                  </Button>
                )}
              </div>

              {showAdvancedFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-2">
                  {/* Método de pago */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">
                      Método de Pago
                    </Label>
                    <Select
                      value={paymentMethodFilter}
                      onValueChange={setPaymentMethodFilter}
                    >
                      <SelectTrigger className="h-11 border-muted/40 bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los métodos</SelectItem>
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estado */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">
                      Estado de Venta
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as 'all' | 'completed' | 'voided')}
                    >
                      <SelectTrigger className="h-11 border-muted/40 bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las ventas</SelectItem>
                        <SelectItem value="completed">Solo completadas</SelectItem>
                        <SelectItem value="voided">Solo anuladas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estado de deuda */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">
                      Estado de Deuda
                    </Label>
                    <Select
                      value={debtFilter}
                      onValueChange={(v) => setDebtFilter(v as 'all' | 'with_debt' | 'without_debt' | 'paid')}
                    >
                      <SelectTrigger className="h-11 border-muted/40 bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las deudas</SelectItem>
                        <SelectItem value="with_debt">Pendientes</SelectItem>
                        <SelectItem value="without_debt">Sin deuda</SelectItem>
                        <SelectItem value="paid">Pagadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Búsqueda por cliente */}
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">
                      Cliente (Nombre o CI)
                    </Label>
                    <div className="relative">
                      <X
                        className={cn(
                          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
                          !customerSearch && "hidden"
                        )}
                        onClick={() => setCustomerSearch('')}
                      />
                      <Input
                        type="text"
                        value={customerSearch}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)}
                        placeholder="Ej: Juan Perez o 12345678"
                        className="h-11 border-muted/40 bg-muted/50 pr-10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de ventas del día (solo si es el mismo día y es owner) */}
      {isOwner && isSameDaySelected && dateFrom && (
        <DailySalesChart
          sales={daySalesForChart}
          date={dateFrom}
          isLoading={isLoadingAllDaySales}
        />
      )}

      {/* Lista de ventas */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {isError ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="text-muted-foreground">No se pudieron cargar las ventas</p>
                {error instanceof Error && (
                  <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
                )}
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  Reintentar
                </Button>
              </div>
            </div>
          ) : isSmoothLoading ? (
            <SalesSkeleton />
          ) : rawSales.length === 0 ? (
            <PremiumEmptyState
              title="No hay ventas"
              description="No se encontraron ventas en el período seleccionado"
              icon={FileText}
            />
          ) : sales.length === 0 && activeFiltersCount > 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Filter className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                  No hay ventas que coincidan con los filtros
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Se encontraron {rawSales.length} ventas, pero ninguna coincide con los filtros aplicados
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAdvancedFilters}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Vista de cards swipeables para móvil */}
              {isMobile ? (
                <StaggerContainer className="space-y-2">
                  {sales.map((sale: Sale) => {
                    const itemCount = sale.items.length
                    const isFIAO = sale.payment.method === 'FIAO'
                    const debtStatus = sale.debt?.status || null
                    const isPending = isFIAO && (debtStatus === 'open' || debtStatus === 'partial')
                    const isPaid = isFIAO && debtStatus === 'paid'
                    const isVoided = Boolean(sale.voided_at)

                    return (
                      <StaggerItem key={sale.id}>
                        <SwipeableItem
                          onSwipeRight={() => handleViewDetail(sale)}
                          // ... rest of swipeable item props
                          rightAction={
                            <div className="flex items-center gap-3 px-4">
                              <Eye className="w-5 h-5" />
                              <span className="font-medium">Ver Detalles</span>
                            </div>
                          }
                          onSwipeLeft={() => handlePrint(sale)}
                          leftAction={
                            <div className="flex items-center gap-3 px-4">
                              <Printer className="w-5 h-5" />
                              <span className="font-medium">Imprimir</span>
                            </div>
                          }
                          enabled={isMobile}
                          threshold={80}
                        >
                          <Card
                            className={cn(
                              'transition-all duration-200 cursor-pointer active:scale-[0.98]',
                              isVoided && 'bg-muted/30 border-muted opacity-80',
                              isPending && 'bg-orange-500/10 border-orange-500/20 border-l-4 border-l-orange-500 shadow-sm',
                              isPaid && 'bg-emerald-500/10 border-emerald-500/20 border-l-4 border-l-emerald-500 shadow-sm',
                              !isVoided && !isPending && !isPaid && 'bg-card hover:border-primary/40'
                            )}
                            onClick={() => handleViewDetail(sale)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    isVoided ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                                  )}>
                                    <Receipt className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-foreground text-sm uppercase tracking-tight">
                                      {sale.invoice_full_number || `#${sale.id.substring(0, 6)}`}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                      {format(new Date(sale.sold_at), 'hh:mm a')}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={cn(
                                    "font-black text-base tabular-nums",
                                    isVoided ? "line-through text-muted-foreground" : "text-foreground"
                                  )}>
                                    ${Number(sale.totals.total_usd).toFixed(2)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {Number(sale.totals.total_bs).toFixed(2)} Bs
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-wrap gap-1.5 flex-1">
                                  <Badge variant="outline" className="bg-muted/50 border-none text-[10px] px-2 py-0">
                                    {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                                  </Badge>
                                  {itemCount > 0 && (
                                    <Badge variant="outline" className="bg-muted/50 border-none text-[10px] px-2 py-0">
                                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                    </Badge>
                                  )}
                                  {isVoided && (
                                    <Badge variant="destructive" className="text-[10px] px-2 py-0">
                                      Anulada
                                    </Badge>
                                  )}
                                  {isPending && (
                                    <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0">
                                      Deuda
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {sale.sync_status === 'pending' ? (
                                    <CloudOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <Cloud className="w-3.5 h-3.5 text-emerald-600/50 dark:text-emerald-400/50" />
                                  )}
                                  <Eye className="w-4 h-4 text-primary/40" />
                                </div>
                              </div>

                              {sale.customer && (
                                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                                    <UserCircle className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                  <p className="text-xs font-semibold text-muted-foreground truncate">
                                    {sale.customer.name}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </SwipeableItem>
                      </StaggerItem>
                    )
                  })}
                </StaggerContainer>
              ) : (
                /* Vista de tabla para desktop - Premium Grid */
                <div className="rounded-xl overflow-x-auto border border-border/50 bg-background/50 backdrop-blur-md shadow-inner">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="w-[180px]">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            Fecha
                          </div>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Factura</span>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumen</span>
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vista Previa</span>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <DollarSignIcon className="w-3.5 h-3.5" />
                            Total
                          </div>
                        </TableHead>
                        <TableHead className="text-center hidden md:table-cell">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pago</span>
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendedor</span>
                        </TableHead>
                        <TableHead className="hidden xl:table-cell">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acciones</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale: Sale) => {
                        const itemCount = sale.items.length
                        const totalUnits = sale.items.reduce(
                          (sum: number, item: any) => sum + (item.is_weight_product ? 0 : item.qty),
                          0
                        )
                        const weightLineItems = sale.items.filter(
                          (item: any) => item.is_weight_product
                        ).length
                        const totalItemsLabel =
                          weightLineItems > 0
                            ? totalUnits > 0
                              ? `${totalUnits} u + ${weightLineItems} peso`
                              : `${weightLineItems} peso`
                            : `${totalUnits} u`

                        // Determinar estado de deuda para FIAO
                        const isFIAO = sale.payment.method === 'FIAO'
                        const debtStatus = sale.debt?.status || null
                        const isPending = isFIAO && (debtStatus === 'open' || debtStatus === 'partial')
                        const isVoided = Boolean(sale.voided_at)

                        return (
                          <TableRow
                            key={sale.id}
                            className={cn(
                              'group transition-all duration-200 border-border/50',
                              isVoided ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-primary/5'
                            )}
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold tracking-tight">{format(new Date(sale.sold_at), 'dd MMM yyyy')}</span>
                                <span className="text-xs text-muted-foreground font-mono">{format(new Date(sale.sold_at), 'HH:mm')}</span>
                                {isVoided && (
                                  <Badge variant="outline" className="mt-1 w-fit bg-destructive/10 text-destructive dark:text-red-400 border-destructive/20 text-[10px] h-5 px-1.5">
                                    Anulada
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {sale.invoice_full_number ? (
                                <Badge variant="secondary" className="font-mono text-xs bg-muted/50 text-foreground border-border/50">
                                  {sale.invoice_full_number}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/30 text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium">{itemCount} items</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{totalItemsLabel}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex -space-x-2 overflow-x-auto py-1">
                                {sale.items.slice(0, 4).map((item, idx) => (
                                  <div key={idx} className="relative z-0 group-hover:z-10 transition-all hover:scale-110">
                                    <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-bold shadow-sm" title={item.product?.name}>
                                      {item.product?.name?.substring(0, 2).toUpperCase() || 'P'}
                                    </div>
                                  </div>
                                ))}
                                {sale.items.length > 4 && (
                                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold z-0">
                                    +{sale.items.length - 4}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-base font-bold font-heading text-foreground tracking-tight">
                                  ${Number(sale.totals.total_usd).toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">
                                  Mi Moneda: {Number(sale.totals.total_bs).toFixed(2)} Bs
                                </span>
                                {isFIAO && sale.debt && isPending && (
                                  <Badge variant="outline" className="mt-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] h-5 px-2 ml-auto whitespace-nowrap">
                                    Debe: ${Number(sale.debt.remaining_usd || 0).toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/10">
                                  {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-medium uppercase">{sale.currency}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {sale.sold_by_user ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {sale.sold_by_user.full_name?.substring(0, 1) || 'U'}
                                  </div>
                                  <span className="text-sm truncate max-w-[100px]">{sale.sold_by_user.full_name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sistema</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              {sale.customer ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{sale.customer.name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{sale.customer.document_id}</span>
                                </div>
                              ) : isFIAO ? (
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Sin cliente asignado</span>
                              ) : (
                                <span className="text-muted-foreground/30 text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetail(sale)}
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                                  title="Ver detalles"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handlePrint(sale)}
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                                  title="Imprimir ticket"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="border-t border-border px-4 py-3 sm:px-6">
                  <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando{' '}
                      <span className="font-medium text-foreground">
                        {(currentPage - 1) * limit + 1}
                      </span>{' '}
                      a{' '}
                      <span className="font-medium text-foreground">
                        {Math.min(currentPage * limit, total)}
                      </span>{' '}
                      de <span className="font-medium text-foreground">{total}</span> ventas
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle */}
      <SaleDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        sale={selectedSale}
      />
    </div>
  )
}
