import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { CreateProductLotRequest, ProductLot } from '@/services/product-lots.service'

interface ProductLotModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  lot?: ProductLot | null
  onConfirm: (data: CreateProductLotRequest) => void
  isSubmitting?: boolean
}

export default function ProductLotModal({
  isOpen,
  onClose,
  productId,
  lot,
  onConfirm,
  isSubmitting,
}: ProductLotModalProps) {
  const [lotNumber, setLotNumber] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costBs, setCostBs] = useState('')
  const [costUsd, setCostUsd] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [receivedAt, setReceivedAt] = useState('')
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (lot) {
      setLotNumber(lot.lot_number || '')
      setQuantity(String(lot.initial_quantity || 0))
      setCostBs(String(lot.unit_cost_bs || ''))
      setCostUsd(String(lot.unit_cost_usd || ''))
      setExpirationDate(lot.expiration_date ? lot.expiration_date.slice(0, 10) : '')
      setReceivedAt(lot.received_at ? lot.received_at.slice(0, 10) : '')
      setSupplier(lot.supplier || '')
      setNote(lot.note || '')
    } else {
      setLotNumber('')
      setQuantity('')
      setCostBs('')
      setCostUsd('')
      setExpirationDate('')
      setReceivedAt(new Date().toISOString().slice(0, 10))
      setSupplier('')
      setNote('')
    }
    setError('')
  }, [lot, isOpen])

  const handleSubmit = () => {
    setError('')

    if (!lotNumber.trim()) {
      setError('El número de lote es requerido')
      return
    }

    const qtyValue = Number.parseFloat(quantity)
    const costBsValue = Number.parseFloat(costBs)
    const costUsdValue = Number.parseFloat(costUsd)

    if (Number.isNaN(qtyValue) || qtyValue <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }
    if (Number.isNaN(costBsValue) || costBsValue < 0) {
      setError('El costo Bs debe ser válido')
      return
    }
    if (Number.isNaN(costUsdValue) || costUsdValue < 0) {
      setError('El costo USD debe ser válido')
      return
    }
    if (!receivedAt) {
      setError('La fecha de recepción es requerida')
      return
    }

    onConfirm({
      product_id: productId,
      lot_number: lotNumber.trim(),
      initial_quantity: qtyValue,
      unit_cost_bs: costBsValue,
      unit_cost_usd: costUsdValue,
      expiration_date: expirationDate || null,
      received_at: receivedAt,
      supplier: supplier.trim() || null,
      note: note.trim() || null,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {lot ? 'Editar Lote' : 'Nuevo Lote'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de lote</label>
            <input
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad inicial</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha recepción</label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Bs</label>
              <input
                type="number"
                value={costBs}
                onChange={(e) => setCostBs(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo USD</label>
              <input
                type="number"
                value={costUsd}
                onChange={(e) => setCostUsd(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha vencimiento</label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
