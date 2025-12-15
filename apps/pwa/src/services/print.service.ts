import { Sale } from './sales.service'

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

export const printService = {
  printSale(sale: Sale, opts?: { storeName?: string; cartItems?: CartSnapshotItem[]; cashierName?: string }) {
    const html = buildHtml(sale, opts)
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
  },
}
