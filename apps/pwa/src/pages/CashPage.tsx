import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Lock, Unlock, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cashService, CashSession, CashSessionSummary } from '@/services/cash.service'
import { useAuth } from '@/stores/auth.store'
import toast from 'react-hot-toast'
import OpenCashModal from '@/components/cash/OpenCashModal'
import CloseCashModal from '@/components/cash/CloseCashModal'
import CashSessionsList from '@/components/cash/CashSessionsList'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export default function CashPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Obtener sesión actual
  const {
    data: currentSession,
    isLoading: isLoadingCurrent,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ['cash', 'current-session'],
    queryFn: () => cashService.getCurrentSession(),
    refetchInterval: 30000, // Refrescar cada 30 segundos
  })

  // Obtener resumen si hay sesión abierta
  const {
    data: sessionSummary,
    isLoading: isLoadingSummary,
  } = useQuery<CashSessionSummary>({
    queryKey: ['cash', 'session-summary', currentSession?.id],
    queryFn: () => cashService.getSessionSummary(currentSession!.id),
    enabled: !!currentSession?.id,
    refetchInterval: 30000,
  })

  // Mutación para abrir caja
  const openMutation = useMutation({
    mutationFn: cashService.openSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] })
      toast.success('Caja abierta correctamente')
      setIsOpenModalOpen(false)
      refetchCurrent()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al abrir la caja')
    },
  })

  // Mutación para cerrar caja
  const closeMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: any }) =>
      cashService.closeSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] })
      toast.success('Caja cerrada correctamente')
      setIsCloseModalOpen(false)
      setSelectedSessionId(null)
      refetchCurrent()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cerrar la caja')
    },
  })

  const handleOpenCash = () => {
    setIsOpenModalOpen(true)
  }

  const handleCloseCash = () => {
    if (!currentSession) return
    setSelectedSessionId(currentSession.id)
    setIsCloseModalOpen(true)
  }

  if (isLoadingCurrent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Caja</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Control y seguimiento de sesiones de caja
          </p>
        </div>
      </div>

      {/* Estado actual de la caja */}
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg sm:text-xl font-semibold flex items-center">
            {currentSession ? (
              <>
                <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
                Caja Abierta
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground mr-2" />
                Caja Cerrada
              </>
            )}
          </CardTitle>
          {currentSession && (
            <Button
              variant="destructive"
              onClick={handleCloseCash}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Lock className="w-4 h-4 mr-2" />
              Cerrar Caja
            </Button>
          )}
        </CardHeader>
        <CardContent>
        {!currentSession ? (
          <div className="text-center py-8 sm:py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-6">No hay sesión de caja abierta</p>
              <Button onClick={handleOpenCash} size="lg">
              <Unlock className="w-5 h-5 mr-2" />
              Abrir Caja
              </Button>
          </div>
        ) : (
          <div className="space-y-4">
              {/* Alert de estado */}
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">Sesión Activa</AlertTitle>
                <AlertDescription className="text-green-700">
                  La caja está abierta desde el {format(new Date(currentSession.opened_at), 'dd/MM/yyyy HH:mm')}
                </AlertDescription>
              </Alert>

            {/* Información básica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">Apertura</span>
                </div>
                <p className="text-sm text-blue-700">
                  {format(new Date(currentSession.opened_at), 'dd/MM/yyyy HH:mm')}
                </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">Apertura Bs</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  {Number(currentSession.opening_amount_bs).toFixed(2)} Bs
                </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">Apertura USD</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  ${Number(currentSession.opening_amount_usd).toFixed(2)}
                </p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 mr-2" />
                  <span className="text-sm font-medium text-purple-900">Ventas</span>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {sessionSummary?.sales_count || 0}
                </p>
                  </CardContent>
                </Card>
            </div>

            {/* Resumen de efectivo esperado */}
              {isLoadingSummary ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : sessionSummary ? (
                <Card className="bg-muted/50 border-border">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Resumen de Efectivo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                        <p className="text-sm text-muted-foreground mb-2">Efectivo Esperado (Bs)</p>
                        <p className="text-xl font-bold text-foreground">
                      {Number(sessionSummary.cash_flow.expected_bs).toFixed(2)} Bs
                    </p>
                        <p className="text-xs text-muted-foreground mt-1">
                      Apertura: {Number(sessionSummary.cash_flow.opening_bs).toFixed(2)} Bs + Ventas
                      en efectivo: {Number(sessionSummary.cash_flow.sales_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div>
                        <p className="text-sm text-muted-foreground mb-2">Efectivo Esperado (USD)</p>
                        <p className="text-xl font-bold text-foreground">
                      ${Number(sessionSummary.cash_flow.expected_usd).toFixed(2)}
                    </p>
                        <p className="text-xs text-muted-foreground mt-1">
                      Apertura: ${Number(sessionSummary.cash_flow.opening_usd).toFixed(2)} + Ventas
                      en efectivo: ${Number(sessionSummary.cash_flow.sales_usd).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Totales por método de pago */}
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm font-medium text-foreground mb-3">Ventas por Método de Pago</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1">Efectivo Bs:</span>
                          <Badge variant="secondary" className="w-fit">
                        {Number(sessionSummary.sales.by_method.CASH_BS || 0).toFixed(2)} Bs
                          </Badge>
                    </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1">Efectivo USD:</span>
                          <Badge variant="secondary" className="w-fit">
                        ${Number(sessionSummary.sales.by_method.CASH_USD || 0).toFixed(2)}
                          </Badge>
                    </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1">Pago Móvil:</span>
                          <Badge variant="secondary" className="w-fit">
                        {Number(sessionSummary.sales.by_method.PAGO_MOVIL || 0).toFixed(2)} Bs
                          </Badge>
                    </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1">Transferencia:</span>
                          <Badge variant="secondary" className="w-fit">
                        {Number(sessionSummary.sales.by_method.TRANSFER || 0).toFixed(2)} Bs
                          </Badge>
                    </div>
                  </div>
                </div>
                  </CardContent>
                </Card>
              ) : null}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Historial de sesiones (solo si la caja está cerrada o hay historial) */}
      <CashSessionsList />

      {/* Modales */}
      <OpenCashModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onConfirm={(data) => openMutation.mutate(data)}
        isLoading={openMutation.isPending}
      />

      {selectedSessionId && (
        <CloseCashModal
          isOpen={isCloseModalOpen}
          onClose={() => {
            setIsCloseModalOpen(false)
            setSelectedSessionId(null)
          }}
          session={currentSession!}
          sessionSummary={sessionSummary!}
          onConfirm={(data) =>
            closeMutation.mutate({
              sessionId: selectedSessionId,
              data,
            })
          }
          isLoading={closeMutation.isPending}
        />
      )}
    </div>
  )
}
