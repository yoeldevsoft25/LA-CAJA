import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ZoomIn, ZoomOut, RotateCcw, User, UtensilsCrossed, SprayCan, Clock, Ban, Footprints, Info } from 'lucide-react'
import { tablesService, Table } from '@/services/tables.service'
import { ordersService, Order } from '@/services/orders.service'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from '@/lib/toast'

interface FloorPlanViewProps {
  onTableClick: (table: Table) => void
  onCreateOrder: (tableId: string | null) => void
}

const TABLE_SIZE = 80 // Increased size for better detail
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1

// Helpers para renderizado de sillas
const getChairPositions = (capacity: number = 4) => {
  const chairs = []
  const halfSize = TABLE_SIZE / 2
  const offset = 8 // Distancia desde la mesa

  // Distribución basada en lados
  const sideCapacity = Math.ceil(capacity / 4)

  // Top
  for (let i = 0; i < sideCapacity; i++) {
    chairs.push({
      x: (TABLE_SIZE / (sideCapacity + 1)) * (i + 1) - halfSize,
      y: -halfSize - offset
    })
  }
  // Right
  for (let i = 0; i < sideCapacity; i++) {
    if (chairs.length >= capacity) break
    chairs.push({
      x: halfSize + offset,
      y: (TABLE_SIZE / (sideCapacity + 1)) * (i + 1) - halfSize
    })
  }
  // Bottom
  for (let i = 0; i < sideCapacity; i++) {
    if (chairs.length >= capacity) break
    chairs.push({
      x: (TABLE_SIZE / (sideCapacity + 1)) * (i + 1) - halfSize,
      y: halfSize + offset
    })
  }
  // Left
  for (let i = 0; i < sideCapacity; i++) {
    if (chairs.length >= capacity) break
    chairs.push({
      x: -halfSize - offset,
      y: (TABLE_SIZE / (sideCapacity + 1)) * (i + 1) - halfSize
    })
  }

  return chairs
}

