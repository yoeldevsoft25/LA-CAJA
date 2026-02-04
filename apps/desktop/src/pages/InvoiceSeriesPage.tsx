import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Edit, Trash2, RotateCcw, CheckCircle, XCircle } from 'lucide-react'
import {
  invoiceSeriesService,
  InvoiceSeries,
  CreateInvoiceSeriesRequest,
  UpdateInvoiceSeriesRequest,
} from '@/services/invoice-series.service'
import toast from '@/lib/toast'
import InvoiceSeriesModal from '@/components/invoice-series/InvoiceSeriesModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export default function InvoiceSeriesPage() {
  const queryClient = useQueryClient()
  const [selectedSeries, setSelectedSeries] = useState<InvoiceSeries | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [seriesToDelete, setSeriesToDelete] = useState<InvoiceSeries | null>(null)
  const [seriesToReset, setSeriesToReset] = useState<InvoiceSeries | null>(null)
  const [resetNumber, setResetNumber] = useState<number>(1)

  const { data: series, isLoading } = useQuery({
    queryKey: ['invoice-series'],
    queryFn: () => invoiceSeriesService.getSeriesByStore(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceSeriesRequest) => invoiceSeriesService.createSeries(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-series'] })
      toast.success('Serie creada correctamente')
      setIsModalOpen(false)
      setSelectedSeries(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la serie')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceSeriesRequest }) =>
      invoiceSeriesService.updateSeries(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-series'] })
      toast.success('Serie actualizada correctamente')
      setIsModalOpen(false)
      setSelectedSeries(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar la serie')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoiceSeriesService.deleteSeries(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-series'] })
      toast.success('Serie eliminada correctamente')
      setSeriesToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar la serie')
    },
  })

  const resetMutation = useMutation({
    mutationFn: ({ id, newNumber }: { id: string; newNumber: number }) =>
      invoiceSeriesService.resetSeriesNumber(id, newNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-series'] })
      toast.success('Consecutivo reiniciado correctamente')
      setSeriesToReset(null)
      setResetNumber(1)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al reiniciar el consecutivo')
    },
  })

  const handleEdit = (series: InvoiceSeries) => {
    setSelectedSeries(series)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedSeries(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateInvoiceSeriesRequest | UpdateInvoiceSeriesRequest) => {
    if (selectedSeries) {
      updateMutation.mutate({ id: selectedSeries.id, data: data as UpdateInvoiceSeriesRequest })
    } else {
      createMutation.mutate(data as CreateInvoiceSeriesRequest)
    }
  }

  const formatInvoiceNumber = (series: InvoiceSeries) => {
    const numberStr = String(series.current_number).padStart(6, '0')
    if (series.prefix) {
      return `${series.prefix}-${series.series_code}-${numberStr}`
    }
    return `${series.series_code}-${numberStr}`
  }

  const formatNextNumber = (series: InvoiceSeries) => {
    const nextNumber = series.current_number + 1
    const numberStr = String(nextNumber).padStart(6, '0')
    if (series.prefix) {
      return `${series.prefix}-${series.series_code}-${numberStr}`
    }
    return `${series.series_code}-${numberStr}`
  }

  if (isLoading) {
    return (
      <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Series de Facturas</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona múltiples series de facturas con consecutivos independientes
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-5 h-5 mr-2" />
          Nueva Serie
        </Button>
      </div>

      {/* Lista de series */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Series Configuradas ({series?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {series && series.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay series configuradas. Crea una serie para comenzar a generar números de
              factura automáticamente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">Prefijo</TableHead>
                    <TableHead className="hidden md:table-cell">Número Actual</TableHead>
                    <TableHead className="hidden lg:table-cell">Próximo Número</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series?.map((serie) => (
                    <TableRow key={serie.id}>
                      <TableCell>
                        <p className="font-mono font-semibold text-foreground">
                          {serie.series_code}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{serie.name}</p>
                          {serie.note && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {serie.note}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="text-sm text-muted-foreground">{serie.prefix || '-'}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm font-mono text-foreground">
                          {formatInvoiceNumber(serie)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-sm font-mono text-primary">
                          {formatNextNumber(serie)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={serie.is_active ? 'default' : 'secondary'}>
                          {serie.is_active ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Activa
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactiva
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSeriesToReset(serie)
                              setResetNumber(serie.current_number + 1)
                            }}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            title="Reiniciar Consecutivo"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(serie)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSeriesToDelete(serie)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de crear/editar */}
      <InvoiceSeriesModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedSeries(null)
        }}
        series={selectedSeries}
        onConfirm={handleConfirm}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog de eliminar */}
      <AlertDialog open={!!seriesToDelete} onOpenChange={() => setSeriesToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar serie?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la serie{' '}
              {seriesToDelete && (
                <>
                  <strong>{seriesToDelete.name}</strong> (Código: {seriesToDelete.series_code}).
                </>
              )}{' '}
              Si hay ventas asociadas, no se podrá eliminar. ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => seriesToDelete && deleteMutation.mutate(seriesToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de reiniciar consecutivo */}
      <Dialog open={!!seriesToReset} onOpenChange={() => setSeriesToReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reiniciar Consecutivo</DialogTitle>
            <DialogDescription>
              Establece un nuevo número consecutivo para la serie{' '}
              {seriesToReset && (
                <>
                  <strong>{seriesToReset.name}</strong> (Código: {seriesToReset.series_code}).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reset_number">Nuevo Número</Label>
              <Input
                id="reset_number"
                type="number"
                min="1"
                value={resetNumber}
                onChange={(e) => setResetNumber(Number(e.target.value) || 1)}
                className="mt-2"
              />
              {seriesToReset && (
                <p className="mt-1 text-xs text-muted-foreground">
                  El próximo número será:{' '}
                  {seriesToReset.prefix
                    ? `${seriesToReset.prefix}-${seriesToReset.series_code}-${String(resetNumber).padStart(6, '0')}`
                    : `${seriesToReset.series_code}-${String(resetNumber).padStart(6, '0')}`}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeriesToReset(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                seriesToReset && resetMutation.mutate({ id: seriesToReset.id, newNumber: resetNumber })
              }
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? 'Reiniciando...' : 'Reiniciar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

