import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react'
import {
  transfersService,
  Transfer,
  TransferStatus,
  CreateTransferDto,
  CreateTransferItemDto,
  ShipTransferDto,
  ReceiveTransferDto,
} from '@/services/transfers.service'
import { warehousesService } from '@/services/warehouses.service'
import { productsService, Product } from '@/services/products.service'
import { useAuth } from '@/stores/auth.store'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function TransfersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isShipOpen, setIsShipOpen] = useState(false)
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'all'>('all')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')

  // Estados para crear transferencia
  const [fromWarehouseId, setFromWarehouseId] = useState<string>('')
  const [toWarehouseId, setToWarehouseId] = useState<string>('')
  const [transferItems, setTransferItems] = useState<CreateTransferItemDto[]>([])

  // Obtener bodegas
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: !!user?.store_id,
  })

  // Obtener transferencias
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers', statusFilter, warehouseFilter],
    queryFn: () =>
      transfersService.getAll(
        statusFilter !== 'all' ? statusFilter : undefined,
        warehouseFilter !== 'all' ? warehouseFilter : undefined
      ),
    enabled: !!user?.store_id,
  })

  // Obtener productos para agregar items
  const [productSearch, setProductSearch] = useState('')
  const { data: productsData } = useQuery({
    queryKey: ['products', 'search', productSearch],
    queryFn: () => productsService.search({ q: productSearch, limit: 20 }),
    enabled: productSearch.length >= 2,
  })

  // Mutación para crear transferencia
  const createMutation = useMutation({
    mutationFn: (data: CreateTransferDto) => transfersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Transferencia creada exitosamente')
      setIsFormOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la transferencia'
      toast.error(message)
    },
  })

  // Mutación para enviar transferencia
  const shipMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ShipTransferDto }) =>
      transfersService.ship(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Transferencia marcada como enviada')
      setIsShipOpen(false)
      setSelectedTransfer(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al enviar la transferencia'
      toast.error(message)
    },
  })

  // Mutación para recibir transferencia
  const receiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveTransferDto }) =>
      transfersService.receive(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Transferencia marcada como recibida')
      setIsReceiveOpen(false)
      setSelectedTransfer(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al recibir la transferencia'
      toast.error(message)
    },
  })

  // Mutación para cancelar transferencia
  const cancelMutation = useMutation({
    mutationFn: (id: string) => transfersService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Transferencia cancelada')
      setIsDetailOpen(false)
      setSelectedTransfer(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al cancelar la transferencia'
      toast.error(message)
    },
  })

  const resetForm = () => {
    setFromWarehouseId('')
    setToWarehouseId('')
    setTransferItems([])
  }

  const handleCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const handleViewDetail = (transfer: Transfer) => {
    setSelectedTransfer(transfer)
    setIsDetailOpen(true)
  }

  const handleShip = (transfer: Transfer) => {
    setSelectedTransfer(transfer)
    setIsShipOpen(true)
  }

  const handleReceive = (transfer: Transfer) => {
    setSelectedTransfer(transfer)
    setIsReceiveOpen(true)
  }

  const handleCancel = (transfer: Transfer) => {
    if (
      window.confirm(
        `¿Estás seguro de cancelar la transferencia "${transfer.transfer_number}"?`
      )
    ) {
      cancelMutation.mutate(transfer.id)
    }
  }

  const addTransferItem = (product: Product) => {
    const existingItem = transferItems.find((item) => item.product_id === product.id)
    if (existingItem) {
      setTransferItems(
        transferItems.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      setTransferItems([
        ...transferItems,
        {
          product_id: product.id,
          quantity: 1,
          unit_cost_bs: Number(product.cost_bs),
          unit_cost_usd: Number(product.cost_usd),
        },
      ])
    }
    setProductSearch('')
  }

  const removeTransferItem = (productId: string) => {
    setTransferItems(transferItems.filter((item) => item.product_id !== productId))
  }

  const updateTransferItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeTransferItem(productId)
    } else {
      setTransferItems(
        transferItems.map((item) =>
          item.product_id === productId ? { ...item, quantity } : item
        )
      )
    }
  }

  const handleSubmitTransfer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!fromWarehouseId || !toWarehouseId) {
      toast.error('Selecciona bodega origen y destino')
      return
    }
    if (transferItems.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error('La bodega origen y destino deben ser diferentes')
      return
    }

    const data: CreateTransferDto = {
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      items: transferItems,
      note: (new FormData(e.currentTarget).get('note') as string) || undefined,
    }

    createMutation.mutate(data)
  }

  const handleShipSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedTransfer) return

    const formData = new FormData(e.currentTarget)
    const items: ShipTransferDto['items'] = selectedTransfer.items.map((_, index) => ({
      quantity_shipped: parseInt(formData.get(`shipped_${index}`) as string) || 0,
    }))

    const data: ShipTransferDto = {
      items,
      note: (formData.get('note') as string) || undefined,
    }

    shipMutation.mutate({ id: selectedTransfer.id, data })
  }

  const handleReceiveSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedTransfer) return

    const formData = new FormData(e.currentTarget)
    const items: ReceiveTransferDto['items'] = selectedTransfer.items.map((_, index) => ({
      quantity_received: parseInt(formData.get(`received_${index}`) as string) || 0,
    }))

    const data: ReceiveTransferDto = {
      items,
      note: (formData.get('note') as string) || undefined,
    }

    receiveMutation.mutate({ id: selectedTransfer.id, data })
  }

  const getStatusBadge = (status: TransferStatus) => {
    const statusConfig = {
      pending: { label: 'Pendiente', variant: 'secondary' as const, icon: Clock },
      in_transit: { label: 'En Tránsito', variant: 'default' as const, icon: Truck },
      completed: { label: 'Completada', variant: 'default' as const, icon: CheckCircle },
      cancelled: { label: 'Cancelada', variant: 'destructive' as const, icon: XCircle },
    }
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transferencias</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona transferencias de inventario entre bodegas
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Transferencia
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_transit">En Tránsito</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Bodega</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de transferencias */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      ) : transfers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay transferencias</p>
            <Button onClick={handleCreate} className="mt-4">
              Crear primera transferencia
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transfers.map((transfer) => (
            <Card key={transfer.id} className="border border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {transfer.transfer_number}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2">
                      {getStatusBadge(transfer.status)}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{transfer.from_warehouse?.name}</span>
                        <ArrowRight className="w-4 h-4" />
                        <span>{transfer.to_warehouse?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetail(transfer)}>
                      Ver Detalles
                    </Button>
                    {transfer.status === 'pending' && (
                      <>
                        <Button variant="default" size="sm" onClick={() => handleShip(transfer)}>
                          Enviar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancel(transfer)}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {transfer.status === 'in_transit' && (
                      <Button variant="default" size="sm" onClick={() => handleReceive(transfer)}>
                        Recibir
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>
                    Solicitada: {new Date(transfer.requested_at).toLocaleString()}
                    {transfer.requested_by_user && ` por ${transfer.requested_by_user.full_name}`}
                  </p>
                  {transfer.shipped_at && (
                    <p>
                      Enviada: {new Date(transfer.shipped_at).toLocaleString()}
                      {transfer.shipped_by_user && ` por ${transfer.shipped_by_user.full_name}`}
                    </p>
                  )}
                  {transfer.received_at && (
                    <p>
                      Recibida: {new Date(transfer.received_at).toLocaleString()}
                      {transfer.received_by_user && ` por ${transfer.received_by_user.full_name}`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de crear transferencia */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Nueva Transferencia</DialogTitle>
            <DialogDescription>
              Crea una nueva transferencia de inventario entre bodegas
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTransfer} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
              <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from_warehouse">Bodega Origen *</Label>
                  <Select value={fromWarehouseId} onValueChange={setFromWarehouseId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona bodega origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses
                        .filter((w) => w.is_active)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({w.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="to_warehouse">Bodega Destino *</Label>
                  <Select value={toWarehouseId} onValueChange={setToWarehouseId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona bodega destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses
                        .filter((w) => w.is_active && w.id !== fromWarehouseId)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({w.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Productos</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Buscar producto..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    {productSearch.length >= 2 && productsData?.products && (
                      <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {productsData.products.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addTransferItem(product)}
                            className="w-full text-left px-4 py-2 hover:bg-accent transition-colors"
                          >
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ${Number(product.price_usd).toFixed(2)} USD
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {transferItems.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {transferItems.map((item) => {
                        const product = productsData?.products.find((p) => p.id === item.product_id)
                        return (
                          <Card key={item.product_id} className="border border-border">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{product?.name || 'Producto'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Costo: ${Number(item.unit_cost_usd).toFixed(2)} USD
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateTransferItemQuantity(
                                        item.product_id,
                                        parseInt(e.target.value) || 1
                                      )
                                    }
                                    className="w-20"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeTransferItem(item.product_id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="note">Notas</Label>
                <Textarea id="note" name="note" rows={2} />
              </div>
            </div>
            </div>
            <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creando...' : 'Crear Transferencia'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de detalles */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">
              Transferencia {selectedTransfer?.transfer_number}
            </DialogTitle>
            <DialogDescription>Detalles de la transferencia</DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
              <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estado</Label>
                  <div>{getStatusBadge(selectedTransfer.status)}</div>
                </div>
                <div>
                  <Label>Bodegas</Label>
                  <div className="flex items-center gap-2">
                    <span>{selectedTransfer.from_warehouse?.name}</span>
                    <ArrowRight className="w-4 h-4" />
                    <span>{selectedTransfer.to_warehouse?.name}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label>Items</Label>
                <div className="space-y-2 mt-2">
                  {selectedTransfer.items.map((item) => (
                    <Card key={item.id} className="border border-border">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.product?.name || 'Producto'}
                              {item.variant && (
                                <span className="text-muted-foreground ml-2">
                                  ({item.variant.variant_type}: {item.variant.variant_value})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Solicitado</p>
                              <p className="font-bold">{item.quantity}</p>
                            </div>
                            {item.quantity_shipped > 0 && (
                              <div>
                                <p className="text-muted-foreground">Enviado</p>
                                <p className="font-bold">{item.quantity_shipped}</p>
                              </div>
                            )}
                            {item.quantity_received > 0 && (
                              <div>
                                <p className="text-muted-foreground">Recibido</p>
                                <p className="font-bold text-success">{item.quantity_received}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {selectedTransfer.note && (
                <div>
                  <Label>Notas</Label>
                  <p className="text-sm text-muted-foreground">{selectedTransfer.note}</p>
                </div>
              )}
            </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de enviar */}
      <Dialog open={isShipOpen} onOpenChange={setIsShipOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Enviar Transferencia {selectedTransfer?.transfer_number}</DialogTitle>
            <DialogDescription>
              Indica las cantidades enviadas de cada producto
            </DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <form onSubmit={handleShipSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
                <div className="space-y-4 sm:space-y-5">
                {selectedTransfer.items.map((item, index) => (
                  <div key={item.id} className="space-y-2">
                    <Label>
                      {item.product?.name || 'Producto'}
                      {item.variant && ` (${item.variant.variant_type}: ${item.variant.variant_value})`}
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Solicitado: {item.quantity}
                      </div>
                      <Input
                        type="number"
                        name={`shipped_${index}`}
                        min="0"
                        max={item.quantity}
                        defaultValue={item.quantity}
                        required
                        className="w-32"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <Label htmlFor="ship_note">Notas</Label>
                  <Textarea id="ship_note" name="note" rows={2} />
                </div>
              </div>
              </div>
              <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsShipOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={shipMutation.isPending}>
                  {shipMutation.isPending ? 'Enviando...' : 'Marcar como Enviada'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de recibir */}
      <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Recibir Transferencia {selectedTransfer?.transfer_number}</DialogTitle>
            <DialogDescription>
              Indica las cantidades recibidas de cada producto
            </DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <form onSubmit={handleReceiveSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
                <div className="space-y-4 sm:space-y-5">
                {selectedTransfer.items.map((item, index) => (
                  <div key={item.id} className="space-y-2">
                    <Label>
                      {item.product?.name || 'Producto'}
                      {item.variant && ` (${item.variant.variant_type}: ${item.variant.variant_value})`}
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Enviado: {item.quantity_shipped}
                      </div>
                      <Input
                        type="number"
                        name={`received_${index}`}
                        min="0"
                        max={item.quantity_shipped}
                        defaultValue={item.quantity_shipped}
                        required
                        className="w-32"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <Label htmlFor="receive_note">Notas</Label>
                  <Textarea id="receive_note" name="note" rows={2} />
                </div>
              </div>
              </div>
              <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsReceiveOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={receiveMutation.isPending}>
                  {receiveMutation.isPending ? 'Recibiendo...' : 'Marcar como Recibida'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

