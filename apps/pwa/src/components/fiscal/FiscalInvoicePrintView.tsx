import { forwardRef } from 'react'
import { FiscalInvoice } from '@/services/fiscal-invoices.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatRIF } from '@/utils/rif-validator'

interface FiscalInvoicePrintViewProps {
  invoice: FiscalInvoice
  className?: string
}

const formatNumber = (num: number, decimals = 2) => {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

const getInvoiceTypeName = (type: string) => {
  switch (type) {
    case 'invoice':
      return 'FACTURA'
    case 'credit_note':
      return 'NOTA DE CRÉDITO'
    case 'debit_note':
      return 'NOTA DE DÉBITO'
    default:
      return 'DOCUMENTO FISCAL'
  }
}

const FiscalInvoicePrintView = forwardRef<HTMLDivElement, FiscalInvoicePrintViewProps>(
  ({ invoice, className }, ref) => {
    const items = invoice.items || []
    const issuedDate = invoice.issued_at
      ? format(new Date(invoice.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: es })
      : format(new Date(invoice.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })
    const issuedTime = invoice.issued_at
      ? format(new Date(invoice.issued_at), 'HH:mm:ss')
      : format(new Date(invoice.created_at), 'HH:mm:ss')

    return (
      <div
        ref={ref}
        className={`bg-white text-black p-8 max-w-[21cm] mx-auto text-sm print:p-4 ${className}`}
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {/* Encabezado */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            {/* Datos del emisor */}
            <div className="flex-1">
              <h1 className="text-xl font-bold uppercase mb-1">
                {invoice.issuer_name}
              </h1>
              <p className="text-sm font-semibold">
                RIF: {formatRIF(invoice.issuer_tax_id)}
              </p>
              {invoice.issuer_address && (
                <p className="text-xs mt-1">{invoice.issuer_address}</p>
              )}
              {invoice.issuer_phone && (
                <p className="text-xs">Tel: {invoice.issuer_phone}</p>
              )}
              {invoice.issuer_email && (
                <p className="text-xs">Email: {invoice.issuer_email}</p>
              )}
            </div>

            {/* Tipo y número de factura */}
            <div className="text-right border-2 border-black p-3">
              <h2 className="text-lg font-bold">
                {getInvoiceTypeName(invoice.invoice_type)}
              </h2>
              <p className="text-2xl font-bold text-primary mt-1">
                N° {invoice.invoice_number}
              </p>
              {invoice.fiscal_number && (
                <p className="text-xs mt-1">
                  Control: {invoice.fiscal_number}
                </p>
              )}
              {invoice.invoice_series && (
                <p className="text-xs text-gray-600">
                  Serie: {invoice.invoice_series.series_code}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Datos del cliente y fecha */}
        <div className="grid grid-cols-2 gap-4 mb-4 border border-gray-300 p-3">
          <div>
            <h3 className="font-semibold text-xs uppercase text-gray-600 mb-1">
              Datos del Cliente
            </h3>
            <p className="font-semibold">{invoice.customer_name}</p>
            {invoice.customer_tax_id && (
              <p className="text-sm">RIF/CI: {formatRIF(invoice.customer_tax_id)}</p>
            )}
            {invoice.customer_address && (
              <p className="text-xs">{invoice.customer_address}</p>
            )}
            {invoice.customer_phone && (
              <p className="text-xs">Tel: {invoice.customer_phone}</p>
            )}
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-xs uppercase text-gray-600 mb-1">
              Información de Emisión
            </h3>
            <p className="text-sm">
              <span className="font-semibold">Fecha:</span> {issuedDate}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Hora:</span> {issuedTime}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Tasa BCV:</span>{' '}
              {formatNumber(invoice.exchange_rate)} Bs/$
            </p>
            {invoice.payment_method && (
              <p className="text-sm">
                <span className="font-semibold">Pago:</span>{' '}
                {invoice.payment_method}
              </p>
            )}
          </div>
        </div>

        {/* Tabla de items */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left text-xs">
                Código
              </th>
              <th className="border border-gray-300 p-2 text-left text-xs">
                Descripción
              </th>
              <th className="border border-gray-300 p-2 text-center text-xs">
                Cant.
              </th>
              <th className="border border-gray-300 p-2 text-right text-xs">
                P. Unit. (Bs)
              </th>
              <th className="border border-gray-300 p-2 text-right text-xs">
                Subtotal (Bs)
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || index}>
                <td className="border border-gray-300 p-2 text-xs">
                  {item.product_code || '-'}
                </td>
                <td className="border border-gray-300 p-2 text-xs">
                  {item.product_name}
                </td>
                <td className="border border-gray-300 p-2 text-center text-xs">
                  {formatNumber(item.quantity, 2)}
                </td>
                <td className="border border-gray-300 p-2 text-right text-xs">
                  {formatNumber(item.unit_price_bs)}
                </td>
                <td className="border border-gray-300 p-2 text-right text-xs">
                  {formatNumber(item.subtotal_bs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end mb-4">
          <div className="w-64 border border-gray-300">
            <div className="flex justify-between p-2 border-b border-gray-200">
              <span className="text-sm">Subtotal:</span>
              <span className="text-sm font-semibold">
                Bs. {formatNumber(invoice.subtotal_bs)}
              </span>
            </div>
            {Number(invoice.discount_bs) > 0 && (
              <div className="flex justify-between p-2 border-b border-gray-200 text-red-600">
                <span className="text-sm">Descuento:</span>
                <span className="text-sm font-semibold">
                  - Bs. {formatNumber(invoice.discount_bs)}
                </span>
              </div>
            )}
            <div className="flex justify-between p-2 border-b border-gray-200">
              <span className="text-sm">
                IVA ({formatNumber(invoice.tax_rate, 0)}%):
              </span>
              <span className="text-sm font-semibold">
                Bs. {formatNumber(invoice.tax_amount_bs)}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-gray-100 font-bold">
              <span>TOTAL:</span>
              <span className="text-lg">
                Bs. {formatNumber(invoice.total_bs)}
              </span>
            </div>
            <div className="flex justify-between p-2 border-t border-gray-300 text-xs text-gray-600">
              <span>Equivalente USD:</span>
              <span>${formatNumber(invoice.total_usd)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {invoice.note && (
          <div className="border border-gray-300 p-3 mb-4">
            <h3 className="font-semibold text-xs uppercase text-gray-600 mb-1">
              Observaciones
            </h3>
            <p className="text-xs">{invoice.note}</p>
          </div>
        )}

        {/* Pie de página fiscal */}
        <div className="border-t-2 border-black pt-4 mt-4 text-center">
          {invoice.fiscal_control_code && (
            <p className="text-xs font-mono mb-2">
              Código de Control: {invoice.fiscal_control_code}
            </p>
          )}
          {invoice.fiscal_authorization_number && (
            <p className="text-xs mb-2">
              Autorización SENIAT: {invoice.fiscal_authorization_number}
            </p>
          )}
          <p className="text-xs text-gray-600">
            Este documento es una representación impresa de una factura
            electrónica.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Generado por Sistema POS LA CAJA
          </p>
        </div>

        {/* Estilos de impresión */}
        <style>{`
          @media print {
            @page {
              size: letter;
              margin: 1cm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        `}</style>
      </div>
    )
  }
)

FiscalInvoicePrintView.displayName = 'FiscalInvoicePrintView'

export default FiscalInvoicePrintView
