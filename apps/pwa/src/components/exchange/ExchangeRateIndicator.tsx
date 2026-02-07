import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, TrendingUp, Clock, Wifi, WifiOff, ChevronDown, Settings } from 'lucide-react'
import { exchangeService } from '@la-caja/app-core'
import { useOnline } from '@/hooks/use-online'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ExchangeRateIndicatorProps {
  /** Mostrar versión compacta (solo tasa) */
  compact?: boolean
  /** Clase CSS adicional */
  className?: string
}

/**
 * Indicador de tasa de cambio BCV para mostrar en el header/navbar.
 * Muestra la tasa actual, última actualización y permite refrescar.
 */
export default function ExchangeRateIndicator({
  compact = false,
  className,
}: ExchangeRateIndicatorProps) {
  const { isOnline } = useOnline()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Obtener tasa BCV actual (con cache offline-first)
  const { data: bcvData, isLoading, isFetching } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  // Obtener todas las tasas (para el popover expandido)
  const { data: allRatesData } = useQuery({
    queryKey: ['exchange', 'all-rates'],
    queryFn: () => exchangeService.getAllRates(),
    staleTime: 1000 * 60 * 30,
    gcTime: Infinity,
    refetchOnMount: false,
    enabled: !compact,
  })

  // Manejar refresh manual
  const handleRefresh = async () => {
    if (!isOnline || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['exchange'] })
      await exchangeService.getBCVRate(true) // Force refresh
    } catch (error) {
      console.error('Error al refrescar tasa:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const rate = bcvData?.rate
  const timestamp = bcvData?.timestamp
  const source = bcvData?.source

  // Formatear tiempo transcurrido
  const getTimeAgo = (isoDate: string | null) => {
    if (!isoDate) return 'Desconocido'
    try {
      return formatDistanceToNow(new Date(isoDate), { addSuffix: true, locale: es })
    } catch {
      return 'Desconocido'
    }
  }

  // Estado visual
  const isLoaded = rate !== null && rate !== undefined
  const isStale = timestamp && (Date.now() - new Date(timestamp).getTime() > 1000 * 60 * 60 * 2) // > 2 horas

  // Versión compacta (para espacios reducidos)
  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                isLoaded
                  ? isStale
                    ? 'bg-warning/10 text-warning'
                    : 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground',
                className
              )}
            >
              {isOnline ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span>
                {isLoading ? '...' : rate ? `${rate.toFixed(2)} Bs` : '--'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs">
              <p className="font-semibold">Tasa BCV</p>
              {timestamp && (
                <p className="text-muted-foreground">
                  Actualizado {getTimeAgo(timestamp)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Versión completa con popover
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2 h-9 px-3 font-medium',
            isLoaded
              ? isStale
                ? 'text-warning hover:text-warning'
                : 'text-foreground'
              : 'text-muted-foreground',
            className
          )}
        >
          {/* Indicador de conexión */}
          <div className="relative">
            {isOnline ? (
              <TrendingUp className={cn(
                'w-4 h-4',
                isStale ? 'text-warning' : 'text-success'
              )} />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            {(isFetching || isRefreshing) && (
              <RefreshCw className="w-3 h-3 absolute -top-1 -right-1 animate-spin text-primary" />
            )}
          </div>

          {/* Tasa */}
          <span className="tabular-nums">
            {isLoading ? '...' : rate ? `${rate.toFixed(2)}` : '--'}
          </span>
          <span className="text-muted-foreground text-xs">Bs/$</span>

          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Tasa de Cambio</p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? 'Conectado' : 'Sin conexión (modo offline)'}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                source === 'api'
                  ? 'bg-success/10 text-success border-success/30'
                  : 'bg-warning/10 text-warning border-warning/30'
              )}
            >
              {source === 'api' ? 'BCV' : source === 'manual' ? 'Manual' : 'Cache'}
            </Badge>
          </div>
        </div>

        {/* Tasa Principal */}
        <div className="px-4 py-4">
          <div className="text-center mb-4">
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {rate?.toFixed(2) || '--'} <span className="text-lg text-muted-foreground">Bs/$</span>
            </p>
            {timestamp && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                {getTimeAgo(timestamp)}
              </p>
            )}
          </div>

          {/* Otras tasas disponibles */}
          {allRatesData?.rates && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Otras Tasas
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {allRatesData.rates.parallel && (
                    <RateItem
                      label="Paralelo"
                      value={allRatesData.rates.parallel}
                    />
                  )}
                  {allRatesData.rates.cash && (
                    <RateItem
                      label="Efectivo"
                      value={allRatesData.rates.cash}
                    />
                  )}
                  {allRatesData.rates.zelle && (
                    <RateItem
                      label="Zelle"
                      value={allRatesData.rates.zelle}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleRefresh}
              disabled={!isOnline || isRefreshing || isFetching}
            >
              <RefreshCw
                className={cn(
                  'w-3.5 h-3.5 mr-1.5',
                  (isRefreshing || isFetching) && 'animate-spin'
                )}
              />
              Actualizar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Configurar tasas</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {!isOnline && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Reconecta a internet para actualizar
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Componente auxiliar para mostrar una tasa individual */
function RateItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value.toFixed(2)}</span>
    </div>
  )
}
