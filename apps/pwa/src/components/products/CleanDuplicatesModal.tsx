import { useState } from 'react'
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import toast from '@/lib/toast'
import { productsService, Product } from '@la-caja/app-core'
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

export default function CleanDuplicatesModal({ isOpen, onClose, onSuccess }: CleanDuplicatesModalProps) {
  const { user } = useAuth()
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [cleanProgress, setCleanProgress] = useState(0)
  const [step, setStep] = useState<'scan' | 'preview' | 'cleaning' | 'complete'>('scan')
  const [deactivatedCount, setDeactivatedCount] = useState(0)

  const handleScan = async () => {
    if (!user?.store_id) return

    setIsScanning(true)
    console.log('[Clean Duplicates] 🔍 Escaneando productos duplicados...')

    try {
      // Cargar TODOS los productos activos
      const response = await productsService.search({ is_active: true, limit: 100000 }, user.store_id)
      const allProducts = response.products

      console.log('[Clean Duplicates] ✅ Productos cargados:', allProducts.length)

      // Agrupar por nombre (case-insensitive)
      const productsByName = new Map<string, Product[]>()

      allProducts.forEach(product => {
        const normalizedName = product.name.toLowerCase().trim()
        if (!productsByName.has(normalizedName)) {
          productsByName.set(normalizedName, [])
        }
        productsByName.get(normalizedName)!.push(product)
      })

      // Filtrar solo grupos con duplicados (más de 1 producto con mismo nombre)
      const duplicates: DuplicateGroup[] = []

      productsByName.forEach((products) => {
        if (products.length > 1) {
          // Ordenar por fecha de creación (más reciente primero según ID)
          const sorted = [...products].sort((a, b) => b.id.localeCompare(a.id))

          duplicates.push({
            name: products[0].name, // Usar el nombre original del primer producto
            products: sorted,
            duplicateCount: sorted.length - 1 // -1 porque queremos mantener el más reciente
          })
        }
      })

      // Ordenar grupos por cantidad de duplicados (descendente)
      duplicates.sort((a, b) => b.duplicateCount - a.duplicateCount)

      setDuplicateGroups(duplicates)

      console.log('[Clean Duplicates] 📊 Grupos duplicados encontrados:', duplicates.length)
      console.log('[Clean Duplicates] 🔢 Total de productos a desactivar:',
        duplicates.reduce((sum, g) => sum + g.duplicateCount, 0))

      if (duplicates.length === 0) {
        toast.success('¡No se encontraron productos duplicados!', { duration: 4000 })
        setStep('scan')
      } else {
        setStep('preview')
        toast.success(`Encontrados ${duplicates.length} grupos con duplicados`, { duration: 5000 })
      }
    } catch (error: any) {
      console.error('[Clean Duplicates] ❌ Error escaneando duplicados:', error)
      toast.error('Error al escanear productos duplicados')
    } finally {
      setIsScanning(false)
    }
  }

  const handleClean = async () => {
    if (!user?.store_id || duplicateGroups.length === 0) return

    setStep('cleaning')
    setCleanProgress(0)
    setDeactivatedCount(0)

    console.log('[Clean Duplicates] 🧹 Iniciando limpieza de duplicados...')

    try {
      let totalDeactivated = 0
      const totalToDeactivate = duplicateGroups.reduce((sum, g) => sum + g.duplicateCount, 0)

      for (let i = 0; i < duplicateGroups.length; i++) {
        const group = duplicateGroups[i]

        // Desactivar todos excepto el primero (más reciente por ID)
        for (let j = 1; j < group.products.length; j++) {
          const product = group.products[j]

          try {
            console.log(`[Clean Duplicates] 🗑️ Desactivando duplicado: ${product.name} (ID: ${product.id})`)

            await productsService.deactivate(product.id, user.store_id)

            totalDeactivated++
            setDeactivatedCount(totalDeactivated)

            // Actualizar progreso
            const progress = Math.round((totalDeactivated / totalToDeactivate) * 100)
            setCleanProgress(progress)

            // Pequeño delay para evitar rate limiting (100ms)
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error: any) {
            console.error(`[Clean Duplicates] ❌ Error desactivando ${product.name}:`, error)
            // Continuar con los demás aunque uno falle
          }
        }

        // Log cada 10 grupos
        if ((i + 1) % 10 === 0) {
          console.log(`[Clean Duplicates] ✅ Progreso: ${i + 1}/${duplicateGroups.length} grupos procesados`)
        }
      }

      console.log('[Clean Duplicates] ✅ Limpieza completada:', {
        grupos_procesados: duplicateGroups.length,
        productos_desactivados: totalDeactivated
      })

      setStep('complete')
      toast.success(`✅ ${totalDeactivated} productos duplicados desactivados`, {
        duration: 5000
      })

      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 3000)
    } catch (error) {
      console.error('[Clean Duplicates] ❌ Error crítico durante limpieza:', error)
      toast.error('Error al limpiar duplicados')
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Limpiar Productos Duplicados
          </DialogTitle>
          <DialogDescription>
            Encuentra y desactiva productos duplicados por nombre
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'scan' && (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta herramienta buscará productos con el mismo nombre y <strong>desactivará los duplicados</strong>,
                  manteniendo solo el más reciente (basado en el ID del producto).
                  <br /><br />
                  Los productos desactivados NO se eliminarán permanentemente, solo se marcarán como inactivos.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleScan}
                disabled={isScanning}
                className="w-full btn-glass-neutral"
              >
                {isScanning ? 'Escaneando...' : 'Escanear Productos Duplicados'}
              </Button>
            </>
          )}

          {step === 'preview' && duplicateGroups.length > 0 && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>¡ATENCIÓN!</strong> Se encontraron <strong>{duplicateGroups.length}</strong> grupos con duplicados.
                  <br />
                  Total de productos que se desactivarán: <strong>{duplicateGroups.reduce((sum, g) => sum + g.duplicateCount, 0)}</strong>
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-card border-b border-border px-4 py-2 font-semibold text-sm">
                  Vista previa de duplicados (primeros 50 grupos)
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-card sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Producto</th>
                        <th className="px-4 py-2 text-center">Duplicados</th>
                        <th className="px-4 py-2 text-left">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicateGroups.slice(0, 50).map((group, idx) => (
                        <tr key={idx} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="font-medium">{group.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID más reciente: {group.products[0].id.slice(0, 8)}...
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                              {group.duplicateCount} {group.duplicateCount === 1 ? 'duplicado' : 'duplicados'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            Mantener 1, desactivar {group.duplicateCount}
                          </td>
                        </tr>
                      ))}
                      {duplicateGroups.length > 50 && (
                        <tr className="border-t bg-card">
                          <td colSpan={3} className="px-4 py-3 text-center text-muted-foreground">
                            ... y {duplicateGroups.length - 50} grupos más
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 btn-glass-neutral"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleClean}
                  variant="destructive"
                  className="flex-1 btn-glass-neutral"
                >
                  Desactivar {duplicateGroups.reduce((sum, g) => sum + g.duplicateCount, 0)} Duplicados
                </Button>
              </div>
            </>
          )}

          {step === 'cleaning' && (
            <>
              <div className="text-center py-8 space-y-4">
                <Trash2 className="w-12 h-12 mx-auto text-destructive animate-pulse" />
                <div>
                  <p className="font-medium">Desactivando productos duplicados...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {deactivatedCount} de {duplicateGroups.reduce((sum, g) => sum + g.duplicateCount, 0)} desactivados
                  </p>
                </div>
                <Progress value={cleanProgress} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  No cierres esta ventana hasta que termine
                </p>
              </div>
            </>
          )}

          {step === 'complete' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium text-lg">¡Limpieza completada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {deactivatedCount} productos duplicados fueron desactivados exitosamente
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
