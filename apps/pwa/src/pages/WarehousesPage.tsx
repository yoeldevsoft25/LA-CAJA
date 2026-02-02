
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Edit,
  Warehouse as WarehouseIcon,
  Package,
  AlertTriangle,
  MapPin,
  User,
  Phone
} from 'lucide-react'
import {
  warehousesService,
  Warehouse,
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '@/services/warehouses.service'
import { inventoryService } from '@/services/inventory.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WarehouseFormModal } from '@/components/warehouses/WarehouseFormModal'
import { cn } from '@/lib/utils'

export default function WarehousesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [showStock, setShowStock] = useState(false)

  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)
  const [stockCount, setStockCount] = useState<number>(0)
  const [isCheckingStock, setIsCheckingStock] = useState(false)

  // Obtener bodegas
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true), // Include Inactive to show them
    enabled: !!user?.store_id,
  })

  // Obtener stock de bodega seleccionada
  const { data: warehouseStock = [] } = useQuery({
    queryKey: ['warehouses', selectedWarehouse?.id, 'stock'],
    queryFn: () => warehousesService.getStock(selectedWarehouse!.id),
    enabled: !!selectedWarehouse && showStock,
  })

  // Mutación para crear bodega
  const createMutation = useMutation({
    mutationFn: (data: CreateWarehouseDto) => warehousesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Bodega creada exitosamente')
      setIsFormOpen(false)
      setEditingWarehouse(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la bodega'
      toast.error(message)
    },
  })

  // Mutación para actualizar bodega
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarehouseDto }) =>
      warehousesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Bodega actualizada exitosamente')
      setIsFormOpen(false)
      setEditingWarehouse(null)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar la bodega'
      toast.error(message)
    },
  })

  // Mutación para eliminar bodega
  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehousesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Bodega eliminada exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al eliminar la bodega'
      toast.error(message)
    },
  })

  const handleCreate = () => {
    setEditingWarehouse(null)
    setIsFormOpen(true)
  }

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setIsFormOpen(true)
  }

  const handleViewStock = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    setShowStock(true)
  }

  const handleSubmit = (data: CreateWarehouseDto | UpdateWarehouseDto) => {
    if (editingWarehouse) {
      updateMutation.mutate({ id: editingWarehouse.id, data })
    } else {
      createMutation.mutate(data as CreateWarehouseDto)
    }
  }

  // --- DELETE LOGIC ---
  const triggerDelete = async (warehouse: Warehouse) => {
    // Close form if it was triggered from there
    setIsFormOpen(false)

    setWarehouseToDelete(warehouse)
    setIsCheckingStock(true)
    setShowDeleteConfirm(true) // Show dialog immediately

    try {
      // Check stock
      const stockStatus = await inventoryService.getStockStatus({ warehouse_id: warehouse.id })
      const totalStock = stockStatus.reduce((sum, item) => sum + Number(item.current_stock || 0), 0)
      setStockCount(totalStock)
    } catch {
      setStockCount(-1) // Error state
    } finally {
      setIsCheckingStock(false)
    }
  }

  const confirmDelete = () => {
    if (warehouseToDelete) {
      deleteMutation.mutate(warehouseToDelete.id)
      setShowDeleteConfirm(false)
      setWarehouseToDelete(null)
      setStockCount(0)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setWarehouseToDelete(null)
    setStockCount(0)
  }

  // --- HELPERS ---
  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'STORE': 'Tienda',
      'MAIN': 'Principal',
      'SHOWROOM': 'Showroom',
      'TRANSIT': 'Tránsito',
      'DAMAGED': 'Merma'
    }
    return types[type] || type
  }

  const getTypeColor = (type: string) => {
    const types: Record<string, string> = {
      'STORE': 'bg-blue-100 text-blue-800 border-blue-200',
      'MAIN': 'bg-purple-100 text-purple-800 border-purple-200',
      'SHOWROOM': 'bg-pink-100 text-pink-800 border-pink-200',
      'TRANSIT': 'bg-amber-100 text-amber-800 border-amber-200',
      'DAMAGED': 'bg-red-100 text-red-800 border-red-200'
    }
    return types[type] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inactiva</Badge>

    switch (status) {
      case 'OPERATIONAL':
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Operativo</Badge>
      case 'MAINTENANCE':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">Mantenimiento</Badge>
      case 'CLOSED':
        return <Badge variant="destructive">Cerrado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Bodegas</h1>
          <p className="text-muted-foreground mt-1">
            Administra tus almacenes, sucursales y puntos de stock
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Bodega
        </Button>
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <WarehouseIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No hay bodegas registradas</h3>
            <p className="text-muted-foreground mt-2 mb-6 max-w-sm">
              Comienza creando tu primera bodega o almacén para gestionar tu inventario correctamente.
            </p>
            <Button onClick={handleCreate}>
              Crear primera bodega
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className="group hover:shadow-lg transition-all duration-300 border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider", getTypeColor(warehouse.type || 'STORE'))}>
                        {getTypeLabel(warehouse.type || 'STORE')}
                      </span>
                      {warehouse.is_default && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-primary/10 text-primary border-primary/20">
                          Principal
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-xl font-bold leading-tight">{warehouse.name}</CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">{warehouse.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(warehouse.status, warehouse.is_active)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 grid gap-4">
                {/* Details Grid */}
                <div className="space-y-2 text-sm">
                  {warehouse.manager_name && (
                    <div className="flex items-center text-muted-foreground">
                      <User className="w-4 h-4 mr-2 opacity-70" />
                      <span>{warehouse.manager_name}</span>
                    </div>
                  )}
                  {(warehouse.city || warehouse.address) && (
                    <div className="flex items-start text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2 opacity-70 mt-0.5" />
                      <span className="line-clamp-2">
                        {[warehouse.address, warehouse.city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {warehouse.contact_phone && (
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="w-4 h-4 mr-2 opacity-70" />
                      <span>{warehouse.contact_phone}</span>
                    </div>
                  )}
                </div>

                {/* Description if exists */}
                {warehouse.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 border-l-2 pl-2 italic">
                    {warehouse.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t bg-muted/20 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-background hover:bg-background/80"
                  onClick={() => handleViewStock(warehouse)}
                >
                  <Package className="w-3.5 h-3.5 mr-2" />
                  Ver Stock
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(warehouse)}
                >
                  <Edit className="w-3.5 h-3.5 mr-2" />
                  Gestionar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Warehouse Form Modal (New Component) */}
      <WarehouseFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={editingWarehouse}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onDelete={triggerDelete}
      />

      {/* Stock Preview Modal */}
      <Dialog open={showStock} onOpenChange={setShowStock}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Inventario: {selectedWarehouse?.name}
            </DialogTitle>
            <DialogDescription>
              Vista rápida de existencias. Para ajustes detallados visita la sección de Inventario.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md">
            <ScrollArea className="h-[50vh]">
              {warehouseStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="w-8 h-8 mb-2 opacity-20" />
                  <p>Esta bodega no tiene existencias registradas</p>
                </div>
              ) : (
                <div className="divide-y overflow-x-hidden">
                  {warehouseStock.map((stock) => (
                    <div key={stock.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Producto Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-sm sm:text-base">{stock.product?.name}</p>
                            {stock.variant && (
                              <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                                {stock.variant.variant_type}: {stock.variant.variant_value}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            SKU: {stock.product?.sku || 'N/A'}
                          </p>
                        </div>

                        {/* Stock Info - Horizontal en mobile y desktop */}
                        <div className="flex gap-6 sm:gap-8">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Disponible</p>
                            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums">{stock.stock}</p>
                          </div>
                          {stock.reserved > 0 && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Reservado</p>
                              <p className="text-xl sm:text-2xl font-bold text-amber-600 font-mono tabular-nums">{stock.reserved}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <div className="bg-muted/40 -mx-6 -mb-6 p-4 border-t flex justify-end">
            <Button variant="outline" onClick={() => setShowStock(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Bodega
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {isCheckingStock ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="loading loading-spinner loading-xs"></span>
                  Verificando inventario...
                </div>
              ) : stockCount > 0 ? (
                <Alert variant="destructive" className="border-destructive/20 bg-destructive/10">
                  <AlertDescription>
                    <strong>¡Acción Peligrosa!</strong> <br />
                    Esta bodega contiene <strong>{stockCount}</strong> unidades en inventario.
                    Eliminarla provocará inconsistencias graves en el stock.
                    <br /><br />
                    Por favor, transfiere o ajusta el stock a 0 antes de continuar.
                  </AlertDescription>
                </Alert>
              ) : (
                <p>
                  ¿Estás seguro que deseas eliminar permanentemente <strong>"{warehouseToDelete?.name}"</strong>?
                  Esta acción no se puede deshacer.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={stockCount > 0 ? 'bg-destructive/80 hover:bg-destructive' : 'bg-destructive hover:bg-destructive/90'}
              disabled={deleteMutation.isPending || stockCount > 0 || isCheckingStock}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Confirmar Eliminación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

