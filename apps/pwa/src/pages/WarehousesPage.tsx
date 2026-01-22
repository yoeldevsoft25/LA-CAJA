import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Warehouse as WarehouseIcon, CheckCircle, XCircle, Package, AlertTriangle } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function WarehousesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [showStock, setShowStock] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)
  const [stockCount, setStockCount] = useState<number>(0)
  const [isCheckingStock, setIsCheckingStock] = useState(false)

  // Obtener bodegas
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
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

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingWarehouse(null)
  }

  const handleDelete = async (warehouse: Warehouse) => {
    setWarehouseToDelete(warehouse)
    setIsCheckingStock(true)
    
    try {
      // Verificar stock en la bodega antes de eliminar
      const stockStatus = await inventoryService.getStockStatus({ warehouse_id: warehouse.id })
      const totalStock = stockStatus.reduce((sum, item) => sum + Number(item.current_stock || 0), 0)
      setStockCount(totalStock)
    } catch {
      // Si falla la verificación, asumir que puede tener stock
      setStockCount(-1)
    }
    
    setIsCheckingStock(false)
    setShowDeleteConfirm(true)
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data: CreateWarehouseDto | UpdateWarehouseDto = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: (formData.get('description') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      is_default: formData.get('is_default') === 'on',
      note: (formData.get('note') as string) || undefined,
    }

    if (editingWarehouse) {
      updateMutation.mutate({ id: editingWarehouse.id, data })
    } else {
      createMutation.mutate(data as CreateWarehouseDto)
    }
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Bodegas</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona múltiples bodegas/almacenes y su inventario
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nueva Bodega</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* Lista de bodegas */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <WarehouseIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay bodegas creadas</p>
            <Button onClick={handleCreate} className="mt-4">
              Crear primera bodega
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className="border border-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Código: {warehouse.code}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(warehouse)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {warehouse.is_active ? (
                      <Badge variant="default" className="bg-success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activa
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactiva
                      </Badge>
                    )}
                    {warehouse.is_default && <Badge variant="outline">Por defecto</Badge>}
                  </div>
                  {warehouse.description && (
                    <p className="text-sm text-muted-foreground">{warehouse.description}</p>
                  )}
                  {warehouse.address && (
                    <p className="text-xs text-muted-foreground">📍 {warehouse.address}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStock(warehouse)}
                      className="flex-1"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Ver Stock
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de formulario */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">
              {editingWarehouse ? 'Editar Bodega' : 'Nueva Bodega'}
            </DialogTitle>
            <DialogDescription>
              {editingWarehouse
                ? 'Modifica los datos de la bodega'
                : 'Crea una nueva bodega/almacén para gestionar inventario'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
              <div className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingWarehouse?.name}
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingWarehouse?.code}
                  required
                  maxLength={50}
                  placeholder="BODEGA1, ALMACEN_PRINCIPAL, etc."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Código único para identificar la bodega
                </p>
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={editingWarehouse?.description || ''}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="address">Dirección</Label>
                <Textarea
                  id="address"
                  name="address"
                  defaultValue={editingWarehouse?.address || ''}
                  rows={2}
                  placeholder="Dirección física de la bodega"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  name="is_default"
                  defaultChecked={editingWarehouse?.is_default}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_default" className="cursor-pointer">
                  Marcar como bodega por defecto
                </Label>
              </div>
              {editingWarehouse && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    defaultChecked={editingWarehouse?.is_active ?? true}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Activa
                  </Label>
                </div>
              )}
              <div>
                <Label htmlFor="note">Notas</Label>
                <Textarea
                  id="note"
                  name="note"
                  defaultValue={editingWarehouse?.note || ''}
                  rows={2}
                />
              </div>
            </div>
            </div>
            <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              {editingWarehouse && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(editingWarehouse)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </Button>
              )}
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Guardando...'
                  : editingWarehouse
                    ? 'Actualizar'
                    : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de stock */}
      <Dialog open={showStock} onOpenChange={setShowStock}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Stock - {selectedWarehouse?.name} ({selectedWarehouse?.code})
            </DialogTitle>
            <DialogDescription>
              Inventario disponible y reservado en esta bodega
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {warehouseStock.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay productos en esta bodega
              </div>
            ) : (
              <div className="space-y-2">
                {warehouseStock.map((stock) => (
                  <Card key={stock.id} className="border border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {stock.product?.name || 'Producto'}
                            {stock.variant && (
                              <span className="text-muted-foreground ml-2">
                                ({stock.variant.variant_type}: {stock.variant.variant_value})
                              </span>
                            )}
                          </p>
                          {stock.product?.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {stock.product.sku}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Disponible</p>
                              <p className="text-lg font-bold text-foreground">{stock.stock}</p>
                            </div>
                            {stock.reserved > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">Reservado</p>
                                <p className="text-lg font-bold text-warning">{stock.reserved}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {stockCount > 0 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  ¡Advertencia! Bodega con stock
                </>
              ) : (
                <>Eliminar Bodega</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {isCheckingStock ? (
                <p>Verificando stock en la bodega...</p>
              ) : stockCount > 0 ? (
                <>
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Esta bodega tiene <strong>{stockCount.toLocaleString()}</strong> unidades de productos.
                      Eliminarla causará pérdida de información de inventario.
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm">
                    Se recomienda transferir el stock a otra bodega antes de eliminar.
                  </p>
                </>
              ) : stockCount === 0 ? (
                <p>
                  ¿Estás seguro de eliminar la bodega <strong>"{warehouseToDelete?.name}"</strong>?
                  Esta acción no se puede deshacer.
                </p>
              ) : (
                <p>
                  No se pudo verificar el stock. ¿Deseas continuar de todas formas?
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={stockCount > 0 ? 'bg-red-600 hover:bg-red-700' : ''}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? 'Eliminando...'
                : stockCount > 0
                ? 'Eliminar de todas formas'
                : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

