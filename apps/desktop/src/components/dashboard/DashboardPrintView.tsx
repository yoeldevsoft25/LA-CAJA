import { forwardRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { KPIs, Trends } from '@/services/dashboard.service'
import { formatQuantity } from '@/lib/weight'

interface DashboardPrintViewProps {
  kpis: KPIs
  trends: Trends
  dateRange?: { start?: string; end?: string }
  storeName?: string
}

const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
  if (currency === 'USD') {
    return `$${Number(amount).toFixed(2)}`
  }
  return `Bs. ${Number(amount).toFixed(2)}`
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('es-VE').format(num)
}

const DashboardPrintView = forwardRef<HTMLDivElement, DashboardPrintViewProps>(
  ({ kpis, trends, dateRange, storeName = 'Velox POS' }, ref) => {
    const now = new Date()
    const reportDate = format(now, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })

    return (
      <div
        ref={ref}
        className="hidden print:block bg-white text-black p-8 max-w-4xl mx-auto"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{storeName}</h1>
              <p className="text-sm text-gray-600">Reporte del Dashboard Ejecutivo</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Generado:</p>
              <p>{reportDate}</p>
              {dateRange?.start && (
                <p className="mt-1">
                  Período: {dateRange.start} - {dateRange.end || 'Hoy'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* KPIs de Ventas */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">
            📊 Resumen de Ventas
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded p-3">
              <p className="text-xs text-gray-500 uppercase">Ventas Hoy</p>
              <p className="text-xl font-bold">{formatNumber(kpis.sales.today_count)}</p>
              <p className="text-sm">{formatCurrency(kpis.sales.today_amount_bs, 'BS')}</p>
              <p className="text-xs text-gray-500">{formatCurrency(kpis.sales.today_amount_usd, 'USD')}</p>
            </div>
            <div className="border border-gray-200 rounded p-3">
              <p className="text-xs text-gray-500 uppercase">Ventas del Período</p>
              <p className="text-xl font-bold">{formatNumber(kpis.sales.period_count)}</p>
              <p className="text-sm">{formatCurrency(kpis.sales.period_amount_bs, 'BS')}</p>
              <p className="text-xs text-gray-500">{formatCurrency(kpis.sales.period_amount_usd, 'USD')}</p>
            </div>
            <div className="border border-gray-200 rounded p-3">
              <p className="text-xs text-gray-500 uppercase">Crecimiento</p>
              <p className={`text-xl font-bold ${kpis.sales.growth_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.sales.growth_percentage >= 0 ? '+' : ''}{kpis.sales.growth_percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">vs período anterior</p>
            </div>
            <div className="border border-gray-200 rounded p-3">
              <p className="text-xs text-gray-500 uppercase">Ticket Promedio</p>
              <p className="text-xl font-bold">{formatCurrency(kpis.performance.avg_sale_amount_bs, 'BS')}</p>
              <p className="text-xs text-gray-500">{formatCurrency(kpis.performance.avg_sale_amount_usd, 'USD')}</p>
            </div>
          </div>
        </section>

        {/* Inventario y Finanzas */}
        <section className="mb-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Inventario */}
            <div>
              <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">
                📦 Inventario
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-1">Total Productos</td>
                    <td className="py-1 text-right font-semibold">{formatNumber(kpis.inventory.total_products)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1">Stock Bajo</td>
                    <td className="py-1 text-right font-semibold text-red-600">{formatNumber(kpis.inventory.low_stock_count)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1">Por Vencer</td>
                    <td className="py-1 text-right font-semibold text-orange-600">{formatNumber(kpis.inventory.expiring_soon_count)}</td>
                  </tr>
                  <tr>
                    <td className="py-1">Valor Total</td>
                    <td className="py-1 text-right font-semibold">{formatCurrency(kpis.inventory.total_stock_value_bs, 'BS')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Finanzas */}
            <div>
              <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">
                💰 Finanzas
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-1">Deuda Total</td>
                    <td className="py-1 text-right font-semibold text-red-600">{formatCurrency(kpis.finances.total_debt_bs, 'BS')}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1">Cobrado</td>
                    <td className="py-1 text-right font-semibold text-green-600">{formatCurrency(kpis.finances.total_collected_bs, 'BS')}</td>
                  </tr>
                  <tr>
                    <td className="py-1">Pendiente</td>
                    <td className="py-1 text-right font-semibold text-orange-600">{formatCurrency(kpis.finances.pending_collections_bs, 'BS')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Fiscal */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">
            🧾 Facturación Fiscal
          </h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Facturas Emitidas</p>
              <p className="font-semibold">{formatNumber(kpis.fiscal.issued_invoices)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Facturado</p>
              <p className="font-semibold">{formatCurrency(kpis.fiscal.total_fiscal_amount_bs, 'BS')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Impuestos</p>
              <p className="font-semibold">{formatCurrency(kpis.fiscal.total_tax_collected_bs, 'BS')}</p>
            </div>
          </div>
        </section>

        {/* Top Productos */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">
            🏆 Top 10 Productos (Últimos 7 Días)
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-2 text-left">#</th>
                <th className="py-2 px-2 text-left">Producto</th>
                <th className="py-2 px-2 text-right">Cantidad</th>
                <th className="py-2 px-2 text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {trends.top_products_trend.length > 0 ? (
                trends.top_products_trend.map((product, index) => (
                  <tr key={product.product_id} className="border-b">
                    <td className="py-1 px-2">{index + 1}</td>
                    <td className="py-1 px-2">{product.product_name}</td>
                    <td className="py-1 px-2 text-right">
                      {formatQuantity(product.quantity_sold, product.is_weight_product, product.weight_unit)}
                    </td>
                    <td className="py-1 px-2 text-right font-semibold">
                      {formatCurrency(product.revenue_bs, 'BS')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No hay datos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Tendencias de Ventas */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">
            📈 Tendencias de Ventas (Últimos 7 Días)
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-2 text-left">Fecha</th>
                <th className="py-2 px-2 text-right">Ventas</th>
                <th className="py-2 px-2 text-right">Monto (Bs)</th>
                <th className="py-2 px-2 text-right">Monto (USD)</th>
              </tr>
            </thead>
            <tbody>
              {trends.sales_trend.map((day) => (
                <tr key={day.date} className="border-b">
                  <td className="py-1 px-2">
                    {format(new Date(day.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="py-1 px-2 text-right">{day.count}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(day.amount_bs, 'BS')}</td>
                  <td className="py-1 px-2 text-right">{formatCurrency(day.amount_usd, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Footer */}
        <div className="border-t-2 border-black pt-4 mt-8 text-center text-xs text-gray-500">
          <p>Reporte generado automáticamente por {storeName}</p>
          <p>Este documento es informativo y no constituye un documento fiscal oficial.</p>
        </div>
      </div>
    )
  }
)

DashboardPrintView.displayName = 'DashboardPrintView'

export default DashboardPrintView
