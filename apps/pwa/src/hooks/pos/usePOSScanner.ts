import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { productsService } from '@/services/products.service'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'

import { Product } from '@/services/products.service'

interface UsePOSScannerProps {
    storeId?: string
    onProductFound: (product: Product) => Promise<void>
}

export function usePOSScanner({ storeId, onProductFound }: UsePOSScannerProps) {
    const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null)
    const [scannerStatus, setScannerStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
    const [scannerSoundEnabled, setScannerSoundEnabled] = useState(true)
    const audioContextRef = useRef<AudioContext | null>(null)

    // Audio helper
    const playScanTone = useCallback((variant: 'success' | 'error') => {
        if (!scannerSoundEnabled) return

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (!AudioContextClass) return
            if (!audioContextRef.current) audioContextRef.current = new AudioContextClass()
            const context = audioContextRef.current
            if (context.state === 'suspended') void context.resume()

            const oscillator = context.createOscillator()
            const gainNode = context.createGain()

            oscillator.type = 'sine'
            oscillator.frequency.value = variant === 'success' ? 880 : 220
            gainNode.gain.value = 0.05

            oscillator.connect(gainNode)
            gainNode.connect(context.destination)

            oscillator.start()
            oscillator.stop(context.currentTime + (variant === 'success' ? 0.12 : 0.2))
        } catch (e) {
            console.warn('Audio context error:', e)
        }
    }, [scannerSoundEnabled])

    const handleBarcodeScan = useCallback(async (barcode: string) => {
        setLastScannedBarcode(barcode)
        setScannerStatus('scanning')

        try {
            const result = await productsService.search({
                q: barcode,
                is_active: true,
                limit: 5,
            }, storeId)

            // Buscar coincidencia exacta por barcode
            const product = result.products.find(
                (p) => p.barcode?.toLowerCase() === barcode.toLowerCase()
            )

            if (!product) {
                setScannerStatus('error')
                toast.error(`Producto no encontrado`, {
                    description: `Código: ${barcode}`,
                    icon: '🔍',
                    duration: 3000
                })
                playScanTone('error')

                setTimeout(() => {
                    setScannerStatus('idle')
                    setLastScannedBarcode(null)
                }, 2000)
                return
            }

            // Producto encontrado
            playScanTone('success')
            await onProductFound(product) // Delegar acción

            setTimeout(() => {
                setScannerStatus('idle')
                setLastScannedBarcode(null)
            }, 1500)
        } catch (error) {
            console.error('[POS] Error al buscar producto por código de barras:', error)
            setScannerStatus('error')
            toast.error('Error al buscar producto')
            setTimeout(() => {
                setScannerStatus('idle')
                setLastScannedBarcode(null)
            }, 2000)
        }
    }, [storeId, onProductFound, playScanTone])

    useBarcodeScanner({
        onScan: handleBarcodeScan,
        enabled: true,
        minLength: 4,
        maxLength: 50,
        maxIntervalMs: 100,
    })

    return {
        lastScannedBarcode,
        scannerStatus,
        scannerSoundEnabled,
        setScannerSoundEnabled,
        handleBarcodeScan
    }
}
