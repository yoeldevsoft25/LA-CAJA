import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Package,
  ArrowRight,
  Eye,
  Copy,
} from 'lucide-react'
import {
  purchaseOrdersService,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/services/purchase-orders.service'
import { suppliersService } from '@/services/suppliers.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PurchaseOrderFormModal from '@/components/purchase-orders/PurchaseOrderFormModal'
import PurchaseOrderDetailModal from '@/components/purchase-orders/PurchaseOrderDetailModal'

const statusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  confirmed: 'Confirmada',
  partial: 'Parcial',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const statusColors: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-card border border-border/60 text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  confirmed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-destructive/10 text-destructive',
}

function getStatusBadge(status: PurchaseOrderStatus) {
  return (
    <Badge variant="secondary" className={statusColors[status]}>
      {statusLabels[status]}
    </Badge>
  )
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [duplicateOrder, setDuplicateOrder] = useState<PurchaseOrder | null>(null)

  // Obtener supplier_id de URL params si existe
  const supplierIdParam = searchParams.get('supplier_id')

  // Obtener proveedores y bodegas para filtros
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll(),
    enabled: !!user?.store_id,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: !!user?.store_id,
  })

  // Obtener órdenes de compra
  const { data: orders = [], isLoading } = useQuery({
    queryKey: [
      'purchase-orders',
      statusFilter !== 'all' ? statusFilter : undefined,
      supplierFilter !== 'all' ? supplierFilter : undefined,
      warehouseFilter !== 'all' ? warehouseFilter : undefined,
    ],
    queryFn: () =>
      purchaseOrdersService.getAll(
        statusFilter !== 'all' ? statusFilter : undefined,
        supplierFilter !== 'all' ? supplierFilter : undefined,
        warehouseFilter !== 'all' ? warehouseFilter : undefined
      ),
    enabled: !!user?.store_id,
  })

  // Prellenar supplier_id si viene de URL
  useEffect(() => {
    if (supplierIdParam && suppliers.length > 0) {
      const supplierExists = suppliers.some((s) => s.id === supplierIdParam)
      if (supplierExists) {
        setSupplierFilter(supplierIdParam)
      }
    }
  }, [supplierIdParam, suppliers])

  // Filtrar órdenes por búsqueda
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.supplier?.name.toLowerCase().includes(query) ||
      order.warehouse?.name.toLowerCase().includes(query)
    )
  })

  const handleCreate = () => {
    setSelectedOrder(null)
    setIsFormOpen(true)
  }

  const handleViewDetail = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setIsDetailOpen(true)
  }

  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    setSelectedOrder(null)
  }

  const handleDuplicate = (order: PurchaseOrder) => {
    // Guardar la orden a duplicar para pasarla al modal
    setDuplicateOrder(order)
    setSelectedOrder(null)
    setIsFormOpen(true)
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Órdenes de Compra</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona órdenes de compra a proveedores
          </p>
        </div>
        <Button onClick={handleCreate} variant="outline" className="btn-glass-neutral">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Orden
        </Button>
      </div>

      {/* Filtros */}
      <Card className="bg-card border border-border/60">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Búsqueda</Label>
              <Input
                type="text"
                placeholder="Buscar por número, proveedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1 border-muted/40 bg-card"
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as PurchaseOrderStatus | 'all')}
              >
                <SelectTrigger className="mt-1 border-muted/40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proveedor</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="mt-1 border-muted/40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {suppliers
                    .filter((s) => s.is_active)
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bodega</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="mt-1 border-muted/40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {warehouses
                    .filter((w) => w.is_active)
                    .map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de órdenes */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || supplierFilter !== 'all' || warehouseFilter !== 'all'
                ? 'No se encontraron órdenes'
                : 'No hay órdenes de compra'}
            </p>
            <Button onClick={handleCreate} variant="outline" className="mt-4 btn-glass-neutral">
              Crear primera orden
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="border border-border hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <div className="flex items-center gap-4 mt-2">
                      {getStatusBadge(order.status)}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Proveedor: {order.supplier?.name}</span>
                        {order.warehouse && (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            <span>Bodega: {order.warehouse.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="btn-glass-neutral"
                      onClick={() => handleDuplicate(order)}
                      title="Duplicar orden anterior"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="btn-glass-neutral"
                      onClick={() => handleViewDetail(order)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Fecha Solicitud</p>
                    <p className="font-medium">
                      {new Date(order.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  {order.expected_delivery_date && (
                    <div>
                      <p className="text-muted-foreground">Fecha Esperada</p>
                      <p className="font-medium">
                        {new Date(order.expected_delivery_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-bold">
                      Bs. {Number(order.total_amount_bs).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(order.total_amount_usd).toFixed(2)} USD
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Items</p>
                    <p className="font-medium">{order.items.length} productos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de crear/editar orden */}
      <PurchaseOrderFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setDuplicateOrder(null)
        }}
        initialSupplierId={
          duplicateOrder?.supplier_id || supplierIdParam || undefined
        }
        initialProducts={
          duplicateOrder
            ? duplicateOrder.items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              }))
            : undefined
        }
        onSuccess={() => {
          setIsFormOpen(false)
          setDuplicateOrder(null)
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        }}
      />

      {/* Modal de detalles */}
      <PurchaseOrderDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        order={selectedOrder}
        onSuccess={() => {
          handleCloseDetail()
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
        }}
      />
    </div>
  )
}
