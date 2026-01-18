import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Eye, Calendar as CalendarIcon, Store, AlertCircle, Printer, Receipt, Download, Filter, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { salesService, Sale } from '@/services/sales.service'
import { authService } from '@/services/auth.service'
import { reportsService } from '@/services/reports.service'
import { useAuth } from '@/stores/auth.store'
import SaleDetailModal from '@/components/sales/SaleDetailModal'
import { format, parseISO, isSameDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { exportToCSV } from '@/utils/export-excel'
import toast from 'react-hot-toast'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDateInAppTimeZone, getTimeZoneLabel } from '@/lib/timezone'
import { printService } from '@/services/print.service'
import { SwipeableItem } from '@/components/ui/swipeable-item'
import { useMobileDetection } from '@/hooks/use-mobile-detection'

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
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
            {date ? format(date, 'PPP', { locale: undefined }) : <span>Seleccionar fecha</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            initialFocus
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
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20
  
  // Filtros avanzados
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all')
  const [debtFilter, setDebtFilter] = useState<'all' | 'with_debt' | 'without_debt' | 'paid'>('all')
  const [minAmountUsd, setMinAmountUsd] = useState<string>('')
  const [maxAmountUsd, setMaxAmountUsd] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Obtener lista de tiendas (solo para owners)
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => authService.getStores(),
    enabled: isOwner,
  })

  // Convertir fechas a formato string para la API (usando zona horaria configurada)
  const effectiveDateFrom = dateFrom ? formatDateInAppTimeZone(dateFrom) : formatDateInAppTimeZone()
  const effectiveDateTo = dateTo ? formatDateInAppTimeZone(dateTo) : formatDateInAppTimeZone()

  // Determinar store_id a usar
  const effectiveStoreId = selectedStoreId || user?.store_id || ''

  // Obtener datos del prefetch como placeholderData (últimas 50 ventas)
  const prefetchedSales = queryClient.getQueryData<{ sales: Sale[]; total: number }>(['sales', 'list', effectiveStoreId, { limit: 50 }])

  // Obtener ventas
  const { data: salesData, isLoading, isError, error, refetch } = useQuery<{ sales: Sale[]; total: number }>({
    queryKey: ['sales', 'list', effectiveDateFrom, effectiveDateTo, effectiveStoreId, currentPage],
    queryFn: () =>
      salesService.list({
        date_from: effectiveDateFrom,
        date_to: effectiveDateTo,
        store_id: effectiveStoreId !== user?.store_id ? effectiveStoreId : undefined,
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

  // Obtener datos de ventas por día para el gráfico (solo si es el mismo día y es owner)
  const { data: dailySalesData, isLoading: isLoadingDailySales } = useQuery({
    queryKey: ['reports', 'sales-by-day', effectiveDateFrom, effectiveDateTo, effectiveStoreId],
    queryFn: () => reportsService.getSalesByDay({
      start_date: effectiveDateFrom,
      end_date: effectiveDateTo,
    }),
    enabled: isOwner && isSameDaySelected && !!effectiveDateFrom && !!effectiveDateTo,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
  
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
        storeName: 'SISTEMA POS',
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Historial de Ventas</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {activeFiltersCount > 0 ? (
                <>
                  {sales.length} de {rawSales.length} ventas mostradas
                  {' · '}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAdvancedFilters}
                    className="h-auto p-0 text-xs underline"
                  >
                    Limpiar filtros
                  </Button>
                </>
              ) : (
                <>
                  {total} venta{total !== 1 ? 's' : ''} en el período seleccionado
                </>
              )}
              {' · '}
              Zona horaria: {getTimeZoneLabel()}
            </p>
          </div>
          {total > 0 && (
            <div className="flex flex-col sm:flex-row items-end gap-2 sm:gap-4">
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">Total en Bs</p>
                  <p className="text-lg font-bold text-foreground">
                    {totalSalesBs.toFixed(2)} Bs
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total en USD</p>
                  <p className="text-lg font-bold text-foreground">
                    ${totalSalesUsd.toFixed(2)}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="min-h-[44px] min-w-[44px]"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardContent className="p-3 sm:p-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Selector de tienda (solo para owners) */}
          {isOwner && stores && stores.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-semibold flex items-center gap-1">
                  <Store className="w-4 h-4" />
                Filtrar por Tienda
                </Label>
                <Select
                value={selectedStoreId || 'all'}
                  onValueChange={(value) => {
                    setSelectedStoreId(value === 'all' ? '' : value)
                  setCurrentPage(1)
                }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las tiendas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                    {store.name}
                      </SelectItem>
                ))}
                  </SelectContent>
                </Select>
            </div>
          )}

          {/* Mensaje para cashiers si intentan filtrar por otra tienda */}
          {!isOwner && selectedStoreId && selectedStoreId !== user?.store_id && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No tienes permisos</AlertTitle>
                <AlertDescription>
                  Solo los administradores pueden ver ventas de otras tiendas
                </AlertDescription>
              </Alert>
          )}

          {/* Filtros de fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
          <div className="flex items-end">
                <Button
                  variant="outline"
              onClick={handleResetDates}
                  className="w-full"
            >
              Reiniciar
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
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">
                    Método de Pago
                  </Label>
                  <Select
                    value={paymentMethodFilter}
                    onValueChange={setPaymentMethodFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(paymentMethodLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Estado */}
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">
                    Estado
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as 'all' | 'completed' | 'voided')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="completed">Completadas</SelectItem>
                      <SelectItem value="voided">Anuladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Estado de deuda */}
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">
                    Estado de Deuda
                  </Label>
                  <Select
                    value={debtFilter}
                    onValueChange={(v) => setDebtFilter(v as 'all' | 'with_debt' | 'without_debt' | 'paid')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="with_debt">Con deuda pendiente</SelectItem>
                      <SelectItem value="without_debt">Sin deuda</SelectItem>
                      <SelectItem value="paid">Deuda pagada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Monto mínimo USD */}
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">
                    Monto Mínimo (USD)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={minAmountUsd}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinAmountUsd(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                
                {/* Monto máximo USD */}
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">
                    Monto Máximo (USD)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={maxAmountUsd}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxAmountUsd(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                
                {/* Búsqueda por cliente */}
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">
                    Buscar Cliente
                  </Label>
                  <Input
                    type="text"
                    value={customerSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)}
                    placeholder="Nombre o cédula/RIF"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Gráfico de ventas del día (solo si es el mismo día y es owner) */}
      {isOwner && isSameDaySelected && dailySalesData && (
        <Card className="mb-4 sm:mb-6 border border-border">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Ventas del Día - {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDailySales ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : dailySalesData.daily && dailySalesData.daily.length > 0 ? (
              <div className="h-[300px] w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                  <LineChart
                    data={dailySalesData.daily.map((day) => ({
                      ...day,
                      formattedDate: format(parseISO(day.date), 'HH:mm'),
                      total_bs: Number(day.total_bs),
                      total_usd: Number(day.total_usd),
                      sales_count: day.sales_count,
                    }))}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="formattedDate"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      yAxisId="left"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) =>
                        value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-semibold mb-2">
                                {payload[0]?.payload?.formattedDate}
                              </p>
                              {payload.map((entry, index) => (
                                <p key={index} className="text-xs" style={{ color: entry.color }}>
                                  {entry.name === 'total_bs' && `Total Bs: ${Number(entry.value).toFixed(2)}`}
                                  {entry.name === 'total_usd' && `Total USD: $${Number(entry.value).toFixed(2)}`}
                                  {entry.name === 'sales_count' && `Ventas: ${entry.value}`}
                                </p>
                              ))}
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => {
                        if (value === 'total_bs') return 'Total Bs'
                        if (value === 'total_usd') return 'Total USD'
                        if (value === 'sales_count') return 'Cantidad de Ventas'
                        return value
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="total_bs"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="total_bs"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="total_usd"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="total_usd"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="sales_count"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="sales_count"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos de ventas para mostrar
              </div>
            )}
          </CardContent>
        </Card>
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
        ) : isLoading ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
          </div>
        ) : rawSales.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                  No hay ventas
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No se encontraron ventas en el período seleccionado
                </p>
              </div>
          </div>
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
              <div className="space-y-2">
                {sales.map((sale: Sale) => {
                  const itemCount = sale.items.length
                  const isFIAO = sale.payment.method === 'FIAO'
                  const debtStatus = sale.debt?.status || null
                  const isPending = isFIAO && (debtStatus === 'open' || debtStatus === 'partial')
                  const isPaid = isFIAO && debtStatus === 'paid'
                  const isVoided = Boolean(sale.voided_at)

                  return (
                    <SwipeableItem
                      key={sale.id}
                      onSwipeRight={() => handleViewDetail(sale)}
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
                          'transition-colors cursor-pointer',
                          isVoided && 'bg-muted/40 border-muted',
                          isPending && 'bg-orange-50 border-orange-200 border-l-4',
                          isPaid && 'bg-green-50 border-green-200 border-l-4'
                        )}
                        onClick={() => handleViewDetail(sale)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-semibold text-foreground text-sm">
                                  {format(new Date(sale.sold_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                                {isVoided && (
                                  <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">
                                    Anulada
                                  </Badge>
                                )}
                              </div>
                              
                              {sale.invoice_full_number && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Receipt className="w-3.5 h-3.5 text-primary" />
                                  <p className="font-mono font-semibold text-primary text-xs">
                                    {sale.invoice_full_number}
                                  </p>
                                </div>
                              )}
                              
                              <p className="text-xs text-muted-foreground mb-2">
                                {itemCount} producto{itemCount !== 1 ? 's' : ''}
                              </p>
                              
                              {isFIAO && sale.debt && isPending && sale.debt.remaining_bs !== undefined && (
                                <p className="text-xs font-medium text-orange-600 mt-1">
                                  Pendiente: {Number(sale.debt.remaining_bs).toFixed(2)} Bs
                                </p>
                              )}
                            </div>
                            
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-foreground text-base">
                                {Number(sale.totals.total_bs).toFixed(2)} Bs
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ${Number(sale.totals.total_usd).toFixed(2)} USD
                              </p>
                              <Badge variant="secondary" className="mt-1 text-[10px]">
                                {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                            <span>Desliza para acciones →</span>
                            {sale.customer && (
                              <span className="truncate max-w-[150px]">{sale.customer.name}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </SwipeableItem>
                  )
                })}
              </div>
            ) : (
              /* Vista de tabla para desktop */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead className="hidden sm:table-cell">Factura</TableHead>
                      <TableHead className="hidden sm:table-cell">Productos</TableHead>
                      <TableHead className="hidden lg:table-cell">Preview</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Moneda</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Método de Pago</TableHead>
                      <TableHead className="hidden md:table-cell">Responsable</TableHead>
                      <TableHead className="hidden xl:table-cell">Cliente</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
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
                          ? `${totalUnits} unidades + ${weightLineItems} por peso`
                          : `${weightLineItems} por peso`
                        : `${totalUnits} unidades`
                    
                    // Determinar estado de deuda para FIAO
                    const isFIAO = sale.payment.method === 'FIAO'
                    const debtStatus = sale.debt?.status || null
                    const isPending = isFIAO && (debtStatus === 'open' || debtStatus === 'partial')
                    const isPaid = isFIAO && debtStatus === 'paid'
                    const isVoided = Boolean(sale.voided_at)
                    
                    // Clases de color para la fila según estado de deuda
                      let rowClassName = ''
                    if (isVoided) {
                        rowClassName = 'bg-muted/40 text-muted-foreground'
                    } else if (isPending) {
                        rowClassName = 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500'
                    } else if (isPaid) {
                        rowClassName = 'bg-green-50 hover:bg-green-100 border-l-4 border-green-500'
                    }

                    return (
                      <TableRow
                        key={sale.id}
                        className={cn('transition-colors', rowClassName)}
                      >
                          <TableCell>
                          <div className="text-sm sm:text-base">
                              <p className="font-semibold text-foreground">
                              {format(new Date(sale.sold_at), 'dd/MM/yyyy')}
                            </p>
                              <p className="text-xs text-muted-foreground">
                              {format(new Date(sale.sold_at), 'HH:mm')}
                            </p>
                            {isVoided && (
                              <Badge
                                variant="outline"
                                className="mt-1 border-destructive/40 text-destructive"
                              >
                                Anulada
                              </Badge>
                            )}
                          </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                          {sale.invoice_full_number ? (
                            <div className="flex items-center gap-1">
                              <Receipt className="w-4 h-4 text-primary" />
                              <p className="font-mono font-semibold text-primary text-sm">
                                {sale.invoice_full_number}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">-</p>
                          )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                          <div className="text-sm">
                              <p className="font-medium text-foreground">
                              {itemCount} producto{itemCount !== 1 ? 's' : ''}
                            </p>
                              <p className="text-xs text-muted-foreground">
                              {totalItemsLabel}
                            </p>
                          </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="max-w-[200px]">
                              <div className="flex flex-wrap gap-1">
                                {sale.items.slice(0, 3).map((item, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs font-normal"
                                  >
                                    {item.product?.name || 'Producto'}
                                    {item.qty > 1 && ` x${item.qty}`}
                                  </Badge>
                                ))}
                                {sale.items.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{sale.items.length - 3} más
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                          <div className="text-sm sm:text-base">
                              <p className="font-bold text-foreground">
                              {Number(sale.totals.total_bs).toFixed(2)} Bs
                            </p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                              ${Number(sale.totals.total_usd).toFixed(2)} USD
                            </p>
                            {isFIAO && sale.debt && isPending && sale.debt.remaining_bs !== undefined && (
                              <p className="text-xs font-medium text-orange-600 mt-1">
                                Pendiente: {Number(sale.debt.remaining_bs).toFixed(2)} Bs / ${Number(sale.debt.remaining_usd || 0).toFixed(2)} USD
                              </p>
                            )}
                          </div>
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell">
                            <Badge variant="secondary">
                            {currencyLabels[sale.currency] || sale.currency}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                          <div className="flex flex-col items-center gap-1">
                              <span className="text-xs sm:text-sm text-foreground">
                              {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                            </span>
                            {isFIAO && sale.debt && (
                                <Badge
                                  variant={
                                    debtStatus === 'paid'
                                      ? 'default'
                                      : debtStatus === 'partial'
                                      ? 'secondary'
                                      : 'outline'
                                  }
                                  className={
                                  debtStatus === 'paid'
                                      ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                    : debtStatus === 'partial'
                                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                                      : 'bg-orange-100 text-orange-800 hover:bg-orange-100'
                                  }
                              >
                                {debtStatus === 'paid'
                                  ? 'Pagado'
                                  : debtStatus === 'partial'
                                  ? 'Parcial'
                                  : 'Pendiente'}
                                </Badge>
                            )}
                          </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            {sale.sold_by_user ? (
                              <>
                                  <p className="font-medium text-foreground">
                                  {sale.sold_by_user.full_name || 'Sin nombre'}
                                </p>
                                  <p className="text-xs text-muted-foreground">
                                  {sale.sold_by_user_id?.substring(0, 8)}...
                                </p>
                              </>
                            ) : (
                                <p className="text-muted-foreground text-xs">N/A</p>
                            )}
                          </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                          <div className="text-sm">
                            {sale.customer ? (
                              <>
                                  <p className="font-medium text-foreground">{sale.customer.name}</p>
                                {sale.customer.document_id && (
                                    <p className="text-xs text-muted-foreground">
                                    CI: {sale.customer.document_id}
                                  </p>
                                )}
                              </>
                            ) : sale.payment.method === 'FIAO' ? (
                              <p className="text-orange-600 text-xs font-medium">Fiado</p>
                            ) : (
                                <p className="text-muted-foreground text-xs">-</p>
                            )}
                          </div>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewDetail(sale)}
                                    className="text-primary hover:text-primary min-h-[44px] min-w-[44px]"
                                    aria-label="Ver detalles de venta"
                                  >
                                    <Eye className="w-4 h-4 mr-1.5" />
                                    <span className="hidden sm:inline">Ver</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver detalles de la venta</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrint(sale)}
                                    className="text-primary min-h-[44px] min-w-[44px]"
                                    aria-label="Imprimir ticket"
                                  >
                                    <Printer className="w-4 h-4 sm:mr-1" />
                                    <span className="hidden sm:inline">Ticket</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Imprimir ticket de venta</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
