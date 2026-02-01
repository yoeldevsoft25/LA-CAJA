/**
 * Utilidades para compartir contenido por WhatsApp
 */
import { format } from 'date-fns'
import type { Sale } from '@/services/sales.service'

/**
 * Formatea un valor de peso con su unidad
 */
function formatWeightValue(value: number, unit?: string | null): string {
  const safeUnit = unit || 'kg'
  const decimals = safeUnit === 'g' || safeUnit === 'oz' ? 0 : 3
  const safeValue = Number.isFinite(value) ? value : 0
  const fixed = safeValue.toFixed(decimals)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return `${trimmed} ${safeUnit}`
}

/**
 * Etiquetas de métodos de pago
 */
const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  ZELLE: 'Zelle',
  OTHER: 'Otro',
  SPLIT: 'Mixto',
  FIAO: 'Fiado',
}

/**
 * Formatea un ticket de venta como texto para compartir por WhatsApp
 */
export function formatSaleForWhatsApp(sale: Sale, storeName: string = 'SISTEMA POS'): string {
  const soldAt = format(new Date(sale.sold_at), 'dd/MM/yyyy HH:mm')
  const saleId = sale.id.slice(0, 8).toUpperCase()
  
  let text = `🧾 *${storeName}*\n`
  text += `📋 Venta #${saleId}\n`
  text += `📅 ${soldAt}\n`
  text += `\n`
  
  // Items
  text += `*PRODUCTOS:*\n`
  sale.items.forEach((item, index) => {
    const qty = item.is_weight_product 
      ? formatWeightValue(Number(item.qty), item.weight_unit)
      : item.qty.toString()
    const unitPrice = item.is_weight_product
      ? Number(item.price_per_weight_usd ?? item.unit_price_usd).toFixed(2)
      : Number(item.unit_price_usd).toFixed(2)
    const lineTotal = (Number(item.qty) * Number(item.unit_price_usd) - Number(item.discount_usd || 0)).toFixed(2)
    
    text += `${index + 1}. ${item.product?.name || 'Producto'}\n`
    text += `   ${qty} x $${unitPrice} = $${lineTotal}\n`
    if (Number(item.discount_usd || 0) > 0) {
      text += `   💰 Descuento: $${Number(item.discount_usd).toFixed(2)}\n`
    }
  })
  
  text += `\n`
  text += `*TOTALES:*\n`
  text += `Total Bs: ${Number(sale.totals.total_bs).toFixed(2)}\n`
  text += `Total USD: $${Number(sale.totals.total_usd).toFixed(2)}\n`
  text += `Tasa: ${Number(sale.exchange_rate || 0).toFixed(2)}\n`
  
  text += `\n`
  text += `*PAGO:*\n`
  text += `${paymentMethodLabels[sale.payment.method] || sale.payment.method}\n`
  
  if (sale.customer) {
    text += `\n`
    text += `*CLIENTE:*\n`
    text += `${sale.customer.name || ''}\n`
    if (sale.customer.document_id) {
      text += `Cédula: ${sale.customer.document_id}\n`
    }
  }
  
  if (sale.invoice_full_number) {
    text += `\n`
    text += `📄 Factura: ${sale.invoice_full_number}\n`
  }
  
  return text
}

/**
 * Formatea un mensaje de venta con mensaje de agradecimiento personalizado
 */
export function formatSaleWithThankYou(
  sale: Sale,
  thankYouMessage: string | null,
  storeName: string = 'SISTEMA POS'
): string {
  let message = ''
  
  if (thankYouMessage) {
    message = thankYouMessage
      .replace(/{storeName}/g, storeName)
      .replace(/{customerName}/g, sale.customer?.name || 'Cliente')
    message += '\n\n'
  } else {
    message = `¡Gracias por comprar en ${storeName}!\n\n`
  }
  
  message += formatSaleForWhatsApp(sale, storeName)
  
  return message
}

/**
 * Codifica texto para URL de WhatsApp, preservando emojis Unicode
 * 
 * WhatsApp Web espera que el texto esté codificado en UTF-8.
 * Esta función asegura que los emojis y caracteres especiales se codifiquen
 * correctamente para evitar que aparezcan como símbolos de interrogación.
 */
export function encodeWhatsAppText(text: string): string {
  try {
    // encodeURIComponent codifica correctamente UTF-8, incluyendo emojis
    // En JavaScript moderno, los strings son UTF-16 internamente y encodeURIComponent
    // los convierte correctamente a percent-encoding UTF-8
    return encodeURIComponent(text)
  } catch (error) {
    console.error('[WhatsApp] Error encoding text:', error)
    // Fallback: codificar caracter por caracter para manejar emojis problemáticos
    // Esto es útil para emojis complejos que pueden tener múltiples puntos de código
    return text
      .split('')
      .map((char) => {
        try {
          // Para emojis y caracteres Unicode, encodeURIComponent los maneja correctamente
          return encodeURIComponent(char)
        } catch {
          // Si un caracter no se puede codificar, intentar codificarlo como UTF-8 manualmente
          const codePoint = char.codePointAt(0)
          if (codePoint !== undefined && codePoint > 127) {
            // Para caracteres no ASCII, usar escape Unicode si es necesario
            return char
          }
          return char
        }
      })
      .join('')
  }
}

/**
 * Formatea un número de teléfono para WhatsApp
 * 
 * WhatsApp requiere el formato internacional sin espacios ni caracteres especiales.
 * Para Venezuela, el código de país es 58.
 * 
 * @param phone - Número de teléfono (puede incluir espacios, guiones, etc.)
 * @returns Número formateado para WhatsApp (ej: 584121234567)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return ''
  
  // Remover todos los caracteres no numéricos
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Si ya empieza con código de país de Venezuela (58), dejarlo así
  // Si no, agregar código de país (58)
  if (cleanPhone.startsWith('58')) {
    return cleanPhone
  }
  
  return `58${cleanPhone}`
}

/**
 * Crea la URL de WhatsApp con número y mensaje
 * 
 * @param phone - Número de teléfono
 * @param message - Mensaje a enviar
 * @returns URL completa de WhatsApp
 */
export function createWhatsAppUrl(phone: string, message: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone)
  const encodedMessage = encodeWhatsAppText(message)
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`
}
