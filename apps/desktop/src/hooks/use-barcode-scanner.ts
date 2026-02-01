import { useEffect, useCallback, useRef } from 'react'

interface BarcodeScannerOptions {
  /**
   * Callback cuando se detecta un código de barras completo
   */
  onScan: (barcode: string) => void
  /**
   * Tiempo máximo entre caracteres para considerar entrada de scanner (ms)
   * Los escáneres típicos envían caracteres cada 10-50ms; algunos van hasta 80-100ms
   * Default: 80ms
   */
  maxIntervalMs?: number
  /**
   * Longitud mínima del código de barras para ser válido
   * Default: 4
   */
  minLength?: number
  /**
   * Longitud máxima del código de barras
   * Default: 50
   */
  maxLength?: number
  /**
   * Tecla que termina el escaneo (los scanners envían Enter al final)
   * Default: 'Enter'
   */
  endKey?: string
  /**
   * Si está habilitado o no
   * Default: true
   */
  enabled?: boolean
  /**
   * Prevenir que el evento se propague cuando es un escaneo
   * Default: true
   */
  preventDefault?: boolean
}

/**
 * Hook profesional para detectar entrada de lectores de código de barras.
 *
 * Los escáneres de código de barras funcionan como teclados virtuales que:
 * 1. Envían caracteres muy rápidamente (10-50ms entre cada uno)
 * 2. Terminan con Enter
 *
 * Este hook distingue entre escritura humana (lenta) y escaneo (rápido)
 * para evitar falsos positivos cuando el usuario escribe manualmente.
 *
 * @example
 * ```tsx
 * useBarcodeScanner({
 *   onScan: (barcode) => {
 *     console.log('Código escaneado:', barcode)
 *     // Buscar producto por código de barras
 *   },
 *   enabled: true,
 * })
 * ```
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 80,
  minLength = 4,
  maxLength = 50,
  endKey = 'Enter',
  enabled = true,
  preventDefault = true,
}: BarcodeScannerOptions) {
  // Buffer para acumular caracteres del escaneo
  const bufferRef = useRef<string>('')
  // Timestamp del último caracter recibido
  const lastKeyTimeRef = useRef<number>(0)
  // Flag para saber si estamos en medio de un escaneo potencial
  const isScanningRef = useRef<boolean>(false)
  // Timeout para limpiar el buffer si no se completa el escaneo
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Limpiar el buffer
  const clearBuffer = useCallback(() => {
    bufferRef.current = ''
    isScanningRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Procesar el código escaneado
  const processBarcode = useCallback((barcode: string) => {
    // Limpiar espacios y caracteres no válidos
    const cleanBarcode = barcode.trim()

    // Validar longitud
    if (cleanBarcode.length >= minLength && cleanBarcode.length <= maxLength) {
      onScan(cleanBarcode)
    }

    clearBuffer()
  }, [onScan, minLength, maxLength, clearBuffer])

  useEffect(() => {
    if (!enabled) {
      clearBuffer()
      return
    }

    const scheduleClear = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(clearBuffer, 500)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement

      // No interceptar NADA cuando el foco está en un input/textarea/select.
      // La escritura y la búsqueda funcionan con normalidad. El escaneo solo se
      // detecta con el foco fuera (p. ej. en la lista, en el body). Si se escanea
      // con el foco en el buscador, el código se escribe en el input y la búsqueda
      // se dispara por change o Enter como con cualquier texto.
      if (isInputElement) {
        clearBuffer()
        return
      }

      const now = Date.now()
      const timeSinceLastKey = now - lastKeyTimeRef.current
      const key = event.key

      // Enter: escaneo completo
      if (key === endKey) {
        if (bufferRef.current.length >= minLength && isScanningRef.current) {
          if (preventDefault) {
            event.preventDefault()
            event.stopPropagation()
          }
          processBarcode(bufferRef.current)
          return
        }
        clearBuffer()
        return
      }

      if (key.length !== 1) return
      if (!/^[a-zA-Z0-9\-_\.\/\+\=]$/.test(key)) {
        clearBuffer()
        return
      }

      const isRapidInput = timeSinceLastKey < maxIntervalMs

      if (bufferRef.current.length === 0) {
        bufferRef.current = key
        lastKeyTimeRef.current = now
        isScanningRef.current = false
        scheduleClear()
        return
      }

      if (isRapidInput) {
        bufferRef.current += key
        lastKeyTimeRef.current = now
        isScanningRef.current = true
        scheduleClear()
        if (bufferRef.current.length > maxLength) clearBuffer()
      } else {
        clearBuffer()
        bufferRef.current = key
        lastKeyTimeRef.current = now
        scheduleClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      clearBuffer()
    }
  }, [enabled, maxIntervalMs, minLength, maxLength, endKey, preventDefault, processBarcode, clearBuffer])

  // Retornar función para limpiar manualmente si es necesario
  return { clearBuffer }
}

export default useBarcodeScanner
