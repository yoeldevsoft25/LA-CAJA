import { Sale } from './sales.service'
import { CashSessionSummary } from './cash.service'
import { ShiftSummary } from './shifts.service'

type CartSnapshotItem = {
  product_id: string
  product_name?: string
  qty: number
  unit_price_bs: number
  unit_price_usd: number
  discount_bs?: number
  discount_usd?: number
}

const paymentLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
  FIAO: 'Fiao',
  SPLIT: 'Mixto',
}

const currencyMap: Record<'BS' | 'USD' | 'MIXED', string> = {
  BS: 'VES',
  USD: 'USD',
  MIXED: 'VES',
}

function formatCurrency(value: number | string | undefined, currency: 'BS' | 'USD' | 'MIXED') {
  const safe = Number(value ?? 0) || 0
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: currencyMap[currency],
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
}

function resolveItemsForPrint(sale: Sale, cartItems?: CartSnapshotItem[]) {
  return sale.items.map((item) => {
    const fallback = cartItems?.find((c) => c.product_id === item.product_id)
    return {
      name: item.product?.name || fallback?.product_name || 'Producto',
      qty: item.qty,
      unitBs: Number(item.unit_price_bs) || fallback?.unit_price_bs || 0,
      unitUsd: Number(item.unit_price_usd) || fallback?.unit_price_usd || 0,
      discountBs: Number(item.discount_bs || fallback?.discount_bs || 0),
      discountUsd: Number(item.discount_usd || fallback?.discount_usd || 0),
    }
  })
}

