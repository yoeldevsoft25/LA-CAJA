import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { accountingReportsService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Componente para mostrar el Trial Balance (Balance de Comprobación)
 */
export default function TrialBalanceReport() {
  const [asOfDate, setAsOfDate] = useState<Date>(new Date())
  const [includeZeroBalance, setIncludeZeroBalance] = useState(false)

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['accounting', 'reports', 'trial-balance', format(asOfDate, 'yyyy-MM-dd'), includeZeroBalance],
    queryFn: () =>
      accountingReportsService.getTrialBalance({
        as_of_date: format(asOfDate, 'yyyy-MM-dd'),
        include_zero_balance: includeZeroBalance,
      }),
    enabled: !!asOfDate,
  })

  const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
    return currency === 'USD'
      ? `$${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`
  }

  const handleExport = () => {
    // TODO: Implementar exportación
    console.log('Exportar Trial Balance')
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">Error al cargar el Trial Balance</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Balance de Comprobación (Trial Balance)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-zero"
                checked={includeZeroBalance}
                onCheckedChange={(checked) => setIncludeZeroBalance(checked === true)}
              />
              <Label htmlFor="include-zero" className="text-sm font-normal cursor-pointer">
                Incluir cuentas con saldo cero
              </Label>
            </div>
            <Button onClick={handleExport} variant="outline" className="w-full md:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de validación */}
      {report && !report.totals.is_balanced && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            El balance no está equilibrado. Diferencia BS: {formatCurrency(report.totals.difference_bs)}, USD:{' '}
            {formatCurrency(report.totals.difference_usd, 'USD')}
          </AlertDescription>
        </Alert>
      )}

      {report && report.unposted_entries_count > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Hay {report.unposted_entries_count} asiento(s) sin postear que no se incluyen en este reporte.
          </AlertDescription>
        </Alert>
      )}

      {report && report.totals.is_balanced && report.unposted_entries_count === 0 && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            El balance está correctamente equilibrado. Todos los asientos están posteados.
          </AlertDescription>
        </Alert>
      )}

      {/* Reporte */}
      {isLoading ? (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : report ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas y Saldos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-right">Débito BS</TableHead>
                      <TableHead className="text-right">Crédito BS</TableHead>
                      <TableHead className="text-right">Débito USD</TableHead>
                      <TableHead className="text-right">Crédito USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No hay cuentas con movimientos en el período seleccionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.accounts.map((account, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                          <TableCell>
                            <div>{account.account_name}</div>
                            <div className="text-xs text-muted-foreground">{account.account_type}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.debit_balance_bs > 0 ? formatCurrency(account.debit_balance_bs) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.credit_balance_bs > 0 ? formatCurrency(account.credit_balance_bs) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.debit_balance_usd > 0 ? formatCurrency(account.debit_balance_usd, 'USD') : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {account.credit_balance_usd > 0 ? formatCurrency(account.credit_balance_usd, 'USD') : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totales */}
              <div className="flex justify-end gap-8 text-lg font-semibold pt-4 border-t">
                <div className="text-right">
                  <div className="text-muted-foreground text-sm font-normal mb-1">Total Débitos</div>
                  <div className={cn('font-mono', !report.totals.is_balanced && 'text-destructive')}>
                    {formatCurrency(report.totals.total_debits_bs)}
                  </div>
                  <div className="font-mono text-sm text-muted-foreground">
                    {formatCurrency(report.totals.total_debits_usd, 'USD')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-sm font-normal mb-1">Total Créditos</div>
                  <div className={cn('font-mono', !report.totals.is_balanced && 'text-destructive')}>
                    {formatCurrency(report.totals.total_credits_bs)}
                  </div>
                  <div className="font-mono text-sm text-muted-foreground">
                    {formatCurrency(report.totals.total_credits_usd, 'USD')}
                  </div>
                </div>
                {!report.totals.is_balanced && (
                  <div className="text-right">
                    <div className="text-muted-foreground text-sm font-normal mb-1">Diferencia</div>
                    <div className="font-mono text-destructive">{formatCurrency(report.totals.difference_bs)}</div>
                    <div className="font-mono text-sm text-destructive">
                      {formatCurrency(report.totals.difference_usd, 'USD')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}