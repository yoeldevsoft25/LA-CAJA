import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  CreateProductVariantRequest,
  ProductVariant,
  VariantType,
} from '@/services/product-variants.service'

interface ProductVariantModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  variant?: ProductVariant | null
  onConfirm: (data: CreateProductVariantRequest) => void
  isSubmitting?: boolean
}

const variantTypes: Array<{ value: VariantType; label: string }> = [
  { value: 'size', label: 'Tamaño' },
  { value: 'color', label: 'Color' },
  { value: 'material', label: 'Material' },
  { value: 'style', label: 'Estilo' },
  { value: 'other', label: 'Otro' },
]

export default function ProductVariantModal({
  isOpen,
  onClose,
  productId,
  variant,
  onConfirm,
  isSubmitting,
}: ProductVariantModalProps) {
  const [variantType, setVariantType] = useState<VariantType>('size')
  const [variantValue, setVariantValue] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [priceBs, setPriceBs] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (variant) {
      setVariantType((variant.variant_type as VariantType) || 'size')
      setVariantValue(variant.variant_value || '')
      setSku(variant.sku || '')
      setBarcode(variant.barcode || '')
      setPriceBs(variant.price_bs ? String(variant.price_bs) : '')
      setPriceUsd(variant.price_usd ? String(variant.price_usd) : '')
      setIsActive(variant.is_active)
    } else {
      setVariantType('size')
      setVariantValue('')
      setSku('')
      setBarcode('')
      setPriceBs('')
      setPriceUsd('')
      setIsActive(true)
    }
    setError('')
  }, [variant, isOpen])

  const handleSubmit = () => {
    setError('')
    if (!variantValue.trim()) {
      setError('El valor de la variante es requerido')
      return
    }

    const priceBsValue = priceBs.trim() ? Number.parseFloat(priceBs) : null
    const priceUsdValue = priceUsd.trim() ? Number.parseFloat(priceUsd) : null

    if (priceBsValue !== null && Number.isNaN(priceBsValue)) {
      setError('Precio Bs inválido')
      return
    }
    if (priceUsdValue !== null && Number.isNaN(priceUsdValue)) {
      setError('Precio USD inválido')
      return
    }

    onConfirm({
      product_id: productId,
      variant_type: variantType,
      variant_value: variantValue.trim(),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      price_bs: priceBsValue,
      price_usd: priceUsdValue,
      is_active: isActive,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {variant ? 'Editar Variante' : 'Nueva Variante'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={variantType}
              onChange={(e) => setVariantType(e.target.value as VariantType)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
            >
              {variantTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
            <input
              value={variantValue}
              onChange={(e) => setVariantValue(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              placeholder="Ej: XL, Rojo, Algodón"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio Bs</label>
              <input
                type="number"
                value={priceBs}
                onChange={(e) => setPriceBs(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio USD</label>
              <input
                type="number"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                placeholder="Opcional"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Activa
          </label>

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
