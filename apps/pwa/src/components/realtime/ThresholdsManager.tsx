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
}

const operatorLabels: Record<ComparisonOperator, string> = {
  gt: 'Mayor que (>)',
  gte: 'Mayor o igual que (>=)',
  lt: 'Menor que (<)',
  lte: 'Menor o igual que (<=)',
  eq: 'Igual a (=)',
  neq: 'Diferente de (!=)',
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Gestión de Umbrales de Alertas
            </CardTitle>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Umbral
            </Button>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Métrica</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Umbral</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thresholds.map((threshold) => {
                    const severity = formatAlertSeverity(threshold.severity)
                    return (
                      <TableRow key={threshold.id}>
                        <TableCell className="font-medium">
                          {alertTypeLabels[threshold.alert_type]}
                        </TableCell>
                        <TableCell>{threshold.metric_name}</TableCell>
                        <TableCell>
                          {operatorLabels[threshold.comparison_operator]}
                        </TableCell>
                        <TableCell>{threshold.threshold_value}</TableCell>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingThreshold(threshold)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(threshold.id)}
                              className="text-red-600"
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

