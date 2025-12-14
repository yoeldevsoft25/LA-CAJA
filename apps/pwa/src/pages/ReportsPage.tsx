import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { reportsService, SalesByDayReport, TopProduct, DebtSummaryReport } from '@/services/reports.service'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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
            <Label className="text-sm font-semibold mb-3 block">Rango de Fechas</Label>
            <RadioGroup
              value={dateRange}
              onValueChange={(value) => setDateRange(value as DateRange)}
              className="flex flex-wrap gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="today" id="today" />
                <Label htmlFor="today" className="cursor-pointer font-normal">
            Hoy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="week" id="week" />
                <Label htmlFor="week" className="cursor-pointer font-normal">
            Esta Semana
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="month" id="month" />
                <Label htmlFor="month" className="cursor-pointer font-normal">
            Este Mes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer font-normal">
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
            {salesReport?.total_sales || 0}
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
            ${(salesReport?.total_amount_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-muted-foreground mt-1">
            {(salesReport?.total_amount_bs || 0).toFixed(2)} Bs
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
            ${(salesReport?.total_profit_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-success mt-1">
            {(salesReport?.total_profit_bs || 0).toFixed(2)} Bs
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
            ${(salesReport?.total_cost_usd || 0).toFixed(2)}
          </p>
            <p className="text-xs text-muted-foreground mt-1">
            {(salesReport?.total_cost_bs || 0).toFixed(2)} Bs
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
            ${(debtSummary?.total_pending_usd || 0).toFixed(2)}
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
            {(debtSummary?.by_status.open || 0) + (debtSummary?.by_status.partial || 0)}
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
            ${salesReport && salesReport.total_sales > 0
              ? (salesReport.total_amount_usd / salesReport.total_sales).toFixed(2)
              : '0.00'}
          </p>
            <p className="text-xs text-muted-foreground mt-1">USD por venta</p>
          </CardContent>
        </Card>
      </div>

      {/* Ventas por Método de Pago */}
      {salesReport && Object.keys(salesReport.by_payment_method).length > 0 && (
        <Card className="mb-4 sm:mb-6 border border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-primary" />
              Ventas por Método de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(salesReport.by_payment_method)
                .sort(([a], [b]) => {
                  // Priorizar FIAO al inicio
                  if (a === 'FIAO') return -1
                  if (b === 'FIAO') return 1
                  return 0
                })
                .map(([method, data]) => {
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
                      {data.count} ventas
                          </Badge>
                  </div>
                        <div className="text-sm">
                          <p className={cn(isFIAO ? 'text-warning' : 'text-muted-foreground')}>
                            {data.amount_bs.toFixed(2)} Bs
                          </p>
                          <p className={cn('font-medium', isFIAO ? 'text-warning' : 'text-foreground')}>
                            ${data.amount_usd.toFixed(2)} USD
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Total Fiado</p>
                    <p className="text-lg font-bold text-foreground">
                    ${debtSummary.total_debt_usd.toFixed(2)}
                  </p>
                  </CardContent>
                </Card>
                <Card className="bg-success/5 !border-success border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Total Cobrado</p>
                    <p className="text-lg font-bold text-success">
                    ${debtSummary.total_paid_usd.toFixed(2)}
                  </p>
                  </CardContent>
                </Card>
                <Card className="bg-warning/5 !border-warning border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Pendiente</p>
                    <p className="text-lg font-bold text-warning">
                    ${debtSummary.total_pending_usd.toFixed(2)}
                  </p>
                  </CardContent>
                </Card>
                <Card className="bg-info/5 !border-info border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Deudas Abiertas</p>
                    <p className="text-lg font-bold text-info">
                    {debtSummary.by_status.open + debtSummary.by_status.partial}
                  </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top deudores */}
              {debtSummary.top_debtors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Top 10 Deudores</h3>
                  <div className="space-y-2">
                    {debtSummary.top_debtors.map((debtor, index) => (
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Top Productos - Accordion */}
      {topProducts && topProducts.length > 0 && (
        <Accordion type="single" collapsible className="mb-4 sm:mb-6" defaultValue="products">
          <AccordionItem value="products" className="border border-border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center">
                <Package className="w-5 h-5 mr-2 text-primary" />
                <span className="text-lg font-bold">Top 10 Productos Más Vendidos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                {topProducts.map((product, index) => {
                  const maxQty = topProducts[0]?.quantity_sold || 1
                  const percentage = (product.quantity_sold / maxQty) * 100

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
                              {product.quantity_sold} vendidos • ${product.revenue_usd.toFixed(2)}
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
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Ventas Diarias - Accordion */}
      {salesReport && salesReport.daily.length > 0 && (
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
                  {salesReport.daily.map((day) => (
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
      {!isLoading && (!salesReport || salesReport.total_sales === 0) && (
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
