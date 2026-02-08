import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Square, Grid3x3, LayoutGrid, Plus } from 'lucide-react'
import { Table } from '@/services/tables.service'
import { ordersService, Order } from '@/services/orders.service'
import toast from '@/lib/toast'
import TablesGrid from '@/components/tables/TablesGrid'
import FloorPlanView from '@/components/tables/FloorPlanView'
import OrderModal from '@/components/tables/OrderModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders'
import OrderItemModal from '@/components/tables/OrderItemModal'
import { AddOrderItemRequest } from '@/services/orders.service'
import { cn } from '@/lib/utils'

export default function TablesPage() {
  const queryClient = useQueryClient()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isInitialItemModalOpen, setIsInitialItemModalOpen] = useState(false)
  const [tableIdForNewOrder, setTableIdForNewOrder] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'floor'>('grid')

  // Escuchar actualizaciones en tiempo real
  useRealtimeOrders()

  const { data: openOrders } = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => ordersService.getOpenOrders(),
    staleTime: 1000 * 30, // 30 segundos
    refetchInterval: 1000 * 30, // Refrescar cada 30 segundos
  })

  const createOrderMutation = useMutation({
    mutationFn: (data: { tableId: string | null; items: AddOrderItemRequest[] }) =>
      ordersService.createOrder({
        table_id: data.tableId,
        items: data.items
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Orden creada correctamente')
      setSelectedOrder(order)
      setIsOrderModalOpen(true)
      setIsInitialItemModalOpen(false)
      setTableIdForNewOrder(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la orden')
    },
  })

  const handleTableClick = (table: Table) => {
    // Si la mesa tiene una orden abierta, abrirla
    if (table.current_order_id) {
      const order = openOrders?.find((o: Order) => o.id === table.current_order_id)
      if (order) {
        setSelectedOrder(order)
        setIsOrderModalOpen(true)
      } else {
        // Si hay current_order_id pero no encontramos la orden, permitir crear una nueva
        setTableIdForNewOrder(table.id)
        setIsInitialItemModalOpen(true)
      }
    } else {
      // Si no tiene orden, abrir selector de productos para crear una
      setTableIdForNewOrder(table.id)
      setIsInitialItemModalOpen(true)
    }
  }

  const handleCreateOrder = (tableId: string | null) => {
    setTableIdForNewOrder(tableId)
    setIsInitialItemModalOpen(true)
  }

  const handleInitialItemConfirm = (items: AddOrderItemRequest[]) => {
    createOrderMutation.mutate({
      tableId: tableIdForNewOrder,
      items
    })
  }

  const handleOrderUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
    queryClient.invalidateQueries({ queryKey: ['tables'] })
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center">
              <Square className="w-6 h-6 sm:w-8 sm:h-8 text-primary mr-2 sm:mr-3" />
              Mesas y Órdenes
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Gestiona el estado de tus mesas y comandas en tiempo real
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handleCreateOrder(null)}
              className="h-9 sm:h-10 px-4 rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Orden
            </Button>
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl w-fit">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "h-8 sm:h-9 px-3 sm:px-4 rounded-lg font-semibold transition-all",
                  viewMode === 'grid' && "shadow-sm bg-background text-primary hover:bg-background"
                )}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'floor' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('floor')}
                className={cn(
                  "h-8 sm:h-9 px-3 sm:px-4 rounded-lg font-semibold transition-all",
                  viewMode === 'floor' && "shadow-sm bg-background text-primary hover:bg-background"
                )}
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                Plano
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-none bg-transparent shadow-none">
        <CardContent className="p-0">
          {viewMode === 'grid' ? (
            <TablesGrid
              onTableClick={handleTableClick}
              onCreateOrder={handleCreateOrder}
            />
          ) : (
            <FloorPlanView
              onTableClick={handleTableClick}
              onCreateOrder={handleCreateOrder}
            />
          )}
        </CardContent>
      </Card>

      {/* Modales relacionados con órdenes */}
      {selectedOrder && (
        <OrderModal
          isOpen={isOrderModalOpen}
          onClose={() => {
            setIsOrderModalOpen(false)
            setSelectedOrder(null)
          }}
          order={selectedOrder}
          onOrderUpdated={handleOrderUpdated}
        />
      )}

      {/* Selector inicial de item para nuevas órdenes */}
      <OrderItemModal
        isOpen={isInitialItemModalOpen}
        onClose={() => {
          setIsInitialItemModalOpen(false)
          setTableIdForNewOrder(null)
        }}
        onConfirm={handleInitialItemConfirm}
        isLoading={createOrderMutation.isPending}
      />
    </div>
  )
}