export default function FloorPlanView({
  onTableClick,
  onCreateOrder: _onCreateOrder,
}: FloorPlanViewProps) {
  const queryClient = useQueryClient()
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 50, y: 50 })
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
      // toast.success('Posición actualizada') // Sutil, no molestar tanto
    },
    onError: () => {
      toast.error('Error al actualizar la posición')
    },
  })

  const getTableOrder = useCallback((tableId: string | null) => {
    if (!tableId || !openOrders) return null
    return openOrders.find((o: Order) => o.table_id === tableId && o.status === 'open')
  }, [openOrders])

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

      const newX = Math.round(Math.max(0, Math.min(point.x - dragOffset.x, 3000)))
      const newY = Math.round(Math.max(0, Math.min(point.y - dragOffset.y, 3000)))

      const table = tables?.find((t) => t.id === dragging)
      if (table) {
        queryClient.setQueryData(['tables'], (old: Table[] | undefined) => {
          if (!old) return old
          return old.map((t) =>
            t.id === dragging
              ? { ...t, coordinates: { ...t.coordinates, x: newX, y: newY } }
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
      setTimeout(() => {
        setDragging(null)
        dragStartPos.current = null
      }, 50)
    }
    setIsPanning(false)
  }, [dragging, tables, updateTableMutation])

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Permitir paneo también con botón central o manteniendo espacio (si implementáramos key listeners)
    // Por ahora solo click en fondo
    if (e.target !== svgRef.current) return
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
  }

  const resetView = () => {
    setZoom(0.8)
    setPan({ x: 50, y: 50 })
  }

  // Inicializar coordenadas si faltan
  useEffect(() => {
    if (!tables) return
    const tablesWithoutCoords = tables.filter(
      (t) => !t.coordinates && t.status !== 'out_of_service'
    )
    if (tablesWithoutCoords.length > 0) {
      const cols = Math.ceil(Math.sqrt(tablesWithoutCoords.length))
      tablesWithoutCoords.forEach((table, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        const x = col * (TABLE_SIZE + 100) + 150
        const y = row * (TABLE_SIZE + 100) + 150
        updateTableMutation.mutate({
          id: table.id,
          data: { coordinates: { x, y } },
        })
      })
    }
  }, [tables])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
          <UtensilsCrossed className="w-10 h-10 opacity-50" />
          <p>Preparando salón...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[650px] border rounded-2xl overflow-hidden bg-slate-50/50">
      {/* Grid Pattern Sutil */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      {/* Controles Flotantes */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 shadow-2xl rounded-2xl overflow-hidden bg-white border border-slate-100 p-1.5">
        <Button variant="ghost" size="icon" onClick={() => handleZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} className="h-10 w-10 text-slate-600 rounded-xl hover:bg-slate-50">
          <ZoomIn className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} className="h-10 w-10 text-slate-600 rounded-xl hover:bg-slate-50">
          <ZoomOut className="w-5 h-5" />
        </Button>
        <div className="w-full h-px bg-slate-100 my-0.5" />
        <Button variant="ghost" size="icon" onClick={resetView} className="h-10 w-10 text-primary rounded-xl hover:bg-primary/5">
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={cn("w-full h-full", isPanning ? "cursor-grabbing" : "cursor-grab")}
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault()
            handleZoom(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
          }
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

          {tables?.filter((t) => t.coordinates && t.status !== 'out_of_service').map((table) => {
            const order = getTableOrder(table.id)
            const type = table.coordinates?.type || 'table'
            const chairs = type === 'table' ? getChairPositions(table.capacity || 4) : []
            const isSelected = dragging === table.id
            const x = table.coordinates!.x
            const y = table.coordinates!.y

            // Logic per type
            if (type === 'bar') {
              const barWidth = TABLE_SIZE * 2
              const barHeight = TABLE_SIZE * 0.8
              const stoolCount = table.capacity || 4 // Default if no capacity set

              // Generate stools
              const stools = []
              for (let i = 0; i < stoolCount; i++) {
                stools.push({
                  x: (barWidth / (stoolCount + 1)) * (i + 1) - barWidth / 2,
                  y: barHeight / 2 + 10
                })
              }

              return (
                <g key={table.id} transform={`translate(${x}, ${y})`}
                  className={cn('cursor-pointer transition-opacity', isSelected ? 'opacity-70 cursor-grabbing' : 'hover:opacity-100')}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  onClick={(e) => { e.stopPropagation(); if (dragging !== table.id) onTableClick(table); }}>

                  {/* Stools (White as requested) */}
                  {stools.map((chair, i) => (
                    <circle key={i} cx={chair.x} cy={chair.y} r={7} className="fill-white stroke-slate-300 stroke-1 shadow-sm" />
                  ))}

                  {/* Bar Counter (Blanca Blanca as requested) */}
                  <rect x={-barWidth / 2} y={-barHeight / 2} width={barWidth} height={barHeight} rx={8}
                    className="fill-white stroke-slate-200 stroke-2 drop-shadow-xl" />

                  {/* Inner Detail - Subtle differentiation */}
                  <rect x={-barWidth / 2 + 5} y={-barHeight / 2 + 5} width={barWidth - 10} height={barHeight - 10} rx={4}
                    className="fill-slate-50/50 stroke-none" />

                  <foreignObject x={-barWidth / 2} y={-barHeight / 2} width={barWidth} height={barHeight} className="pointer-events-none">
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                      <span className="text-xs font-black uppercase tracking-widest">{table.table_number}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            }

            if (type === 'corridor') {
              return (
                <g key={table.id} transform={`translate(${x}, ${y})`}
                  className={cn('cursor-pointer transition-opacity', isSelected ? 'opacity-50 grayscale' : 'hover:opacity-80')}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  onClick={(e) => { e.stopPropagation(); if (dragging !== table.id) onTableClick(table); }}>
                  <rect x={-TABLE_SIZE / 2} y={-TABLE_SIZE / 2} width={TABLE_SIZE} height={TABLE_SIZE} rx={12}
                    className="fill-slate-100/40 stroke-slate-300 stroke-2" strokeDasharray="6 4" />
                  <foreignObject x={-TABLE_SIZE / 2} y={-TABLE_SIZE / 2} width={TABLE_SIZE} height={TABLE_SIZE} className="pointer-events-none">
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                      <Footprints className="w-8 h-8 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-500 mt-1 uppercase tracking-tighter">Pasillo</span>
                    </div>
                  </foreignObject>
                </g>
              )
            }

            if (type === 'wall') {
              return (
                <g key={table.id} transform={`translate(${x}, ${y})`}
                  className={cn('cursor-pointer', isSelected && 'opacity-50')}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  onClick={(e) => { e.stopPropagation(); if (dragging !== table.id) onTableClick(table); }}>
                  <rect x={-TABLE_SIZE / 2} y={-6} width={TABLE_SIZE} height={12} rx={6}
                    className="fill-slate-400/80 stroke-slate-500 stroke-1" />
                  <text y={24} textAnchor="middle" className="fill-slate-400 text-[9px] font-black uppercase tracking-widest">{table.table_number}</text>
                </g>
              )
            }

            if (type === 'zone') {
              return (
                <g key={table.id} transform={`translate(${x}, ${y})`}
                  className={cn('cursor-pointer', isSelected && 'opacity-50')}
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                  onClick={(e) => { e.stopPropagation(); if (dragging !== table.id) onTableClick(table); }}>
                  <rect x={-TABLE_SIZE / 2} y={-18} width={TABLE_SIZE} height={36} rx={18}
                    className="fill-primary/5 stroke-primary/30 stroke-1" strokeDasharray="3 3" />
                  <foreignObject x={-TABLE_SIZE / 2} y={-18} width={TABLE_SIZE} height={36} className="pointer-events-none">
                    <div className="w-full h-full flex items-center justify-center">
                      <Info className="w-3 h-3 text-primary/40 mr-1" />
                      <span className="fill-primary/60 font-black text-[11px] uppercase tracking-widest">
                        {table.table_number}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            }

            // Default: Table
            // Unified 'White White' Aesthetic
            let tableFill = "fill-white"
            let tableStroke = "stroke-slate-200"
            let tableShadow = "drop-shadow-xl"
            let statusIcon = null

            if (order || table.status === 'occupied') {
              tableStroke = "stroke-primary"
              statusIcon = <UtensilsCrossed className="w-6 h-6 text-primary" />
            } else if (table.status === 'reserved') {
              tableStroke = "stroke-amber-400"
              statusIcon = <Clock className="w-6 h-6 text-amber-500" />
            } else if (table.status === 'cleaning') {
              tableStroke = "stroke-blue-400"
              statusIcon = <SprayCan className="w-6 h-6 text-blue-500" />
            } else if (table.status === 'out_of_service') {
              // Slight differentiation for out of service, but keeping it very light/white
              tableFill = "fill-slate-50"
              tableStroke = "stroke-slate-200"
              statusIcon = <Ban className="w-6 h-6 text-slate-300" />
            }

            return (
              <g
                key={table.id}
                transform={`translate(${x}, ${y})`}
                className={cn(
                  'cursor-pointer transition-opacity duration-200',
                  isSelected ? 'opacity-70 cursor-grabbing' : 'hover:opacity-100'
                )}
                onMouseDown={(e) => handleTableMouseDown(e, table)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (dragStartPos.current) {
                    const dist = Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y)
                    if (dist > 5) return
                  }
                  if (dragging !== table.id) onTableClick(table)
                }}
              >
                {/* Sombra suave de elevación (Pre-calculated or generic) */}
                <rect
                  x={-TABLE_SIZE / 2 + 4}
                  y={-TABLE_SIZE / 2 + 4}
                  width={TABLE_SIZE}
                  height={TABLE_SIZE}
                  rx={24}
                  className="fill-black/5 stroke-none"
                />

                {/* Sillas (Unified White Style) */}
                {chairs.map((chair, i) => (
                  <circle
                    key={i}
                    cx={chair.x}
                    cy={chair.y}
                    r={6}
                    className={cn(
                      "stroke-1 transition-colors shadow-sm",
                      order ? "fill-white stroke-primary" : "fill-white stroke-slate-300"
                    )}
                  />
                ))}

                {/* Mesa Principal */}
                <rect
                  x={-TABLE_SIZE / 2}
                  y={-TABLE_SIZE / 2}
                  width={TABLE_SIZE}
                  height={TABLE_SIZE}
                  rx={20}
                  className={cn(
                    "stroke-[3px] transition-colors duration-300",
                    tableFill,
                    tableStroke,
                    tableShadow,
                    isSelected && "stroke-primary"
                  )}
                />

                {/* Contenido Central */}
                <foreignObject x={-TABLE_SIZE / 2} y={-TABLE_SIZE / 2} width={TABLE_SIZE} height={TABLE_SIZE} className="pointer-events-none">
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    {statusIcon ? (
                      <div className="mb-1">{statusIcon}</div>
                    ) : (
                      <div className="mb-1 text-slate-300">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    <span className={cn(
                      "font-black text-lg leading-none",
                      order ? "text-primary" : "text-slate-600"
                    )}>
                      {table.table_number}
                    </span>
                    {table.zone && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 max-w-[90%] truncate">
                        {table.zone}
                      </span>
                    )}
                  </div>
                </foreignObject>

                {/* Badge de Orden Activa */}
                {order && (
                  <g transform={`translate(${TABLE_SIZE / 2 - 12}, ${-TABLE_SIZE / 2 + 12})`}>
                    <circle r={10} className="fill-red-500 stroke-white stroke-2" />
                    <text textAnchor="middle" dy={3} className="fill-white text-[10px] font-black pointer-events-none">
                      $
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-md rounded-2xl p-4 border border-slate-100 shadow-xl">
        <div className="flex flex-col gap-3 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white border border-slate-300 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-400" />
            </div>
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white border border-primary flex items-center justify-center">
              <UtensilsCrossed className="w-3 h-3 text-primary" />
            </div>
            <span>Ocupada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-400 flex items-center justify-center">
              <Clock className="w-3 h-3 text-amber-500" />
            </div>
            <span>Reservada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-400 flex items-center justify-center">
              <SprayCan className="w-3 h-3 text-blue-500" />
            </div>
            <span>Limpieza</span>
          </div>
          <div className="w-full h-px bg-slate-100 my-1" />
          <div className="flex items-center gap-2 opacity-60">
            <div className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-300 border-dashed flex items-center justify-center">
              <Footprints className="w-3 h-3 text-slate-400" />
            </div>
            <span>Pasillo</span>
          </div>
          <div className="flex items-center gap-2 opacity-60">
            <div className="w-6 h-6 rounded-sm bg-slate-400 flex items-center justify-center" />
            <span>Muro</span>
          </div>
        </div>
      </div>
    </div>
  )
}
