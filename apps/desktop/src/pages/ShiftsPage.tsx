import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { shiftsService, ShiftSummary } from '@/services/shifts.service'
import toast from '@/lib/toast'
import OpenShiftModal from '@/components/shifts/OpenShiftModal'
import CloseShiftModal from '@/components/shifts/CloseShiftModal'
import CutXModal from '@/components/shifts/CutXModal'
import CutZModal from '@/components/shifts/CutZModal'
import CurrentShiftCard from '@/components/shifts/CurrentShiftCard'
import ShiftsList from '@/components/shifts/ShiftsList'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ShiftsPage() {
  const queryClient = useQueryClient()
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [isCutXModalOpen, setIsCutXModalOpen] = useState(false)
  const [isCutZModalOpen, setIsCutZModalOpen] = useState(false)
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)

  // Obtener turno actual
  const {
    data: currentShift,
    isLoading: isLoadingCurrent,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ['shifts', 'current'],
    queryFn: () => shiftsService.getCurrentShift(),
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: Infinity,
    refetchInterval: 30000, // Refrescar cada 30 segundos
    refetchOnMount: false,
  })

  // Obtener resumen si hay turno abierto
  const {
    data: shiftSummary,
    isLoading: isLoadingSummary,
  } = useQuery<ShiftSummary>({
    queryKey: ['shifts', 'summary', currentShift?.id],
    queryFn: () => shiftsService.getShiftSummary(currentShift!.id),
    enabled: !!currentShift?.id,
    refetchInterval: 30000,
  })

  // Mutación para abrir turno
  const openMutation = useMutation({
    mutationFn: shiftsService.openShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Turno abierto correctamente')
      setIsOpenModalOpen(false)
      refetchCurrent()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al abrir el turno')
    },
  })

  // Mutación para cerrar turno
  const closeMutation = useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: string; data: any }) =>
      shiftsService.closeShift(shiftId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Turno cerrado correctamente')
      setIsCloseModalOpen(false)
      setSelectedShiftId(null)
      refetchCurrent()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cerrar el turno')
    },
  })

  // Mutación para crear corte X
  const cutXMutation = useMutation({
    mutationFn: (shiftId: string) => shiftsService.createCutX(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Corte X generado correctamente')
      setIsCutXModalOpen(false)
      refetchCurrent()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al generar el corte X')
    },
  })

  // Mutación para crear corte Z
  const cutZMutation = useMutation({
    mutationFn: (shiftId: string) => shiftsService.createCutZ(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Corte Z generado correctamente')
      setIsCutZModalOpen(false)
      refetchCurrent()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al generar el corte Z')
    },
  })

  const handleOpenShift = () => {
    setIsOpenModalOpen(true)
  }

  const handleCloseShift = () => {
    if (!currentShift) return
    setSelectedShiftId(currentShift.id)
    setIsCloseModalOpen(true)
  }

  const handleCreateCutX = () => {
    if (!currentShift) return
    setIsCutXModalOpen(true)
  }

  const handleCreateCutZ = () => {
    if (!currentShift) return
    setIsCutZModalOpen(true)
  }

  if (isLoadingCurrent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Turnos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Control y seguimiento de turnos de cajeros con cortes X y Z
          </p>
        </div>
        {!currentShift && (
          <Button onClick={handleOpenShift} size="lg">
            <Clock className="w-5 h-5 mr-2" />
            Abrir Turno
          </Button>
        )}
      </div>

      {/* Turno actual */}
      <CurrentShiftCard
        shift={currentShift || null}
        shiftSummary={shiftSummary || null}
        isLoading={isLoadingSummary}
        onCloseShift={handleCloseShift}
        onCreateCutX={handleCreateCutX}
        onCreateCutZ={handleCreateCutZ}
      />

      {/* Historial de turnos */}
      <ShiftsList />

      {/* Modales */}
      <OpenShiftModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onConfirm={(data) => openMutation.mutate(data)}
        isLoading={openMutation.isPending}
      />

      {selectedShiftId && currentShift && shiftSummary && (
        <CloseShiftModal
          isOpen={isCloseModalOpen}
          onClose={() => {
            setIsCloseModalOpen(false)
            setSelectedShiftId(null)
          }}
          shift={currentShift}
          shiftSummary={shiftSummary}
          onConfirm={(data) =>
            closeMutation.mutate({
              shiftId: selectedShiftId,
              data,
            })
          }
          isLoading={closeMutation.isPending}
        />
      )}

      {currentShift && (
        <>
          <CutXModal
            isOpen={isCutXModalOpen}
            onClose={() => setIsCutXModalOpen(false)}
            shift={currentShift}
            onConfirm={() => cutXMutation.mutate(currentShift.id)}
            isLoading={cutXMutation.isPending}
          />

          <CutZModal
            isOpen={isCutZModalOpen}
            onClose={() => setIsCutZModalOpen(false)}
            shift={currentShift}
            onConfirm={() => cutZMutation.mutate(currentShift.id)}
            isLoading={cutZMutation.isPending}
          />
        </>
      )}
    </div>
  )
}

