import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { inventoryService, StockAdjustedRequest, StockStatus } from '@/services/inventory.service'
import { warehousesService } from '@/services/warehouses.service'
import { salesService } from '@/services/sales.service'
import { useAuth } from '@/stores/auth.store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

// Umbral para considerar un ajuste como "grande" (más del 50% del stock o más de 100 unidades)
const LARGE_ADJUSTMENT_THRESHOLD_PERCENT = 50
const LARGE_ADJUSTMENT_THRESHOLD_UNITS = 100

interface StockAdjustModalProps {
  isOpen: boolean
  onClose: () => void
  product: StockStatus | null
  onSuccess?: () => void
}

const stockAdjustSchema = z.object({
  qty_delta: z.preprocess(
    (val) => Number(val),
    z.number().refine((val) => val !== 0, 'La cantidad debe ser diferente de 0')
  ),
  reason: z.enum(['loss', 'damage', 'count', 'other']),
  note: z.string().optional(),
}).refine(
  (data) => {
    // Si la razón es "other", la nota es obligatoria
    if (data.reason === 'other') {
      return data.note && data.note.trim().length >= 10
    }
    return true
  },
  {
    message: 'Debes especificar una descripción (mínimo 10 caracteres) cuando seleccionas "Otro"',
    path: ['note'],
  }
)

type StockAdjustForm = z.infer<typeof stockAdjustSchema>

const reasonLabels = {
  loss: 'Pérdida',
  damage: 'Daño',
  count: 'Conteo',
  other: 'Otro',
}

