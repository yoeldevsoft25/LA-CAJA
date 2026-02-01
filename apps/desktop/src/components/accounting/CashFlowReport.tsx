import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { accountingReportsService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Componente para mostrar el Estado de Flujo de Efectivo
 */
export default function CashFlowReport() {
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1))) // Primer día del mes
  const [endDate, setEndDate] = useState<Date>(new Date())

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['accounting', 'reports', 'cash-flow', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: () =>
      accountingReportsService.getCashFlow({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        method: 'indirect',
      }),
    enabled: !!startDate && !!endDate,
  })

  const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
    return currency === 'USD'
      ? `$${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`
  }

  const handleExport = () => {
    // TODO: Implementar exportación
    console.log('Exportar Estado de Flujo de Efectivo')
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">Error al cargar el Estado de Flujo de Efectivo</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Flujo de Efectivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleExport} variant="outline" className="w-full md:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reporte */}
      {isLoading ? (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : report ? (
        <div className="space-y-4">
          {/* Actividades Operativas */}
          <Card>
            <CardHeader>
              <CardTitle>Flujo de Efectivo de Actividades Operativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-right">Bs</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold">Resultado Neto</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.net_income_bs)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.net_income_usd, 'USD')}</TableCell>
                      </TableRow>
                      {report.operating_activities.adjustments.map((adj, index) => (
                        <TableRow key={index}>
                          <TableCell className="pl-4 text-sm">{adj.description}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(adj.amount_bs)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(adj.amount_usd, 'USD')}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-semibold pl-4">Cambios en Capital de Trabajo</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-8 text-sm">Cuentas por Cobrar</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.changes_in_working_capital.accounts_receivable_bs)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.changes_in_working_capital.accounts_receivable_usd, 'USD')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-8 text-sm">Cuentas por Pagar</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.changes_in_working_capital.accounts_payable_bs)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.changes_in_working_capital.accounts_payable_usd, 'USD')}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-8 text-sm">Inventario</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.changes_in_working_capital.inventory_bs)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.changes_in_working_capital.inventory_usd, 'USD')}</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Flujo de Efectivo Neto de Operaciones</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.net_cash_from_operations_bs)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(report.operating_activities.net_cash_from_operations_usd, 'USD')}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actividades de Inversión */}
          <Card>
            <CardHeader>
              <CardTitle>Flujo de Efectivo de Actividades de Inversión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Bs</TableHead>
                      <TableHead className="text-right">USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.investing_activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No hay actividades de inversión en el período
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.investing_activities.map((activity, index) => (
                        <TableRow key={index}>
                          <TableCell>{activity.description}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(activity.amount_bs)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(activity.amount_usd, 'USD')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Actividades de Financiamiento */}
          <Card>
            <CardHeader>
              <CardTitle>Flujo de Efectivo de Actividades de Financiamiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Bs</TableHead>
                      <TableHead className="text-right">USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.financing_activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No hay actividades de financiamiento en el período
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.financing_activities.map((activity, index) => (
                        <TableRow key={index}>
                          <TableCell>{activity.description}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(activity.amount_bs)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(activity.amount_usd, 'USD')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Resumen */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Resumen del Flujo de Efectivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Bs</TableHead>
                      <TableHead className="text-right">USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Efectivo al inicio del período</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(report.cash_at_beginning_bs)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(report.cash_at_beginning_usd, 'USD')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Flujo de efectivo neto</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(report.net_change_in_cash_bs)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(report.net_change_in_cash_usd, 'USD')}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>Efectivo al final del período</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(report.cash_at_end_bs)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(report.cash_at_end_usd, 'USD')}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}