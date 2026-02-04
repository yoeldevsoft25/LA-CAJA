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
 * Componente para mostrar el Balance General
 */
export default function BalanceSheetReport() {
  const [asOfDate, setAsOfDate] = useState<Date>(new Date())

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['accounting', 'reports', 'balance-sheet', format(asOfDate, 'yyyy-MM-dd')],
    queryFn: () => accountingReportsService.getBalanceSheet({ as_of_date: format(asOfDate, 'yyyy-MM-dd') }),
    enabled: !!asOfDate,
  })

  const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
    return currency === 'USD' 
      ? `$${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`
  }

  const handleExport = () => {
    // TODO: Implementar exportación
    console.log('Exportar Balance General')
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">Error al cargar el Balance General</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Balance General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Fecha de Corte</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !asOfDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {asOfDate ? format(asOfDate, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={asOfDate} onSelect={(date) => date && setAsOfDate(date)} />
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
          {/* Activos */}
          <Card>
            <CardHeader>
              <CardTitle>Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Saldo BS</TableHead>
                        <TableHead className="text-right">Saldo USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.assets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay cuentas de activos con saldo
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.assets.map((account, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.balance_bs)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.balance_usd, 'USD')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <div className="text-right">
                    <div className="text-muted-foreground text-sm">Total Activos</div>
                    <div className="font-mono">{formatCurrency(report.totals.total_assets_bs)}</div>
                    <div className="font-mono text-sm text-muted-foreground">{formatCurrency(report.totals.total_assets_usd, 'USD')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pasivos */}
          <Card>
            <CardHeader>
              <CardTitle>Pasivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Saldo BS</TableHead>
                        <TableHead className="text-right">Saldo USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.liabilities.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay cuentas de pasivos con saldo
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.liabilities.map((account, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.balance_bs)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.balance_usd, 'USD')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <div className="text-right">
                    <div className="text-muted-foreground text-sm">Total Pasivos</div>
                    <div className="font-mono">{formatCurrency(report.totals.total_liabilities_bs)}</div>
                    <div className="font-mono text-sm text-muted-foreground">{formatCurrency(report.totals.total_liabilities_usd, 'USD')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Patrimonio */}
          <Card>
            <CardHeader>
              <CardTitle>Patrimonio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Saldo BS</TableHead>
                        <TableHead className="text-right">Saldo USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.equity.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay cuentas de patrimonio con saldo
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.equity.map((account, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.balance_bs)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(account.balance_usd, 'USD')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <div className="text-right">
                    <div className="text-muted-foreground text-sm">Total Patrimonio</div>
                    <div className="font-mono">{formatCurrency(report.totals.total_equity_bs)}</div>
                    <div className="font-mono text-sm text-muted-foreground">{formatCurrency(report.totals.total_equity_usd, 'USD')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Totales */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex justify-end gap-8 text-xl font-bold">
                <div className="text-right">
                  <div className="text-muted-foreground text-sm font-normal">Total Pasivos + Patrimonio</div>
                  <div className="font-mono">{formatCurrency(report.totals.total_liabilities_bs + report.totals.total_equity_bs)}</div>
                  <div className="font-mono text-sm text-muted-foreground font-normal">
                    {formatCurrency(report.totals.total_liabilities_usd + report.totals.total_equity_usd, 'USD')}
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










