import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { accountingReportsService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, Download, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export default function VATBooksReport() {
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()))
    const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()))
    const [activeTab, setActiveTab] = useState('sales')

    const { data: salesBook, isLoading: isLoadingSales, error: errorSales } = useQuery({
        queryKey: ['accounting', 'reports', 'vat-sales', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
        queryFn: () => accountingReportsService.getVATSalesBook({
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
        }),
        enabled: !!startDate && !!endDate && activeTab === 'sales',
    })

    const { data: purchasesBook, isLoading: isLoadingPurchases, error: errorPurchases } = useQuery({
        queryKey: ['accounting', 'reports', 'vat-purchases', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
        queryFn: () => accountingReportsService.getVATPurchasesBook({
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
        }),
        enabled: !!startDate && !!endDate && activeTab === 'purchases',
    })

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const handleExport = (type: 'sales' | 'purchases') => {
        // TODO: Implementar exportación a Excel/TXT
        console.log(`Exportar Libro de ${type}`)
    }

    const DateFilter = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
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
            <div className="flex gap-2">
                <Button onClick={() => handleExport(activeTab as 'sales' | 'purchases')} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                </Button>
                <Button variant="outline" size="icon">
                    <Printer className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Libros de IVA (SENIAT)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="sales">Libro de Ventas</TabsTrigger>
                            <TabsTrigger value="purchases">Libro de Compras</TabsTrigger>
                        </TabsList>

                        <DateFilter />

                        <TabsContent value="sales">
                            {isLoadingSales ? (
                                <Skeleton className="h-64 w-full" />
                            ) : errorSales ? (
                                <p className="text-destructive">Error al cargar el libro de ventas</p>
                            ) : salesBook ? (
                                <div className="space-y-4">
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table className="whitespace-nowrap">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>N° Factura</TableHead>
                                                    <TableHead>N° Control</TableHead>
                                                    <TableHead>Cliente</TableHead>
                                                    <TableHead>RIF/CI</TableHead>
                                                    <TableHead className="text-right">Total Ventas</TableHead>
                                                    <TableHead className="text-right">Exento</TableHead>
                                                    <TableHead className="text-right">Base Imponible</TableHead>
                                                    <TableHead className="text-right">% Aliq</TableHead>
                                                    <TableHead className="text-right">Impuesto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {salesBook.entries.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                                                            No hay movimientos en el período
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    salesBook.entries.map((entry, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell>{entry.invoice_number}</TableCell>
                                                            <TableCell>{entry.control_number}</TableCell>
                                                            <TableCell>{entry.customer_name}</TableCell>
                                                            <TableCell>{entry.customer_tax_id}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.total_sales)}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.exempt_sales)}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.taxable_base)}</TableCell>
                                                            <TableCell className="text-right font-mono">{entry.tax_rate}%</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.tax_amount)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                                        <div>
                                            <div className="text-sm text-muted-foreground">Total Ventas</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(salesBook.summary.total_sales)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground">Total Exento</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(salesBook.summary.total_exempt)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground">Base Imponible</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(salesBook.summary.total_taxable)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground">Total IVA</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(salesBook.summary.total_tax)}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>

                        <TabsContent value="purchases">
                            {isLoadingPurchases ? (
                                <Skeleton className="h-64 w-full" />
                            ) : errorPurchases ? (
                                <p className="text-destructive">Error al cargar el libro de compras</p>
                            ) : purchasesBook ? (
                                <div className="space-y-4">
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table className="whitespace-nowrap">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>N° Factura</TableHead>
                                                    <TableHead>N° Control</TableHead>
                                                    <TableHead>Proveedor</TableHead>
                                                    <TableHead>RIF</TableHead>
                                                    <TableHead className="text-right">Total Compras</TableHead>
                                                    <TableHead className="text-right">Exento</TableHead>
                                                    <TableHead className="text-right">Base Imponible</TableHead>
                                                    <TableHead className="text-right">% Aliq</TableHead>
                                                    <TableHead className="text-right">Impuesto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {purchasesBook.entries.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                                                            No hay movimientos en el período
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    purchasesBook.entries.map((entry, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell>{entry.invoice_number}</TableCell>
                                                            <TableCell>{entry.control_number}</TableCell>
                                                            <TableCell>{entry.supplier_name}</TableCell>
                                                            <TableCell>{entry.supplier_tax_id}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.total_purchases)}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.exempt_purchases)}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.taxable_base)}</TableCell>
                                                            <TableCell className="text-right font-mono">{entry.tax_rate?.toFixed(2)}%</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(entry.tax_amount)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                                        <div>
                                            <div className="text-sm text-muted-foreground">Total Compras</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(purchasesBook.summary.total_purchases)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground">Total Exento</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(purchasesBook.summary.total_exempt)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground">Base Imponible</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(purchasesBook.summary.total_taxable)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground">Total IVA</div>
                                            <div className="text-lg font-bold font-mono">{formatCurrency(purchasesBook.summary.total_tax)}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
