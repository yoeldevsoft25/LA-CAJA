import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { budgetService } from '@/services/accounting.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'

interface BudgetFormModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

interface BudgetFormData {
    name: string
    description?: string
    period_start: string
    period_end: string
}

export default function BudgetFormModal({ isOpen, onClose, onSuccess }: BudgetFormModalProps) {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const storeId = user?.store_id

    const { register, handleSubmit, reset, formState: { errors } } = useForm<BudgetFormData>()

    const createMutation = useMutation({
        mutationFn: (data: BudgetFormData) => {
            if (!storeId) throw new Error('No store selected')
            return budgetService.create({
                store_id: storeId,
                ...data,
            })
        },
        onSuccess: () => {
            toast.success('Presupuesto creado exitosamente')
            queryClient.invalidateQueries({ queryKey: ['accounting', 'budgets'] })
            onSuccess()
            onClose()
            reset()
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Error al crear el presupuesto')
        },
    })

    const onSubmit = (data: BudgetFormData) => {
        createMutation.mutate(data)
    }

    // Set default dates (Current Month)
    useEffect(() => {
        if (isOpen) {
            const date = new Date();
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            reset({
                period_start: firstDay,
                period_end: lastDay
            })
        }
    }, [isOpen, reset])

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nuevo Presupuesto</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre del Presupuesto</Label>
                        <Input
                            id="name"
                            placeholder="Ej. Presupuesto 2024"
                            {...register('name', { required: 'El nombre es requerido' })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="period_start">Fecha Inicio</Label>
                            <Input
                                id="period_start"
                                type="date"
                                {...register('period_start', { required: 'Requerido' })}
                            />
                            {errors.period_start && <p className="text-sm text-red-500">{errors.period_start.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="period_end">Fecha Fin</Label>
                            <Input
                                id="period_end"
                                type="date"
                                {...register('period_end', { required: 'Requerido' })}
                            />
                            {errors.period_end && <p className="text-sm text-red-500">{errors.period_end.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción (Opcional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Notas adicionales..."
                            {...register('description')}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creando...' : 'Crear Presupuesto'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
