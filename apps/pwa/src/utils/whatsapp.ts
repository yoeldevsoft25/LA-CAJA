/**
 * Utilidades para compartir contenido por WhatsApp
 */

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