function buildHtml(sale: Sale, opts?: { storeName?: string; cartItems?: CartSnapshotItem[]; cashierName?: string }) {
  const storeName = opts?.storeName || 'SISTEMA POS'
  const cashier = opts?.cashierName || sale.sold_by_user?.full_name || 'Cajero'
  const items = resolveItemsForPrint(sale, opts?.cartItems)
  const soldAt = new Date(sale.sold_at || new Date()).toLocaleString('es-VE')

  const paymentLines = (() => {
    const label = paymentLabels[sale.payment.method] || sale.payment.method
    if (!sale.payment.split) return [`Método: ${label}`]
    const s = sale.payment.split
    return [
      `Método: ${label}`,
      s.cash_bs ? `  Efectivo Bs: ${formatCurrency(s.cash_bs, 'BS')}` : null,
      s.cash_usd ? `  Efectivo USD: ${formatCurrency(s.cash_usd, 'USD')}` : null,
      s.pago_movil_bs ? `  Pago móvil: ${formatCurrency(s.pago_movil_bs, 'BS')}` : null,
      s.transfer_bs ? `  Transferencia: ${formatCurrency(s.transfer_bs, 'BS')}` : null,
      s.other_bs ? `  Otros: ${formatCurrency(s.other_bs, 'BS')}` : null,
    ].filter(Boolean) as string[]
  })()

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', 'Helvetica', Arial, sans-serif; margin: 0; padding: 12px; width: 280px; color: #111; }
        .header { text-align: center; margin-bottom: 12px; }
        .header h2 { margin: 0; font-size: 16px; }
        .muted { color: #555; font-size: 12px; }
        .section { margin: 12px 0; }
        .items { width: 100%; border-collapse: collapse; }
        .items th, .items td { text-align: left; font-size: 12px; padding: 4px 0; }
        .items th:last-child, .items td:last-child { text-align: right; }
        .total { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; font-size: 13px; }
        .bold { font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${storeName}</h2>
        <div class="muted">Venta #${(sale.id || '').slice(0, 8)}</div>
        <div class="muted">${soldAt}</div>
        <div class="muted">Cajero: ${cashier}</div>
      </div>

      <div class="section">
        <table class="items">
          <thead>
            <tr><th>Item</th><th>Cant</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${items
              .map((item) => {
                const lineTotalBs = item.qty * item.unitBs - item.discountBs
                const lineTotalUsd = item.qty * item.unitUsd - item.discountUsd
                const totalLine =
                  sale.currency === 'USD'
                    ? formatCurrency(lineTotalUsd, 'USD')
                    : sale.currency === 'BS'
                    ? formatCurrency(lineTotalBs, 'BS')
                    : `${formatCurrency(lineTotalBs, 'BS')} / ${formatCurrency(lineTotalUsd, 'USD')}`
                return `<tr>
                  <td>${item.name}</td>
                  <td>${item.qty}</td>
                  <td>${totalLine}</td>
                </tr>`
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="section total">
        <div>Total Bs: <span class="bold">${formatCurrency(sale.totals.total_bs, 'BS')}</span></div>
        <div>Total USD: <span class="bold">${formatCurrency(sale.totals.total_usd, 'USD')}</span></div>
        <div>Tasa: ${Number(sale.exchange_rate || 0).toFixed(2)}</div>
      </div>

      <div class="section">
        ${paymentLines.map((l) => `<div>${l}</div>`).join('')}
      </div>

      ${sale.customer ? `<div class="section">
        <div class="bold">Cliente:</div>
        <div>${sale.customer.name || ''}</div>
        ${sale.customer.document_id ? `<div class="muted">${sale.customer.document_id}</div>` : ''}
      </div>` : ''}
    </body>
  </html>`
}

function buildCashSessionHtml(summary: CashSessionSummary, opts?: { storeName?: string; cashierName?: string }) {
  const storeName = opts?.storeName || 'SISTEMA POS'
  const cashier = opts?.cashierName || 'Cajero'
  const { session, sales_count, sales, cash_flow, closing } = summary
  const openedAt = new Date(session.opened_at).toLocaleString('es-VE')
  const closedAt = session.closed_at ? new Date(session.closed_at).toLocaleString('es-VE') : 'Abierta'

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', 'Helvetica', Arial, sans-serif; margin: 0; padding: 12px; width: 300px; color: #111; }
        .header { text-align: center; margin-bottom: 12px; }
        .header h2 { margin: 0; font-size: 16px; }
        .muted { color: #555; font-size: 11px; }
        .section { margin: 12px 0; }
        .section-title { font-weight: 600; margin-bottom: 8px; font-size: 12px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
        .row.total { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; font-size: 12px; font-weight: 600; }
        .bold { font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${storeName}</h2>
        <div class="muted">Resumen de Sesión de Caja</div>
        <div class="muted">Sesión #${session.id.slice(0, 8)}</div>
        <div class="muted">Cajero: ${cashier}</div>
      </div>

      <div class="section">
        <div class="section-title">Apertura</div>
        <div class="row">
          <span>Apertura Bs:</span>
          <span class="bold">${formatCurrency(cash_flow.opening_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Apertura USD:</span>
          <span class="bold">${formatCurrency(cash_flow.opening_usd, 'USD')}</span>
        </div>
        <div class="muted">${openedAt}</div>
      </div>

      <div class="section">
        <div class="section-title">Resumen de Ventas</div>
        <div class="row">
          <span>Total Ventas:</span>
          <span class="bold">${sales_count}</span>
        </div>
        <div class="row">
          <span>Total Bs:</span>
          <span class="bold">${formatCurrency(sales.total_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Total USD:</span>
          <span class="bold">${formatCurrency(sales.total_usd, 'USD')}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Por Método de Pago</div>
        ${sales.by_method.CASH_BS > 0 ? `<div class="row"><span>Efectivo Bs:</span><span>${formatCurrency(sales.by_method.CASH_BS, 'BS')}</span></div>` : ''}
        ${sales.by_method.CASH_USD > 0 ? `<div class="row"><span>Efectivo USD:</span><span>${formatCurrency(sales.by_method.CASH_USD, 'USD')}</span></div>` : ''}
        ${sales.by_method.PAGO_MOVIL > 0 ? `<div class="row"><span>Pago Móvil:</span><span>${formatCurrency(sales.by_method.PAGO_MOVIL, 'BS')}</span></div>` : ''}
        ${sales.by_method.TRANSFER > 0 ? `<div class="row"><span>Transferencia:</span><span>${formatCurrency(sales.by_method.TRANSFER, 'BS')}</span></div>` : ''}
        ${sales.by_method.FIAO > 0 ? `<div class="row"><span>Fiao:</span><span>${formatCurrency(sales.by_method.FIAO, 'BS')}</span></div>` : ''}
      </div>

      ${closing ? `
      <div class="section">
        <div class="section-title">Cierre</div>
        <div class="row">
          <span>Esperado Bs:</span>
          <span class="bold">${formatCurrency(closing.expected.cash_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Esperado USD:</span>
          <span class="bold">${formatCurrency(closing.expected.cash_usd, 'USD')}</span>
        </div>
        <div class="row">
          <span>Contado Bs:</span>
          <span class="bold">${formatCurrency(closing.counted.cash_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Contado USD:</span>
          <span class="bold">${formatCurrency(closing.counted.cash_usd, 'USD')}</span>
        </div>
        <div class="row total">
          <span>Diferencia Bs:</span>
          <span class="bold">${closing.difference_bs >= 0 ? '+' : ''}${formatCurrency(closing.difference_bs, 'BS')}</span>
        </div>
        <div class="row total">
          <span>Diferencia USD:</span>
          <span class="bold">${closing.difference_usd >= 0 ? '+' : ''}${formatCurrency(closing.difference_usd, 'USD')}</span>
        </div>
        <div class="muted">${closedAt}</div>
      </div>
      ` : ''}

      ${session.note ? `<div class="section"><div class="section-title">Nota:</div><div class="muted">${session.note}</div></div>` : ''}
    </body>
  </html>`
}

function buildShiftSummaryHtml(summary: ShiftSummary, opts?: { storeName?: string; cashierName?: string }) {
  const storeName = opts?.storeName || 'SISTEMA POS'
  const cashier = opts?.cashierName || 'Cajero'
  const { shift, sales_count, cuts_count, summary: shiftSummary } = summary
  const openedAt = new Date(shift.opened_at).toLocaleString('es-VE')
  const closedAt = shift.closed_at ? new Date(shift.closed_at).toLocaleString('es-VE') : 'Abierto'
  const expected = shiftSummary.expected
  const counted = shiftSummary.counted
  const difference = shiftSummary.difference

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', 'Helvetica', Arial, sans-serif; margin: 0; padding: 12px; width: 300px; color: #111; }
        .header { text-align: center; margin-bottom: 12px; }
        .header h2 { margin: 0; font-size: 16px; }
        .muted { color: #555; font-size: 11px; }
        .section { margin: 12px 0; }
        .section-title { font-weight: 600; margin-bottom: 8px; font-size: 12px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
        .row.total { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; font-size: 12px; font-weight: 600; }
        .bold { font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${storeName}</h2>
        <div class="muted">Resumen de Turno</div>
        <div class="muted">Turno #${shift.id.slice(0, 8)}</div>
        <div class="muted">Cajero: ${cashier}</div>
      </div>

      <div class="section">
        <div class="section-title">Apertura</div>
        <div class="row">
          <span>Apertura Bs:</span>
          <span class="bold">${formatCurrency(Number(shiftSummary.opening.bs), 'BS')}</span>
        </div>
        <div class="row">
          <span>Apertura USD:</span>
          <span class="bold">${formatCurrency(Number(shiftSummary.opening.usd), 'USD')}</span>
        </div>
        <div class="muted">${openedAt}</div>
      </div>

      <div class="section">
        <div class="section-title">Resumen</div>
        <div class="row">
          <span>Total Ventas:</span>
          <span class="bold">${sales_count}</span>
        </div>
        <div class="row">
          <span>Total Cortes X/Z:</span>
          <span class="bold">${cuts_count}</span>
        </div>
      </div>

      ${expected ? `
      <div class="section">
        <div class="section-title">Esperado</div>
        <div class="row">
          <span>Efectivo Bs:</span>
          <span class="bold">${formatCurrency(expected.cash_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Efectivo USD:</span>
          <span class="bold">${formatCurrency(expected.cash_usd, 'USD')}</span>
        </div>
        <div class="row">
          <span>Pago Móvil:</span>
          <span>${formatCurrency(expected.pago_movil_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Transferencia:</span>
          <span>${formatCurrency(expected.transfer_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Otros:</span>
          <span>${formatCurrency(expected.other_bs, 'BS')}</span>
        </div>
        <div class="row total">
          <span>Total Bs:</span>
          <span class="bold">${formatCurrency(expected.total_bs, 'BS')}</span>
        </div>
        <div class="row total">
          <span>Total USD:</span>
          <span class="bold">${formatCurrency(expected.total_usd, 'USD')}</span>
        </div>
      </div>
      ` : ''}

      ${counted ? `
      <div class="section">
        <div class="section-title">Contado</div>
        <div class="row">
          <span>Efectivo Bs:</span>
          <span class="bold">${formatCurrency(counted.cash_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Efectivo USD:</span>
          <span class="bold">${formatCurrency(counted.cash_usd, 'USD')}</span>
        </div>
        <div class="row">
          <span>Pago Móvil:</span>
          <span>${formatCurrency(counted.pago_movil_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Transferencia:</span>
          <span>${formatCurrency(counted.transfer_bs, 'BS')}</span>
        </div>
        <div class="row">
          <span>Otros:</span>
          <span>${formatCurrency(counted.other_bs, 'BS')}</span>
        </div>
      </div>
      ` : ''}

      ${difference.bs !== null || difference.usd !== null ? `
      <div class="section">
        <div class="section-title">Diferencia</div>
        ${difference.bs !== null ? `<div class="row total"><span>Diferencia Bs:</span><span class="bold">${Number(difference.bs) >= 0 ? '+' : ''}${formatCurrency(Number(difference.bs), 'BS')}</span></div>` : ''}
        ${difference.usd !== null ? `<div class="row total"><span>Diferencia USD:</span><span class="bold">${Number(difference.usd) >= 0 ? '+' : ''}${formatCurrency(Number(difference.usd), 'USD')}</span></div>` : ''}
        <div class="muted">${closedAt}</div>
      </div>
      ` : ''}

      ${shift.note ? `<div class="section"><div class="section-title">Nota:</div><div class="muted">${shift.note}</div></div>` : ''}
    </body>
  </html>`
}

function openPrintWindow(html: string) {
  const printWindow = window.open('', '_blank', 'width=320,height=600')
  if (!printWindow) {
    console.warn('[PrintService] No se pudo abrir la ventana de impresión (popup bloqueado)')
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  setTimeout(() => printWindow.close(), 300)
}

export const printService = {
  printSale(sale: Sale, opts?: { storeName?: string; cartItems?: CartSnapshotItem[]; cashierName?: string }) {
    const html = buildHtml(sale, opts)
    openPrintWindow(html)
  },

  printCashSessionSummary(summary: CashSessionSummary, opts?: { storeName?: string; cashierName?: string }) {
    const html = buildCashSessionHtml(summary, opts)
    openPrintWindow(html)
  },

  printShiftSummary(summary: ShiftSummary, opts?: { storeName?: string; cashierName?: string }) {
    const html = buildShiftSummaryHtml(summary, opts)
    openPrintWindow(html)
  },
}
