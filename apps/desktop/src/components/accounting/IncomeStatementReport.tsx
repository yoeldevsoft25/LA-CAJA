import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
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
 * Componente para mostrar el Estado de Resultados
 */
export default function IncomeStatementReport() {
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 1))
  const [endDate, setEndDate] = useState<Date>(new Date())

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['accounting', 'reports', 'income-statement', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: () => accountingReportsService.getIncomeStatement({
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    }),
    enabled: !!startDate && !!endDate && endDate >= startDate,
  })

  const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
    return currency === 'USD' 
      ? `$${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`
  }

  const handleExport = () => {
    // TODO: Implementar exportación
    console.log('Exportar Estado de Resultados')
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">Error al cargar el Estado de Resultados</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Resultados</CardTitle>
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
          {/* Ingresos */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Monto BS</TableHead>
                        <TableHead className="text-right">Monto USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.revenues.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay ingresos en el período
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.revenues.map((account, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.amount_bs)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.amount_usd, 'USD')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <div className="text-right">
                    <div className="text-muted-foreground text-sm">Total Ingresos</div>
                    <div className="font-mono">{formatCurrency(report.totals.total_revenue_bs)}</div>
                    <div className="font-mono text-sm text-muted-foreground">{formatCurrency(report.totals.total_revenue_usd, 'USD')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gastos */}
          <Card>
            <CardHeader>
              <CardTitle>Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Monto BS</TableHead>
                        <TableHead className="text-right">Monto USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.expenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay gastos en el período
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.expenses.map((account, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.amount_bs)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.amount_usd, 'USD')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <div className="text-right">
                    <div className="text-muted-foreground text-sm">Total Gastos</div>
                    <div className="font-mono">{formatCurrency(report.totals.total_expenses_bs)}</div>
                    <div className="font-mono text-sm text-muted-foreground">{formatCurrency(report.totals.total_expenses_usd, 'USD')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingreso Neto */}
          <Card className={cn(
            "bg-muted/50",
            report.totals.net_income_bs >= 0 ? "border-green-500" : "border-red-500"
          )}>
            <CardContent className="pt-6">
              <div className="flex justify-end gap-8 text-xl font-bold">
                <div className="text-right">
                  <div className="text-muted-foreground text-sm font-normal">Ingreso Neto</div>
                  <div className={cn(
                    "font-mono",
                    report.totals.net_income_bs >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(report.totals.net_income_bs)}
                  </div>
                  <div className={cn(
                    "font-mono text-sm font-normal",
                    report.totals.net_income_usd >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(report.totals.net_income_usd, 'USD')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}










