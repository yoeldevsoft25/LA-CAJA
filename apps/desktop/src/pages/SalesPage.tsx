import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText, Eye, Calendar, DollarSign, Store, AlertCircle } from 'lucide-react'
import { salesService, Sale } from '@/services/sales.service'
import { authService } from '@/services/auth.service'
import { useAuth } from '@/stores/auth.store'
import SaleDetailModal from '@/components/sales/SaleDetailModal'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
  SPLIT: 'Mixto',
  FIAO: 'Fiado',
}

const currencyLabels: Record<string, string> = {
  BS: 'Bs',
  USD: 'USD',
  MIXED: 'Mixto',
}

export default function SalesPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  // Obtener lista de tiendas (solo para owners)
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => authService.getStores(),
    enabled: isOwner,
  })

  // Calcular fechas por defecto (hoy)
  const getDefaultDateFrom = () => {
    return new Date().toISOString().split('T')[0]
  }

  const getDefaultDateTo = () => {
    return new Date().toISOString().split('T')[0]
  }

  const effectiveDateFrom = dateFrom || getDefaultDateFrom()
  const effectiveDateTo = dateTo || getDefaultDateTo()

  // Determinar store_id a usar
  const effectiveStoreId = selectedStoreId || user?.store_id || ''

  // Obtener ventas
  const { data: salesData, isLoading, error: salesError } = useQuery({
    queryKey: ['sales', 'list', effectiveDateFrom, effectiveDateTo, effectiveStoreId, currentPage],
    queryFn: () =>
      salesService.list({
        date_from: effectiveDateFrom,
        date_to: effectiveDateTo,
        store_id: effectiveStoreId !== user?.store_id ? effectiveStoreId : undefined,
        limit,
        offset: (currentPage - 1) * limit,
      }),
  })

  // Manejar errores manualmente
  if (salesError && (salesError as any).response?.status === 401) {
    toast.error('No tienes permisos para ver ventas de otras tiendas')
  }

  const sales = (salesData as any)?.sales || []
  const total = (salesData as any)?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Calcular totales
  const totalSalesBs = sales.reduce(
    (sum, sale) => sum + Number(sale.totals.total_bs),
    0
  )
  const totalSalesUsd = sales.reduce(
    (sum, sale) => sum + Number(sale.totals.total_usd),
    0
  )

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailModalOpen(true)
  }

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false)
    setSelectedSale(null)
  }

  const handleResetDates = () => {
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Historial de Ventas</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {total} venta{total !== 1 ? 's' : ''} en el período seleccionado
            </p>
          </div>
          {total > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-right">
              <div>
                <p className="text-xs text-gray-500">Total en Bs</p>
                <p className="text-lg font-bold text-gray-900">
                  {totalSalesBs.toFixed(2)} Bs
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total en USD</p>
                <p className="text-lg font-bold text-gray-900">
                  ${totalSalesUsd.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="space-y-3 sm:space-y-4">
          {/* Selector de tienda (solo para owners) */}
          {isOwner && stores && stores.length > 1 && (
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                <Store className="inline w-4 h-4 mr-1" />
                Filtrar por Tienda
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas las tiendas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mensaje para cashiers si intentan filtrar por otra tienda */}
          {!isOwner && selectedStoreId && selectedStoreId !== user?.store_id && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  No tienes permisos
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Solo los administradores pueden ver ventas de otras tiendas
                </p>
              </div>
            </div>
          )}

          {/* Filtros de fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
              Desde
            </label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-8 pr-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
              Hasta
            </label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-8 pr-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleResetDates}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-colors touch-manipulation"
            >
              Reiniciar
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Lista de ventas */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
            <p>Cargando ventas...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">No hay ventas</p>
            <p className="text-sm">No se encontraron ventas en el período seleccionado</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Fecha/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                      Productos
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                      Moneda
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                      Método de Pago
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                      Responsable
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => {
                    const itemCount = sale.items.length
                    const totalItems = sale.items.reduce((sum, item) => sum + item.qty, 0)
                    
                    // Determinar estado de deuda para FIAO
                    const isFIAO = sale.payment.method === 'FIAO'
                    const debtStatus = sale.debt?.status || null
                    const isPending = isFIAO && (debtStatus === 'open' || debtStatus === 'partial')
                    const isPaid = isFIAO && debtStatus === 'paid'
                    
                    // Clases de color para la fila según estado de deuda
                    let rowBgClass = 'hover:bg-gray-50'
                    if (isPending) {
                      rowBgClass = 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500'
                    } else if (isPaid) {
                      rowBgClass = 'bg-green-50 hover:bg-green-100 border-l-4 border-green-500'
                    }

                    return (
                      <tr
                        key={sale.id}
                        className={`transition-colors ${rowBgClass}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm sm:text-base">
                            <p className="font-semibold text-gray-900">
                              {format(new Date(sale.sold_at), 'dd/MM/yyyy')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(sale.sold_at), 'HH:mm')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">
                              {itemCount} producto{itemCount !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-500">
                              {totalItems} unidad{totalItems !== 1 ? 'es' : ''} total
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-sm sm:text-base">
                            <p className="font-bold text-gray-900">
                              {Number(sale.totals.total_bs).toFixed(2)} Bs
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600">
                              ${Number(sale.totals.total_usd).toFixed(2)} USD
                            </p>
                            {isFIAO && sale.debt && isPending && sale.debt.remaining_bs !== undefined && (
                              <p className="text-xs font-medium text-orange-600 mt-1">
                                Pendiente: {Number(sale.debt.remaining_bs).toFixed(2)} Bs / ${Number(sale.debt.remaining_usd || 0).toFixed(2)} USD
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {currencyLabels[sale.currency] || sale.currency}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs sm:text-sm text-gray-700">
                              {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                            </span>
                            {isFIAO && sale.debt && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  debtStatus === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : debtStatus === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {debtStatus === 'paid'
                                  ? 'Pagado'
                                  : debtStatus === 'partial'
                                  ? 'Parcial'
                                  : 'Pendiente'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-sm">
                            {sale.sold_by_user ? (
                              <>
                                <p className="font-medium text-gray-900">
                                  {sale.sold_by_user.full_name || 'Sin nombre'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {sale.sold_by_user_id?.substring(0, 8)}...
                                </p>
                              </>
                            ) : (
                              <p className="text-gray-400 text-xs">N/A</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="text-sm">
                            {sale.customer ? (
                              <>
                                <p className="font-medium text-gray-900">{sale.customer.name}</p>
                                {sale.customer.document_id && (
                                  <p className="text-xs text-gray-500">
                                    CI: {sale.customer.document_id}
                                  </p>
                                )}
                              </>
                            ) : sale.payment.method === 'FIAO' ? (
                              <p className="text-orange-600 text-xs font-medium">Fiado</p>
                            ) : (
                              <p className="text-gray-400 text-xs">-</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleViewDetail(sale)}
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
              <div className="border-t border-gray-200 px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Mostrando{' '}
                    <span className="font-medium">
                      {(currentPage - 1) * limit + 1}
                    </span>{' '}
                    a{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * limit, total)}
                    </span>{' '}
                    de <span className="font-medium">{total}</span> ventas
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de detalle */}
      <SaleDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        sale={selectedSale}
      />
    </div>
  )
}

