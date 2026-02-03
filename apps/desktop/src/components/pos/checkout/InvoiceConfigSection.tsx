import { useEffect } from 'react'
import { ReceiptText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@la-caja/ui-core'

interface InvoiceSeries {
    id: string
    name: string
    prefix?: string | null
    is_active: boolean
}

interface PriceList {
    id: string
    name: string
}

interface Warehouse {
    id: string
    name: string
}

interface InvoiceConfigSectionProps {
    invoiceSeries: InvoiceSeries[]
    priceLists: PriceList[]
    warehouses: Warehouse[]
    selectedSeriesId: string | null
    selectedPriceListId: string | null
    selectedWarehouseId: string | null
    onSeriesChange: (id: string | null) => void
    onPriceListChange: (id: string | null) => void
    onWarehouseChange: (id: string | null) => void
    generateFiscalInvoice: boolean
    onGenerateFiscalInvoiceChange: (value: boolean) => void
    className?: string
}

export default function InvoiceConfigSection({
    invoiceSeries,
    priceLists,
    warehouses,
    selectedSeriesId,
    selectedPriceListId,
    selectedWarehouseId,
    onSeriesChange,
    onPriceListChange,
    onWarehouseChange,
    generateFiscalInvoice,
    onGenerateFiscalInvoiceChange,
    className,
}: InvoiceConfigSectionProps) {
    useEffect(() => {
        if (!selectedSeriesId && invoiceSeries.length > 0) {
            const defaultSeries = invoiceSeries.find((series) => series.is_active) || invoiceSeries[0]
            if (defaultSeries) {
                onSeriesChange(defaultSeries.id)
            }
        }
    }, [invoiceSeries, selectedSeriesId, onSeriesChange])

    return (
        <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <ReceiptText className="h-4 w-4" />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Configuracion operativa</h3>
                        <p className="text-xs text-slate-500">Factura, precios y bodega</p>
                    </div>
                </div>

                {invoiceSeries.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="invoice-series" className="text-xs uppercase tracking-wide text-slate-600">Serie de factura</Label>
                        <Select
                            value={selectedSeriesId || 'none'}
                            onValueChange={(value) => onSeriesChange(value === 'none' ? null : value)}
                        >
                            <SelectTrigger id="invoice-series" className="bg-slate-50">
                                <SelectValue placeholder="Seleccionar serie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin serie especifica</SelectItem>
                                {invoiceSeries.map((series) => (
                                    <SelectItem key={series.id} value={series.id}>
                                        {series.name} ({series.prefix || '---'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {priceLists.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="price-list" className="text-xs uppercase tracking-wide text-slate-600">Lista de precios</Label>
                        <Select
                            value={selectedPriceListId || 'none'}
                            onValueChange={(value) => onPriceListChange(value === 'none' ? null : value)}
                        >
                            <SelectTrigger id="price-list" className="bg-slate-50">
                                <SelectValue placeholder="Precio base" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Precio base</SelectItem>
                                {priceLists.map((list) => (
                                    <SelectItem key={list.id} value={list.id}>
                                        {list.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {warehouses.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="warehouse" className="text-xs uppercase tracking-wide text-slate-600">Bodega</Label>
                        <Select
                            value={selectedWarehouseId || 'none'}
                            onValueChange={(value) => onWarehouseChange(value === 'none' ? null : value)}
                        >
                            <SelectTrigger id="warehouse" className="bg-slate-50">
                                <SelectValue placeholder="Bodega principal" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Bodega principal</SelectItem>
                                {warehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div>
                        <Label htmlFor="fiscal-invoice" className="text-sm font-medium text-slate-900">Factura fiscal</Label>
                        <p className="text-xs text-slate-500">Generar documento fiscal en esta venta</p>
                    </div>
                    <Switch
                        id="fiscal-invoice"
                        checked={generateFiscalInvoice}
                        onCheckedChange={onGenerateFiscalInvoiceChange}
                        aria-label="Generar factura fiscal"
                    />
                </div>
            </CardContent>
        </Card>
    )
}
