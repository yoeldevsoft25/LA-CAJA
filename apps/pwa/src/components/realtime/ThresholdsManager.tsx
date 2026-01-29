import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import {
  AlertThreshold,
  CreateAlertThresholdRequest,
  AlertType,
  ComparisonOperator,
  AlertSeverity,
} from '@/types/realtime-analytics.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Settings, Plus, Trash2, Edit } from 'lucide-react'
import toast from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
// Helper para formatear severidad de alertas
const formatAlertSeverity = (severity: string): { label: string; bgColor: string } => {
  const severityMap: Record<string, { label: string; bgColor: string }> = {
    low: { label: 'Baja', bgColor: 'bg-gray-100' },
    medium: { label: 'Media', bgColor: 'bg-yellow-100' },
    high: { label: 'Alta', bgColor: 'bg-orange-100' },
    critical: { label: 'Crítica', bgColor: 'bg-red-100' },
  }
  return severityMap[severity] || { label: severity, bgColor: 'bg-gray-100' }
}

const alertTypeLabels: Record<AlertType, string> = {
  stock_low: 'Stock Bajo',
  revenue_drop: 'Caída de Ingresos',
  sales_drop: 'Caída de Ventas',
  inventory_anomaly: 'Anomalía de Inventario',
  payment_issue: 'Problema de Pago',
  system_error: 'Error del Sistema',
  sale_anomaly: 'Anomalía en Ventas',
  revenue_spike: 'Aumento de Ingresos',
  inventory_high: 'Exceso de Inventario',
  debt_overdue: 'Deuda Vencida',
  product_expiring: 'Producto por Vencer',
  custom: 'Personalizada',
}

const operatorLabels: Record<ComparisonOperator, string> = {
  gt: 'Mayor que (>)',
  gte: 'Mayor o igual que (>=)',
  lt: 'Menor que (<)',
  lte: 'Menor o igual que (<=)',
  eq: 'Igual a (=)',
  neq: 'Diferente de (!=)',
  less_than: 'Menor que (<)',
  greater_than: 'Mayor que (>)',
  equals: 'Igual a (=)',
  not_equals: 'Diferente de (!=)',
}

const metricNameLabels: Record<string, string> = {
  out_of_stock_count: 'Productos sin Stock',
  daily_revenue_bs: 'Ingresos Diarios (Bs)',
  daily_revenue_usd: 'Ingresos Diarios (USD)',
  overdue_debt_bs: 'Deuda Vencida (Bs)',
  expired_products_count: 'Productos Vencidos',
  low_stock_count: 'Stock Bajo',
  cash_on_hand_bs: 'Efectivo en Caja',
  daily_sales_count: 'Volumen de Ventas',
  expiring_soon_count: 'Próximos a Vencer',
  customers_overdue_count: 'Clientes en Mora',
  total_debt_bs: 'Deuda Total (Bs)',
  inventory_value_bs: 'Valor Inventario',
  avg_ticket_bs: 'Ticket Promedio (Bs)',
  avg_ticket_usd: 'Ticket Promedio (USD)',
  pending_orders_count: 'Órdenes de Compra',
  active_sessions_count: 'Sesiones Abiertas',
  active_customers_count: 'Clientes Activos',
  products_sold_count: 'Productos Vendidos',
}

