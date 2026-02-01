import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface PWAInstallState {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  promptInstall: () => Promise<void>
  dismissPrompt: () => void
  wasPromptDismissed: boolean
}

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 días

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [wasPromptDismissed, setWasPromptDismissed] = useState(false)

  // Detectar si es iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

  // Verificar si ya está instalado como PWA
  useEffect(() => {
    const checkInstalled = () => {
      // Verificar si está en modo standalone (instalado)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInWebAppiOS = (window.navigator as any).standalone === true
      setIsInstalled(isStandalone || isInWebAppiOS)
    }

    checkInstalled()

    // Escuchar cambios en el display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener('change', checkInstalled)

    return () => {
      mediaQuery.removeEventListener('change', checkInstalled)
    }
  }, [])

  // Verificar si el usuario ya descartó el prompt
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      const now = Date.now()
      if (now - dismissedTime < DISMISS_DURATION) {
        setWasPromptDismissed(true)
      } else {
        // Expiró el tiempo de descarte
        localStorage.removeItem(DISMISS_KEY)
      }
    }
  }, [])

  // Capturar el evento beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevenir que Chrome muestre el prompt automáticamente
      e.preventDefault()
      // Guardar el evento para usarlo después
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Función para mostrar el prompt de instalación
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] No hay prompt de instalación disponible')
      return
    }

    try {
      // Mostrar el prompt
      await deferredPrompt.prompt()

      // Esperar la respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice

      console.log('[PWA] Usuario respondió:', outcome)

      if (outcome === 'accepted') {
        console.log('[PWA] App instalada')
      } else {
        console.log('[PWA] Usuario canceló la instalación')
      }

      // El prompt solo se puede usar una vez
      setDeferredPrompt(null)
    } catch (error) {
      console.error('[PWA] Error al mostrar prompt:', error)
    }
  }, [deferredPrompt])

  // Función para descartar el prompt
  const dismissPrompt = useCallback(() => {
    setWasPromptDismissed(true)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }, [])

  return {
    isInstallable: !!deferredPrompt && !isInstalled && !wasPromptDismissed,
    isInstalled,
    isIOS: isIOS && !isInstalled,
    promptInstall,
    dismissPrompt,
    wasPromptDismissed,
  }
}
