import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { accountingReportsService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Componente para mostrar el Libro Mayor (General Ledger)
 */
export default function GeneralLedgerReport() {
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1))) // Primer día del mes
  const [endDate, setEndDate] = useState<Date>(new Date())

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['accounting', 'reports', 'general-ledger', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: () =>
      accountingReportsService.getGeneralLedger({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
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
    console.log('Exportar Libro Mayor')
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">Error al cargar el Libro Mayor</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Libro Mayor</CardTitle>
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
      ) : report && report.accounts.length > 0 ? (
        <div className="space-y-4">
          {report.accounts.map((account) => (
            <Card key={account.account_id}>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={account.account_id} className="border-none">
                  <AccordionTrigger className="hover:no-underline px-6 py-4">
                    <div className="flex justify-between items-center w-full mr-4">
                      <div className="text-left">
                        <div className="font-semibold">
                          <span className="font-mono">{account.account_code}</span> - {account.account_name}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {account.account_type} • {account.movements.length} movimiento(s)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Saldo Final</div>
                        <div className="font-mono font-semibold">{formatCurrency(account.closing_balance_bs)}</div>
                        <div className="font-mono text-sm text-muted-foreground">
                          {formatCurrency(account.closing_balance_usd, 'USD')}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-4">
                      {/* Resumen */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <div className="text-sm text-muted-foreground">Saldo Inicial</div>
                          <div className="font-mono font-semibold">{formatCurrency(account.opening_balance_bs)}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(account.opening_balance_usd, 'USD')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Débitos</div>
                          <div className="font-mono font-semibold">{formatCurrency(account.total_debits_bs)}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(account.total_debits_usd, 'USD')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Créditos</div>
                          <div className="font-mono font-semibold">{formatCurrency(account.total_credits_bs)}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(account.total_credits_usd, 'USD')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Saldo Final</div>
                          <div className="font-mono font-semibold">{formatCurrency(account.closing_balance_bs)}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(account.closing_balance_usd, 'USD')}
                          </div>
                        </div>
                      </div>

                      {/* Movimientos */}
                      <div className="border rounded-lg overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Asiento</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">Débito BS</TableHead>
                              <TableHead className="text-right">Crédito BS</TableHead>
                              <TableHead className="text-right">Saldo BS</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {account.movements.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                  No hay movimientos en el período
                                </TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {/* Saldo inicial */}
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={3} className="font-semibold">
                                    Saldo Inicial
                                  </TableCell>
                                  <TableCell colSpan={2}></TableCell>
                                  <TableCell className="text-right font-mono font-semibold">
                                    {formatCurrency(account.opening_balance_bs)}
                                  </TableCell>
                                </TableRow>
                                {/* Movimientos */}
                                {account.movements.map((movement, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{format(new Date(movement.entry_date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="font-mono">{movement.entry_number}</TableCell>
                                    <TableCell>
                                      <div>{movement.description}</div>
                                      {movement.reference_number && (
                                        <div className="text-xs text-muted-foreground">Ref: {movement.reference_number}</div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {movement.debit_amount_bs > 0 ? formatCurrency(movement.debit_amount_bs) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {movement.credit_amount_bs > 0 ? formatCurrency(movement.credit_amount_bs) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                      {formatCurrency(movement.running_balance_bs)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* Saldo final */}
                                <TableRow className="bg-muted/50 font-semibold">
                                  <TableCell colSpan={3}>Saldo Final</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(account.total_debits_bs)}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(account.total_credits_bs)}</TableCell>
                                  <TableCell className="text-right font-mono">{formatCurrency(account.closing_balance_bs)}</TableCell>
                                </TableRow>
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      ) : report && report.accounts.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-muted-foreground">No hay cuentas con movimientos en el período seleccionado</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}