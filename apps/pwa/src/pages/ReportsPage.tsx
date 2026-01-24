import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  AlertCircle,
  CreditCard,
  FileText,
  Percent,
  Wallet,
} from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatQuantity } from '@/lib/weight'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type DateRange = 'today' | 'week' | 'month' | 'custom'

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
      <Label className="text-xs font-semibold">{label}</Label>
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
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined)
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined)

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
        start = customStartDate || subDays(today, 7)
        end = customEndDate || today
        break
      default:
        start = today
    }

    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    }
  }, [dateRange, customStartDate, customEndDate])

  // Query: Ventas por día - SOLO si el usuario es owner
  const { 
    data: salesReport, 
    isLoading: loadingSales, 
    refetch: refetchSales,
    error: salesError,
  } = useQuery({
    queryKey: ['reports', 'sales-by-day', startDate, endDate],
    queryFn: () => reportsService.getSalesByDay({ start_date: startDate, end_date: endDate }),
    enabled: isOwner, // Solo ejecutar si es owner
    retry: (failureCount, error: any) => {
      // No reintentar si es error 403 (permisos) o 401 (auth)
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })

  // Query: Top productos - SOLO si el usuario es owner
  const { 
    data: topProducts, 
    isLoading: loadingProducts,
    error: productsError,
  } = useQuery({
    queryKey: ['reports', 'top-products', startDate, endDate],
    queryFn: () => reportsService.getTopProducts(10, { start_date: startDate, end_date: endDate }),
    enabled: isOwner, // Solo ejecutar si es owner
    retry: (failureCount, error: any) => {
      // No reintentar si es error 403 (permisos) o 401 (auth)
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })

  // Query: Resumen de deudas - SOLO si el usuario es owner
  const { 
    data: debtSummary, 
    isLoading: loadingDebts,
    error: debtsError,
  } = useQuery({
    queryKey: ['reports', 'debt-summary'],
    queryFn: () => reportsService.getDebtSummary(),
    enabled: isOwner, // Solo ejecutar si es owner
    retry: (failureCount, error: any) => {
      // No reintentar si es error 403 (permisos) o 401 (auth)
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })

  // Manejar errores de las queries
  useEffect(() => {
    if (salesError) {
      const error: any = salesError
      console.error('[Reports] Error cargando ventas por día:', error)
      if (error?.response?.status === 403) {
        toast.error('No tienes permisos para ver reportes. Se requiere rol de owner.')
      } else if (error?.response?.status !== 401) {
        toast.error('Error al cargar el reporte de ventas por día')
      }
    }
  }, [salesError])

  useEffect(() => {
    if (productsError) {
      const error: any = productsError
      console.error('[Reports] Error cargando top productos:', error)
      if (error?.response?.status === 403) {
        toast.error('No tienes permisos para ver reportes. Se requiere rol de owner.')
      } else if (error?.response?.status !== 401) {
        toast.error('Error al cargar el reporte de top productos')
      }
    }
  }, [productsError])

  useEffect(() => {
    if (debtsError) {
      const error: any = debtsError
      console.error('[Reports] Error cargando resumen de deudas:', error)
      if (error?.response?.status === 403) {
        toast.error('No tienes permisos para ver reportes. Se requiere rol de owner.')
      } else if (error?.response?.status !== 401) {
        toast.error('Error al cargar el resumen de deudas')
      }
    }
  }, [debtsError])

  const isLoading = loadingSales || loadingProducts || loadingDebts
  const hasError = salesError || productsError || debtsError

  // Si no es owner, mostrar mensaje
  if (!isOwner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground text-center mb-4">
              Esta página requiere permisos de owner. Tu rol actual es: <strong>{user?.role || 'desconocido'}</strong>
            </p>
            <Link to="/app/pos">
              <Button>Ir al POS</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si hay errores, mostrar información de depuración
  if (hasError && !isLoading) {
    const error = salesError || productsError || debtsError
    const is403 = error?.response?.status === 403
    const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido'
    
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Error al cargar los Reportes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">Detalles del error:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Estado HTTP: {error?.response?.status || 'N/A'}</li>
                <li>Mensaje: {errorMessage}</li>
                <li>Rol del usuario: {user?.role || 'desconocido'}</li>
                <li>Store ID: {user?.store_id || 'N/A'}</li>
                {is403 && (
                  <li className="text-destructive font-semibold">
                    Este endpoint requiere rol 'owner'. Verifica tu token JWT.
                  </li>
                )}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                Recargar Página
              </Button>
              <Button variant="outline" onClick={() => {
                localStorage.removeItem('auth_token')
                window.location.href = '/login'
              }}>
                Cerrar Sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center">
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 mr-2 text-primary" />
              Reportes
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Análisis de ventas, productos y deudas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              size="sm"
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
              Actualizar
            </Button>
            <Button
              onClick={handleExportCSV}
              disabled={isLoading}
              size="sm"
              className="bg-success hover:bg-success/90 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros de fecha */}
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardContent className="p-3 sm:p-4 space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-2 sm:mb-3 block">Rango de Fechas</Label>
            <RadioGroup
              value={dateRange}
              onValueChange={(value) => setDateRange(value as DateRange)}
              className="flex flex-wrap gap-1.5 sm:gap-2"
            >
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <RadioGroupItem value="today" id="today" className="h-4 w-4 sm:h-5 sm:w-5" />
                <Label htmlFor="today" className="cursor-pointer font-normal text-xs sm:text-sm">
            Hoy
                </Label>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <RadioGroupItem value="week" id="week" className="h-4 w-4 sm:h-5 sm:w-5" />
                <Label htmlFor="week" className="cursor-pointer font-normal text-xs sm:text-sm">
            Esta Semana
                </Label>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <RadioGroupItem value="month" id="month" className="h-4 w-4 sm:h-5 sm:w-5" />
                <Label htmlFor="month" className="cursor-pointer font-normal text-xs sm:text-sm">
            Este Mes
                </Label>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <RadioGroupItem value="custom" id="custom" className="h-4 w-4 sm:h-5 sm:w-5" />
                <Label htmlFor="custom" className="cursor-pointer font-normal text-xs sm:text-sm">
            Personalizado
                </Label>
              </div>
            </RadioGroup>
        </div>

        {dateRange === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
              <DatePicker
                date={customStartDate}
                onDateChange={setCustomStartDate}
                label="Desde"
                />
              <DatePicker
                date={customEndDate}
                onDateChange={setCustomEndDate}
                label="Hasta"
                />
          </div>
        )}

          <div className="text-sm text-muted-foreground flex items-center">
            <CalendarIcon className="inline w-4 h-4 mr-1" />
          Período: {format(new Date(startDate), "dd 'de' MMMM", { locale: es })} al{' '}
          {format(new Date(endDate), "dd 'de' MMMM, yyyy", { locale: es })}
        </div>
        </CardContent>
      </Card>

      {/* Resumen Principal de Ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card className="border border-border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Total Ventas</span>
              <TrendingUp className="w-5 h-5 text-primary" />
          </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {(salesReport as any)?.total_sales || 0}
          </p>
            <p className="text-xs text-muted-foreground mt-1">transacciones</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Ingresos USD</span>
              <DollarSign className="w-5 h-5 text-primary" />
          </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
            ${((salesReport as any)?.total_amount_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-muted-foreground mt-1">
            {((salesReport as any)?.total_amount_bs || 0).toFixed(2)} Bs
          </p>
          </CardContent>
        </Card>

        <Card className="bg-success/5 !border-success border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-success">Ganancia Neta</span>
              <Wallet className="w-5 h-5 text-success" />
          </div>
            <p className="text-xl sm:text-2xl font-bold text-success">
            ${((salesReport as any)?.total_profit_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-success mt-1">
            {((salesReport as any)?.total_profit_bs || 0).toFixed(2)} Bs
          </p>
          </CardContent>
        </Card>

        <Card className="bg-info/5 !border-info border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-info">Margen</span>
              <Percent className="w-5 h-5 text-info" />
          </div>
            <p className="text-xl sm:text-2xl font-bold text-info">
            {(salesReport?.profit_margin || 0).toFixed(1)}%
          </p>
            <p className="text-xs text-info mt-1">de ganancia</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Costos y Deuda */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card className="border border-border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Costo Total</span>
              <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
            <p className="text-lg sm:text-xl font-bold text-destructive">
            ${((salesReport as any)?.total_cost_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-muted-foreground mt-1">
            {((salesReport as any)?.total_cost_bs || 0).toFixed(2)} Bs
          </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Deuda Pendiente</span>
              <AlertCircle className="w-5 h-5 text-warning" />
          </div>
            <p className="text-lg sm:text-xl font-bold text-warning">
            ${((debtSummary as any)?.total_pending_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-muted-foreground mt-1">por cobrar (FIAO)</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Deudas Abiertas</span>
              <Users className="w-5 h-5 text-warning" />
          </div>
            <p className="text-lg sm:text-xl font-bold text-foreground">
            {((debtSummary as any)?.by_status?.open || 0) + ((debtSummary as any)?.by_status?.partial || 0)}
          </p>
            <p className="text-xs text-muted-foreground mt-1">clientes con deuda</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Ticket Promedio</span>
              <BarChart3 className="w-5 h-5 text-primary" />
          </div>
            <p className="text-lg sm:text-xl font-bold text-foreground">
            ${salesReport && (salesReport as any).total_sales > 0
              ? ((salesReport as any).total_amount_usd / (salesReport as any).total_sales).toFixed(2)
              : '0.00'}
          </p>
            <p className="text-xs text-muted-foreground mt-1">USD por venta</p>
          </CardContent>
        </Card>
      </div>

      {/* Ventas por Método de Pago */}
      {salesReport && (salesReport as any).by_payment_method && Object.keys((salesReport as any).by_payment_method).length > 0 && (
        <Card className="mb-4 sm:mb-6 border border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-primary" />
              Ventas por Método de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries((salesReport as any).by_payment_method)
                .sort(([a], [b]) => {
                  // Priorizar FIAO al inicio
                  if (a === 'FIAO') return -1
                  if (b === 'FIAO') return 1
                  return 0
                })
                .map(([method, data]: [string, any]) => {
                  const isFIAO = method === 'FIAO'
                  return (
                    <Card
                  key={method}
                      className={cn(
                        'border',
                        isFIAO ? 'bg-warning/5 !border-warning' : 'bg-muted/50 border-border'
                      )}
                >
                      <CardContent className="p-3">
                  <div className="flex justify-between items-center mb-2">
                          <span
                            className={cn(
                              'font-semibold',
                              isFIAO ? 'text-warning' : 'text-foreground'
                            )}
                          >
                      {paymentMethodLabels[method] || method}
                    </span>
                          <Badge variant={isFIAO ? 'default' : 'secondary'} className={isFIAO ? 'bg-warning text-white' : ''}>
                      {(data?.count || 0)} ventas
                          </Badge>
                  </div>
                        <div className="text-sm">
                          <p className={cn(isFIAO ? 'text-warning' : 'text-muted-foreground')}>
                            {(data?.amount_bs || 0).toFixed(2)} Bs
                          </p>
                          <p className={cn('font-medium', isFIAO ? 'text-warning' : 'text-foreground')}>
                            ${(data?.amount_usd || 0).toFixed(2)} USD
                          </p>
                  </div>
                      </CardContent>
                    </Card>
                  )
                })}
                </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen de Deudas - Accordion */}
      {debtSummary && (
        <Accordion type="single" collapsible className="mb-4 sm:mb-6" defaultValue="debtors">
          <AccordionItem value="debtors" className="border border-border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-warning" />
                <span className="text-lg font-bold">Resumen de FIAO / Deudas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {/* Stats de deudas */}
              {debtSummary ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Fiado</p>
                        <p className="text-lg font-bold text-foreground">
                        ${((debtSummary as any).total_debt_usd || 0).toFixed(2)}
                      </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-success/5 !border-success border">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Cobrado</p>
                        <p className="text-lg font-bold text-success">
                        ${((debtSummary as any).total_paid_usd || 0).toFixed(2)}
                      </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-warning/5 !border-warning border">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Pendiente</p>
                        <p className="text-lg font-bold text-warning">
                        ${((debtSummary as any).total_pending_usd || 0).toFixed(2)}
                      </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-info/5 !border-info border">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Deudas Abiertas</p>
                        <p className="text-lg font-bold text-info">
                        {((debtSummary as any).by_status?.open || 0) + ((debtSummary as any).by_status?.partial || 0)}
                      </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top deudores */}
                  {(debtSummary as any).top_debtors && Array.isArray((debtSummary as any).top_debtors) && (debtSummary as any).top_debtors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Top 10 Deudores</h3>
                  <div className="space-y-2">
                    {debtSummary.top_debtors.map((debtor: any, index: number) => (
                      <Card
                        key={debtor.customer_id}
                        className="bg-muted/50 border-border"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                        <div className="flex items-center">
                              <Badge
                                variant={index < 3 ? 'default' : 'secondary'}
                                className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3',
                                  index < 3 && 'bg-warning text-white'
                                )}
                          >
                            {index + 1}
                              </Badge>
                              <span className="font-medium text-foreground">{debtor.customer_name}</span>
                        </div>
                        <div className="text-right">
                              <p className="font-bold text-warning">${debtor.pending_usd.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{debtor.pending_bs.toFixed(2)} Bs</p>
                        </div>
                      </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No hay datos de deudas disponibles</p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Top Productos - Accordion */}
      {topProducts && Array.isArray(topProducts) && topProducts.length > 0 && (
        <Accordion type="single" collapsible className="mb-4 sm:mb-6" defaultValue="products">
          <AccordionItem value="products" className="border border-border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center">
                <Package className="w-5 h-5 mr-2 text-primary" />
                <span className="text-lg font-bold">Top 10 Productos Más Vendidos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Tabs defaultValue="weight" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="weight">Por Peso</TabsTrigger>
                  <TabsTrigger value="units">Por Cantidad</TabsTrigger>
                </TabsList>
                
                {/* Tab: Productos por Peso */}
                <TabsContent value="weight" className="mt-0">
                  <div className="space-y-2">
                    {(() => {
                      const getWeightQty = (product: any) =>
                        Number(product.quantity_sold_kg ?? product.quantity_sold ?? 0)
                      const weightProducts = topProducts
                        .filter((p: any) => p.is_weight_product)
                        .sort((a: any, b: any) => getWeightQty(b) - getWeightQty(a))
                        .slice(0, 10)
                      const maxQtyWeight = weightProducts.reduce(
                        (max: number, product: any) => Math.max(max, getWeightQty(product)),
                        1,
                      )
                      
                      return weightProducts.length > 0 ? (
                        weightProducts.map((product: any, index: number) => {
                          const percentage = (getWeightQty(product) / maxQtyWeight) * 100
                          return (
                            <Card
                              key={product.product_id}
                              className="bg-muted/50 border-border relative overflow-hidden"
                            >
                              <CardContent className="p-3">
                                <div className="relative flex items-center justify-between">
                                  <div className="flex items-center flex-1 min-w-0">
                                    <Badge
                                      variant={index < 3 ? 'default' : 'secondary'}
                                      className={cn(
                                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0',
                                        index < 3 && 'bg-primary text-white'
                                      )}
                                    >
                                      {index + 1}
                                    </Badge>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground truncate">{product.product_name}</p>
                                      <p className="text-xs text-muted-foreground">
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
                                    <p className="font-bold text-success">
                                      +${product.profit_usd.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-info">
                                      {product.profit_margin.toFixed(0)}% margen
                                    </p>
                                  </div>
                                </div>
                                {/* Barra de progreso */}
                                <div className="mt-2">
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No hay productos por peso disponibles
                        </p>
                      )
                    })()}
                  </div>
                </TabsContent>

                {/* Tab: Productos por Cantidad/Unidades */}
                <TabsContent value="units" className="mt-0">
                  <div className="space-y-2">
                    {(() => {
                      const getUnitQty = (product: any) =>
                        Number(product.quantity_sold_units ?? product.quantity_sold ?? 0)
                      const unitProducts = topProducts
                        .filter((p: any) => !p.is_weight_product)
                        .sort((a: any, b: any) => getUnitQty(b) - getUnitQty(a))
                        .slice(0, 10)
                      const maxQtyUnits = unitProducts.reduce(
                        (max: number, product: any) => Math.max(max, getUnitQty(product)),
                        1,
                      )
                      
                      return unitProducts.length > 0 ? (
                        unitProducts.map((product: any, index: number) => {
                          const percentage = (getUnitQty(product) / maxQtyUnits) * 100
                          return (
                            <Card
                              key={product.product_id}
                              className="bg-muted/50 border-border relative overflow-hidden"
                            >
                              <CardContent className="p-3">
                                <div className="relative flex items-center justify-between">
                                  <div className="flex items-center flex-1 min-w-0">
                                    <Badge
                                      variant={index < 3 ? 'default' : 'secondary'}
                                      className={cn(
                                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0',
                                        index < 3 && 'bg-primary text-white'
                                      )}
                                    >
                                      {index + 1}
                                    </Badge>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground truncate">{product.product_name}</p>
                                      <p className="text-xs text-muted-foreground">
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
                                    <p className="font-bold text-success">
                                      +${product.profit_usd.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-info">
                                      {product.profit_margin.toFixed(0)}% margen
                                    </p>
                                  </div>
                                </div>
                                {/* Barra de progreso */}
                                <div className="mt-2">
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No hay productos por cantidad disponibles
                        </p>
                      )
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Ventas Diarias - Accordion */}
      {salesReport && (salesReport as any).daily && Array.isArray((salesReport as any).daily) && (salesReport as any).daily.length > 0 && (
        <Accordion type="single" collapsible className="mb-4 sm:mb-6" defaultValue="daily">
          <AccordionItem value="daily" className="border border-border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-success" />
                <span className="text-lg font-bold">Desglose Diario</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-center">Ventas</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Costo</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {(salesReport as any).daily && Array.isArray((salesReport as any).daily) && (salesReport as any).daily.map((day: any) => (
                      <TableRow key={day.date}>
                        <TableCell>
                          <span className="font-medium text-foreground">
                          {format(new Date(day.date + 'T12:00:00'), "EEE dd/MM", {
                            locale: es,
                          })}
                        </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                          {day.sales_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium text-foreground">${day.total_usd.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <span className="text-destructive">${day.cost_usd.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-success">${day.profit_usd.toFixed(2)}</span>
                        </TableCell>
                      </TableRow>
                  ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold text-foreground">TOTAL</TableCell>
                      <TableCell className="text-center font-bold text-foreground">
                      {salesReport.total_sales}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                      ${salesReport.total_amount_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive hidden sm:table-cell">
                      ${salesReport.total_cost_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                      ${salesReport.total_profit_usd.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
            </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Estado vacío */}
      {!isLoading && (!salesReport || (salesReport as any)?.total_sales === 0) && (
        <Card className="border border-border">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm sm:text-base font-medium text-foreground mb-2">No hay datos para mostrar</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
            No se encontraron ventas en el período seleccionado. Intenta con un rango de fechas diferente.
          </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border border-border">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
