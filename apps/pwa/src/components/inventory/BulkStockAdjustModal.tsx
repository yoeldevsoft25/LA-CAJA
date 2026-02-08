import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { inventoryService, StockStatus, StockAdjustedRequest } from '@/services/inventory.service'
import { warehousesService } from '@/services/warehouses.service'
import { productsService } from '@la-caja/app-core'
import { useAuth } from '@/stores/auth.store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface BulkStockAdjustModalProps {
  isOpen: boolean
  onClose: () => void
  stockItems: StockStatus[]
  onSuccess?: () => void
}

const reasonLabels = {
  loss: 'Pérdida',
  damage: 'Daño',
  count: 'Conteo',
  other: 'Otro',
}

type AdjustmentMode = 'fixed' | 'percentage'
type AdjustmentReason = 'loss' | 'damage' | 'count' | 'other'

export default function BulkStockAdjustModal({
  isOpen,
  onClose,
  stockItems,
  onSuccess,
}: BulkStockAdjustModalProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<AdjustmentMode>('fixed')
  const [category, setCategory] = useState<string>('')
  const [fixedAdjustment, setFixedAdjustment] = useState<string>('')
  const [percentageAdjustment, setPercentageAdjustment] = useState<string>('')
  const [reason, setReason] = useState<AdjustmentReason>('count')
  const [note, setNote] = useState<string>('')
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [previewData, setPreviewData] = useState<Array<{ product_id: string; name: string; current: number; new: number }>>([])

  // Obtener productos para las categorías
  const { data: productsData } = useQuery({
    queryKey: ['products', 'list', user?.store_id],
    queryFn: () => productsService.search({ limit: 10000 }, user?.store_id),
    enabled: isOpen && !!user?.store_id,
    staleTime: 1000 * 60 * 5,
  })

  // Obtener bodega por defecto
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['warehouses', 'default'],
    queryFn: () => warehousesService.getDefault(),
    enabled: isOpen && !!user?.store_id,
  })

  // Obtener bodegas
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: isOpen && !!user?.store_id,
  })

  // Prellenar bodega por defecto
  useEffect(() => {
    if (isOpen && defaultWarehouse && !warehouseId) {
      setWarehouseId(defaultWarehouse.id)
    }
  }, [isOpen, defaultWarehouse, warehouseId])

  // Obtener categorías únicas de productos con stock
  const categories = Array.from(
    new Set(
      stockItems
        .map((item) => {
          const product = productsData?.products?.find((p) => p.id === item.product_id)
          return product?.category
        })
        .filter((c): c is string => c !== null && c !== undefined)
    )
  ).sort()

  // Calcular preview cuando cambian los parámetros
  useEffect(() => {
    if (!category || (!fixedAdjustment && !percentageAdjustment)) {
      setPreviewData([])
      return
    }

    const productsInCategory =
      category === 'TODAS'
        ? stockItems
        : stockItems.filter((item) => {
          const product = productsData?.products?.find((p) => p.id === item.product_id)
          return product?.category === category
        })

    const preview = productsInCategory.map((item) => {
      const current = item.current_stock
      let newStock: number

      if (mode === 'fixed') {
        const adjustment = parseFloat(fixedAdjustment) || 0
        newStock = current + adjustment
      } else {
        const percentage = parseFloat(percentageAdjustment) || 0
        const adjustment = Math.round((current * percentage) / 100)
        newStock = current + adjustment
      }

      return {
        product_id: item.product_id,
        name: item.product_name,
        current,
        new: Math.max(0, newStock), // No permitir negativo
      }
    })

    setPreviewData(preview)
  }, [category, mode, fixedAdjustment, percentageAdjustment, stockItems, productsData])

  const bulkAdjustMutation = useMutation({
    mutationFn: async (adjustments: StockAdjustedRequest[]) => {
      // Ejecutar ajustes secuencialmente para evitar problemas de concurrencia
      const results = []
      for (const adjustment of adjustments) {
        try {
          const result = await inventoryService.stockAdjusted(adjustment)
          results.push({ success: true, product_id: adjustment.product_id, result })
        } catch (error: any) {
          results.push({
            success: false,
            product_id: adjustment.product_id,
            error: error.response?.data?.message || 'Error al ajustar',
          })
        }
      }
      return results
    },
    onSuccess: (results) => {
      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      if (failCount === 0) {
        toast.success(`Stock ajustado exitosamente: ${successCount} productos`)
      } else {
        toast.success(`Stock ajustado: ${successCount} productos. ${failCount} fallaron.`, {
          duration: 5000,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onSuccess?.()
      onClose()
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al ajustar stock masivamente')
      setError(error.response?.data?.message || 'Error al ajustar stock masivamente')
    },
  })

  const resetForm = () => {
    setCategory('')
    setFixedAdjustment('')
    setPercentageAdjustment('')
    setReason('count')
    setNote('')
    setError('')
    setPreviewData([])
  }

  const handleSubmit = () => {
    setError('')

    if (!category) {
      setError('Debes seleccionar una categoría')
      return
    }

    if (mode === 'fixed' && !fixedAdjustment) {
      setError('Debes ingresar un ajuste fijo')
      return
    }

    if (mode === 'percentage' && !percentageAdjustment) {
      setError('Debes ingresar un porcentaje de ajuste')
      return
    }

    if (previewData.length === 0) {
      setError('No hay productos para ajustar en la categoría seleccionada')
      return
    }

    // Validar razón
    if (reason === 'other' && (!note || note.trim().length < 10)) {
      setError('Debes especificar una descripción (mínimo 10 caracteres) cuando seleccionas "Otro"')
      return
    }

    // Crear ajustes
    const adjustments: StockAdjustedRequest[] = previewData.map((item) => {
      const current = item.current
      const newStock = item.new
      const qtyDelta = newStock - current

      return {
        product_id: item.product_id,
        qty_delta: qtyDelta,
        reason,
        note: note.trim() || undefined,
        warehouse_id: warehouseId || undefined,
      }
    })

    bulkAdjustMutation.mutate(adjustments)
  }

  const isLoading = bulkAdjustMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-xl">Ajuste Masivo de Stock</DialogTitle>
          <DialogDescription>
            Ajusta el stock de múltiples productos por categoría
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 md:py-6">
          <div className="space-y-4 md:space-y-6">
            {/* Categoría */}
            <div>
              <Label htmlFor="category" className="mb-2">
                Categoría <span className="text-destructive dark:text-red-400">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">TODAS LAS CATEGORÍAS</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modo de ajuste */}
            <div>
              <Label className="mb-2">Tipo de ajuste</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as AdjustmentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Cantidad fija (suma/resta)</SelectItem>
                  <SelectItem value="percentage">Porcentaje del stock actual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ajuste fijo */}
            {mode === 'fixed' && (
              <div>
                <Label htmlFor="fixedAdjustment" className="mb-2">
                  Cantidad a ajustar <span className="text-destructive dark:text-red-400">*</span>
                </Label>
                <Input
                  id="fixedAdjustment"
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  value={fixedAdjustment}
                  onChange={(e) => setFixedAdjustment(e.target.value)}
                  placeholder="Ej: +10 (sumar) o -5 (restar)"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Usa valores positivos para aumentar y negativos para reducir el stock
                </p>
              </div>
            )}

            {/* Ajuste porcentual */}
            {mode === 'percentage' && (
              <div>
                <Label htmlFor="percentageAdjustment" className="mb-2">
                  Porcentaje a ajustar <span className="text-destructive dark:text-red-400">*</span>
                </Label>
                <Input
                  id="percentageAdjustment"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={percentageAdjustment}
                  onChange={(e) => setPercentageAdjustment(e.target.value)}
                  placeholder="Ej: +10 (aumentar 10%) o -5 (reducir 5%)"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Porcentaje relativo al stock actual de cada producto
                </p>
              </div>
            )}

            {/* Bodega */}
            {warehouses.length > 0 && (
              <div>
                <Label htmlFor="warehouse" className="mb-2">
                  Bodega (Opcional)
                </Label>
                <Select value={warehouseId || '__default__'} onValueChange={(v) => setWarehouseId(v === '__default__' ? null : v)}>
                  <SelectTrigger id="warehouse">
                    <SelectValue placeholder="Bodega por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Bodega por defecto</SelectItem>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Razón */}
            <div>
              <Label htmlFor="reason" className="mb-2">
                Razón del ajuste <span className="text-destructive dark:text-red-400">*</span>
              </Label>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nota */}
            <div>
              <Label htmlFor="note">
                Nota {reason === 'other' && <span className="text-destructive dark:text-red-400">*</span>}
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-2 resize-none"
                placeholder={
                  reason === 'other'
                    ? 'Describe el motivo del ajuste (obligatorio, mínimo 10 caracteres)'
                    : 'Descripción del ajuste (opcional)'
                }
              />
            </div>

            {/* Preview */}
            {previewData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Vista previa del ajuste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {previewData.slice(0, 20).map((item) => (
                        <div
                          key={item.product_id}
                          className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                        >
                          <span className="truncate flex-1">{item.name}</span>
                          <span className="ml-4 text-muted-foreground">
                            {item.current} → <strong>{item.new}</strong>
                          </span>
                        </div>
                      ))}
                      {previewData.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          ... y {previewData.length - 20} productos más
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    Total de productos a ajustar: <strong>{previewData.length}</strong>
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex-shrink-0 border-t border-border px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || previewData.length === 0}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ajustando...
                </>
              ) : (
                `Ajustar ${previewData.length} productos`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
