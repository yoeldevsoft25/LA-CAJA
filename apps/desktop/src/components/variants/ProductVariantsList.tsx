import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, Plus, Edit, Trash2, Package } from 'lucide-react'
import {
  productVariantsService,
  ProductVariant,
  CreateProductVariantRequest,
} from '@/services/product-variants.service'
import toast from '@/lib/toast'
import ProductVariantModal from './ProductVariantModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@la-caja/ui-core'
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

interface ProductVariantsListProps {
  productId: string
}

export default function ProductVariantsList({ productId }: ProductVariantsListProps) {
  const queryClient = useQueryClient()
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null)

  const { data: variants, isLoading } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => productVariantsService.getVariantsByProduct(productId),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Obtener stock de cada variante
  const variantIds = variants?.map((v) => v.id) || []
  const { data: variantStocks } = useQuery({
    queryKey: ['product-variants', 'stock', variantIds],
    queryFn: async () => {
      const stocks = await Promise.all(
        variantIds.map(async (id) => {
          try {
            const stock = await productVariantsService.getVariantStock(id)
            return { id, stock }
          } catch {
            return { id, stock: 0 }
          }
        })
      )
      return stocks.reduce<Record<string, number>>((acc, { id, stock }) => {
        acc[id] = stock
        return acc
      }, {})
    },
    enabled: variantIds.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutos
  })

  // Agregar stock a las variantes
  const variantsWithStock = variants?.map((variant) => ({
    ...variant,
    stock: variantStocks?.[variant.id] ?? undefined,
  }))

  const createMutation = useMutation({
    mutationFn: (data: CreateProductVariantRequest) => productVariantsService.createVariant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      toast.success('Variante creada correctamente')
      setIsModalOpen(false)
      setSelectedVariant(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la variante')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProductVariantRequest> }) =>
      productVariantsService.updateVariant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      toast.success('Variante actualizada correctamente')
      setIsModalOpen(false)
      setSelectedVariant(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar la variante')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productVariantsService.deleteVariant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      toast.success('Variante eliminada correctamente')
      setVariantToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar la variante')
    },
  })

  const handleEdit = (variant: ProductVariant) => {
    setSelectedVariant(variant)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedVariant(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateProductVariantRequest) => {
    if (selectedVariant) {
      updateMutation.mutate({ id: selectedVariant.id, data })
    } else {
      createMutation.mutate(data)
    }
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

  const activeVariants = variantsWithStock?.filter((v) => v.is_active) || []
  const inactiveVariants = variantsWithStock?.filter((v) => !v.is_active) || []

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg sm:text-xl flex items-center">
            <Layers className="w-5 h-5 mr-2" />
            Variantes del Producto ({variants?.length || 0})
          </CardTitle>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Variante
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {variants && variants.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay variantes configuradas. Agrega variantes para gestionar diferentes versiones
              del producto.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden md:table-cell">SKU</TableHead>
                    <TableHead className="hidden lg:table-cell">Código</TableHead>
                    <TableHead className="hidden sm:table-cell">Precio Bs</TableHead>
                    <TableHead className="hidden sm:table-cell">Precio USD</TableHead>
                    <TableHead className="hidden md:table-cell">Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeVariants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        <Badge variant="outline">{variant.variant_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{variant.variant_value}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-muted-foreground">{variant.sku || '-'}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-sm text-muted-foreground font-mono">
                          {variant.barcode || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="text-sm text-foreground">
                          {variant.price_bs ? `${Number(variant.price_bs).toFixed(2)} Bs` : '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="text-sm text-foreground">
                          {variant.price_usd ? `$${Number(variant.price_usd).toFixed(2)}` : '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {variant.stock !== undefined ? variant.stock : '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Activa</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(variant)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVariantToDelete(variant)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inactiveVariants.map((variant) => (
                    <TableRow key={variant.id} className="opacity-60">
                      <TableCell>
                        <Badge variant="secondary">{variant.variant_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{variant.variant_value}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-muted-foreground">{variant.sku || '-'}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-sm text-muted-foreground font-mono">
                          {variant.barcode || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="text-sm text-foreground">
                          {variant.price_bs ? `${Number(variant.price_bs).toFixed(2)} Bs` : '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="text-sm text-foreground">
                          {variant.price_usd ? `$${Number(variant.price_usd).toFixed(2)}` : '-'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">-</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Inactiva</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(variant)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVariantToDelete(variant)}
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

      <ProductVariantModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedVariant(null)
        }}
        productId={productId}
        variant={selectedVariant}
        onConfirm={handleConfirm}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!variantToDelete} onOpenChange={() => setVariantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar variante?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la variante{' '}
              {variantToDelete && (
                <>
                  <strong>{variantToDelete.variant_value}</strong> (tipo:{' '}
                  <strong>{variantToDelete.variant_type}</strong>).
                </>
              )}{' '}
              ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => variantToDelete && deleteMutation.mutate(variantToDelete.id)}
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

