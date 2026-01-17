import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Calendar } from 'lucide-react'
import {
  productLotsService,
  ProductLot,
  CreateProductLotRequest,
} from '@/services/product-lots.service'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import ProductLotModal from './ProductLotModal'

interface ProductLotsListProps {
  productId: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

export default function ProductLotsList({ productId }: ProductLotsListProps) {
  const queryClient = useQueryClient()
  const [selectedLot, setSelectedLot] = useState<ProductLot | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ['product-lots', productId],
    queryFn: () => productLotsService.getLotsByProduct(productId),
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProductLotRequest) => productLotsService.createLot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-lots', productId] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Lote creado correctamente')
      setIsModalOpen(false)
      setSelectedLot(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al crear el lote'))
    },
  })

  const handleAdd = () => {
    setSelectedLot(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateProductLotRequest) => {
    createMutation.mutate(data)
  }

  const sortedLots = [...lots].sort((a, b) => {
    return new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  })

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Cargando lotes...</div>
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">
            Lotes ({lots.length})
          </h3>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Lote
        </button>
      </div>

      {lots.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          No hay lotes configurados. Agrega lotes para gestionar vencimientos y FIFO.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                  Lote
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">
                  Cantidad
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Costo
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Recepción
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">
                  Vencimiento
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                  Proveedor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedLots.map((lot) => (
                <tr key={lot.id}>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {lot.lot_number}
                    {lot.note && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{lot.note}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    {lot.remaining_quantity} / {lot.initial_quantity}
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">
                    <div>
                      <p>${Number(lot.unit_cost_usd).toFixed(2)} USD</p>
                      <p className="text-xs text-gray-500">
                        Bs. {Number(lot.unit_cost_bs).toFixed(2)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">
                    {format(new Date(lot.received_at), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    {lot.expiration_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>{format(new Date(lot.expiration_date), 'dd/MM/yyyy')}</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-2">{lot.supplier || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductLotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId}
        lot={selectedLot}
        onConfirm={handleConfirm}
        isSubmitting={createMutation.isPending}
      />
    </>
  )
}
