import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, DollarSign } from 'lucide-react'
import { paymentsService, CreateCashMovementRequest } from '@/services/payments.service'
import toast from '@/lib/toast'
import PaymentMethodsList from '@/components/payments/PaymentMethodsList'
import CashMovementsList from '@/components/payments/CashMovementsList'
import CashMovementsSummary from '@/components/payments/CashMovementsSummary'
import CashMovementModal from '@/components/payments/CashMovementModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)

  const createMovementMutation = useMutation({
    mutationFn: (data: CreateCashMovementRequest) => paymentsService.createCashMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'movements'] })
      toast.success('Movimiento registrado correctamente')
      setIsMovementModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al registrar el movimiento')
    },
  })

  return (
    <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Configuración de Pagos
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona métodos de pago, topes y movimientos de efectivo
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="methods" className="space-y-4">
        <TabsList className="h-11 p-1 rounded-xl bg-card border border-border/70">
          <TabsTrigger value="methods" className="flex items-center">
            <CreditCard className="w-4 h-4 mr-2" />
            Métodos de Pago
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center">
            <DollarSign className="w-4 h-4 mr-2" />
            Movimientos de Efectivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="space-y-4">
          <PaymentMethodsList />
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsMovementModalOpen(true)} variant="outline" className="btn-glass-neutral">
              <DollarSign className="w-4 h-4 mr-2" />
              Registrar Movimiento
            </Button>
          </div>
          <CashMovementsSummary />
          <CashMovementsList />
        </TabsContent>
      </Tabs>

      {/* Modal de movimiento */}
      <CashMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onConfirm={(data) => createMovementMutation.mutate(data)}
        isLoading={createMovementMutation.isPending}
      />
    </div>
  )
}

