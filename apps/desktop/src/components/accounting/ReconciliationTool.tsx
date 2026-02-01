import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { accountingValidationService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Componente para reconciliación de cuentas contables
 */
export default function ReconciliationTool() {
  const [asOfDate, setAsOfDate] = useState<Date>(new Date())

  const reconciliationMutation = useMutation({
    mutationFn: () =>
      accountingValidationService.reconcileAccounts({
        as_of_date: format(asOfDate, 'yyyy-MM-dd'),
      }),
  })

  const handleReconcile = () => {
    reconciliationMutation.mutate()
  }

  const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
    return currency === 'USD'
      ? `$${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`
  }

  const result = reconciliationMutation.data

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliación de Cuentas Contables</CardTitle>
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
            <Button onClick={handleReconcile} disabled={reconciliationMutation.isPending} className="w-full md:w-auto">
              {reconciliationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reconciliando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconciliar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {reconciliationMutation.isError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Error al ejecutar la reconciliación: {reconciliationMutation.error instanceof Error ? reconciliationMutation.error.message : 'Error desconocido'}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultado */}
      {result && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total de Cuentas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.summary.total_accounts}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Reconciliadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{result.summary.reconciled_accounts}</div>
              </CardContent>
            </Card>
            <Card className={cn(result.summary.accounts_with_discrepancies > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800')}>
              <CardHeader className="pb-3">
                <CardTitle className={cn('text-sm font-medium', result.summary.accounts_with_discrepancies > 0 ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200')}>
                  Con Discrepancias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', result.summary.accounts_with_discrepancies > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300')}>
                  {result.summary.accounts_with_discrepancies}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estado general */}
          {result.summary.accounts_with_discrepancies === 0 ? (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Todas las cuentas están correctamente reconciliadas. No se encontraron discrepancias.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Se encontraron {result.summary.accounts_with_discrepancies} cuenta(s) con discrepancias que requieren atención.
              </AlertDescription>
            </Alert>
          )}

          {/* Tabla de discrepancias */}
          {result.discrepancies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Discrepancias Encontradas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre de Cuenta</TableHead>
                        <TableHead className="text-right">Saldo Esperado BS</TableHead>
                        <TableHead className="text-right">Saldo Actual BS</TableHead>
                        <TableHead className="text-right">Diferencia BS</TableHead>
                        <TableHead className="text-right">Saldo Esperado USD</TableHead>
                        <TableHead className="text-right">Saldo Actual USD</TableHead>
                        <TableHead className="text-right">Diferencia USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.discrepancies.map((discrepancy) => {
                        const severityBS = Math.abs(discrepancy.difference_bs) > 100 ? 'destructive' : 'secondary'
                        const severityUSD = Math.abs(discrepancy.difference_usd) > 10 ? 'destructive' : 'secondary'
                        return (
                          <TableRow key={discrepancy.account_id}>
                            <TableCell className="font-mono font-semibold">{discrepancy.account_code}</TableCell>
                            <TableCell>{discrepancy.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(discrepancy.expected_balance_bs)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(discrepancy.actual_balance_bs)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={severityBS} className="font-mono">
                                {formatCurrency(Math.abs(discrepancy.difference_bs))}
                                {discrepancy.difference_bs < 0 ? ' (Falta)' : ' (Sobra)'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(discrepancy.expected_balance_usd, 'USD')}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(discrepancy.actual_balance_usd, 'USD')}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={severityUSD} className="font-mono">
                                {formatCurrency(Math.abs(discrepancy.difference_usd), 'USD')}
                                {discrepancy.difference_usd < 0 ? ' (Falta)' : ' (Sobra)'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}