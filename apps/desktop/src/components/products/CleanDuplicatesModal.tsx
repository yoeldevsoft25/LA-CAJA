import { useState } from 'react'
import { Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productsService, Product } from '@/services/products.service'
import { useAuth } from '@/stores/auth.store'

interface DuplicateGroup {
  name: string
  products: Product[]
  duplicateCount: number
}

interface CleanDuplicatesModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

export default function CleanDuplicatesModal({
  isOpen,
  onClose,
  onSuccess,
}: CleanDuplicatesModalProps) {
  const { user } = useAuth()
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [cleanProgress, setCleanProgress] = useState(0)
  const [step, setStep] = useState<'scan' | 'preview' | 'cleaning' | 'complete'>('scan')
  const [deactivatedCount, setDeactivatedCount] = useState(0)

  const handleScan = async () => {
    setIsScanning(true)

    try {
      const response = await productsService.search({ is_active: true, limit: 100000 }, user?.store_id)
      const allProducts = response.products

      const productsByName = new Map<string, Product[]>()

      allProducts.forEach((product) => {
        const normalizedName = product.name.toLowerCase().trim()
        if (!productsByName.has(normalizedName)) {
          productsByName.set(normalizedName, [])
        }
        productsByName.get(normalizedName)?.push(product)
      })

      const duplicates: DuplicateGroup[] = []

      productsByName.forEach((products) => {
        if (products.length > 1) {
          const sorted = [...products].sort((a, b) => b.id.localeCompare(a.id))
          duplicates.push({
            name: products[0].name,
            products: sorted,
            duplicateCount: sorted.length - 1,
          })
        }
      })

      duplicates.sort((a, b) => b.duplicateCount - a.duplicateCount)

      setDuplicateGroups(duplicates)

      if (duplicates.length === 0) {
        toast.success('¡No se encontraron productos duplicados!', { duration: 4000 })
        setStep('scan')
      } else {
        setStep('preview')
        toast.success(`Encontrados ${duplicates.length} grupos con duplicados`, { duration: 5000 })
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al escanear productos duplicados'))
    } finally {
      setIsScanning(false)
    }
  }

  const handleClean = async () => {
    if (duplicateGroups.length === 0) return

    setStep('cleaning')
    setCleanProgress(0)
    setDeactivatedCount(0)

    try {
      let totalDeactivated = 0
      const totalToDeactivate = duplicateGroups.reduce((sum, group) => sum + group.duplicateCount, 0)

      for (let i = 0; i < duplicateGroups.length; i++) {
        const group = duplicateGroups[i]

        for (let j = 1; j < group.products.length; j++) {
          const product = group.products[j]

          try {
            await productsService.deactivate(product.id, user?.store_id)
            totalDeactivated++
            setDeactivatedCount(totalDeactivated)

            const progress = Math.round((totalDeactivated / totalToDeactivate) * 100)
            setCleanProgress(progress)

            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            console.warn('[Clean Duplicates] Error desactivando producto:', {
              productId: product.id,
              error,
            })
          }
        }
      }

      setStep('complete')
      toast.success(`✅ ${totalDeactivated} productos duplicados desactivados`, {
        duration: 5000,
      })

      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 3000)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al limpiar duplicados'))
      setStep('preview')
    }
  }

  const handleClose = () => {
    setDuplicateGroups([])
    setStep('scan')
    setCleanProgress(0)
    setDeactivatedCount(0)
    onClose()
  }

  if (!isOpen) return null

  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicateCount, 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Limpiar Productos Duplicados
            </h2>
            <p className="text-sm text-gray-600">Encuentra y desactiva productos duplicados por nombre</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {step === 'scan' && (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700 space-y-2">
                    <p className="font-semibold">Esta herramienta desactivará productos duplicados.</p>
                    <p>
                      Se mantendrá el producto más reciente (basado en el ID) y los duplicados se marcarán
                      como inactivos. No se eliminan permanentemente.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={isScanning}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isScanning ? 'Escaneando...' : 'Escanear duplicados'}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  Se encontraron <strong>{duplicateGroups.length}</strong> grupos con duplicados.
                  Se desactivarán <strong>{totalDuplicates}</strong> productos.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  Grupos duplicados (top 10)
                </div>
                <div className="divide-y divide-gray-200">
                  {duplicateGroups.slice(0, 10).map((group) => (
                    <div key={group.name} className="px-4 py-3 text-sm">
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      <p className="text-gray-600">
                        {group.duplicateCount} duplicados (total {group.products.length})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'cleaning' && (
            <>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Desactivando duplicados...</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${cleanProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {cleanProgress}% completado ({deactivatedCount} desactivados)
                </p>
              </div>
            </>
          )}

          {step === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-700 font-semibold">Limpieza completada</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={step === 'cleaning'}
              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {step === 'complete' ? 'Cerrar' : 'Cancelar'}
            </button>
            {step === 'preview' && (
              <button
                type="button"
                onClick={handleClean}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold text-sm hover:bg-orange-700"
              >
                Limpiar duplicados
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