export default function ThresholdsManager() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingThreshold, setEditingThreshold] = useState<AlertThreshold | null>(null)

  const { data: thresholds = [], isLoading } = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: () => realtimeAnalyticsService.getThresholds(),
    staleTime: 1000 * 60 * 2, // 2 minutos - más frecuente porque es rápido con vistas materializadas
  })

  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: CreateAlertThresholdRequest) =>
      realtimeAnalyticsService.createThreshold(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
      toast.success('Umbral creado correctamente')
      setIsCreateModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el umbral')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      realtimeAnalyticsService.updateThreshold(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
      toast.success('Umbral actualizado correctamente')
      setEditingThreshold(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el umbral')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => realtimeAnalyticsService.deleteThreshold(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
      toast.success('Umbral eliminado correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el umbral')
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: () => realtimeAnalyticsService.deleteAllThresholds(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
      toast.success('Todos los umbrales han sido eliminados')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar los umbrales')
    },
  })

  const deleteAlertsMutation = useMutation({
    mutationFn: () => realtimeAnalyticsService.deleteAllAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realtime-alerts'] }) // Re-feth alerts if they are on the page
      toast.success('Historial de alertas eliminado')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el historial')
    },
  })

  const handleDeleteAll = () => {
    if (
      !confirm(
        '¿Está seguro de que desea eliminar TODOS los umbrales? Esta acción no se puede deshacer.'
      )
    )
      return
    deleteAllMutation.mutate()
  }

  const handleDeleteHistory = () => {
    if (
      !confirm(
        '¿Está seguro de que desea eliminar TODO el historial de alertas? Esta acción no se puede deshacer.'
      )
    )
      return
    deleteAlertsMutation.mutate()
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Está seguro de eliminar este umbral?')) return
    deleteMutation.mutate(id)
  }

  const handleToggleActive = (threshold: AlertThreshold) => {
    updateMutation.mutate({
      id: threshold.id,
      data: { is_active: !threshold.is_active },
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Settings className="w-5 h-5 text-primary" />
              Gestión de Umbrales
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteHistory}
                className="text-orange-600 border-orange-100 hover:bg-orange-50 h-9"
                disabled={deleteAlertsMutation.isPending}
              >
                Limpiar Historial
              </Button>
              {thresholds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAll}
                  className="text-red-600 border-red-100 hover:bg-red-50 h-9"
                  disabled={deleteAllMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Vaciar Umbrales
                </Button>
              )}
              <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="h-9 shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Crear Umbral
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : thresholds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No hay umbrales configurados
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Umbral
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Vista de Tabla para Tablet/Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Métrica</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead>Umbral</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thresholds.map((threshold) => {
                      const severity = formatAlertSeverity(threshold.severity)
                      return (
                        <TableRow key={threshold.id}>
                          <TableCell className="font-medium">
                            {alertTypeLabels[threshold.alert_type] || threshold.alert_type}
                          </TableCell>
                          <TableCell>
                            {metricNameLabels[threshold.metric_name] || threshold.metric_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {operatorLabels[threshold.comparison_operator]}
                          </TableCell>
                          <TableCell className="font-bold">{threshold.threshold_value}</TableCell>
                          <TableCell>
                            <Badge className={severity.bgColor} variant="secondary">
                              {severity.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={threshold.is_active}
                              onCheckedChange={() => handleToggleActive(threshold)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingThreshold(threshold)}
                                className="h-8 w-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(threshold.id)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Vista de Tarjetas para Mobile */}
              <div className="md:hidden space-y-3">
                {thresholds.map((threshold) => {
                  const severity = formatAlertSeverity(threshold.severity)
                  return (
                    <div key={threshold.id} className="p-4 border rounded-xl space-y-3 bg-card shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {alertTypeLabels[threshold.alert_type] || threshold.alert_type}
                          </p>
                          <h4 className="font-bold text-base leading-tight">
                            {metricNameLabels[threshold.metric_name] || threshold.metric_name}
                          </h4>
                        </div>
                        <Badge className={`${severity.bgColor} px-2 py-0.5`} variant="secondary">
                          {severity.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between py-2 border-y border-dashed">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Condición:</span>{' '}
                          <span className="font-medium">{operatorLabels[threshold.comparison_operator]}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Valor:</span>{' '}
                          <span className="font-bold text-primary">{threshold.threshold_value}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={threshold.is_active}
                            onCheckedChange={() => handleToggleActive(threshold)}
                            id={`active-${threshold.id}`}
                          />
                          <Label htmlFor={`active-${threshold.id}`} className="text-xs">
                            {threshold.is_active ? 'Activo' : 'Inactivo'}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingThreshold(threshold)}
                            className="h-8 px-3"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(threshold.id)}
                            className="h-8 px-3 text-red-600 border-red-100 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de creación/edición */}
      <ThresholdFormModal
        isOpen={isCreateModalOpen || !!editingThreshold}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingThreshold(null)
        }}
        threshold={editingThreshold}
        onSubmit={(data) => {
          if (editingThreshold) {
            updateMutation.mutate({ id: editingThreshold.id, data })
          } else {
            createMutation.mutate(data)
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

interface ThresholdFormModalProps {
  isOpen: boolean
  onClose: () => void
  threshold: AlertThreshold | null
  onSubmit: (data: CreateAlertThresholdRequest) => void
  isLoading: boolean
}

function ThresholdFormModal({
  isOpen,
  onClose,
  threshold,
  onSubmit,
  isLoading,
}: ThresholdFormModalProps) {
  const [formData, setFormData] = useState<CreateAlertThresholdRequest>({
    alert_type: 'stock_low',
    metric_name: '',
    threshold_value: 0,
    comparison_operator: 'lt',
    severity: 'medium',
  })

  // Actualizar formulario cuando cambia el threshold
  useEffect(() => {
    if (threshold) {
      setFormData({
        alert_type: threshold.alert_type,
        metric_name: threshold.metric_name,
        threshold_value: threshold.threshold_value,
        comparison_operator: threshold.comparison_operator,
        severity: threshold.severity,
      })
    } else {
      setFormData({
        alert_type: 'stock_low',
        metric_name: '',
        threshold_value: 0,
        comparison_operator: 'lt',
        severity: 'medium',
      })
    }
  }, [threshold])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {threshold ? 'Editar Umbral' : 'Crear Umbral de Alerta'}
          </DialogTitle>
          <DialogDescription>
            Configure un umbral para generar alertas automáticas cuando se cumpla
            la condición.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="alert_type">Tipo de Alerta</Label>
            <Select
              value={formData.alert_type}
              onValueChange={(value) =>
                setFormData({ ...formData, alert_type: value as AlertType })
              }
            >
              <SelectTrigger id="alert_type" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(alertTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="metric_name">Nombre de Métrica</Label>
            <Input
              id="metric_name"
              value={formData.metric_name}
              onChange={(e) =>
                setFormData({ ...formData, metric_name: e.target.value })
              }
              className="mt-2"
              placeholder="Ej: revenue_bs, sales_count, etc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="comparison_operator">Operador</Label>
              <Select
                value={formData.comparison_operator}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    comparison_operator: value as ComparisonOperator,
                  })
                }
              >
                <SelectTrigger id="comparison_operator" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(operatorLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="threshold_value">Valor Umbral</Label>
              <Input
                id="threshold_value"
                type="number"
                step="0.01"
                value={formData.threshold_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    threshold_value: parseFloat(e.target.value) || 0,
                  })
                }
                className="mt-2"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="severity">Severidad</Label>
            <Select
              value={formData.severity}
              onValueChange={(value) =>
                setFormData({ ...formData, severity: value as AlertSeverity })
              }
            >
              <SelectTrigger id="severity" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : threshold ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

