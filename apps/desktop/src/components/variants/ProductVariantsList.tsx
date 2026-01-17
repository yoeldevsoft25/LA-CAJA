import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, Plus, Edit, Trash2 } from 'lucide-react'
import {
  productVariantsService,
  ProductVariant,
  CreateProductVariantRequest,
} from '@/services/product-variants.service'
import toast from 'react-hot-toast'
import ProductVariantModal from './ProductVariantModal'

interface ProductVariantsListProps {
  productId: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

export default function ProductVariantsList({ productId }: ProductVariantsListProps) {
  const queryClient = useQueryClient()
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => productVariantsService.getVariantsByProduct(productId),
    staleTime: 1000 * 60 * 5,
  })

  const variantIds = variants.map((variant) => variant.id)
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
    staleTime: 1000 * 60 * 2,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProductVariantRequest) => productVariantsService.createVariant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      toast.success('Variante creada correctamente')
      setIsModalOpen(false)
      setSelectedVariant(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al crear la variante'))
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
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al actualizar la variante'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productVariantsService.deleteVariant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      toast.success('Variante eliminada correctamente')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al eliminar la variante'))
    },
  })

  const handleAdd = () => {
    setSelectedVariant(null)
    setIsModalOpen(true)
  }

  const handleEdit = (variant: ProductVariant) => {
    setSelectedVariant(variant)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateProductVariantRequest) => {
    if (selectedVariant) {
      updateMutation.mutate({ id: selectedVariant.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (variant: ProductVariant) => {
    if (window.confirm(`¿Eliminar la variante "${variant.variant_value}"?`)) {
      deleteMutation.mutate(variant.id)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">Cargando variantes...</div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            Variantes ({variants.length})
          </h3>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Variante
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          No hay variantes configuradas. Agrega variantes para gestionar versiones del producto.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                  Valor
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  SKU
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                  Barcode
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">
                  Bs
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">
                  USD
                </th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Stock
                </th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                  Estado
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {variants.map((variant) => (
                <tr key={variant.id}>
                  <td className="px-4 py-2">{variant.variant_type}</td>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {variant.variant_value}
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell text-gray-600">
                    {variant.sku || '-'}
                  </td>
                  <td className="px-4 py-2 hidden lg:table-cell text-gray-600">
                    {variant.barcode || '-'}
                  </td>
                  <td className="px-4 py-2 text-right hidden sm:table-cell">
                    {variant.price_bs ? Number(variant.price_bs).toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right hidden sm:table-cell">
                    {variant.price_usd ? Number(variant.price_usd).toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-2 text-center hidden md:table-cell">
                    {variantStocks?.[variant.id] ?? '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        variant.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {variant.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(variant)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(variant)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductVariantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId}
        variant={selectedVariant}
        onConfirm={handleConfirm}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}
