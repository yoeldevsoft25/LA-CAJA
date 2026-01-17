import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, Plus, RotateCcw, AlertTriangle } from 'lucide-react'
import {
  productSerialsService,
  ProductSerial,
  CreateProductSerialRequest,
  CreateSerialsBatchRequest,
  SerialStatus,
} from '@/services/product-serials.service'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import ProductSerialModal from './ProductSerialModal'

interface ProductSerialsListProps {
  productId: string
}

const statusLabels: Record<SerialStatus, string> = {
  available: 'Disponible',
  sold: 'Vendido',
  returned: 'Devuelto',
  damaged: 'Dañado',
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

export default function ProductSerialsList({ productId }: ProductSerialsListProps) {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<SerialStatus | 'all'>('all')

  const { data: serials = [], isLoading } = useQuery({
    queryKey: ['product-serials', productId, statusFilter],
    queryFn: () =>
      productSerialsService.getSerialsByProduct(
        productId,
        statusFilter === 'all' ? undefined : statusFilter
      ),
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProductSerialRequest) => productSerialsService.createSerial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials', productId] })
      toast.success('Serial creado correctamente')
      setIsModalOpen(false)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al crear el serial'))
    },
  })

  const batchCreateMutation = useMutation({
    mutationFn: (data: CreateSerialsBatchRequest) => productSerialsService.createSerialsBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials', productId] })
      toast.success('Seriales creados correctamente')
      setIsModalOpen(false)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al crear los seriales'))
    },
  })

  const returnMutation = useMutation({
    mutationFn: (id: string) => productSerialsService.returnSerial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials', productId] })
      toast.success('Serial devuelto correctamente')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al devolver el serial'))
    },
  })

  const markDamagedMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      productSerialsService.markSerialAsDamaged(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials', productId] })
      toast.success('Serial marcado como dañado')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Error al marcar el serial como dañado'))
    },
  })

  const handleConfirm = (data: CreateProductSerialRequest) => {
    createMutation.mutate(data)
  }

  const handleBatchConfirm = (data: CreateSerialsBatchRequest) => {
    batchCreateMutation.mutate(data)
  }

  const handleReturn = (serial: ProductSerial) => {
    if (window.confirm(`¿Marcar serial ${serial.serial_number} como devuelto?`)) {
      returnMutation.mutate(serial.id)
    }
  }

  const handleDamaged = (serial: ProductSerial) => {
    if (window.confirm(`¿Marcar serial ${serial.serial_number} como dañado?`)) {
      markDamagedMutation.mutate({ id: serial.id })
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Cargando seriales...</div>
  }

  const availableCount = serials.filter((serial) => serial.status === 'available').length
  const soldCount = serials.filter((serial) => serial.status === 'sold').length
  const returnedCount = serials.filter((serial) => serial.status === 'returned').length
  const damagedCount = serials.filter((serial) => serial.status === 'damaged').length

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Seriales ({serials.length})</h3>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Serial
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">Disponibles: {availableCount}</span>
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Vendidos: {soldCount}</span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Devueltos: {returnedCount}</span>
          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">Dañados: {damagedCount}</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SerialStatus | 'all')}
          className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
        >
          <option value="all">Todos</option>
          <option value="available">Disponibles</option>
          <option value="sold">Vendidos</option>
          <option value="returned">Devueltos</option>
          <option value="damaged">Dañados</option>
        </select>
      </div>

      {serials.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          No hay seriales configurados. Agrega seriales para rastrear productos.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Serial</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Recepción
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                  Venta
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {serials.map((serial) => (
                <tr key={serial.id}>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {serial.serial_number}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {statusLabels[serial.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">
                    {format(new Date(serial.received_at), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">
                    {serial.sold_at ? format(new Date(serial.sold_at), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      {serial.status === 'sold' && (
                        <button
                          onClick={() => handleReturn(serial)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Marcar como devuelto"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {serial.status === 'available' && (
                        <button
                          onClick={() => handleDamaged(serial)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Marcar como dañado"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductSerialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId}
        onConfirm={handleConfirm}
        onBatchConfirm={handleBatchConfirm}
        isSubmitting={createMutation.isPending || batchCreateMutation.isPending}
      />
    </>
  )
}
