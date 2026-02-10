import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { accountingReportsService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Reporte de Antigüedad de Saldos (Aging Report)
 * Muestra Cuentas por Cobrar y Cuentas por Pagar clasificadas por tiempo de vencimiento
 */
export default function AccountsAgingReport() {
    const [asOfDate, setAsOfDate] = useState<Date>(new Date())
    const [activeTab, setActiveTab] = useState('receivable')

    // Query para Cuentas por Cobrar
    const {
        data: receivableReport,
        isLoading: isLoadingReceivable,
        error: errorReceivable
    } = useQuery({
        queryKey: ['accounting', 'reports', 'aging-receivable', format(asOfDate, 'yyyy-MM-dd')],
        queryFn: () => accountingReportsService.getAccountsReceivableAging({ as_of_date: format(asOfDate, 'yyyy-MM-dd') }),
        enabled: !!asOfDate && activeTab === 'receivable',
    })

    // Query para Cuentas por Pagar
    const {
        data: payableReport,
        isLoading: isLoadingPayable,
        error: errorPayable
    } = useQuery({
        queryKey: ['accounting', 'reports', 'aging-payable', format(asOfDate, 'yyyy-MM-dd')],
        queryFn: () => accountingReportsService.getAccountsPayableAging({ as_of_date: format(asOfDate, 'yyyy-MM-dd') }),
        enabled: !!asOfDate && activeTab === 'payable',
    })

    const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
        return currency === 'USD'
            ? `$${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`
    }

    const handleExport = () => {
        console.log(`Exportar Aging ${activeTab}`)
    }

    const isLoading = activeTab === 'receivable' ? isLoadingReceivable : isLoadingPayable
    const error = activeTab === 'receivable' ? errorReceivable : errorPayable

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Antigüedad de Saldos</h2>
                    <p className="text-muted-foreground">
                        Análisis de vencimiento de cuentas por cobrar y por pagar.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn('w-[240px] justify-start text-left font-normal', !asOfDate && 'text-muted-foreground')}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {asOfDate ? format(asOfDate, 'PPP') : 'Seleccionar fecha'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar mode="single" selected={asOfDate} onSelect={(date) => date && setAsOfDate(date)} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleExport} variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="receivable" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="receivable" className="flex items-center gap-2">
                        <ArrowDownLeft className="h-4 w-4" />
                        Cuentas por Cobrar
                    </TabsTrigger>
                    <TabsTrigger value="payable" className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4" />
                        Cuentas por Pagar
                    </TabsTrigger>
                </TabsList>

                <div className="mt-4">
                    {error ? (
                        <Card className="border-destructive">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-destructive">
                                    <span className="font-semibold">Error al cargar el reporte:</span>
                                    <span>{(error as Error).message}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ) : isLoading ? (
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Contenido Cuentas por Cobrar */}
                            <TabsContent value="receivable" className="m-0">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Reporte de Cuentas por Cobrar</CardTitle>
                                        <CardDescription>
                                            Saldos pendientes de clientes agrupados por días de vencimiento.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {receivableReport?.customers.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground">
                                                No hay cuentas por cobrar pendientes a la fecha seleccionada.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="rounded-md border overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[200px]">Cliente</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">Corriente</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">1 - 30 días</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">31 - 60 días</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">61 - 90 días</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">+90 días</TableHead>
                                                                <TableHead className="text-right font-bold bg-muted/50">Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {receivableReport?.customers.map((customer) => (
                                                                <TableRow key={customer.customer_id}>
                                                                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-emerald-600 dark:text-emerald-400">{formatCurrency(customer.current_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(customer.current_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-emerald-600 dark:text-emerald-400">{formatCurrency(customer.days_1_30_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(customer.days_1_30_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-yellow-600 dark:text-yellow-400">{formatCurrency(customer.days_31_60_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(customer.days_31_60_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-orange-600 dark:text-orange-400">{formatCurrency(customer.days_61_90_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(customer.days_61_90_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-red-600 dark:text-red-400">{formatCurrency(customer.days_over_90_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(customer.days_over_90_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm font-bold bg-muted/50">
                                                                        <div>{formatCurrency(customer.total_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground text-xs font-normal">{formatCurrency(customer.total_bs)}</div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                        <TableBody className="border-t-2 border-primary/20 bg-muted/20">
                                                            <TableRow>
                                                                <TableCell className="font-bold text-base">TOTALES</TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(receivableReport?.totals.current_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(receivableReport?.totals.current_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(receivableReport?.totals.days_1_30_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(receivableReport?.totals.days_1_30_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(receivableReport?.totals.days_31_60_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(receivableReport?.totals.days_31_60_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(receivableReport?.totals.days_61_90_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(receivableReport?.totals.days_61_90_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(receivableReport?.totals.days_over_90_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(receivableReport?.totals.days_over_90_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono text-base bg-muted/50">
                                                                    <div className="text-primary">{formatCurrency(receivableReport?.totals.total_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(receivableReport?.totals.total_bs || 0)}</div>
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Contenido Cuentas por Pagar */}
                            <TabsContent value="payable" className="m-0">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Reporte de Cuentas por Pagar</CardTitle>
                                        <CardDescription>
                                            Saldos pendientes a proveedores agrupados por días de vencimiento.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {payableReport?.suppliers.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground">
                                                No hay cuentas por pagar pendientes a la fecha seleccionada.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="rounded-md border overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[200px]">Proveedor</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">Corriente</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">1 - 30 días</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">31 - 60 días</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">61 - 90 días</TableHead>
                                                                <TableHead className="text-right whitespace-nowrap">+90 días</TableHead>
                                                                <TableHead className="text-right font-bold bg-muted/50">Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {payableReport?.suppliers.map((supplier) => (
                                                                <TableRow key={supplier.supplier_id}>
                                                                    <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-emerald-600 dark:text-emerald-400">{formatCurrency(supplier.current_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(supplier.current_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-emerald-600 dark:text-emerald-400">{formatCurrency(supplier.days_1_30_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(supplier.days_1_30_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-yellow-600 dark:text-yellow-400">{formatCurrency(supplier.days_31_60_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(supplier.days_31_60_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-orange-600 dark:text-orange-400">{formatCurrency(supplier.days_61_90_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(supplier.days_61_90_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">
                                                                        <div className="text-red-600 dark:text-red-400">{formatCurrency(supplier.days_over_90_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground">{formatCurrency(supplier.days_over_90_bs)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm font-bold bg-muted/50">
                                                                        <div>{formatCurrency(supplier.total_usd, 'USD')}</div>
                                                                        <div className="text-muted-foreground text-xs font-normal">{formatCurrency(supplier.total_bs)}</div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                        <TableBody className="border-t-2 border-primary/20 bg-muted/20">
                                                            <TableRow>
                                                                <TableCell className="font-bold text-base">TOTALES</TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(payableReport?.totals.current_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(payableReport?.totals.current_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(payableReport?.totals.days_1_30_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(payableReport?.totals.days_1_30_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(payableReport?.totals.days_31_60_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(payableReport?.totals.days_31_60_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(payableReport?.totals.days_61_90_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(payableReport?.totals.days_61_90_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono">
                                                                    <div>{formatCurrency(payableReport?.totals.days_over_90_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(payableReport?.totals.days_over_90_bs || 0)}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold font-mono text-base bg-muted/50">
                                                                    <div className="text-primary">{formatCurrency(payableReport?.totals.total_usd || 0, 'USD')}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(payableReport?.totals.total_bs || 0)}</div>
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </>
                    )}
                </div>
            </Tabs>
        </div>
    )
}
