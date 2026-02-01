import { useEffect } from 'react'
import { ShoppingBag } from 'lucide-react'
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
    // Auto-select first active series when component mounts
    useEffect(() => {
        if (!selectedSeriesId && invoiceSeries.length > 0) {
            const defaultSeries = invoiceSeries.find(s => s.is_active) || invoiceSeries[0]
            if (defaultSeries) {
                onSeriesChange(defaultSeries.id)
            }
        }
    }, [invoiceSeries, selectedSeriesId, onSeriesChange])

    return (
        <Card className={className}>
            <CardContent className="p-4 space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Configuración de Venta
                </h3>

                {/* Serie de Factura */}
                {invoiceSeries.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="invoice-series">Serie de Factura</Label>
                        <Select
                            value={selectedSeriesId || 'none'}
                            onValueChange={(value) => onSeriesChange(value === 'none' ? null : value)}
                        >
                            <SelectTrigger id="invoice-series">
                                <SelectValue placeholder="Seleccionar serie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin serie específica</SelectItem>
                                {invoiceSeries.map((series) => (
                                    <SelectItem key={series.id} value={series.id}>
                                        {series.name} ({series.prefix || ''})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Lista de Precios */}
                {priceLists.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="price-list">Lista de Precios</Label>
                        <Select
                            value={selectedPriceListId || 'none'}
                            onValueChange={(value) => onPriceListChange(value === 'none' ? null : value)}
                        >
                            <SelectTrigger id="price-list">
                                <SelectValue placeholder="Precio base" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Precio Base</SelectItem>
                                {priceLists.map((list) => (
                                    <SelectItem key={list.id} value={list.id}>
                                        {list.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Bodega */}
                {warehouses.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="warehouse">Bodega</Label>
                        <Select
                            value={selectedWarehouseId || 'none'}
                            onValueChange={(value) => onWarehouseChange(value === 'none' ? null : value)}
                        >
                            <SelectTrigger id="warehouse">
                                <SelectValue placeholder="Bodega Principal" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Bodega Principal</SelectItem>
                                {warehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Fiscal Invoice Toggle */}
                <div className="flex items-center justify-between space-x-2 pt-2 border-t">
                    <div className="space-y-0.5">
                        <Label htmlFor="fiscal-invoice">Factura Fiscal</Label>
                        <p className="text-[10px] text-muted-foreground">Generar documento fiscal</p>
                    </div>
                    <Switch
                        id="fiscal-invoice"
                        checked={generateFiscalInvoice}
                        onCheckedChange={onGenerateFiscalInvoiceChange}
                    />
                </div>
            </CardContent>
        </Card >
    )
}
