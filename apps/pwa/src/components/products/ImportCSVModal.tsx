import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
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
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ImportCSVModal({ open, onClose, onSuccess }: ImportCSVModalProps) {
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
    parseCSV(selectedFile)
  }

  const parseCSV = async (file: File) => {
    setIsProcessing(true)
    setErrors([])
    setParsedProducts([])

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        toast.error('El archivo CSV está vacío o no tiene datos')
        setIsProcessing(false)
        return
      }

      // Parsear header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      // Validar headers requeridos
      const requiredHeaders = ['nombre', 'precio_bs', 'precio_usd']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

      if (missingHeaders.length > 0) {
        toast.error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`)
        setIsProcessing(false)
        return
      }

      const products: ParsedProduct[] = []
      const validationErrors: ValidationError[] = []
      let skippedRows = 0

      // Parsear cada línea
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
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
              product.price_bs = parseFloat(value) || 0
              break
            case 'precio_usd':
              product.price_usd = parseFloat(value) || 0
              break
            case 'costo_bs':
              product.cost_bs = parseFloat(value) || undefined
              break
            case 'costo_usd':
              product.cost_usd = parseFloat(value) || undefined
              break
            case 'stock_minimo':
            case 'umbral_stock':
              product.low_stock_threshold = parseInt(value) || undefined
              break
          }
        })

        // Validaciones - SI HAY ERRORES, OMITIR ESTA FILA
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

        // Solo agregar producto si NO tiene errores
        if (!hasErrors) {
          products.push(product)
        } else {
          skippedRows++
        }
      }

      setParsedProducts(products)
      setErrors(validationErrors)

      // Mostrar resumen detallado
      console.log('[CSV Import] Resultado del parsing:', {
        total_filas: lines.length - 1,
        productos_validos: products.length,
        filas_omitidas: skippedRows,
        errores: validationErrors.length
      })

      if (validationErrors.length === 0) {
        setStep('preview')
        toast.success(`${products.length} productos listos para importar`)
      } else if (products.length > 0) {
        // Hay productos válidos Y errores - permitir continuar con los válidos
        setStep('preview')

        // Agrupar errores por tipo para mostrar al usuario
        const errorsByType = validationErrors.reduce((acc, error) => {
          const key = error.message
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        console.log('[CSV Import] Errores por tipo:', errorsByType)

        toast.success(
          `${products.length} productos válidos listos para importar. ${skippedRows} filas omitidas por errores.`,
          { duration: 7000 }
        )
      } else {
        // TODOS los productos tienen errores
        toast.error(`Todas las filas tienen errores. Revisa el archivo y corrige los errores.`)
      }
    } catch (error) {
      console.error('Error parsing CSV:', error)
      toast.error('Error al leer el archivo CSV')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!user?.store_id || parsedProducts.length === 0) return

    setStep('importing')
    setImportProgress(0)

    console.log('[CSV Import] Iniciando importación de', parsedProducts.length, 'productos')

    // Función para importar UN producto con reintentos automáticos y backoff agresivo
    const importProductWithRetry = async (product: ParsedProduct, maxRetries = 10): Promise<boolean> => {
      let lastError: any = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await productsService.create(
            {
              name: product.name,
              category: product.category || null,
              sku: product.sku || null,
              barcode: product.barcode || null,
              price_bs: product.price_bs,
              price_usd: product.price_usd,
              cost_bs: product.cost_bs || 0,
              cost_usd: product.cost_usd || 0,
              low_stock_threshold: product.low_stock_threshold || 10,
            },
            user.store_id
          )

          // ✅ ÉXITO - Esperar 1 segundo completo antes del siguiente
          await new Promise(resolve => setTimeout(resolve, 1000))
          return true
        } catch (err: any) {
          lastError = err
          const status = err?.response?.status

          // Si es 429 (rate limit) o 500 (server error), reintentar con backoff AGRESIVO
          if (status === 429 || status === 500 || err?.code === 'ECONNABORTED') {
            // Backoff exponencial: 2s → 4s → 8s → 16s → 30s (máximo)
            const baseWait = 2000 * Math.pow(2, attempt - 1)
            const waitTime = Math.min(baseWait, 30000) // Máximo 30 segundos

            console.warn(
              `[CSV Import] ⚠️ Rate limit en fila ${product.row} (intento ${attempt}/${maxRetries}), ` +
              `esperando ${(waitTime / 1000).toFixed(1)}s...`
            )
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue // Reintentar
          }

          // Otros errores (400, 404, etc.) no se reintentan
          console.error(`[CSV Import] Error NO retriable en fila ${product.row}:`, {
            status,
            message: err?.message,
            data: err?.response?.data
          })
          return false
        }
      }

      // Si llegamos aquí, agotamos todos los reintentos
      console.error(`[CSV Import] ❌ Fila ${product.row} (${product.name}) FALLÓ después de ${maxRetries} intentos`, {
        status: lastError?.response?.status
      })
      return false
    }

    try {
      let successCount = 0
      let errorCount = 0

      // Procesar productos de UNO EN UNO con reintentos automáticos
      for (let i = 0; i < parsedProducts.length; i++) {
        const product = parsedProducts[i]

        console.log(`[CSV Import] Procesando ${i + 1}/${parsedProducts.length}: ${product.name}`)

        const success = await importProductWithRetry(product)

        if (success) {
          successCount++
        } else {
          errorCount++
        }

        // Actualizar progreso
        const progress = Math.round(((i + 1) / parsedProducts.length) * 100)
        setImportProgress(progress)

        // Log cada 50 productos
        if ((i + 1) % 50 === 0) {
          console.log(`[CSV Import] ✅ Progreso: ${i + 1}/${parsedProducts.length} (${successCount} éxitos, ${errorCount} errores)`)
        }
      }

      console.log('[CSV Import] Importación completada:', {
        total: parsedProducts.length,
        exitos: successCount,
        errores: errorCount
      })

      setStep('complete')

      if (errorCount === 0) {
        toast.success(`✅ ${successCount} productos importados exitosamente`, {
          duration: 5000
        })
      } else {
        toast.success(`${successCount} productos importados, ${errorCount} con errores`, {
          duration: 6000
        })
      }

      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 3000)
    } catch (error) {
      console.error('[CSV Import] Error crítico durante importación:', error)
      toast.error('Error al importar productos')
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
    const template = 'nombre,categoria,sku,codigo_barras,precio_bs,precio_usd,costo_bs,costo_usd,stock_minimo\n' +
      'Producto Ejemplo,Electrónica,SKU001,123456789,100.00,25.00,80.00,20.00,10\n' +
      'Producto 2,Ropa,SKU002,987654321,50.00,12.50,40.00,10.00,5'

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_productos.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Plantilla descargada')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Importar Productos desde CSV</DialogTitle>
          <DialogDescription>
            Importa múltiples productos a la vez desde un archivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step: Upload */}
          {step === 'upload' && (
            <>
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Formato del archivo CSV:</p>
                    <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                      <li><strong>Columnas requeridas:</strong> nombre, precio_bs, precio_usd</li>
                      <li><strong>Columnas opcionales:</strong> categoria, sku, codigo_barras, costo_bs, costo_usd, stock_minimo</li>
                      <li>Los nombres de las columnas deben estar en la primera fila</li>
                      <li>Los valores numéricos deben usar punto como separador decimal</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadTemplate}
                  className="flex-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Descargar Plantilla
                </Button>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {file ? file.name : 'Selecciona un archivo CSV'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Haz clic para seleccionar o arrastra el archivo aquí
                  </p>
                </label>
              </div>

              {isProcessing && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Procesando archivo...</p>
                </div>
              )}

              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Errores de validación:</p>
                    <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                      {errors.slice(0, 10).map((error, idx) => (
                        <li key={idx}>
                          Fila {error.row}, {error.field}: {error.message}
                        </li>
                      ))}
                      {errors.length > 10 && (
                        <li className="font-medium">... y {errors.length - 10} errores más</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription>
                  <p className="font-medium">
                    {parsedProducts.length} productos listos para importar
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Revisa los datos antes de continuar
                  </p>
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Nombre</th>
                      <th className="px-4 py-2 text-left">Categoría</th>
                      <th className="px-4 py-2 text-right">Precio Bs</th>
                      <th className="px-4 py-2 text-right">Precio USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedProducts.slice(0, 100).map((product, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2">{product.name}</td>
                        <td className="px-4 py-2">{product.category || '-'}</td>
                        <td className="px-4 py-2 text-right">{product.price_bs.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{product.price_usd.toFixed(2)}</td>
                      </tr>
                    ))}
                    {parsedProducts.length > 100 && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={4} className="px-4 py-3 text-center text-muted-foreground">
                          ... y {parsedProducts.length - 100} productos más (mostrando primeros 100)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('upload')}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  className="flex-1"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Importar {parsedProducts.length} Productos
                </Button>
              </div>
            </>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <>
              <div className="text-center space-y-4">
                <p className="text-lg font-medium">Importando productos...</p>
                <Progress value={importProgress} className="w-full" />
                <p className="text-sm text-muted-foreground">{importProgress}% completado</p>
              </div>
            </>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription>
                  <p className="font-medium text-lg">¡Importación completada!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Los productos han sido importados exitosamente
                  </p>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
