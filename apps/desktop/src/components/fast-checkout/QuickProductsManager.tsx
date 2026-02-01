import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Plus, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import {
  fastCheckoutService,
  QuickProduct,
  CreateQuickProductRequest,
} from '@/services/fast-checkout.service'
import toast from '@/lib/toast'
import QuickProductModal from './QuickProductModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

export default function QuickProductsManager() {
  const queryClient = useQueryClient()
  const [selectedQuickProduct, setSelectedQuickProduct] = useState<QuickProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [quickProductToDelete, setQuickProductToDelete] = useState<QuickProduct | null>(null)

  const { data: quickProducts, isLoading } = useQuery({
    queryKey: ['fast-checkout', 'quick-products'],
    queryFn: () => fastCheckoutService.getQuickProducts(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const existingKeys = quickProducts?.map((qp) => qp.quick_key) || []

  const upsertMutation = useMutation({
    mutationFn: (data: CreateQuickProductRequest) => fastCheckoutService.upsertQuickProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fast-checkout'] })
      toast.success('Producto rápido guardado correctamente')
      setIsModalOpen(false)
      setSelectedQuickProduct(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al guardar el producto rápido')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fastCheckoutService.deleteQuickProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fast-checkout'] })
      toast.success('Producto rápido eliminado correctamente')
      setQuickProductToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el producto rápido')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => fastCheckoutService.deactivateQuickProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fast-checkout'] })
      toast.success('Producto rápido desactivado correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al desactivar el producto rápido')
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => fastCheckoutService.reorderQuickProducts(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fast-checkout'] })
      toast.success('Productos reordenados correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al reordenar productos')
    },
  })

  const handleEdit = (quickProduct: QuickProduct) => {
    setSelectedQuickProduct(quickProduct)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedQuickProduct(null)
    setIsModalOpen(true)
  }

  const handleMoveUp = (index: number) => {
    if (!quickProducts || index === 0) return
    const sorted = [...quickProducts].sort((a, b) => a.position - b.position)
    const newOrder = [...sorted]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    const ids = newOrder.map((qp) => qp.id)
    reorderMutation.mutate(ids)
  }

  const handleMoveDown = (index: number) => {
    if (!quickProducts || index === quickProducts.length - 1) return
    const sorted = [...quickProducts].sort((a, b) => a.position - b.position)
    const newOrder = [...sorted]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    const ids = newOrder.map((qp) => qp.id)
    reorderMutation.mutate(ids)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const sortedProducts = [...(quickProducts || [])].sort((a, b) => a.position - b.position)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 pb-4">
          <CardTitle className="text-lg sm:text-xl flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Productos Rápidos ({sortedProducts.length}/50)
          </CardTitle>
          <Button
            onClick={handleAdd}
            size="sm"
            disabled={sortedProducts.length >= 50}
            className="w-full sm:w-auto whitespace-normal sm:whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2 shrink-0" />
            <span className="text-xs sm:text-sm">Agregar Producto</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {sortedProducts.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay productos rápidos configurados. Agrega productos para comenzar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Orden</TableHead>
                    <TableHead>Tecla</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Precio</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((quickProduct, index) => (
                    <TableRow key={quickProduct.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === sortedProducts.length - 1 || reorderMutation.isPending}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {quickProduct.quick_key}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {quickProduct.product?.name || 'Producto no encontrado'}
                          </p>
                          {quickProduct.product?.barcode && (
                            <p className="text-xs text-muted-foreground">
                              {quickProduct.product.barcode}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">
                          <p className="text-foreground">
                            ${Number(quickProduct.product?.price_usd || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {Number(quickProduct.product?.price_bs || 0).toFixed(2)} Bs
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={quickProduct.is_active ? 'default' : 'secondary'}>
                          {quickProduct.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(quickProduct)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            Editar
                          </Button>
                          {quickProduct.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deactivateMutation.mutate(quickProduct.id)}
                              className="text-warning hover:text-warning hover:bg-warning/10"
                            >
                              Desactivar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuickProductToDelete(quickProduct)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedQuickProduct !== undefined && (
        <QuickProductModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedQuickProduct(null)
          }}
          quickProduct={selectedQuickProduct}
          existingKeys={existingKeys}
          onConfirm={(data) => upsertMutation.mutate(data)}
          isLoading={upsertMutation.isPending}
        />
      )}

      <AlertDialog open={!!quickProductToDelete} onOpenChange={() => setQuickProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto rápido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el producto rápido{' '}
              {quickProductToDelete && (
                <>
                  <strong>{quickProductToDelete.product?.name}</strong> con tecla{' '}
                  <strong>{quickProductToDelete.quick_key}</strong>.
                </>
              )}{' '}
              ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => quickProductToDelete && deleteMutation.mutate(quickProductToDelete.id)}
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
