import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { mlService } from '@/services/ml.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, Brain, RefreshCw } from 'lucide-react'
import type { EvaluateDemandResponse, DemandEvaluationResult } from '@/types/ml.types'

const statusStyles: Record<string, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-emerald-100 text-emerald-800' },
  insufficient_data: {
    label: 'Datos insuficientes',
    className: 'bg-amber-100 text-amber-800',
  },
  not_found: { label: 'No encontrado', className: 'bg-red-100 text-red-800' },
}

export default function DemandEvaluationPage() {
  const [topN, setTopN] = useState(3)
  const [daysBack, setDaysBack] = useState(180)
  const [horizon, setHorizon] = useState(1)
  const [maxFolds, setMaxFolds] = useState(30)
  const [minTrainSize, setMinTrainSize] = useState<number | ''>('')
  const [result, setResult] = useState<EvaluateDemandResponse | null>(null)

  const evaluateMutation = useMutation({
    mutationFn: () =>
      mlService.evaluateDemand({
        top_n: topN,
        days_back: daysBack,
        horizon,
        max_folds: maxFolds,
        min_train_size: minTrainSize === '' ? undefined : minTrainSize,
      }),
    onSuccess: (data) => setResult(data),
  })

  const handleRun = () => {
    setResult(null)
    evaluateMutation.mutate()
  }

  const evaluations = result?.evaluations || []

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Brain className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Evaluacion de Modelos de Demanda
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Validacion walk-forward para seleccionar el mejor modelo por producto
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuracion de Evaluacion</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="topN">Top productos</Label>
            <Input
              id="topN"
              type="number"
              min="1"
              max="10"
              value={topN}
              onChange={(e) =>
                setTopN(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
              }
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="daysBack">Dias historicos</Label>
            <Input
              id="daysBack"
              type="number"
              min="30"
              max="365"
              value={daysBack}
              onChange={(e) =>
                setDaysBack(
                  Math.max(30, Math.min(365, Number(e.target.value) || 30)),
                )
              }
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="horizon">Horizon</Label>
            <Input
              id="horizon"
              type="number"
              min="1"
              max="7"
              value={horizon}
              onChange={(e) =>
                setHorizon(Math.max(1, Math.min(7, Number(e.target.value) || 1)))
              }
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="maxFolds">Max folds</Label>
            <Input
              id="maxFolds"
              type="number"
              min="5"
              max="60"
              value={maxFolds}
              onChange={(e) =>
                setMaxFolds(
                  Math.max(5, Math.min(60, Number(e.target.value) || 5)),
                )
              }
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="minTrain">Min train (opcional)</Label>
            <Input
              id="minTrain"
              type="number"
              min="7"
              max="90"
              value={minTrainSize}
              onChange={(e) =>
                setMinTrainSize(e.target.value ? Number(e.target.value) : '')
              }
              className="mt-2"
            />
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <Button onClick={handleRun} disabled={evaluateMutation.isPending}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${evaluateMutation.isPending ? 'animate-spin' : ''}`}
            />
            Ejecutar evaluacion
          </Button>
        </CardContent>
      </Card>

      {evaluateMutation.isPending && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32" />
          </CardContent>
        </Card>
      )}

      {evaluateMutation.isError && (
        <Card>
          <CardContent className="p-6 flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>No se pudo ejecutar la evaluacion. Intenta nuevamente.</span>
          </CardContent>
        </Card>
      )}

      {!evaluateMutation.isPending && result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Evaluado: {new Date(result.evaluated_at).toLocaleString()}
            </div>
            {evaluations.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No hay productos para evaluar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>MAE</TableHead>
                    <TableHead>MAPE</TableHead>
                    <TableHead>R2</TableHead>
                    <TableHead>Zero Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((item) => {
                    const status = statusStyles[item.status] || statusStyles.ok
                    return (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <div className="font-medium">
                            {item.product_name || item.product_id}
                          </div>
                          {item.note && (
                            <div className="text-xs text-muted-foreground">
                              {item.note}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={status.className}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.best_model || '-'}</TableCell>
                        <TableCell>
                          {item.metrics ? item.metrics.mae.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.metrics ? `${item.metrics.mape.toFixed(2)}%` : '-'}
                        </TableCell>
                        <TableCell>
                          {item.metrics ? item.metrics.r2.toFixed(3) : '-'}
                        </TableCell>
                        <TableCell>{item.data_stats.zero_ratio.toFixed(2)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!evaluateMutation.isPending && evaluations.length > 0 && (
        <div className="space-y-4">
          {evaluations.map((item: DemandEvaluationResult) => (
            <Card key={`detail-${item.product_id}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{item.product_name || item.product_id}</span>
                  <Badge
                    variant="secondary"
                    className={(statusStyles[item.status] || statusStyles.ok).className}
                  >
                    {(statusStyles[item.status] || statusStyles.ok).label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Modelo</p>
                    <p className="font-semibold">{item.best_model || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">MAE</p>
                    <p className="font-semibold">
                      {item.metrics ? item.metrics.mae.toFixed(2) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">RMSE</p>
                    <p className="font-semibold">
                      {item.metrics ? item.metrics.rmse.toFixed(2) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">MAPE</p>
                    <p className="font-semibold">
                      {item.metrics ? `${item.metrics.mape.toFixed(2)}%` : '-'}
                    </p>
                  </div>
                </div>

                {item.model_metrics && item.model_metrics.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2">
                      Comparativa por modelo
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modelo</TableHead>
                          <TableHead>MAE</TableHead>
                          <TableHead>RMSE</TableHead>
                          <TableHead>MAPE</TableHead>
                          <TableHead>R2</TableHead>
                          <TableHead>Folds</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {item.model_metrics.map((metric) => (
                          <TableRow key={`${item.product_id}-${metric.model}`}>
                            <TableCell>{metric.model}</TableCell>
                            <TableCell>{metric.mae.toFixed(2)}</TableCell>
                            <TableCell>{metric.rmse.toFixed(2)}</TableCell>
                            <TableCell>{metric.mape.toFixed(2)}%</TableCell>
                            <TableCell>{metric.r2.toFixed(3)}</TableCell>
                            <TableCell>{metric.folds}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
