import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import { realtimeWebSocketService } from '@/services/realtime-websocket.service'
import { SalesHeatmapData } from '@/types/realtime-analytics.types'
import { format } from 'date-fns'

export function useSalesHeatmap(startDate: Date, endDate: Date) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  const startDateStr = format(startDate, 'yyyy-MM-dd')
  const endDateStr = format(endDate, 'yyyy-MM-dd')

  // Obtener heatmap inicial desde API REST
  const {
    data: heatmapData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sales-heatmap', startDateStr, endDateStr],
    queryFn: () =>
      realtimeAnalyticsService.getSalesHeatmap(startDateStr, endDateStr),
    staleTime: 1000 * 60 * 2, // 2 minutos - más frecuente porque es rápido con vistas materializadas
  })

  // Estado local para datos actualizados vía WebSocket
  const [data, setData] = useState<SalesHeatmapData[]>(
    heatmapData?.data || [],
  )

  // Callback para actualizaciones de heatmap
  const handleHeatmapUpdate = useCallback((updatedData: SalesHeatmapData[]) => {
    setData(updatedData)

    // Actualizar cache
    queryClient.setQueryData(
      ['sales-heatmap', startDateStr, endDateStr],
      (old: any) => {
        if (!old) {
          return {
            data: updatedData,
            date_range: {
              start_date: startDateStr,
              end_date: endDateStr,
            },
          }
        }
        return {
          ...old,
          data: updatedData,
        }
      },
    )
  }, [startDateStr, endDateStr, queryClient])

  // Conectar WebSocket
  useEffect(() => {
    realtimeWebSocketService.connect()

    const checkConnection = setInterval(() => {
      setIsConnected(realtimeWebSocketService.connected)
    }, 1000)

    const unsubscribe = realtimeWebSocketService.onHeatmapUpdate(handleHeatmapUpdate)

    return () => {
      clearInterval(checkConnection)
      unsubscribe()
    }
  }, [handleHeatmapUpdate])

  // Actualizar datos cuando cambian los datos iniciales
  useEffect(() => {
    if (heatmapData?.data) {
      setData(heatmapData.data)
    }
  }, [heatmapData])

  return {
    data,
    dateRange: heatmapData?.date_range,
    isLoading,
    error,
    isConnected,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ['sales-heatmap'] }),
  }
}


