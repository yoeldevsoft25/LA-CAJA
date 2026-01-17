import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productsService } from '@/services/products.service'
import { useAuth } from '@/stores/auth.store'

interface ParsedProduct {
  name: string
  category?: string
  sku?: string
  barcode?: string
  price_bs: number
  price_usd: number
  cost_bs?: number
  cost_usd?: number
  low_stock_threshold?: number
  row: number
}

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ImportCSVModalProps {
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

export default function ImportCSVModal({ isOpen, onClose, onSuccess }: ImportCSVModalProps) {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Por favor selecciona un archivo CSV')
      return
    }

    setFile(selectedFile)
    void parseCSV(selectedFile)
  }

  const parseCSV = async (selectedFile: File) => {
    setIsProcessing(true)
    setErrors([])
    setParsedProducts([])

    try {
      const text = await selectedFile.text()
      const lines = text.split(/\r?\n/).filter((line) => line.trim())

      if (lines.length < 2) {
        toast.error('El archivo CSV está vacío o no tiene datos')
        return
      }

      const headers = lines[0].split(',').map((header) => header.trim().toLowerCase())

      const requiredHeaders = ['nombre', 'precio_bs', 'precio_usd']
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header))

      if (missingHeaders.length > 0) {
        toast.error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`)
        return
      }

      const products: ParsedProduct[] = []
      const validationErrors: ValidationError[] = []
      let skippedRows = 0

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((value) => value.trim())
        const row = i + 1

        const product: ParsedProduct = {
          name: '',
          price_bs: 0,
          price_usd: 0,
          row,
        }

        headers.forEach((header, index) => {
          const value = values[index] || ''

          switch (header) {
            case 'nombre':
              product.name = value
              break
            case 'categoria':
            case 'categoría':
              product.category = value || undefined
              break
            case 'sku':
              product.sku = value || undefined
              break
            case 'codigo_barras':
            case 'código_barras':
            case 'barcode':
              product.barcode = value || undefined
              break
            case 'precio_bs':
              product.price_bs = Number.parseFloat(value) || 0
              break
            case 'precio_usd':
              product.price_usd = Number.parseFloat(value) || 0
              break
            case 'costo_bs':
              product.cost_bs = Number.parseFloat(value) || undefined
              break
            case 'costo_usd':
              product.cost_usd = Number.parseFloat(value) || undefined
              break
            case 'stock_minimo':
            case 'umbral_stock':
              product.low_stock_threshold = Number.parseInt(value, 10) || undefined
              break
            default:
              break
          }
        })

        let hasErrors = false

        if (!product.name || product.name.trim() === '') {
          validationErrors.push({
            row,
            field: 'nombre',
            message: 'El nombre es requerido',
          })
          hasErrors = true
        }

        if (product.price_bs <= 0) {
          validationErrors.push({
            row,
            field: 'precio_bs',
            message: 'El precio en Bs debe ser mayor a 0',
          })
          hasErrors = true
        }

        if (product.price_usd <= 0) {
          validationErrors.push({
            row,
            field: 'precio_usd',
            message: 'El precio en USD debe ser mayor a 0',
          })
          hasErrors = true
        }

        if (!hasErrors) {
          products.push(product)
        } else {
          skippedRows++
        }
      }

      setParsedProducts(products)
      setErrors(validationErrors)

      if (validationErrors.length === 0) {
        setStep('preview')
        toast.success(`${products.length} productos listos para importar`)
      } else if (products.length > 0) {
        setStep('preview')
        toast.success(
          `${products.length} productos válidos listos para importar. ${skippedRows} filas omitidas por errores.`,
          { duration: 7000 }
        )
      } else {
        toast.error('Todas las filas tienen errores. Revisa el archivo y corrige los errores.')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al leer el archivo CSV'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (parsedProducts.length === 0) return

    setStep('importing')
    setImportProgress(0)

    let existingProducts: Array<{ name: string; sku?: string | null; barcode?: string | null }> = []
    try {
      const response = await productsService.search({ limit: 100000 }, user?.store_id)
      existingProducts = response.products
    } catch (error) {
      console.warn('[CSV Import] No se pudieron cargar productos existentes:', error)
    }

    const productExists = (product: ParsedProduct): boolean => {
      return existingProducts.some((existing) => {
        const nameMatch =
          existing.name.toLowerCase().trim() === product.name.toLowerCase().trim()
        const skuMatch =
          product.sku &&
          existing.sku &&
          existing.sku.toLowerCase().trim() === product.sku.toLowerCase().trim()
        const barcodeMatch =
          product.barcode &&
          existing.barcode &&
          existing.barcode.toLowerCase().trim() === product.barcode.toLowerCase().trim()

        return Boolean(nameMatch || skuMatch || barcodeMatch)
      })
    }

    const importProductWithRetry = async (
      product: ParsedProduct,
      maxRetries = 10
    ): Promise<boolean> => {
      let lastError: unknown = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await productsService.create({
            name: product.name,
            category: product.category || null,
            sku: product.sku || null,
            barcode: product.barcode || null,
            price_bs: product.price_bs,
            price_usd: product.price_usd,
            cost_bs: product.cost_bs || 0,
            cost_usd: product.cost_usd || 0,
            low_stock_threshold: product.low_stock_threshold || 10,
          }, user?.store_id)

          return true
        } catch (error) {
          lastError = error
          const status = (error as { response?: { status?: number } })?.response?.status

          if (status === 429 || status === 500) {
            const baseWait = 2000 * Math.pow(2, attempt - 1)
            const waitTime = Math.min(baseWait, 30000)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            continue
          }

          return false
        }
      }

      console.error('[CSV Import] Fila fallida:', {
        row: product.row,
        name: product.name,
        error: lastError,
      })
      return false
    }

    try {
      let successCount = 0
      let errorCount = 0
      let skippedCount = 0

      for (let i = 0; i < parsedProducts.length; i++) {
        const product = parsedProducts[i]

        if (productExists(product)) {
          skippedCount++
          const progress = Math.round(((i + 1) / parsedProducts.length) * 100)
          setImportProgress(progress)
          continue
        }

        const success = await importProductWithRetry(product)
        if (success) {
          successCount++
        } else {
          errorCount++
        }

        const progress = Math.round(((i + 1) / parsedProducts.length) * 100)
        setImportProgress(progress)

        if ((i + 1) % 60 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 65000))
        }
      }

      toast.success(
        `Importación completada. Éxitos: ${successCount}, Omitidos: ${skippedCount}, Errores: ${errorCount}`,
        { duration: 7000 }
      )

      setStep('complete')
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Error al importar productos'))
      setStep('preview')
    }
  }

  const handleClose = () => {
    setFile(null)
    setParsedProducts([])
    setErrors([])
    setStep('upload')
    setImportProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const downloadTemplate = () => {
    const template =
      'nombre,categoria,sku,codigo_barras,precio_bs,precio_usd,costo_bs,costo_usd,stock_minimo\n' +
      'Producto Ejemplo,Electrónica,SKU001,123456789,100.00,25.00,80.00,20.00,10\n' +
      'Producto 2,Ropa,SKU002,987654321,50.00,12.50,40.00,10.00,5'

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla_productos.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Plantilla descargada')
  }

  if (!isOpen) return null

  const errorsByType = errors.reduce<Record<string, number>>((acc, error) => {
    acc[error.message] = (acc[error.message] || 0) + 1
    return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Importar Productos desde CSV</h2>
            <p className="text-sm text-gray-600">Importa múltiples productos a la vez</p>
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
          {step === 'upload' && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-600 mt-0.5" />
                  <div className="text-sm text-gray-700 space-y-1">
                    <p className="font-semibold">Formato CSV:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Requeridas:</strong> nombre, precio_bs, precio_usd</li>
                      <li><strong>Opcionales:</strong> categoria, sku, codigo_barras, costo_bs, costo_usd, stock_minimo</li>
                      <li>Separador decimal: punto (.)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center justify-center px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Descargar Plantilla
              </button>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload-desktop"
                />
                <label htmlFor="csv-upload-desktop" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {file ? file.name : 'Selecciona un archivo CSV'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Haz clic para seleccionar o arrastra el archivo aquí
                  </p>
                </label>
              </div>

              {isProcessing && (
                <div className="text-center text-sm text-gray-500">Procesando archivo...</div>
              )}

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div className="text-sm text-red-700">
                      <p className="font-semibold mb-2">Errores de validación:</p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {errors.slice(0, 10).map((error, idx) => (
                          <li key={`${error.row}-${idx}`}>
                            Fila {error.row}, {error.field}: {error.message}
                          </li>
                        ))}
                        {errors.length > 10 && (
                          <li className="font-semibold">... y {errors.length - 10} errores más</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-700">
                    <p className="font-semibold">Productos listos para importar</p>
                    <p>Se importarán {parsedProducts.length} productos válidos.</p>
                  </div>
                </div>
              </div>

              {Object.keys(errorsByType).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">Resumen de errores:</p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {Object.entries(errorsByType).map(([message, count]) => (
                      <li key={message}>- {message}: {count}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                  Vista previa (primeros 5 productos)
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Categoría</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Bs</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedProducts.slice(0, 5).map((product) => (
                        <tr key={product.row}>
                          <td className="px-4 py-2">{product.name}</td>
                          <td className="px-4 py-2">{product.category || '-'}</td>
                          <td className="px-4 py-2 text-right">{product.price_bs.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{product.price_usd.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {step === 'importing' && (
            <>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Importando productos...</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">{importProgress}% completado</p>
              </div>
            </>
          )}

          {step === 'complete' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-700 font-semibold">Importación completada</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing || step === 'importing'}
              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {step === 'complete' ? 'Cerrar' : 'Cancelar'}
            </button>
            {step === 'preview' && (
              <button
                type="button"
                onClick={handleImport}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700"
              >
                Importar {parsedProducts.length} productos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
