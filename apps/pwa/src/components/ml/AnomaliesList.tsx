import { useState } from 'react'
import { useAnomalies } from '@/hooks/useAnomalies'
import { DetectedAnomaly, AnomalyType, AnomalySeverity, EntityType } from '@/types/ml.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatAnomalyType, formatAnomalySeverity } from '@/utils/ml-formatters'
import { format } from 'date-fns'
import ResolveAnomalyModal from './ResolveAnomalyModal'
import { useNavigate } from 'react-router-dom'

interface AnomaliesListProps {
  filters?: {
    anomaly_type?: AnomalyType
    min_severity?: AnomalySeverity
    start_date?: Date
    end_date?: Date
  }
  limit?: number
}

export default function AnomaliesList({
  filters: initialFilters,
  limit = 50,
}: AnomaliesListProps) {
  const navigate = useNavigate()
  const [selectedAnomaly, setSelectedAnomaly] = useState<DetectedAnomaly | null>(null)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false)
  const [filters, setFilters] = useState({
    anomaly_type: initialFilters?.anomaly_type,
    min_severity: initialFilters?.min_severity || 'low',
    start_date: initialFilters?.start_date
      ? format(initialFilters.start_date, 'yyyy-MM-dd')
      : undefined,
    end_date: initialFilters?.end_date
      ? format(initialFilters.end_date, 'yyyy-MM-dd')
      : undefined,
  })

  const { data, isLoading, error } = useAnomalies({
    ...filters,
    limit,
  })

  const anomalies = data?.anomalies || []

  const handleResolve = (anomaly: DetectedAnomaly) => {
    setSelectedAnomaly(anomaly)
    setIsResolveModalOpen(true)
  }

  const handleViewEntity = (anomaly: DetectedAnomaly) => {
    if (!anomaly.entity_id) return

    const routes: Record<EntityType, string> = {
      sale: `/sales`,
      product: `/products/${anomaly.entity_id}`,
      customer: `/customers/${anomaly.entity_id}`,
      inventory: `/inventory`,
      payment: `/payments`,
    }

    const route = routes[anomaly.entity_type]
    if (route) {
      navigate(route)
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Error al cargar anomalías</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Anomalías Detectadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="anomaly_type">Tipo</Label>
              <Select
                value={filters.anomaly_type || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, anomaly_type: value === 'all' ? undefined : (value as AnomalyType) })
                }
              >
                <SelectTrigger id="anomaly_type" className="mt-2">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sale_amount">Monto de Venta</SelectItem>
                  <SelectItem value="sale_frequency">Frecuencia de Venta</SelectItem>
                  <SelectItem value="product_movement">Movimiento de Producto</SelectItem>
                  <SelectItem value="inventory_level">Nivel de Inventario</SelectItem>
                  <SelectItem value="price_deviation">Desviación de Precio</SelectItem>
                  <SelectItem value="customer_behavior">Comportamiento de Cliente</SelectItem>
                  <SelectItem value="payment_pattern">Patrón de Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="min_severity">Severidad Mínima</Label>
              <Select
                value={filters.min_severity || 'low'}
                onValueChange={(value) =>
                  setFilters({ ...filters, min_severity: value as AnomalySeverity })
                }
              >
                <SelectTrigger id="min_severity" className="mt-2">
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
            <div>
              <Label htmlFor="start_date">Fecha Inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="end_date">Fecha Fin</Label>
              <Input
                id="end_date"
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
                className="mt-2"
              />
            </div>
          </div>

          {/* Tabla de anomalías */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : anomalies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No se encontraron anomalías</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((anomaly) => {
                    const severity = formatAnomalySeverity(anomaly.severity)
                    return (
                      <TableRow key={anomaly.id}>
                        <TableCell className="font-medium">
                          {formatAnomalyType(anomaly.anomaly_type)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{anomaly.entity_type}</span>
                            {anomaly.entity_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleViewEntity(anomaly)}
                                title="Ver entidad"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={severity.bgColor} variant="secondary">
                            {severity.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{Number(anomaly.score).toFixed(2)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {anomaly.description}
                        </TableCell>
                        <TableCell>
                          {format(new Date(anomaly.detected_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {!anomaly.resolved_at ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolve(anomaly)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Resolver
                            </Button>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              Resuelta
                            </Badge>
                          )}
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

      {/* Modal de resolución */}
      <ResolveAnomalyModal
        isOpen={isResolveModalOpen}
        onClose={() => {
          setIsResolveModalOpen(false)
          setSelectedAnomaly(null)
        }}
        anomaly={selectedAnomaly}
      />
    </>
  )
}

