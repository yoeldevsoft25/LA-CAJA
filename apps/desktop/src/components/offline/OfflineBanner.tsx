import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, CheckCircle, Clock, ShoppingCart, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useOnline } from '@/hooks/use-online'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { syncService } from '@/services/sync.service'

interface OfflineBannerProps {
  className?: string
}

/**
 * Banner prominente que aparece cuando el usuario está offline.
 * Muestra información útil sobre qué funciones están disponibles
 * y cuántas operaciones están pendientes de sincronizar.
 */
export default function OfflineBanner({ className }: OfflineBannerProps) {
  const { isOnline } = useOnline()
  const [isExpanded, setIsExpanded] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  // Detectar cambios de conectividad
  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true)
    } else {
      // Delay para mostrar mensaje de reconexión
      const timer = setTimeout(() => {
        setShowBanner(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  // Obtener conteo de eventos pendientes
  useEffect(() => {
    const updatePendingCount = () => {
      try {
        const status = syncService.getStatus()
        setPendingCount(status.pendingCount)
      } catch {
        setPendingCount(0)
      }
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000)
    return () => clearInterval(interval)
  }, [])

  // Intentar sincronizar manualmente
  const handleSyncNow = async () => {
    if (!isOnline) return
    
    setIsSyncing(true)
    try {
      await syncService.syncNow()
      const status = syncService.getStatus()
      setPendingCount(status.pendingCount)
    } finally {
      setIsSyncing(false)
    }
  }

  if (!showBanner && pendingCount === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 shadow-lg',
          isOnline ? 'bg-green-600' : 'bg-amber-600',
          className
        )}
      >
        {/* Banner principal */}
        <div className="px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <>
                  <CheckCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-medium text-sm">
                    Conexión restaurada
                    {isSyncing && ' - Sincronizando...'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5 text-white animate-pulse" />
                  <span className="text-white font-medium text-sm">
                    Modo sin conexión - Tus ventas se guardarán localmente
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Contador de pendientes */}
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-white" />
                  <span className="text-white text-xs font-semibold">
                    {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Botón de sincronizar */}
              {isOnline && pendingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="text-white hover:bg-white/20 h-7 px-2"
                >
                  <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
                </Button>
              )}

              {/* Botón expandir */}
              {!isOnline && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-white hover:bg-white/20 h-7 px-2"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Panel expandido con información */}
        <AnimatePresence>
          {isExpanded && !isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/20 bg-white/10"
            >
              <div className="px-4 py-3 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white">
                  {/* Funciones disponibles */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-300" />
                      Disponible sin conexión:
                    </h4>
                    <ul className="space-y-1 text-white/90">
                      <li className="flex items-center gap-2">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Realizar ventas (se sincronizarán después)
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Ver historial de ventas recientes
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Consultar productos y precios
                      </li>
                    </ul>
                  </div>

                  {/* Funciones que requieren conexión */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-300" />
                      Requiere conexión:
                    </h4>
                    <ul className="space-y-1 text-white/90">
                      <li className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Crear/editar productos
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Generar reportes del dashboard
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Abrir/cerrar caja
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
