import { CheckCircle2, Clock, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OrderItemStatus = 'pending' | 'preparing' | 'ready'

export interface OrderProgressData {
  totalItems: number
  pendingItems: number
  preparingItems: number
  readyItems: number
  orderStatus: 'open' | 'paused' | 'closed' | 'cancelled'
}

interface OrderProgressBarProps {
  progress: OrderProgressData
  showLabels?: boolean
  compact?: boolean
}

const STATUS_STEPS = [
  { 
    key: 'pending' as const, 
    label: 'Recibido', 
    icon: Clock, 
    color: 'text-slate-600', 
    bgColor: 'bg-slate-100',
    activeBgColor: 'bg-slate-200',
    borderColor: 'border-slate-300',
    gradient: 'from-slate-400 to-slate-500',
  },
  { 
    key: 'preparing' as const, 
    label: 'En Cocina', 
    icon: ChefHat, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-50',
    activeBgColor: 'bg-orange-100',
    borderColor: 'border-orange-400',
    gradient: 'from-orange-400 to-orange-500',
  },
  { 
    key: 'ready' as const, 
    label: 'Listo', 
    icon: CheckCircle2, 
    color: 'text-green-600', 
    bgColor: 'bg-green-50',
    activeBgColor: 'bg-green-100',
    borderColor: 'border-green-400',
    gradient: 'from-green-400 to-green-500',
  },
]

export default function OrderProgressBar({
  progress,
  showLabels = true,
  compact = false,
}: OrderProgressBarProps) {
  const { totalItems, pendingItems, preparingItems, readyItems } = progress

  // Calcular porcentajes
  const pendingPercent = totalItems > 0 ? (pendingItems / totalItems) * 100 : 0
  const preparingPercent = totalItems > 0 ? (preparingItems / totalItems) * 100 : 0
  const readyPercent = totalItems > 0 ? (readyItems / totalItems) * 100 : 0

  // Estado general de la orden - calcular progreso total incluyendo preparación
  // Progreso = (items preparando * 0.5 + items listos * 1.0) / total
  const overallProgress = totalItems > 0 
    ? ((preparingItems * 0.5 + readyItems * 1.0) / totalItems) * 100 
    : 0
  const isComplete = readyItems === totalItems && totalItems > 0

  // Determinar estado actual (el que tiene items)
  let currentStep: 'pending' | 'preparing' | 'ready' = 'pending'
  if (readyItems > 0) currentStep = 'ready'
  else if (preparingItems > 0) currentStep = 'preparing'

  // Calcular paso actual (0, 1, 2)
  const currentStepIndex = STATUS_STEPS.findIndex(step => step.key === currentStep)
  // Calcular cuántos pasos están completados
  const completedSteps = readyItems === totalItems ? 3 : (preparingItems > 0 || readyItems > 0 ? 2 : 1)

  if (compact) {
    return (
      <div className="w-full space-y-2">
        {/* Timeline compacta con pasos */}
        <div className="relative flex items-center justify-between">
          {/* Línea de conexión - conecta puntos sin tocar círculos */}
          <div 
            className="absolute top-5 h-0.5 bg-muted z-0"
            style={{ 
              left: 'calc(16.666% + 20px)', // Empieza después del primer círculo
              right: 'calc(16.666% + 20px)', // Termina antes del último círculo
            }} 
          />
          {(() => {
            // Calcular ancho de conexión entre círculos
            const connectionWidth = 'calc(33.333% - 40px)'
            let progressWidth = '0%'
            const leftOffset = 'calc(16.666% + 20px)'
            
            if (completedSteps >= 1 && pendingItems === 0) {
              progressWidth = connectionWidth // Primera conexión
            }
            if (completedSteps >= 2) {
              progressWidth = 'calc(66.666% - 40px)' // Dos conexiones
            }
            if (completedSteps >= 3) {
              progressWidth = 'calc(66.666% - 40px)' // Completo
            }
            
            return progressWidth !== '0%' ? (
              <div 
                className="absolute top-5 h-0.5 bg-gradient-to-r from-slate-400 via-orange-400 to-green-400 transition-all duration-700 ease-out z-10"
                style={{ 
                  left: leftOffset,
                  width: progressWidth,
                }}
              />
            ) : null
          })()}

          {STATUS_STEPS.map((step, index) => {
            const Icon = step.icon
            let count = 0
            if (step.key === 'pending') count = pendingItems
            if (step.key === 'preparing') count = preparingItems
            if (step.key === 'ready') count = readyItems

            const isCompleted = index < completedSteps
            const isCurrent = index === currentStepIndex && count > 0
            const hasItems = count > 0

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center">
                {/* Círculo del paso */}
                <div
                  className={cn(
                    'relative rounded-full p-2 transition-all duration-500',
                    'border-2 shadow-lg z-20', // z-20 para estar sobre la línea
                    isCompleted
                      ? `${step.activeBgColor} ${step.borderColor} scale-110`
                      : 'bg-background border-muted-foreground/20 scale-100',
                    isCurrent && 'animate-pulse ring-2 ring-offset-2 z-30', // z-30 cuando está activo
                    isCurrent && step.key === 'ready' && 'ring-green-500/50',
                    isCurrent && step.key === 'preparing' && 'ring-orange-500/50',
                  )}
                >
                  {/* Ícono */}
                  <Icon
                    className={cn(
                      'w-3 h-3 sm:w-4 sm:h-4 transition-all duration-300',
                      isCompleted ? step.color : 'text-muted-foreground/40',
                      isCurrent && 'scale-110'
                    )}
                  />
                  
                  {/* Badge con contador */}
                  {hasItems && (
                    <div
                      className={cn(
                        'absolute -top-1 -right-1 rounded-full w-4 h-4 flex items-center justify-center',
                        'text-xs font-bold text-white shadow-md',
                        isCompleted ? `bg-gradient-to-r ${step.gradient}` : 'bg-muted-foreground/60'
                      )}
                    >
                      {count}
                    </div>
                  )}

                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-xs font-medium mt-1 text-center max-w-[60px]',
                    isCompleted ? step.color : 'text-muted-foreground/50'
                  )}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* Timeline principal con pasos grandes */}
      <div className="relative">
        {/* Línea de fondo - conecta puntos pero sin tocar los círculos */}
        <div 
          className="absolute top-6 sm:top-8 h-1 bg-muted rounded-full z-0"
          style={{ 
            left: 'calc(16.666% + 32px)', // Empieza después del primer círculo (ancho ~24px + padding)
            right: 'calc(16.666% + 32px)', // Termina antes del último círculo
          }} 
        />
        
        {/* Línea de progreso animada - conecta puntos sin tocar círculos */}
        {(() => {
          // Calcular cuánto conecta según pasos completados
          // Cada conexión es aproximadamente 33.333% menos los espacios de círculos
          const connectionWidth = 'calc(33.333% - 64px)' // Ancho entre círculos
          let progressWidth = '0%'
          const leftOffset = 'calc(16.666% + 32px)'
          
          if (completedSteps >= 1 && pendingItems === 0) {
            // Conecta del primer al segundo punto
            progressWidth = connectionWidth
          }
          if (completedSteps >= 2) {
            // Conecta del primer al tercer punto (2 conexiones)
            progressWidth = 'calc(66.666% - 64px)'
          }
          if (completedSteps >= 3) {
            // Conecta todo
            progressWidth = 'calc(66.666% - 64px)'
          }
          
          return progressWidth !== '0%' ? (
            <div 
              className={cn(
                "absolute top-6 sm:top-8 h-1 rounded-full transition-all duration-1000 ease-out z-10",
                "bg-gradient-to-r from-slate-400 via-orange-400 to-green-400"
              )}
              style={{ 
                left: leftOffset,
                width: progressWidth,
              }}
            />
          ) : null
        })()}

        {/* Pasos */}
        <div className="relative flex items-start justify-between">
          {STATUS_STEPS.map((step, index) => {
            const Icon = step.icon
            let count = 0
            if (step.key === 'pending') count = pendingItems
            if (step.key === 'preparing') count = preparingItems
            if (step.key === 'ready') count = readyItems

            const isCompleted = index < completedSteps
            const isCurrent = index === currentStepIndex && count > 0
            const hasItems = count > 0
            const stepProgress = index === 0 
              ? pendingPercent 
              : index === 1 
              ? preparingPercent 
              : readyPercent

            return (
              <div 
                key={step.key} 
                className="relative z-10 flex flex-col items-center flex-1"
              >
                {/* Círculo del paso con efecto glassmorphism */}
                <div
                  className={cn(
                    'relative rounded-full transition-all duration-700 ease-out',
                    'border-2 shadow-xl backdrop-blur-sm',
                    'p-3 sm:p-4 z-20', // z-20 para que siempre esté sobre la línea
                    isCompleted
                      ? `${step.activeBgColor} ${step.borderColor} border-opacity-100`
                      : 'bg-background/80 border-muted-foreground/30',
                    isCurrent && 'ring-4 ring-offset-2 animate-pulse z-30', // z-30 cuando está activo para estar siempre arriba
                    isCurrent && step.key === 'ready' && 'ring-green-500/30',
                    isCurrent && step.key === 'preparing' && 'ring-orange-500/30',
                    !isCompleted && !isCurrent && 'opacity-60',
                    isCompleted && 'scale-110 transform'
                  )}
                >
                  {/* Ícono grande */}
                  <Icon
                    className={cn(
                      'w-5 h-5 sm:w-6 sm:h-6 transition-all duration-500',
                      isCompleted ? step.color : 'text-muted-foreground/40',
                      isCurrent && 'scale-125 drop-shadow-md'
                    )}
                  />

                  {/* Badge flotante con contador */}
                  {hasItems && (
                    <div
                      className={cn(
                        'absolute -top-1 -right-1 rounded-full min-w-[20px] h-5 px-1.5',
                        'flex items-center justify-center text-xs font-bold text-white',
                        'shadow-lg animate-in zoom-in duration-300',
                        isCompleted 
                          ? `bg-gradient-to-br ${step.gradient}` 
                          : 'bg-muted-foreground/70'
                      )}
                    >
                      {count}
                    </div>
                  )}


                  {/* Efecto de brillo en estado actual - debe estar sobre todo */}
                  {isCurrent && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent animate-pulse z-40" />
                  )}
                </div>

                {/* Labels con mejor espaciado */}
                {showLabels && (
                  <div className="mt-3 sm:mt-4 text-center space-y-1 w-full">
                    <p
                      className={cn(
                        'text-xs sm:text-sm font-bold transition-colors duration-300',
                        isCompleted ? step.color : 'text-muted-foreground/50'
                      )}
                    >
                      {step.label}
                    </p>
                    <p
                      className={cn(
                        'text-xs font-semibold transition-colors',
                        isCompleted ? step.color : 'text-muted-foreground/40'
                      )}
                    >
                      {count} item{count !== 1 ? 's' : ''}
                    </p>
                    
                    {/* Barra de progreso individual del paso (opcional) */}
                    {isCurrent && stepProgress > 0 && (
                      <div className="w-full max-w-[80px] mx-auto mt-1.5">
                        <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-700',
                              `bg-gradient-to-r ${step.gradient}`
                            )}
                            style={{ width: `${stepProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Barra de progreso general mejorada */}
      <div className="space-y-2">
        <div className="relative h-3 sm:h-4 bg-muted rounded-full overflow-hidden shadow-inner">
          {/* Segmentos de progreso con gradient */}
          {pendingPercent > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-slate-400 to-slate-500 transition-all duration-700 ease-out"
              style={{ width: `${pendingPercent}%` }}
            />
          )}
          {preparingPercent > 0 && (
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-700 ease-out"
              style={{
                left: `${pendingPercent}%`,
                width: `${preparingPercent}%`,
              }}
            />
          )}
          {readyPercent > 0 && (
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-green-400 to-green-500 transition-all duration-700 ease-out"
              style={{
                left: `${pendingPercent + preparingPercent}%`,
                width: `${readyPercent}%`,
              }}
            />
          )}
          
          {/* Indicador de porcentaje */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs sm:text-sm font-black text-foreground bg-background/90 px-2 py-0.5 rounded-full shadow-sm">
              {Math.round(overallProgress)}%
            </span>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
          <span>
            {readyItems}/{totalItems} completado{readyItems !== 1 ? 's' : ''}
          </span>
          {!isComplete && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {preparingItems + pendingItems} pendiente{(preparingItems + pendingItems) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Mensaje de estado mejorado con animación */}
      {isComplete && (
        <div 
          className={cn(
            "flex items-center justify-center gap-2 sm:gap-3",
            "bg-gradient-to-r from-green-50 to-emerald-50",
            "border-2 border-green-300 rounded-xl p-3 sm:p-4",
            "shadow-lg animate-in slide-in-from-bottom-4 duration-500"
          )}
        >
          <div>
            <p className="text-sm sm:text-base font-black text-green-900">
              ¡Tu pedido está listo!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Todos los items han sido preparados
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
