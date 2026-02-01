import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarIcon, DollarSign, Loader2, Save } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import toast from '@/lib/toast'
import { debtsService } from '@/services/debts.service'
import { Customer } from '@/services/customers.service'
import { useAuth } from '@/stores/auth.store'

interface LegacyDebtModalProps {
    isOpen: boolean
    onClose: () => void
    customer: Customer | null
}

interface FormValues {
    amount_usd: string
    note: string
    created_at: Date
}

export default function LegacyDebtModal({ isOpen, onClose, customer }: LegacyDebtModalProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const queryClient = useQueryClient()
    const { user } = useAuth()

    const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        defaultValues: {
            amount_usd: '',
            note: 'Deuda antigua (Migración)',
            created_at: new Date(),
        },
    })

    const createMutation = useMutation({
        mutationFn: (values: FormValues) => {
            if (!customer) throw new Error('No customer selected')
            if (!user) throw new Error('Usuario no autenticado')

            return debtsService.createLegacy({
                customer_id: customer.id,
                amount_usd: Number(values.amount_usd),
                note: values.note,
                created_at: values.created_at.toISOString(),
                store_id: user.store_id,
                user_id: user.user_id
            })
        },
        onSuccess: () => {
            toast.success('Deuda antigua registrada correctamente')
            queryClient.invalidateQueries({ queryKey: ['debts'] })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            handleClose()
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message || 'Error al registrar deuda'
            toast.error(msg)
        },
    })

    const handleClose = () => {
        reset()
        onClose()
    }

    const onSubmit = (values: FormValues) => {
        createMutation.mutate(values)
    }

    if (!customer) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Deuda Antigua</DialogTitle>
                    <DialogDescription>
                        Agrega una deuda existente ("fiado viejo") para <strong>{customer.name}</strong>.
                        <br />
                        Esta acción <strong>NO</strong> afecta el inventario ni requiere una venta.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">

                    <div className="space-y-2">
                        <Label htmlFor="amount_usd">Monto (USD)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Controller
                                name="amount_usd"
                                control={control}
                                rules={{
                                    required: 'El monto es requerido',
                                    min: { value: 0.01, message: 'El monto debe ser mayor a 0' },
                                    pattern: { value: /^\d+(\.\d{1,2})?$/, message: 'Formato inválido' }
                                }}
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        id="amount_usd"
                                        className={cn("pl-9 text-lg font-semibold", errors.amount_usd && "border-red-500")}
                                        placeholder="0.00"
                                        autoFocus
                                        type="number"
                                        step="0.01"
                                    />
                                )}
                            />
                        </div>
                        {errors.amount_usd && (
                            <p className="text-sm text-red-500 font-medium">{errors.amount_usd.message}</p>
                        )}
                        <p className="text-sm text-muted-foreground">Monto total de la deuda en dólares.</p>
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <Label>Fecha Original</Label>
                        <Controller
                            name="created_at"
                            control={control}
                            render={({ field }) => (
                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                                format(field.value, "PPP", { locale: es })
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={(date) => {
                                                field.onChange(date)
                                                setIsCalendarOpen(false)
                                            }}
                                            disabled={(date) =>
                                                date > new Date() || date < new Date("1900-01-01")
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                        <p className="text-sm text-muted-foreground">Fecha cuando se originó la deuda.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Nota / Concepto</Label>
                        <Controller
                            name="note"
                            control={control}
                            render={({ field }) => (
                                <Textarea
                                    {...field}
                                    id="note"
                                    placeholder="Ej: Fiado tienda vieja, saldo pendiente cuaderno..."
                                    className="resize-none"
                                />
                            )}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {!createMutation.isPending && (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Registrar Deuda
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
