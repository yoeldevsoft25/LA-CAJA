import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshIndicatorProps {
  isPulling: boolean
  isRefreshing: boolean
  pullDistance: number
  threshold: number
}

/**
 * Componente visual para indicar pull-to-refresh
 * Se muestra en la parte superior cuando el usuario arrastra hacia abajo
 */
export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance,
  threshold,
}: PullToRefreshIndicatorProps) {
  if (!isPulling && !isRefreshing) return null

  const progress = Math.min(pullDistance / threshold, 1)
  const shouldTrigger = progress >= 1

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center',
        'bg-background/95 backdrop-blur-sm border-b border-border',
        'transition-all duration-200',
        isPulling || isRefreshing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
      )}
      style={{
        height: `${Math.min(pullDistance, threshold * 1.5)}px`,
        maxHeight: `${threshold * 1.5}px`,
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <RefreshCw
          className={cn(
            'w-6 h-6 transition-transform duration-300',
            isRefreshing && 'animate-spin',
            shouldTrigger && !isRefreshing && 'text-primary',
            !shouldTrigger && 'text-muted-foreground'
          )}
          style={{
            transform: isRefreshing ? 'rotate(0deg)' : `rotate(${progress * 180}deg)`,
          }}
        />
        <span
          className={cn(
            'text-xs font-medium transition-colors',
            shouldTrigger && !isRefreshing ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {isRefreshing
            ? 'Actualizando...'
            : shouldTrigger
              ? 'Suelta para actualizar'
              : 'Arrastra para actualizar'}
        </span>
      </div>
    </div>
  )
}
