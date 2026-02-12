import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Warehouse, CreateWarehouseDto, UpdateWarehouseDto } from '@/services/warehouses.service'
import { Store, MapPin, User, Package, FileText, Phone } from 'lucide-react'

// Schema de validación
const warehouseSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido').max(100),
    code: z.string().min(1, 'El código es requerido').max(50),
    type: z.string().optional(),
    status: z.string().optional(),
    description: z.string().optional(),

    // Location
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.string().optional(),

    // Contact / Operations
    manager_name: z.string().optional(),
    contact_phone: z.string().optional(),
    contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
    capacity: z.coerce.number().min(0).optional(),

    // Settings
    is_default: z.boolean().default(false),
    is_active: z.boolean().default(true),
    note: z.string().optional(),
})

type WarehouseFormValues = z.infer<typeof warehouseSchema>

interface WarehouseFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData: Warehouse | null
    onSubmit: (data: CreateWarehouseDto | UpdateWarehouseDto) => void
    isSubmitting?: boolean
    onDelete?: (warehouse: Warehouse) => void
}

export function WarehouseFormModal({
    open,
    onOpenChange,
    initialData,
    onSubmit,
    isSubmitting = false,
    onDelete
}: WarehouseFormModalProps) {
    const form = useForm({
        resolver: zodResolver(warehouseSchema),
        defaultValues: {
            name: '',
            code: '',
            type: 'STORE',
            status: 'OPERATIONAL',
            description: '',
            address: '',
            city: '',
            state: '',
            zip_code: '',
            manager_name: '',
            contact_phone: '',
            contact_email: '',
            capacity: 0,
            is_default: false,
            is_active: true,
            note: '',
        },
    })

    // Reset form when opening/closing or changing initialData
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    code: initialData.code,
                    type: initialData.type || 'STORE',
                    status: initialData.status || 'OPERATIONAL',
                    description: initialData.description || '',
                    address: initialData.address || '',
                    city: initialData.city || '',
                    state: initialData.state || '',
                    zip_code: initialData.zip_code || '',
                    manager_name: initialData.manager_name || '',
                    contact_phone: initialData.contact_phone || '',
                    contact_email: initialData.contact_email || '',
                    capacity: Number(initialData.capacity) || 0,
                    is_default: initialData.is_default,
                    is_active: initialData.is_active,
                    note: initialData.note || '',
                })
            } else {
                form.reset({
                    name: '',
                    code: '',
                    type: 'STORE',
                    status: 'OPERATIONAL',
                    description: '',
                    address: '',
                    city: '',
                    state: '',
                    zip_code: '',
                    manager_name: '',
                    contact_phone: '',
                    contact_email: '',
                    capacity: 0,
                    is_default: false,
                    is_active: true,
                    note: '',
                })
            }
        }
    }, [open, initialData, form])

    const handleSubmit = (values: WarehouseFormValues) => {
        // Cast values to match DTOs since Zod inference might be slightly different 
        // (e.g. optional fields vs empty strings)
        onSubmit(values as unknown as CreateWarehouseDto)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 bg-card">
                <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0 bg-card">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        {initialData ? <Store className="w-5 h-5 text-primary" /> : <Package className="w-5 h-5 text-primary" />}
                        {initialData ? 'Editar Bodega' : 'Nueva Bodega'}
                    </DialogTitle>
                    <DialogDescription>
                        {initialData
                            ? 'Modifica los datos operativos y ubicación de la bodega.'
                            : 'Registra una nueva ubicación de almacenamiento.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <Form {...form}>
                        <form id="warehouse-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 mb-4 h-auto bg-card border border-border/60">
                                    <TabsTrigger value="general" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">General</TabsTrigger>
                                    <TabsTrigger value="location" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Ubicación</TabsTrigger>
                                    <TabsTrigger value="operations" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Operaciones</TabsTrigger>
                                    <TabsTrigger value="notes" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Notas</TabsTrigger>
                                </TabsList>

                                {/* TAB: GENERAL */}
                                <TabsContent value="general" className="space-y-4 focus-visible:outline-none">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nombre *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej. Almacén Central" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="code"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Código *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej. WARE-001" {...field} />
                                                    </FormControl>
                                                    <FormDescription>Identificador único</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tipo de Instalación</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecciona un tipo" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="STORE">Tienda / Sucursal</SelectItem>
                                                            <SelectItem value="MAIN">Almacén Central</SelectItem>
                                                            <SelectItem value="SHOWROOM">Showroom</SelectItem>
                                                            <SelectItem value="TRANSIT">En Tránsito</SelectItem>
                                                            <SelectItem value="DAMAGED">Mermas / Dañados</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Estado Operativo</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Estado actual" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="OPERATIONAL">Operativo</SelectItem>
                                                            <SelectItem value="MAINTENANCE">En Mantenimiento</SelectItem>
                                                            <SelectItem value="CLOSED">Cerrado / Clausurado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-4 p-4 border border-border/60 rounded-lg bg-card">
                                        <FormField
                                            control={form.control}
                                            name="is_default"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                                    <div className="space-y-0.5">
                                                        <FormLabel>Bodega Principal</FormLabel>
                                                        <FormDescription>
                                                            Se usará por defecto en ventas y movimientos.
                                                        </FormDescription>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="is_active"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                                    <div className="space-y-0.5">
                                                        <FormLabel>Activo en Sistema</FormLabel>
                                                        <FormDescription>
                                                            Visible en selectores y reportes.
                                                        </FormDescription>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </TabsContent>

                                {/* TAB: LOCATION */}
                                <TabsContent value="location" className="space-y-4 focus-visible:outline-none">
                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Dirección Física</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                        <Textarea
                                                            placeholder="Calle principal #123, Colonia..."
                                                            className="pl-9 min-h-[80px]"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="city"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Ciudad</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="state"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Estado / Región</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="zip_code"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Código Postal</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </TabsContent>

                                {/* TAB: OPERATIONS */}
                                <TabsContent value="operations" className="space-y-4 focus-visible:outline-none">
                                    <div className="grid grid-cols-1 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="manager_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Encargado / Gerente</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input className="pl-9" placeholder="Nombre del responsable" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="contact_phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Teléfono de Contacto</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input className="pl-9" placeholder="+58 412..." {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="contact_email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email de Contacto</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="bodega@empresa.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="pt-4 border-t">
                                        <FormField
                                            control={form.control}
                                            name="capacity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Capacidad de Almacenamiento (m² o unidades)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            {...field}
                                                            value={String(field.value)}
                                                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>Usar 0 para sin límite</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </TabsContent>

                                {/* TAB: NOTES */}
                                <TabsContent value="notes" className="space-y-4 focus-visible:outline-none">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Descripción Pública</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                        <Textarea
                                                            className="pl-9"
                                                            placeholder="Descripción visible para el equipo"
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="note"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Notas Internas</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Información confidencial o técnica"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TabsContent>
                            </Tabs>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0 bg-card">
                    <div className="flex flex-col-reverse sm:flex-row w-full gap-2 sm:gap-0 sm:justify-between sm:items-center">
                        {/* Botón Eliminar - Izquierda en desktop, abajo en mobile */}
                        <div className="flex justify-center sm:justify-start">
                            {initialData && onDelete && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onDelete(initialData)}
                                    className="w-full sm:w-auto"
                                >
                                    Eliminar Bodega
                                </Button>
                            )}
                        </div>

                        {/* Botones Cancelar/Guardar - Derecha en desktop, arriba en mobile */}
                        <div className="flex gap-2 w-full sm:w-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    className="flex-1 sm:flex-none btn-glass-neutral"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    variant="outline"
                                    form="warehouse-form"
                                    disabled={isSubmitting}
                                    className="flex-1 sm:flex-none btn-glass-neutral"
                                >
                                    {isSubmitting ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear')}
                                </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
