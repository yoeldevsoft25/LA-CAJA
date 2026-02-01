import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Square, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { tablesService, Table } from '@/services/tables.service'
import { ordersService, Order } from '@/services/orders.service'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from '@/lib/toast'

interface FloorPlanViewProps {
  onTableClick: (table: Table) => void
  onCreateOrder: (tableId: string | null) => void
}

const TABLE_SIZE = 60
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

export default function FloorPlanView({
  onTableClick,
  onCreateOrder: _onCreateOrder, // TODO: Implementar funcionalidad de crear orden
}: FloorPlanViewProps) {
  const queryClient = useQueryClient()
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesService.getTablesByStore(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const { data: openOrders } = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => ordersService.getOpenOrders(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const updateTableMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { coordinates: { x: number; y: number } } }) =>
      tablesService.updateTable(id, { coordinates: data.coordinates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Posición actualizada')
    },
    onError: () => {
      toast.error('Error al actualizar la posición')
    },
  })

  const getTableOrder = (tableId: string | null) => {
    if (!tableId || !openOrders) return null
    return openOrders.find((o: Order) => o.table_id === tableId && o.status === 'open')
  }

  const getTableStatusColor = (table: Table) => {
    const order = getTableOrder(table.id)
    if (order) return 'fill-primary'
    if (table.status === 'occupied') return 'fill-primary'
    if (table.status === 'reserved') return 'fill-yellow-500'
    if (table.status === 'cleaning') return 'fill-blue-500'
    if (table.status === 'out_of_service') return 'fill-destructive'
    return 'fill-green-500'
  }

  const handleTableMouseDown = useCallback(
    (e: React.MouseEvent, table: Table) => {
      e.stopPropagation()
      if (!table.coordinates) return

      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const point = svg.createSVGPoint()
      point.x = (e.clientX - rect.left - pan.x) / zoom
      point.y = (e.clientY - rect.top - pan.y) / zoom

      // Guardar posición inicial del mouse
      dragStartPos.current = { x: e.clientX, y: e.clientY }
      setDragging(table.id)
      setDragOffset({
        x: point.x - table.coordinates.x,
        y: point.y - table.coordinates.y,
      })
    },
    [pan, zoom]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - panStart.x
        const deltaY = e.clientY - panStart.y
        setPan((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }))
        setPanStart({ x: e.clientX, y: e.clientY })
        return
      }

      if (!dragging) return

      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const point = svg.createSVGPoint()
      point.x = (e.clientX - rect.left - pan.x) / zoom
      point.y = (e.clientY - rect.top - pan.y) / zoom

      const newX = Math.max(0, Math.min(point.x - dragOffset.x, 2000))
      const newY = Math.max(0, Math.min(point.y - dragOffset.y, 2000))

      const table = tables?.find((t) => t.id === dragging)
      if (table) {
        // Actualizar coordenadas localmente (optimistic update)
        queryClient.setQueryData(['tables'], (old: Table[] | undefined) => {
          if (!old) return old
          return old.map((t) =>
            t.id === dragging
              ? { ...t, coordinates: { x: newX, y: newY } }
              : t
          )
        })
      }
    },
    [dragging, dragOffset, pan, zoom, isPanning, panStart, tables, queryClient]
  )

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      const table = tables?.find((t) => t.id === dragging)
      if (table?.coordinates) {
        updateTableMutation.mutate({
          id: dragging,
          data: { coordinates: table.coordinates },
        })
      }
      // Resetear después de un pequeño delay para prevenir el onClick
      setTimeout(() => {
        setDragging(null)
        dragStartPos.current = null
      }, 100)
    }
    setIsPanning(false)
  }, [dragging, tables, updateTableMutation])

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Solo botón izquierdo
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Inicializar coordenadas para mesas sin coordenadas
  useEffect(() => {
    if (!tables) return

    const tablesWithoutCoords = tables.filter(
      (t) => !t.coordinates && t.status !== 'out_of_service'
    )

    if (tablesWithoutCoords.length > 0) {
      // Distribuir mesas en una cuadrícula
      const cols = Math.ceil(Math.sqrt(tablesWithoutCoords.length))
      tablesWithoutCoords.forEach((table, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        const x = col * (TABLE_SIZE + 40) + 100
        const y = row * (TABLE_SIZE + 40) + 100

        updateTableMutation.mutate({
          id: table.id,
          data: { coordinates: { x, y } },
        })
      })
    }
  }, [tables, updateTableMutation])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Cargando plano...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[600px] border rounded-lg overflow-hidden bg-muted/20">
      {/* Controles de zoom */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 border shadow-lg">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleZoom(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleZoom(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={resetView}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Grid de fondo */}
          <defs>
            <pattern
              id="grid"
              width={50}
              height={50}
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground/20"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Mesas */}
          {tables
            ?.filter((t) => t.coordinates && t.status !== 'out_of_service')
            .map((table) => {
              const order = getTableOrder(table.id)
              const x = table.coordinates!.x
              const y = table.coordinates!.y

              return (
                <g
                  key={table.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    dragging === table.id && 'opacity-50'
                  )}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  onClick={(e) => {
                    e.stopPropagation()
                    // Solo llamar onTableClick si no se ha arrastrado
                    // Verificar si hubo movimiento significativo (>5px)
                    if (dragStartPos.current) {
                      const deltaX = Math.abs(e.clientX - dragStartPos.current.x)
                      const deltaY = Math.abs(e.clientY - dragStartPos.current.y)
                      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
                      if (distance > 5) {
                        // Se arrastró, no hacer click
                        return
                      }
                    }
                    // Solo si la mesa no está siendo arrastrada actualmente
                    if (dragging !== table.id) {
                      onTableClick(table)
                    }
                  }}
                >
                  {/* Mesa */}
                  <rect
                    x={x - TABLE_SIZE / 2}
                    y={y - TABLE_SIZE / 2}
                    width={TABLE_SIZE}
                    height={TABLE_SIZE}
                    rx={8}
                    className={cn(
                      getTableStatusColor(table),
                      'stroke-2 stroke-background',
                      dragging === table.id && 'cursor-grabbing'
                    )}
                    opacity={0.8}
                  />

                  {/* Número de mesa */}
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-background font-bold text-sm pointer-events-none"
                  >
                    {table.table_number}
                  </text>

                  {/* Badge de orden */}
                  {order && (
                    <circle
                      cx={x + TABLE_SIZE / 2 - 8}
                      cy={y - TABLE_SIZE / 2 + 8}
                      r={8}
                      className="fill-primary"
                    />
                  )}

                  {/* Zona */}
                  {table.zone && (
                    <text
                      x={x}
                      y={y + TABLE_SIZE / 2 + 15}
                      textAnchor="middle"
                      className="fill-muted-foreground text-xs pointer-events-none"
                    >
                      {table.zone}
                    </text>
                  )}
                </g>
              )
            })}
        </g>
      </svg>

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 fill-green-500" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 fill-primary" />
            <span>Ocupada</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 fill-yellow-500" />
            <span>Reservada</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 fill-blue-500" />
            <span>Limpieza</span>
          </div>
        </div>
      </div>
    </div>
  )
}
