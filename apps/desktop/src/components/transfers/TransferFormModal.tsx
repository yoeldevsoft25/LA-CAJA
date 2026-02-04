import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Warehouse } from '@/services/warehouses.service'
import { productsService, Product } from '@/services/products.service'
import { CreateTransferDto } from '@/services/transfers.service'
import { ArrowRight, Package, Check, X, Search, AlertCircle, MapPin, Calendar } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

// Schemas
const routeBaseSchema = z.object({
    from_warehouse_id: z.string().min(1, 'Selecciona origen'),
    to_warehouse_id: z.string().min(1, 'Selecciona destino'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
})

const itemBaseSchema = z.object({
    items: z.array(z.object({
        product_id: z.string(),
        variant_id: z.string().optional().nullable(),
        quantity: z.number().min(1),
        product_name: z.string(), // Helper for display
        current_stock: z.number().optional(), // Helper for validation
    })).min(1, 'Agrega al menos un producto')
})

const logisticsBaseSchema = z.object({
    expected_arrival: z.string().optional(),
    note: z.string().optional(),
})

// Final schema with refinement
const finalSchema = routeBaseSchema
    .merge(itemBaseSchema)
    .merge(logisticsBaseSchema)
    .refine(data => data.from_warehouse_id !== data.to_warehouse_id, {
        message: "El destino no puede ser igual al origen",
        path: ["to_warehouse_id"]
    })

type FormValues = z.infer<typeof finalSchema>

interface TransferFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    warehouses: Warehouse[]
    onSubmit: (data: CreateTransferDto) => void
    isSubmitting?: boolean
}

