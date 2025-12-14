import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Lock, Unlock, Calendar, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { cashService, CashSession, CashSessionSummary } from '@/services/cash.service'
import { useAuth } from '@/stores/auth.store'
import toast from 'react-hot-toast'
import OpenCashModal from '@/components/cash/OpenCashModal'
import CloseCashModal from '@/components/cash/CloseCashModal'
import CashSessionsList from '@/components/cash/CashSessionsList'
import { format } from 'date-fns'

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
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Caja</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Control y seguimiento de sesiones de caja
          </p>
        </div>
      </div>

      {/* Estado actual de la caja */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
            {currentSession ? (
              <>
                <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
                Caja Abierta
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mr-2" />
                Caja Cerrada
              </>
            )}
          </h2>
          {currentSession && (
            <button
              onClick={handleCloseCash}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-red-700 transition-colors touch-manipulation"
            >
              <Lock className="w-4 h-4 mr-2" />
              Cerrar Caja
            </button>
          )}
        </div>

        {!currentSession ? (
          <div className="text-center py-8 sm:py-12">
            <Lock className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-6">No hay sesión de caja abierta</p>
            <button
              onClick={handleOpenCash}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors touch-manipulation"
            >
              <Unlock className="w-5 h-5 mr-2" />
              Abrir Caja
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center mb-2">
                  <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">Apertura</span>
                </div>
                <p className="text-sm text-blue-700">
                  {format(new Date(currentSession.opened_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">Apertura Bs</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  {Number(currentSession.opening_amount_bs).toFixed(2)} Bs
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">Apertura USD</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  ${Number(currentSession.opening_amount_usd).toFixed(2)}
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center mb-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 mr-2" />
                  <span className="text-sm font-medium text-purple-900">Ventas</span>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {sessionSummary?.sales_count || 0}
                </p>
              </div>
            </div>

            {/* Resumen de efectivo esperado */}
            {sessionSummary && (
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6 border border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Resumen de Efectivo
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Efectivo Esperado (Bs)</p>
                    <p className="text-xl font-bold text-gray-900">
                      {Number(sessionSummary.cash_flow.expected_bs).toFixed(2)} Bs
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Apertura: {Number(sessionSummary.cash_flow.opening_bs).toFixed(2)} Bs + Ventas
                      en efectivo: {Number(sessionSummary.cash_flow.sales_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Efectivo Esperado (USD)</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${Number(sessionSummary.cash_flow.expected_usd).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Apertura: ${Number(sessionSummary.cash_flow.opening_usd).toFixed(2)} + Ventas
                      en efectivo: ${Number(sessionSummary.cash_flow.sales_usd).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Totales por método de pago */}
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <p className="text-sm font-medium text-gray-700 mb-2">Ventas por Método de Pago</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-600">Efectivo Bs:</span>{' '}
                      <span className="font-semibold">
                        {Number(sessionSummary.sales.by_method.CASH_BS || 0).toFixed(2)} Bs
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Efectivo USD:</span>{' '}
                      <span className="font-semibold">
                        ${Number(sessionSummary.sales.by_method.CASH_USD || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Pago Móvil:</span>{' '}
                      <span className="font-semibold">
                        {Number(sessionSummary.sales.by_method.PAGO_MOVIL || 0).toFixed(2)} Bs
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Transferencia:</span>{' '}
                      <span className="font-semibold">
                        {Number(sessionSummary.sales.by_method.TRANSFER || 0).toFixed(2)} Bs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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

