import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, DollarSign, Lock, Unlock, Eye } from 'lucide-react'
import { cashService, CashSession, CashSessionSummary } from '@/services/cash.service'
import { format } from 'date-fns'
import CashSessionDetailModal from './CashSessionDetailModal'

export default function CashSessionsList() {
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['cash', 'sessions', currentPage],
    queryFn: () => cashService.listSessions({ limit, offset: (currentPage - 1) * limit }),
  })

  const handleViewDetail = (session: CashSession) => {
    setSelectedSession(session)
    setIsDetailModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Cargando historial...</p>
      </div>
    )
  }

  const sessions = sessionsData?.sessions || []
  const totalPages = sessionsData ? Math.ceil(sessionsData.total / limit) : 0

  if (sessions.length === 0) {
    return null // No mostrar si no hay sesiones
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Historial de Sesiones</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                  Apertura
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                  Cierre
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => {
                const isOpen = session.closed_at === null

                return (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {format(new Date(session.opened_at), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(session.opened_at), 'HH:mm')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {isOpen ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Unlock className="w-3 h-3 mr-1" />
                          Abierta
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Lock className="w-3 h-3 mr-1" />
                          Cerrada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-sm">
                        <p className="text-gray-900">
                          {Number(session.opening_amount_bs).toFixed(2)} Bs
                        </p>
                        <p className="text-xs text-gray-500">
                          ${Number(session.opening_amount_usd).toFixed(2)} USD
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {session.closed_at ? (
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {format(new Date(session.closed_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          {session.counted && (
                            <p className="text-xs text-gray-500">
                              {Number(session.counted.cash_bs).toFixed(2)} Bs / $
                              {Number(session.counted.cash_usd).toFixed(2)} USD
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">-</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleViewDetail(session)}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedSession && (
        <CashSessionDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false)
            setSelectedSession(null)
          }}
          session={selectedSession}
        />
      )}
    </>
  )
}

