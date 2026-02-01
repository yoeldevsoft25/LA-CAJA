/**
 * Utilidades para exportar datos a Excel (CSV format)
 * Compatible con Microsoft Excel, Google Sheets, LibreOffice
 */

interface ExportColumn<T> {
  header: string
  accessor: keyof T | ((row: T) => string | number)
  format?: 'currency' | 'number' | 'date' | 'percent'
}

interface ExportOptions {
  filename: string
  sheetName?: string
}

/**
 * Formatea un valor para exportación
 */
function formatValue(
  value: any,
  format?: 'currency' | 'number' | 'date' | 'percent'
): string {
  if (value === null || value === undefined) {
    return ''
  }

  switch (format) {
    case 'currency':
      return typeof value === 'number' ? value.toFixed(2) : String(value)
    case 'number':
      return typeof value === 'number' ? String(value) : String(value)
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString('es-VE')
      }
      if (typeof value === 'string') {
        return new Date(value).toLocaleDateString('es-VE')
      }
      return String(value)
    case 'percent':
      return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value)
    default:
      return String(value)
  }
}

/**
 * Escapa un valor para CSV
 */
function escapeCSV(value: string): string {
  // Si contiene coma, comilla o salto de línea, envolver en comillas
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Escapar comillas duplicándolas
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Exporta datos a CSV
 */
export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): void {
  // Construir encabezados
  const headers = columns.map((col) => escapeCSV(col.header))

  // Construir filas
  const rows = data.map((row) =>
    columns.map((col) => {
      const value =
        typeof col.accessor === 'function'
          ? col.accessor(row)
          : row[col.accessor]
      return escapeCSV(formatValue(value, col.format))
    })
  )

  // Unir todo con BOM para UTF-8 en Excel
  const BOM = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  // Crear blob y descargar
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${options.filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporta KPIs del dashboard a Excel
 */
export function exportDashboardToExcel(
  kpis: {
    sales: any
    inventory: any
    finances: any
    purchases: any
    fiscal: any
    performance: any
  },
  trends: {
    sales_trend: any[]
    top_products_trend: any[]
  },
  dateRange?: { start?: string; end?: string }
): void {
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `Velox-POS-Reporte-${timestamp}`

  // Preparar datos de ventas por día
  const salesData = trends.sales_trend.map((day) => ({
    fecha: day.date,
    ventas: day.count,
    monto_bs: day.amount_bs,
    monto_usd: day.amount_usd,
  }))

  // Preparar datos de top productos
  const productsData = trends.top_products_trend.map((product, index) => ({
    ranking: index + 1,
    producto: product.product_name,
    cantidad: product.quantity_sold,
    ingresos_bs: product.revenue_bs,
    ingresos_usd: product.revenue_usd,
  }))

  // Preparar resumen de KPIs
  const kpisData = [
    { metrica: 'Ventas Hoy', valor_bs: kpis.sales.today_amount_bs, valor_usd: kpis.sales.today_amount_usd },
    { metrica: 'Ventas del Período', valor_bs: kpis.sales.period_amount_bs, valor_usd: kpis.sales.period_amount_usd },
    { metrica: 'Crecimiento', valor_bs: `${kpis.sales.growth_percentage.toFixed(1)}%`, valor_usd: '-' },
    { metrica: 'Ticket Promedio', valor_bs: kpis.performance.avg_sale_amount_bs, valor_usd: kpis.performance.avg_sale_amount_usd },
    { metrica: 'Total Productos', valor_bs: kpis.inventory.total_products, valor_usd: '-' },
    { metrica: 'Stock Bajo', valor_bs: kpis.inventory.low_stock_count, valor_usd: '-' },
    { metrica: 'Valor Inventario', valor_bs: kpis.inventory.total_stock_value_bs, valor_usd: kpis.inventory.total_stock_value_usd },
    { metrica: 'Deuda Total', valor_bs: kpis.finances.total_debt_bs, valor_usd: kpis.finances.total_debt_usd },
    { metrica: 'Cobrado', valor_bs: kpis.finances.total_collected_bs, valor_usd: kpis.finances.total_collected_usd },
    { metrica: 'Facturas Emitidas', valor_bs: kpis.fiscal.issued_invoices, valor_usd: '-' },
    { metrica: 'Total Facturado', valor_bs: kpis.fiscal.total_fiscal_amount_bs, valor_usd: kpis.fiscal.total_fiscal_amount_usd },
  ]

  // Crear CSV combinado
  const BOM = '\uFEFF'
  let csvContent = BOM

  // Sección: Resumen de KPIs
  csvContent += 'RESUMEN DE KPIs\n'
  csvContent += 'Métrica,Valor (Bs),Valor (USD)\n'
  kpisData.forEach((row) => {
    csvContent += `${escapeCSV(row.metrica)},${row.valor_bs},${row.valor_usd}\n`
  })
  csvContent += '\n'

  // Sección: Tendencias de Ventas
  csvContent += 'TENDENCIAS DE VENTAS (Últimos 7 Días)\n'
  csvContent += 'Fecha,Cantidad Ventas,Monto (Bs),Monto (USD)\n'
  salesData.forEach((row) => {
    csvContent += `${row.fecha},${row.ventas},${row.monto_bs.toFixed(2)},${row.monto_usd.toFixed(2)}\n`
  })
  csvContent += '\n'

  // Sección: Top Productos
  csvContent += 'TOP PRODUCTOS\n'
  csvContent += '#,Producto,Cantidad Vendida,Ingresos (Bs),Ingresos (USD)\n'
  productsData.forEach((row) => {
    csvContent += `${row.ranking},${escapeCSV(row.producto)},${row.cantidad},${row.ingresos_bs.toFixed(2)},${row.ingresos_usd.toFixed(2)}\n`
  })

  // Agregar metadata
  csvContent += '\n'
  csvContent += `Generado: ${new Date().toLocaleString('es-VE')}\n`
  if (dateRange?.start) {
    csvContent += `Período: ${dateRange.start} - ${dateRange.end || 'Hoy'}\n`
  }

  // Descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
