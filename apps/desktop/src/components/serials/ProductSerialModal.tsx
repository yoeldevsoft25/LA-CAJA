import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  CreateProductSerialRequest,
  CreateSerialsBatchRequest,
} from '@/services/product-serials.service'

interface ProductSerialModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  onConfirm: (data: CreateProductSerialRequest) => void
  onBatchConfirm: (data: CreateSerialsBatchRequest) => void
  isSubmitting?: boolean
}

export default function ProductSerialModal({
  isOpen,
  onClose,
  productId,
  onConfirm,
  onBatchConfirm,
  isSubmitting,
}: ProductSerialModalProps) {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [serialNumber, setSerialNumber] = useState('')
  const [serialNumbers, setSerialNumbers] = useState('')
  const [receivedAt, setReceivedAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setMode('single')
      setSerialNumber('')
      setSerialNumbers('')
      setReceivedAt(new Date().toISOString().slice(0, 10))
      setNote('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = () => {
    setError('')
    if (!receivedAt) {
      setError('La fecha de recepción es requerida')
      return
    }

    if (mode === 'single') {
      if (!serialNumber.trim()) {
        setError('El número de serial es requerido')
        return
      }

      onConfirm({
        product_id: productId,
        serial_number: serialNumber.trim(),
        received_at: receivedAt,
        note: note.trim() || null,
      })
      return
    }

    const batch = serialNumbers
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)

    if (batch.length === 0) {
      setError('Ingresa al menos un serial en el listado')
      return
    }

    onBatchConfirm({
      product_id: productId,
      serial_numbers: batch,
      received_at: receivedAt,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Agregar Seriales</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modo</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'single' | 'batch')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
            >
              <option value="single">Individual</option>
              <option value="batch">Lote</option>
            </select>
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

          {mode === 'single' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial</label>
                <input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
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
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seriales (uno por línea)
              </label>
              <textarea
                value={serialNumbers}
                onChange={(e) => setSerialNumbers(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                rows={6}
                placeholder="SERIAL-001&#10;SERIAL-002"
              />
            </div>
          )}

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
