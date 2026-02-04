import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Package,
  Calendar,
} from 'lucide-react'
import {
  transfersService,
  Transfer,
  TransferStatus,
  CreateTransferDto,
  ShipTransferDto,
  ReceiveTransferDto,
} from '@/services/transfers.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransferFormModal } from '@/components/transfers/TransferFormModal'
import { cn } from '@/lib/utils'

export default function TransfersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isShipOpen, setIsShipOpen] = useState(false)
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [warehouseFilter] = useState<string>('all')

  // Obtener bodegas
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: !!user?.store_id,
  })

  const { data: allTransfers = [], isLoading } = useQuery({
    queryKey: ['transfers', warehouseFilter],
    queryFn: () =>
      transfersService.getAll(
        undefined, // Get all statuses
        warehouseFilter !== 'all' ? warehouseFilter : undefined
      ),
    enabled: !!user?.store_id,
  })

  // Filtrar en cliente para las pestañas
  const activeTransfers = allTransfers.filter(t => ['pending', 'in_transit'].includes(t.status))
  const historyTransfers = allTransfers.filter(t => ['completed', 'cancelled'].includes(t.status))

  // Mutación para crear transferencia
  const createMutation = useMutation({
    mutationFn: (data: CreateTransferDto) => transfersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Transferencia creada exitosamente')
      setIsFormOpen(false)
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
      toast.success('Transferencia recibida correctamente')
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
      toast.success('Transferencia cancelada')
      setIsDetailOpen(false)
      setSelectedTransfer(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al cancelar la transferencia'
      toast.error(message)
    },
  })

  const handleCreate = () => {
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
      driver_name: (formData.get('driver_name') as string) || undefined,
      vehicle_plate: (formData.get('vehicle_plate') as string) || undefined,
      tracking_number: (formData.get('tracking_number') as string) || undefined,
      shipping_cost: Number(formData.get('shipping_cost')) || undefined,
    }

    shipMutation.mutate({ id: selectedTransfer.id, data })
  }

  const handleReceiveSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedTransfer) return

    const formData = new FormData(e.currentTarget)
    const items: ReceiveTransferDto['items'] = selectedTransfer.items.map((item, index) => ({
      product_id: item.product_id,
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
      pending: { label: 'Pendiente', variant: 'secondary' as const, icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
      in_transit: { label: 'En Tránsito', variant: 'default' as const, icon: Truck, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse" },
      completed: { label: 'Completada', variant: 'default' as const, icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      cancelled: { label: 'Cancelada', variant: 'destructive' as const, icon: XCircle, className: "" },
    }
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-5">URGENTE</Badge>
      case 'high': return <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-5 bg-orange-500 hover:bg-orange-600">ALTA</Badge>
      default: return null
    }
  }

  const TransferCard = ({ transfer }: { transfer: Transfer }) => (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center">
              <CardTitle className="text-lg font-mono">
                {transfer.transfer_number}
              </CardTitle>
              {getPriorityBadge(transfer.priority)}
            </div>

            <div className="flex items-center gap-2 mt-2">
              {getStatusBadge(transfer.status)}
              <span className="text-xs text-muted-foreground flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(transfer.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center justify-between text-sm p-3 bg-muted/30 rounded-lg mb-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground mb-1">Origen</span>
            <span className="font-medium flex items-center">
              <Package className="w-3 h-3 mr-1 text-muted-foreground" />
              {transfer.from_warehouse?.name}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-col text-right">
            <span className="text-xs text-muted-foreground mb-1">Destino</span>
            <span className="font-medium flex items-center justify-end">
              {transfer.to_warehouse?.name}
              <Package className="w-3 h-3 ml-1 text-muted-foreground" />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {transfer.items.length} items
          </div>
          <div>
            {transfer.expected_arrival && (
              <span className="text-orange-600 dark:text-orange-400 font-medium">
                Llegada: {new Date(transfer.expected_arrival).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(transfer)}>
          Ver Detalles
        </Button>
        {transfer.status === 'pending' && (
          <>
            <Button variant="outline" size="sm" onClick={() => handleShip(transfer)}>
              <Truck className="w-4 h-4 mr-2" />
              Enviar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleCancel(transfer)}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </>
        )}
        {transfer.status === 'in_transit' && (
          <Button variant="default" size="sm" onClick={() => handleReceive(transfer)}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Recibir
          </Button>
        )}
      </CardFooter>
    </Card>
  )

  return (
    <div className="h-full max-w-7xl mx-auto space-y-6 p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Transferencias</h1>
          <p className="text-muted-foreground mt-1">
            Movimientos de inventario entre bodegas
          </p>
        </div>
        <Button onClick={handleCreate} className="shadow-lg hover:shadow-xl transition-all">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Transferencia
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="active">Activas ({activeTransfers.length})</TabsTrigger>
          <TabsTrigger value="history">Historial ({historyTransfers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando transferencias...</div>
          ) : activeTransfers.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium">No hay transferencias activas</h3>
              <p className="text-muted-foreground">Crea una nueva transferencia para comenzar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTransfers.map(transfer => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando historial...</div>
          ) : historyTransfers.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium">Sin historial</h3>
              <p className="text-muted-foreground">Las transferencias completadas o canceladas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
              {historyTransfers.map(transfer => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL: Nueva Transferencia (Stepper) */}
      <TransferFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        warehouses={warehouses}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />

      {/* Modal de enviar */}
      <Dialog open={isShipOpen} onOpenChange={setIsShipOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pr-12">
            <DialogTitle className="text-base sm:text-lg">Enviar Transferencia {selectedTransfer?.transfer_number}</DialogTitle>
            <DialogDescription>
              Completa los datos de envío y logística
            </DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <form onSubmit={handleShipSubmit} className="space-y-4">
              {/* Logistics Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Conductor</Label>
                  <Input name="driver_name" placeholder="Nombre del chofer" />
                </div>
                <div className="space-y-2">
                  <Label>Placa / Vehículo</Label>
                  <Input name="vehicle_plate" placeholder="ABC-123" />
                </div>
                <div className="space-y-2">
                  <Label>No. Guía / Tracking</Label>
                  <Input name="tracking_number" placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label>Costo de Envío</Label>
                  <Input name="shipping_cost" type="number" min="0" step="0.01" placeholder="0.00" />
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-3">
                {selectedTransfer.items.map((item, index) => (
                  <div key={item.id} className="p-3 border rounded-lg space-y-2">
                    {/* Mobile: Vertical layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product?.name}</p>
                        <p className="text-xs text-muted-foreground">Solicitado: {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Enviado:</Label>
                        <Input
                          type="number"
                          name={`shipped_${index}`}
                          min="0"
                          max={item.quantity}
                          defaultValue={item.quantity}
                          required
                          className="w-20 text-right"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Notas de Salida</Label>
                <Textarea name="note" placeholder="Observaciones sobre el despacho..." />
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsShipOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" disabled={shipMutation.isPending} className="w-full sm:w-auto">
                  {shipMutation.isPending ? 'Enviando...' : 'Confirmar Envío'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de recibir */}
      <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pr-12">
            <DialogTitle className="text-base sm:text-lg">Recibir Transferencia {selectedTransfer?.transfer_number}</DialogTitle>
            <DialogDescription>
              Verifica y confirma las cantidades recibidas
            </DialogDescription>
          </DialogHeader>
          {selectedTransfer && (
            <form onSubmit={handleReceiveSubmit} className="space-y-4">
              <div className="max-h-[300px] overflow-y-auto space-y-3">
                {selectedTransfer.items.map((item, index) => (
                  <div key={item.id} className="p-3 border rounded-lg space-y-2">
                    {/* Mobile: Vertical layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product?.name}</p>
                        <p className="text-xs text-muted-foreground">Enviado: {item.quantity_shipped}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Recibido:</Label>
                        <Input
                          type="number"
                          name={`received_${index}`}
                          min="0"
                          max={item.quantity_shipped}
                          defaultValue={item.quantity_shipped}
                          required
                          className="w-20 text-right"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Notas de Recepción</Label>
                <Textarea name="note" placeholder="Daños, faltantes o comentarios..." />
              </div>
              <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsReceiveOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" disabled={receiveMutation.isPending} className="w-full sm:w-auto">
                  {receiveMutation.isPending ? 'Procesando...' : 'Confirmar Recepción'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de detalles (Solo lectura) */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="pr-12">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-base sm:text-lg">Transferencia {selectedTransfer?.transfer_number}</span>
              {selectedTransfer && getStatusBadge(selectedTransfer.status)}
            </DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 bg-muted/20 rounded-lg text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Origen</span>
                  <span className="font-medium">{selectedTransfer.from_warehouse?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Destino</span>
                  <span className="font-medium">{selectedTransfer.to_warehouse?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Fecha Solicitud</span>
                  <span className="font-medium">{new Date(selectedTransfer.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Prioridad</span>
                  <span className="capitalize">{selectedTransfer.priority || 'Normal'}</span>
                </div>
              </div>

              {/* Logistics Info if shipped */}
              {(selectedTransfer.status === 'in_transit' || selectedTransfer.status === 'completed') && (
                <div className="border rounded-lg p-3 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Datos de Logística
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Conductor:</span>
                      <div className="font-medium">{selectedTransfer.driver_name || '-'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Placa:</span>
                      <div className="font-medium">{selectedTransfer.vehicle_plate || '-'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Tracking:</span>
                      <div className="font-medium">{selectedTransfer.tracking_number || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                {/* Header - Solo desktop */}
                <div className="hidden sm:grid bg-muted px-4 py-2 text-xs font-medium grid-cols-12 gap-4">
                  <div className="col-span-6">Producto</div>
                  <div className="col-span-2 text-center">Solicitado</div>
                  <div className="col-span-2 text-center">Enviado</div>
                  <div className="col-span-2 text-center">Recibido</div>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {selectedTransfer.items.map(item => (
                    <div key={item.id} className="p-3">
                      {/* Mobile Layout - Vertical */}
                      <div className="flex sm:hidden flex-col gap-2">
                        <div className="font-medium text-sm">{item.product?.name}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-muted-foreground mb-1">Solicitado</div>
                            <div className="font-bold">{item.quantity}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground mb-1">Enviado</div>
                            <div className="font-bold text-blue-600">{item.quantity_shipped}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground mb-1">Recibido</div>
                            <div className={cn("font-bold",
                              item.quantity_received === item.quantity_shipped ? "text-green-600" : "text-amber-600"
                            )}>
                              {item.quantity_received}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout - Horizontal */}
                      <div className="hidden sm:grid grid-cols-12 gap-4 text-sm items-center">
                        <div className="col-span-6 font-medium">
                          {item.product?.name}
                        </div>
                        <div className="col-span-2 text-center">{item.quantity}</div>
                        <div className="col-span-2 text-center text-muted-foreground">{item.quantity_shipped}</div>
                        <div className={cn("col-span-2 text-center font-bold",
                          item.quantity_received === item.quantity_shipped ? "text-green-600" : "text-amber-600"
                        )}>
                          {item.quantity_received}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedTransfer.note && (
                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded text-sm text-amber-900 dark:text-amber-100 italic">
                  "{selectedTransfer.note}"
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
