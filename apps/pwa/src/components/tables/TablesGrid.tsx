import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Square,
  Plus,
  Edit,
  Trash2,
  Users,
  Clock,
  QrCode,
  MoreVertical,
} from 'lucide-react'
import OrderProgressBar, { type OrderProgressData } from '@/components/public/OrderProgressBar'
import {
  tablesService,
  Table,
  TableStatus,
  CreateTableRequest,
  UpdateTableRequest,
} from '@/services/tables.service'
import { ordersService, Order } from '@/services/orders.service'
import toast from '@/lib/toast'
import TableModal from './TableModal'
import TableQRCodeModal from './TableQRCodeModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const statusLabels: Record<TableStatus, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  cleaning: 'Limpieza',
  out_of_service: 'Fuera de Servicio',
}

const statusColors: Record<TableStatus, string> = {
  available: 'default',
  occupied: 'secondary',
  reserved: 'default',
  cleaning: 'default',
  out_of_service: 'destructive',
}

interface TablesGridProps {
  onTableClick: (table: Table) => void
  onCreateOrder: (tableId: string | null) => void
}

export default function TablesGrid({ onTableClick, onCreateOrder }: TablesGridProps) {
  const queryClient = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null)
  const [tableToShowQR, setTableToShowQR] = useState<Table | null>(null)
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all')

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables', statusFilter],
    queryFn: () =>
      tablesService.getTablesByStore(
        statusFilter === 'all' ? undefined : statusFilter
      ),
    staleTime: 1000 * 60 * 2, // 2 minutos
    refetchInterval: 1000 * 30, // Refrescar cada 30 segundos
  })

  const { data: openOrders } = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => ordersService.getOpenOrders(),
    staleTime: 1000 * 60 * 1, // 1 minuto
    refetchInterval: 1000 * 30, // Refrescar cada 30 segundos
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTableRequest) => tablesService.createTable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Mesa creada correctamente')
      setIsModalOpen(false)
      setSelectedTable(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la mesa')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTableRequest }) =>
      tablesService.updateTable(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Mesa actualizada correctamente')
      setIsModalOpen(false)
      setSelectedTable(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar la mesa')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tablesService.deleteTable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Mesa eliminada correctamente')
      setTableToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar la mesa')
    },
  })

  const handleEdit = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTable(table)
    setIsModalOpen(true)
  }

  const handleShowQR = (table: Table) => {
    setTableToShowQR(table)
  }

  const handleAdd = () => {
    setSelectedTable(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateTableRequest | UpdateTableRequest) => {
    if (selectedTable) {
      updateMutation.mutate({ id: selectedTable.id, data: data as UpdateTableRequest })
    } else {
      createMutation.mutate(data as CreateTableRequest)
    }
  }

  const getTableOrder = (tableId: string | null) => {
    if (!tableId || !openOrders) return null
    return openOrders.find((order) => order.table_id === tableId && order.status === 'open')
  }

  const calculateOrderTotal = (order: Order) => {
    let totalBs = 0
    let totalUsd = 0

    // Verificar que items exista y sea un array
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const itemTotalBs =
          Number(item.unit_price_bs) * item.qty - Number(item.discount_bs || 0)
        const itemTotalUsd =
          Number(item.unit_price_usd) * item.qty - Number(item.discount_usd || 0)
        totalBs += itemTotalBs
        totalUsd += itemTotalUsd
      })
    }

    // Restar pagos parciales (verificar que payments exista y sea un array)
    if (order.payments && Array.isArray(order.payments)) {
      order.payments.forEach((payment) => {
        totalBs -= Number(payment.amount_bs)
        totalUsd -= Number(payment.amount_usd)
      })
    }

    return { bs: Math.max(0, totalBs), usd: Math.max(0, totalUsd) }
  }

  const calculateElapsedTime = (order: Order) => {
    if (!order.opened_at) return 0
    const openedAt = new Date(order.opened_at).getTime()
    const now = Date.now()
    return Math.floor((now - openedAt) / (1000 * 60)) // minutos
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getTimeColor = (minutes: number) => {
    if (minutes < 15) return 'text-emerald-600 dark:text-emerald-400'
    if (minutes < 30) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getOrderProgress = (order: Order): OrderProgressData => {
    if (!order.items || !Array.isArray(order.items)) {
      return {
        totalItems: 0,
        pendingItems: 0,
        preparingItems: 0,
        readyItems: 0,
        orderStatus: order.status,
      }
    }

    const pendingItems = order.items.filter((item: any) => item.status === 'pending' || !item.status).length
    const preparingItems = order.items.filter((item: any) => item.status === 'preparing').length
    const readyItems = order.items.filter((item: any) => item.status === 'ready').length

    return {
      totalItems: order.items.length,
      pendingItems,
      preparingItems,
      readyItems,
      orderStatus: order.status,
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filtros y acciones */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as TableStatus | 'all')}
          >
            <SelectTrigger className="w-full sm:w-[200px] h-11 bg-card border-border/40 font-medium">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las mesas</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="occupied">Ocupadas</SelectItem>
              <SelectItem value="reserved">Reservadas</SelectItem>
              <SelectItem value="cleaning">Limpieza</SelectItem>
              <SelectItem value="out_of_service">Fuera de Servicio</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleAdd}
            className="h-11 sm:h-12 px-6 font-bold shadow-md shadow-primary/20"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Mesa
          </Button>
        </div>

        {/* Grid de mesas */}
        {tables && tables.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No hay mesas configuradas. Crea una mesa para comenzar.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {tables?.map((table) => {
              const order = getTableOrder(table.id)
              const totals = order ? calculateOrderTotal(order) : null
              const elapsedTime = order ? calculateElapsedTime(order) : 0
              const isLongWait = elapsedTime > 30

              return (
                <div
                  key={table.id}
                  onClick={() => onTableClick(table)}
                  className={cn(
                    'relative p-3 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.98] hover:shadow-xl',
                    'bg-card shadow-sm group',
                    table.status === 'occupied'
                      ? isLongWait
                        ? 'border-destructive bg-destructive/10'
                        : 'border-primary bg-primary/5'
                      : table.status === 'reserved'
                        ? 'border-amber-400 bg-amber-500/10'
                        : table.status === 'out_of_service'
                          ? 'border-muted bg-muted/20 opacity-60 grayscale'
                          : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  {/* Botones de acción - Menú desplegable */}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(table, e as any)
                          }}
                          className="cursor-pointer"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar mesa
                        </DropdownMenuItem>
                        {table.qrCode && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleShowQR(table)
                              }}
                              className="cursor-pointer"
                            >
                              <QrCode className="w-4 h-4 mr-2" />
                              Ver código QR
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setTableToDelete(table)
                          }}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar mesa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Contenido de la mesa */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Square className="w-5 h-5 text-primary flex-shrink-0" />
                          <h3 className="font-bold text-lg text-foreground truncate">
                            {table.table_number}
                          </h3>
                        </div>
                        {table.name && (
                          <p className="text-xs text-muted-foreground truncate">{table.name}</p>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={statusColors[table.status] as any}
                      className="text-xs"
                    >
                      {statusLabels[table.status]}
                    </Badge>

                    {table.capacity && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{table.capacity} personas</span>
                      </div>
                    )}

                    {order && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                        {/* Información de la orden */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">Orden</span>
                            <span className="text-xs font-black text-foreground tabular-nums">
                              #{order.order_number}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            {/* Tiempo transcurrido */}
                            {elapsedTime > 0 ? (
                              <div className={cn(
                                'flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-card shadow-sm border border-border/50',
                                getTimeColor(elapsedTime)
                              )}>
                                <Clock className="w-3.5 h-3.5" />
                                <span>{formatTime(elapsedTime)}</span>
                              </div>
                            ) : <div></div>}

                            {totals && (
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase leading-none mb-0.5">Pendiente</p>
                                <p className="text-xs sm:text-sm font-black text-primary">
                                  ${totals.usd.toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Barra de progreso de la orden */}
                        {order.items && order.items.length > 0 && (
                          <div className="pt-2 border-t border-border/30">
                            <OrderProgressBar
                              progress={getOrderProgress(order)}
                              compact={true}
                              showLabels={false}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {!order && table.status === 'available' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 h-10 border border-dashed border-primary/30 text-primary hover:bg-primary/5 font-bold rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCreateOrder(table.id)
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Abrir Cuenta
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de crear/editar */}
      <TableModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTable(null)
        }}
        table={selectedTable}
        onConfirm={handleConfirm}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Modal de código QR */}
      {tableToShowQR && (
        <TableQRCodeModal
          isOpen={!!tableToShowQR}
          onClose={() => setTableToShowQR(null)}
          table={tableToShowQR}
        />
      )}

      {/* Dialog de eliminar */}
      <AlertDialog open={!!tableToDelete} onOpenChange={() => setTableToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la mesa{' '}
              {tableToDelete && (
                <>
                  <strong>{tableToDelete.table_number}</strong>
                  {tableToDelete.name && ` (${tableToDelete.name})`}.
                </>
              )}{' '}
              Si hay órdenes asociadas, no se podrá eliminar. ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tableToDelete && deleteMutation.mutate(tableToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