export default function StockAdjustModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockAdjustModalProps) {
  const { user } = useAuth()
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingData, setPendingData] = useState<StockAdjustForm | null>(null)
  const [hasRecentSales, setHasRecentSales] = useState(false)
  const [recentSalesCount, setRecentSalesCount] = useState(0)

  // Obtener bodegas
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: isOpen && !!user?.store_id,
  })

  // Obtener bodega por defecto
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['warehouses', 'default'],
    queryFn: () => warehousesService.getDefault(),
    enabled: isOpen && !!user?.store_id,
  })

  // Prellenar bodega por defecto
  useEffect(() => {
    if (isOpen && defaultWarehouse && !warehouseId) {
      setWarehouseId(defaultWarehouse.id)
    }
  }, [isOpen, defaultWarehouse, warehouseId])

  // Verificar ventas recientes del producto (últimas 2 horas)
  const { data: recentSalesData } = useQuery({
    queryKey: ['sales', 'recent', product?.product_id, user?.store_id],
    queryFn: async () => {
      if (!product?.product_id || !user?.store_id) return { sales: [], total: 0 }

      // Buscar ventas de las últimas 2 horas
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()

      const result = await salesService.list({
        date_from: twoHoursAgo,
        date_to: now,
        limit: 100, // Límite alto para buscar todas las ventas recientes
        store_id: user.store_id,
      })

      // Filtrar ventas que incluyan este producto
      const salesWithProduct = result.sales.filter((sale) =>
        sale.items.some((item) => item.product_id === product.product_id)
      )

      return {
        sales: salesWithProduct,
        total: salesWithProduct.length,
      }
    },
    enabled: isOpen && !!product?.product_id && !!user?.store_id,
    staleTime: 1000 * 30, // 30 segundos
  })

  // Actualizar estado de ventas recientes
  useEffect(() => {
    if (recentSalesData) {
      const count = recentSalesData.total
      setHasRecentSales(count > 0)
      setRecentSalesCount(count)
    } else {
      setHasRecentSales(false)
      setRecentSalesCount(0)
    }
  }, [recentSalesData])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(stockAdjustSchema) as any,
    defaultValues: {
      qty_delta: 0,
      reason: 'other',
      note: '',
    },
  })

  const qtyDelta = watch('qty_delta')

  // Calcular stock resultante
  const resultingStock = product ? product.current_stock + (qtyDelta || 0) : 0

  useEffect(() => {
    if (isOpen) {
      reset({
        qty_delta: 0,
        reason: 'other',
        note: '',
      })
      if (defaultWarehouse) {
        setWarehouseId(defaultWarehouse.id)
      }
    } else {
      setWarehouseId(null)
    }
  }, [isOpen, reset, defaultWarehouse])

  const queryClient = useQueryClient()

  const stockAdjustMutation = useMutation({
    mutationFn: (data: StockAdjustedRequest) => {
      if (!product) throw new Error('Producto no seleccionado')
      return inventoryService.stockAdjusted({
        ...data,
        product_id: product.product_id,
        warehouse_id: warehouseId || undefined,
      })
    },
    onMutate: async (newData) => {
      // Cancelar refetches en curso
      await queryClient.cancelQueries({ queryKey: ['inventory', 'stock-status'] })

      // Snapshot del valor anterior
      const previousStock = queryClient.getQueryData(['inventory', 'stock-status'])

      // Optimistic update
      queryClient.setQueriesData({ queryKey: ['inventory', 'stock-status'] }, (old: any) => {
        if (!old) return old

        // Manejar estructura paginada { items: [], total: 0 } o array directo
        const isPaged = old.items && Array.isArray(old.items)
        const items = isPaged ? old.items : (Array.isArray(old) ? old : [])

        const newItems = items.map((item: StockStatus) => {
          if (item.product_id === product?.product_id) {
            return {
              ...item,
              current_stock: item.current_stock + newData.qty_delta,
              // Actualizar estado de bajo stock si es necesario
              is_low_stock: (item.current_stock + newData.qty_delta) <= item.low_stock_threshold
            }
          }
          return item
        })

        if (isPaged) {
          return { ...old, items: newItems }
        }
        return newItems
      })

      return { previousStock }
    },
    onSuccess: () => {
      toast.success('Stock ajustado exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: async (error: any, variables, context) => {
      // ✅ OFFLINE-FIRST: Si falla por conexión, encolar evento
      if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED' || !navigator.onLine) {
        try {
          // Importar dinámicamente para evitar ciclos si fuera necesario
          const { syncService } = await import('@/services/sync.service')

          if (!product) return

          // Construir evento
          await syncService.enqueueEvent({
            event_id: crypto.randomUUID(),
            type: 'inventory.stock_adjusted',
            payload: {
              ...variables,
              product_id: product.product_id,
              warehouse_id: warehouseId || undefined,
            },
            created_at: Date.now(),
            seq: 0, // Se asigna en backend o localmente
            store_id: user?.store_id || '',
            device_id: localStorage.getItem('device_id') || 'unknown',
            version: 1,
            actor: {
              user_id: user?.user_id || 'unknown',
              role: (user?.role as any) || 'cashier',
            },
          })

          toast.success('Guardado localmente (sin conexión)')
          onClose()
          onSuccess?.()

          // No hacemos rollback porque queremos mantener la UI optimista
          return
        } catch (queueError) {
          console.error('Error al encolar offline:', queueError)
        }
      }

      // Si no es error de conexión, rollback
      if (context?.previousStock) {
        queryClient.setQueriesData(
          { queryKey: ['inventory', 'stock-status'] },
          context.previousStock
        )
      }
      toast.error(error.response?.data?.message || 'Error al ajustar stock')
    },
    onSettled: () => {
      // Invalidate para asegurar consistencia final (si hay red)
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-status'] })
      }
    }
  })

  // Verificar si es un ajuste grande
  const isLargeAdjustment = (delta: number): boolean => {
    if (!product) return false
    const absChange = Math.abs(delta)
    const currentStock = product.current_stock || 0

    // Más de 100 unidades
    if (absChange >= LARGE_ADJUSTMENT_THRESHOLD_UNITS) return true

    // Más del 50% del stock actual (si hay stock)
    if (currentStock > 0) {
      const percentChange = (absChange / currentStock) * 100
      if (percentChange >= LARGE_ADJUSTMENT_THRESHOLD_PERCENT) return true
    }

    // Stock resultante negativo
    if (currentStock + delta < 0) return true

    return false
  }

  const onSubmit = (data: StockAdjustForm) => {
    if (!product) return

    // Bloquear ajuste si hay ventas recientes
    if (hasRecentSales) {
      toast.error(
        `No se puede ajustar el stock. Hay ${recentSalesCount} venta(s) reciente(s) que incluyen este producto. Espera al menos 2 horas después de la última venta.`,
        { duration: 6000 }
      )
      return
    }

    // Verificar si necesita confirmación
    if (isLargeAdjustment(data.qty_delta)) {
      setPendingData(data)
      setShowConfirmDialog(true)
      return
    }

    // Proceder directamente
    executeAdjustment(data)
  }

  const executeAdjustment = (data: StockAdjustForm) => {
    if (!product) return
    stockAdjustMutation.mutate({
      ...data,
      product_id: product.product_id,
    })
  }

  const handleConfirmLargeAdjustment = () => {
    if (pendingData) {
      executeAdjustment(pendingData)
      setShowConfirmDialog(false)
      setPendingData(null)
    }
  }

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false)
    setPendingData(null)
  }

  if (!product) return null

  const isLoading = stockAdjustMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Ajustar Stock</DialogTitle>
          <DialogDescription className="sr-only">
            Ajusta la cantidad de stock del producto
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit as any)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4 sm:space-y-6">
              {/* Información del producto */}
              <Card className="bg-muted/50 border-border">
                <CardContent className="p-3 sm:p-4">
                  <p className="text-sm text-muted-foreground mb-1">Producto:</p>
                  <p className="font-semibold text-foreground">{product.product_name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Stock actual:</span>
                      <span className="ml-2 font-bold text-foreground">{product.current_stock}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stock resultante:</span>
                      <span
                        className={cn(
                          'ml-2 font-bold',
                          resultingStock < 0
                            ? 'text-destructive'
                            : resultingStock === product.current_stock
                              ? 'text-muted-foreground'
                              : 'text-primary'
                        )}
                      >
                        {resultingStock}
                      </span>
                    </div>
                  </div>
                  {resultingStock < 0 && (
                    <Alert className="mt-2 bg-destructive/10 border-destructive/50">
                      <AlertDescription className="text-xs text-destructive">
                        ⚠️ El stock resultante será negativo
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Alerta de ventas recientes */}
              {hasRecentSales && (
                <Alert className="bg-orange-50 dark:bg-orange-950/20 border-orange-500/50">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription className="text-xs text-orange-800 dark:text-orange-200">
                    <strong>⚠️ Ajuste bloqueado:</strong> Hay {recentSalesCount} venta(s) reciente(s) que incluyen este producto.
                    Para evitar inconsistencias, espera al menos 2 horas después de la última venta antes de ajustar el stock.
                  </AlertDescription>
                </Alert>
              )}

              {/* Cantidad delta */}
              <div>
                <Label htmlFor="qty_delta" className="mb-2">
                  Ajuste de Cantidad <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="qty_delta"
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  {...register('qty_delta', { valueAsNumber: true })}
                  placeholder="Ej: -0.5 (reducir) o +3 (aumentar)"
                />
                {errors.qty_delta && (
                  <p className="mt-1 text-sm text-destructive">{errors.qty_delta.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Usa valores positivos para aumentar y negativos para reducir el stock
                </p>
              </div>

              {/* Bodega */}
              {warehouses.length > 0 && (
                <div>
                  <Label htmlFor="warehouse" className="mb-2">
                    Bodega (Opcional)
                  </Label>
                  <Select
                    value={warehouseId || 'default'}
                    onValueChange={(value) =>
                      setWarehouseId(value === 'default' ? null : value)
                    }
                  >
                    <SelectTrigger id="warehouse">
                      <SelectValue placeholder="Usar bodega por defecto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Usar bodega por defecto</SelectItem>
                      {warehouses
                        .filter((w) => w.is_active)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} {w.is_default && '(Por defecto)'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si no se selecciona, se usará la bodega por defecto
                  </p>
                </div>
              )}

              {/* Razón */}
              <div>
                <Label htmlFor="reason" className="mb-2">
                  Razón del Ajuste <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch('reason')}
                  onValueChange={(value) => setValue('reason', value as 'loss' | 'damage' | 'count' | 'other')}
                >
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
                  Nota {watch('reason') === 'other' && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="mt-2 resize-none"
                  placeholder={watch('reason') === 'other'
                    ? "Describe el motivo del ajuste (obligatorio)"
                    : "Descripción del ajuste (opcional)"}
                />
                {errors.note && (
                  <p className="mt-1 text-sm text-destructive">{errors.note.message}</p>
                )}
                {watch('reason') === 'other' && (
                  <p className="mt-1 text-xs text-amber-600">
                    La nota es obligatoria cuando seleccionas "Otro" como razón
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading || qtyDelta === 0 || resultingStock < 0 || hasRecentSales}
              >
                {isLoading ? 'Ajustando...' : 'Ajustar Stock'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Confirmación para ajustes grandes */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar ajuste grande
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de realizar un ajuste significativo de stock:
              </p>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 border border-orange-200 dark:border-orange-800 text-sm">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  {product?.product_name}
                </p>
                <p className="text-orange-700 dark:text-orange-300 mt-1">
                  {pendingData?.qty_delta && pendingData.qty_delta > 0 ? '+' : ''}
                  {pendingData?.qty_delta} unidades
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Stock actual: {product?.current_stock} →
                  Stock final: {(product?.current_stock || 0) + (pendingData?.qty_delta || 0)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelConfirm}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLargeAdjustment}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Sí, ajustar stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
