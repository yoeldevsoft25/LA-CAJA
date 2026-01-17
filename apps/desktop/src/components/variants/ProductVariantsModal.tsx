import { X } from 'lucide-react'
import { Product } from '@/services/products.service'
import ProductVariantsList from './ProductVariantsList'

interface ProductVariantsModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
}

export default function ProductVariantsModal({
  isOpen,
  onClose,
  product,
}: ProductVariantsModalProps) {
  if (!isOpen || !product) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Variantes de {product.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ProductVariantsList productId={product.id} />
        </div>
      </div>
    </div>
  )
}
