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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    )
  }

  const activeVariants = variantsWithStock?.filter((v) => v.is_active) || []
  const inactiveVariants = variantsWithStock?.filter((v) => !v.is_active) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center">
            <Layers className="w-5 h-5 mr-2 text-primary" />
            Variantes Registradas ({variants?.length || 0})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona las diferentes versiones de este producto
          </p>
        </div>
        <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Variante
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
        {variants && variants.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-medium text-foreground">No hay variantes</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">
              Comienza agregando tallas, colores o versiones para este producto.
            </p>
            <Button onClick={handleAdd} variant="outline" size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Crear primera variante
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden md:table-cell">SKU / Barra</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Precio</TableHead>
                  <TableHead className="hidden md:table-cell text-center">Stock</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeVariants.map((variant) => (
                  <TableRow key={variant.id} className="group hover:bg-muted/20">
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{variant.variant_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-foreground">{variant.variant_value}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-0.5">
                        <p className="text-xs font-mono text-muted-foreground">{variant.sku || '-'}</p>
                        <p className="text-[10px] font-mono text-muted-foreground/60">{variant.barcode || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-foreground">
                          {variant.price_usd ? `$${Number(variant.price_usd).toFixed(2)}` : '-'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {variant.price_bs ? `${Number(variant.price_bs).toFixed(2)} Bs` : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn(
                          "text-sm font-bold",
                          (variant.stock || 0) > 0 ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {variant.stock !== undefined ? variant.stock : '-'}
                        </span>
                        <Package className="w-3 h-3 text-muted-foreground/40" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(variant)}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setVariantToDelete(variant)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {inactiveVariants.length > 0 && (
                  <>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={6} className="py-2 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Variantes Inactivas
                      </TableCell>
                    </TableRow>
                    {inactiveVariants.map((variant) => (
                      <TableRow key={variant.id} className="opacity-50 grayscale hover:bg-muted/20 group">
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{variant.variant_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{variant.variant_value}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">-</TableCell>
                        <TableCell className="hidden sm:table-cell text-right">-</TableCell>
                        <TableCell className="hidden md:table-cell text-center">-</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(variant)}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
    </div>
  )
}