export function TransferFormModal({
    open,
    onOpenChange,
    warehouses,
    onSubmit,
    isSubmitting = false
}: TransferFormModalProps) {
    const [step, setStep] = useState(1)
    const [productSearch, setProductSearch] = useState('')

    const form = useForm<FormValues>({
        resolver: zodResolver(finalSchema) as any,
        defaultValues: {
            from_warehouse_id: '',
            to_warehouse_id: '',
            priority: 'normal',
            items: [],
            note: '',
        },
        mode: 'onChange'
    })

    // Watchers
    const items = form.watch('items')
    const fromWarehouseId = form.watch('from_warehouse_id')

    // Product Search Query
    const { data: productsData } = useQuery({
        queryKey: ['products', 'search', productSearch],
        queryFn: () => productsService.search({ q: productSearch, limit: 10 }),
        enabled: productSearch.length >= 2,
    })

    useEffect(() => {
        if (!open) {
            form.reset()
            setStep(1)
            setProductSearch('')
        }
    }, [open, form])

    const nextStep = async () => {
        let valid = false
        if (step === 1) {
            valid = await form.trigger(['from_warehouse_id', 'to_warehouse_id'])
        } else if (step === 2) {
            valid = await form.trigger('items')
        }

        if (valid) setStep(s => s + 1)
    }

    const prevStep = () => setStep(s => s - 1)

    const addItem = (product: Product) => {
        const currentItems = form.getValues('items')
        const existing = currentItems.findIndex(i => i.product_id === product.id)

        if (existing >= 0) {
            const updated = [...currentItems]
            updated[existing].quantity += 1
            form.setValue('items', updated)
        } else {
            form.setValue('items', [...currentItems, {
                product_id: product.id,
                quantity: 1,
                product_name: product.name,
            }])
        }
        setProductSearch('')
    }

    const removeItem = (index: number) => {
        const currentItems = form.getValues('items')
        form.setValue('items', currentItems.filter((_, i) => i !== index))
    }

    const handleFinalSubmit = (values: FormValues) => {
        onSubmit({
            from_warehouse_id: values.from_warehouse_id,
            to_warehouse_id: values.to_warehouse_id,
            items: values.items.map(i => ({
                product_id: i.product_id,
                quantity: i.quantity
            })),
            priority: values.priority,
            expected_arrival: values.expected_arrival,
            note: values.note
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b bg-muted/20 pr-12">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <DialogTitle className="text-base sm:text-lg">Nueva Transferencia de Inventario</DialogTitle>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-background px-2.5 sm:px-3 py-1 rounded-full border w-fit">
                            <span className={cn("font-medium whitespace-nowrap", step >= 1 ? "text-primary" : "")}>1. Ruta</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                            <span className={cn("font-medium whitespace-nowrap", step >= 2 ? "text-primary" : "")}>2. Items</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                            <span className={cn("font-medium whitespace-nowrap", step >= 3 ? "text-primary" : "")}>3. Detalles</span>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFinalSubmit)} className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            {step === 1 && (
                                <div className="space-y-6 max-w-2xl mx-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-start">
                                        <FormField
                                            control={form.control}
                                            name="from_warehouse_id"
                                            render={({ field }) => (
                                                <FormItem className="space-y-4">
                                                    <div className="p-4 border rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-center space-y-2">
                                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                                            <Package className="w-6 h-6" />
                                                        </div>
                                                        <h3 className="font-semibold">Origen</h3>
                                                        <p className="text-xs text-muted-foreground">¿De dónde salen los productos?</p>
                                                    </div>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-12">
                                                                <SelectValue placeholder="Seleccionar bodega" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {warehouses.filter(w => w.is_active).map(w => (
                                                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Flecha - Horizontal en mobile, vertical en desktop */}
                                        <div className="flex sm:hidden justify-center py-2">
                                            <div className="p-2 bg-muted rounded-full rotate-90">
                                                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex justify-center pt-24">
                                            <div className="p-2 bg-muted rounded-full">
                                                <ArrowRight className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="to_warehouse_id"
                                            render={({ field }) => (
                                                <FormItem className="space-y-4">
                                                    <div className="p-4 border rounded-xl bg-green-50/50 dark:bg-green-950/20 text-center space-y-2">
                                                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto text-green-600">
                                                            <MapPin className="w-6 h-6" />
                                                        </div>
                                                        <h3 className="font-semibold">Destino</h3>
                                                        <p className="text-xs text-muted-foreground">¿A dónde llegan los productos?</p>
                                                    </div>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-12">
                                                                <SelectValue placeholder="Seleccionar bodega" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {warehouses.filter(w => w.is_active && w.id !== fromWarehouseId).map(w => (
                                                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="priority"
                                        render={({ field }) => (
                                            <FormItem className="pt-6">
                                                <FormLabel>Prioridad del Envío</FormLabel>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {['low', 'normal', 'high', 'urgent'].map((p) => (
                                                        <div
                                                            key={p}
                                                            onClick={() => field.onChange(p)}
                                                            className={cn(
                                                                "cursor-pointer border rounded-lg p-3 text-center transition-all hover:bg-accent",
                                                                field.value === p ? "ring-2 ring-primary border-primary bg-accent" : ""
                                                            )}
                                                        >
                                                            <div className="capitalize font-medium text-xs sm:text-sm">
                                                                {p === 'low' ? 'Baja' : p === 'normal' ? 'Normal' : p === 'high' ? 'Alta' : 'Urgente'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar productos para agregar..."
                                                className="pl-9 h-10"
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                                autoFocus
                                            />
                                            {productSearch.length >= 2 && productsData?.products && (
                                                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
                                                    {productsData.products.length === 0 ? (
                                                        <div className="p-4 text-sm text-center text-muted-foreground">No se encontraron productos</div>
                                                    ) : (
                                                        productsData.products.map(product => (
                                                            <div
                                                                key={product.id}
                                                                onClick={() => addItem(product)}
                                                                className="p-3 hover:bg-accent cursor-pointer border-b last:border-0 flex justify-between items-center"
                                                            >
                                                                <div>
                                                                    <div className="font-medium">{product.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{product.sku}</div>
                                                                </div>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full">
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        {/* Header - Solo visible en desktop */}
                                        <div className="hidden sm:grid bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground grid-cols-12 gap-4">
                                            <div className="col-span-6">PRODUCTO</div>
                                            <div className="col-span-4 text-center">CANTIDAD</div>
                                            <div className="col-span-2 text-right">ACCIONES</div>
                                        </div>
                                        <div className="divide-y max-h-[400px] overflow-y-auto">
                                            {items.length === 0 ? (
                                                <div className="p-8 text-center text-muted-foreground">
                                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p className="text-sm">No hay items agregados a la transferencia</p>
                                                </div>
                                            ) : items.map((item, index) => (
                                                <div key={item.product_id} className="p-3 sm:p-4 hover:bg-muted/10 transition-colors">
                                                    {/* Mobile Layout - Vertical */}
                                                    <div className="flex sm:hidden flex-col gap-3">
                                                        <div className="flex items-start justify-between">
                                                            <p className="font-medium text-sm flex-1">{item.product_name}</p>
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 -mt-1" onClick={() => removeItem(index)}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground font-medium">Cantidad:</span>
                                                            <div className="flex items-center border rounded-md shadow-sm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newItems = [...items];
                                                                        if (newItems[index].quantity > 1) {
                                                                            newItems[index].quantity -= 1;
                                                                            form.setValue('items', newItems);
                                                                        }
                                                                    }}
                                                                    className="px-3 py-1.5 hover:bg-accent border-r text-sm"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value) || 0;
                                                                        const newItems = [...items];
                                                                        newItems[index].quantity = val;
                                                                        form.setValue('items', newItems);
                                                                    }}
                                                                    className="w-16 text-center text-sm border-none focus:ring-0 appearance-none bg-transparent"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newItems = [...items];
                                                                        newItems[index].quantity += 1;
                                                                        form.setValue('items', newItems);
                                                                    }}
                                                                    className="px-3 py-1.5 hover:bg-accent border-l text-sm"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Desktop Layout - Horizontal */}
                                                    <div className="hidden sm:grid grid-cols-12 gap-4 items-center">
                                                        <div className="col-span-6">
                                                            <p className="font-medium text-sm">{item.product_name}</p>
                                                        </div>
                                                        <div className="col-span-4 flex justify-center">
                                                            <div className="flex items-center border rounded-md shadow-sm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newItems = [...items];
                                                                        if (newItems[index].quantity > 1) {
                                                                            newItems[index].quantity -= 1;
                                                                            form.setValue('items', newItems);
                                                                        }
                                                                    }}
                                                                    className="px-3 py-1 hover:bg-accent border-r"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value) || 0;
                                                                        const newItems = [...items];
                                                                        newItems[index].quantity = val;
                                                                        form.setValue('items', newItems);
                                                                    }}
                                                                    className="w-16 text-center text-sm border-none focus:ring-0 appearance-none bg-transparent"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newItems = [...items];
                                                                        newItems[index].quantity += 1;
                                                                        form.setValue('items', newItems);
                                                                    }}
                                                                    className="px-3 py-1 hover:bg-accent border-l"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 text-right">
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {items.length > 0 && (
                                        <div className="flex justify-end text-sm text-muted-foreground">
                                            Total items: {items.reduce((acc, curr) => acc + curr.quantity, 0)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 max-w-2xl mx-auto">
                                    <FormField
                                        control={form.control}
                                        name="expected_arrival"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Fecha Esperada de Llegada</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input type="datetime-local" className="pl-9" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormDescription>
                                                    Estimado de cuándo llegará la mercancía al destino.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="note"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Notas Generales</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Instrucciones especiales para el transportista o bodega..."
                                                        className="min-h-[120px]"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg flex gap-3 text-amber-800 dark:text-amber-200 text-sm">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p>
                                            Al confirmar, la transferencia se creará en estado <strong>Pendiente</strong>.
                                            El stock no se descontará del origen hasta que marques la transferencia como <strong>Enviada</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/20">
                            <div className="flex flex-col-reverse sm:flex-row w-full gap-2 sm:gap-0 sm:justify-between sm:items-center">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => step === 1 ? onOpenChange(false) : prevStep()}
                                    className="w-full sm:w-auto"
                                >
                                    {step === 1 ? 'Cancelar' : 'Atrás'}
                                </Button>

                                <div className="flex gap-2 w-full sm:w-auto">
                                    {step < 3 ? (
                                        <Button type="button" onClick={nextStep} className="flex-1 sm:flex-none">
                                            Siguiente
                                            <ArrowRight className="ml-2 w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
                                            {isSubmitting ? 'Creando...' : 'Confirmar'}
                                            <Check className="ml-2 w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
