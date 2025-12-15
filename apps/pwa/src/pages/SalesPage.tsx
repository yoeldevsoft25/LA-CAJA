import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Eye, Calendar as CalendarIcon, Store, AlertCircle } from 'lucide-react'
import { salesService, Sale } from '@/services/sales.service'
import { authService } from '@/services/auth.service'
import { useAuth } from '@/stores/auth.store'
import SaleDetailModal from '@/components/sales/SaleDetailModal'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  const isOwner = user?.role === 'owner'
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date())
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  // Obtener lista de tiendas (solo para owners)
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => authService.getStores(),
    enabled: isOwner,
  })

  // Convertir fechas a formato string para la API
  const effectiveDateFrom = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  const effectiveDateTo = dateTo ? format(dateTo, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

  // Determinar store_id a usar
  const effectiveStoreId = selectedStoreId || user?.store_id || ''

  // Obtener datos del prefetch como placeholderData (últimas 50 ventas)
  const prefetchedSales = queryClient.getQueryData<{ sales: Sale[]; total: number }>(['sales', 'list', effectiveStoreId, { limit: 50 }])

  // Obtener ventas
  const { data: salesData, isLoading } = useQuery<{ sales: Sale[]; total: number }>({
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

  const sales = salesData?.sales || []
  const total = salesData?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Calcular totales
  const totalSalesBs = sales.reduce(
    (sum: number, sale: Sale) => sum + Number(sale.totals.total_bs),
    0
  )
  const totalSalesUsd = sales.reduce(
    (sum: number, sale: Sale) => sum + Number(sale.totals.total_usd),
    0
  )

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailModalOpen(true)
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

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Historial de Ventas</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {total} venta{total !== 1 ? 's' : ''} en el período seleccionado
            </p>
          </div>
          {total > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-right">
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
                value={selectedStoreId}
                  onValueChange={(value) => {
                    setSelectedStoreId(value)
                  setCurrentPage(1)
                }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las tiendas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las tiendas</SelectItem>
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
        </div>
        </CardContent>
      </Card>

      {/* Lista de ventas */}
      <Card className="border border-border">
        <CardContent className="p-0">
        {isLoading ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
          </div>
        ) : sales.length === 0 ? (
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
        ) : (
          <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead className="hidden sm:table-cell">Productos</TableHead>
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
                    const totalItems = sale.items.reduce((sum: number, item: any) => sum + item.qty, 0)
                    
                    // Determinar estado de deuda para FIAO
                    const isFIAO = sale.payment.method === 'FIAO'
                    const debtStatus = sale.debt?.status || null
                    const isPending = isFIAO && (debtStatus === 'open' || debtStatus === 'partial')
                    const isPaid = isFIAO && debtStatus === 'paid'
                    
                    // Clases de color para la fila según estado de deuda
                      let rowClassName = ''
                    if (isPending) {
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
                          </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                          <div className="text-sm">
                              <p className="font-medium text-foreground">
                              {itemCount} producto{itemCount !== 1 ? 's' : ''}
                            </p>
                              <p className="text-xs text-muted-foreground">
                              {totalItems} unidad{totalItems !== 1 ? 'es' : ''} total
                            </p>
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
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(sale)}
                              className="text-primary hover:text-primary"
                            >
                              <Eye className="w-4 h-4 mr-1.5" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                    )
                  })}
                  </TableBody>
                </Table>
            </div>

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
