import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, Plus, Edit, RotateCcw, AlertTriangle, Boxes } from 'lucide-react'
import {
  productSerialsService,
  ProductSerial,
  CreateProductSerialRequest,
  CreateSerialsBatchRequest,
  SerialStatus,
} from '@/services/product-serials.service'
import toast from '@/lib/toast'
import ProductSerialModal from './ProductSerialModal'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ProductSerialsListProps {
  productId: string
}

const statusLabels: Record<SerialStatus, string> = {
  available: 'Disponible',
  sold: 'Vendido',
  returned: 'Devuelto',
  damaged: 'Dañado',
}

export default function ProductSerialsList({ productId }: ProductSerialsListProps) {
  const queryClient = useQueryClient()
  const [selectedSerial, setSelectedSerial] = useState<ProductSerial | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [serialToReturn, setSerialToReturn] = useState<ProductSerial | null>(null)
  const [serialToMarkDamaged, setSerialToMarkDamaged] = useState<ProductSerial | null>(null)
  const [statusFilter, setStatusFilter] = useState<SerialStatus | 'all'>('all')

  const { data: serials, isLoading } = useQuery({
    queryKey: ['product-serials', productId, statusFilter],
    queryFn: () =>
      productSerialsService.getSerialsByProduct(
        productId,
        statusFilter === 'all' ? undefined : statusFilter
      ),
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProductSerialRequest) => productSerialsService.createSerial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials'] })
      toast.success('Serial creado correctamente')
      setIsModalOpen(false)
      setSelectedSerial(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el serial')
    },
  })

  const batchCreateMutation = useMutation({
    mutationFn: (data: CreateSerialsBatchRequest) =>
      productSerialsService.createSerialsBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials'] })
      toast.success('Seriales creados correctamente')
      setIsModalOpen(false)
      setSelectedSerial(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear los seriales')
    },
  })

  const returnMutation = useMutation({
    mutationFn: (id: string) => productSerialsService.returnSerial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials'] })
      toast.success('Serial devuelto correctamente')
      setSerialToReturn(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al devolver el serial')
    },
  })

  const markDamagedMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      productSerialsService.markSerialAsDamaged(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-serials'] })
      toast.success('Serial marcado como dañado')
      setSerialToMarkDamaged(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al marcar el serial como dañado')
    },
  })

  const handleEdit = (serial: ProductSerial) => {
    setSelectedSerial(serial)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedSerial(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateProductSerialRequest) => {
    createMutation.mutate(data)
  }

  const handleBatchConfirm = (data: CreateSerialsBatchRequest) => {
    batchCreateMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    )
  }

  const availableCount = serials?.filter((s) => s.status === 'available').length || 0
  const soldCount = serials?.filter((s) => s.status === 'sold').length || 0
  const damagedCount = serials?.filter((s) => s.status === 'damaged').length || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center">
            <Hash className="w-5 h-5 mr-2 text-primary" />
            Seriales Registrados ({serials?.length || 0})
          </h2>
          <div className="flex gap-4 mt-1">
            <p className="text-xs font-medium text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {availableCount} Disponibles
            </p>
            <p className="text-xs font-medium text-blue-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {soldCount} Vendidos
            </p>
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              {damagedCount} Dañados
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as SerialStatus | 'all')}
          >
            <SelectTrigger className="h-9 w-[140px] bg-background">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="sold">Vendidos</SelectItem>
              <SelectItem value="returned">Devueltos</SelectItem>
              <SelectItem value="damaged">Dañados</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} size="sm" className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Serial
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
        {serials && serials.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Hash className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-medium text-foreground">No hay seriales</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">
              Registra números de serie para llevar un control individual de cada unidad.
            </p>
            <Button onClick={handleAdd} variant="outline" size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Crear primer serial
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-1/3">Número de Serie</TableHead>
                  <TableHead className="hidden sm:table-cell">Recepción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serials?.map((serial) => (
                  <TableRow key={serial.id} className="group hover:bg-muted/20">
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-mono font-bold text-foreground tracking-tight">{serial.serial_number}</p>
                        {serial.note && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{serial.note}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {format(new Date(serial.received_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          serial.status === 'available' ? "text-green-600 bg-green-50 border-green-200" :
                            serial.status === 'sold' ? "text-blue-600 bg-blue-50 border-blue-200" :
                              serial.status === 'returned' ? "text-purple-600 bg-purple-50 border-purple-200" :
                                "text-destructive bg-destructive/5 border-destructive/20"
                        )}
                      >
                        {statusLabels[serial.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {serial.status === 'sold' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSerialToReturn(serial)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Devolver"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        {serial.status === 'available' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSerialToMarkDamaged(serial)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Marcar como dañado"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(serial)}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ProductSerialModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedSerial(null)
        }}
        productId={productId}
        serial={selectedSerial}
        onConfirm={handleConfirm}
        onBatchConfirm={handleBatchConfirm}
        isLoading={createMutation.isPending || batchCreateMutation.isPending}
      />

      <AlertDialog open={!!serialToReturn} onOpenChange={() => setSerialToReturn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Devolver serial?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará el serial{' '}
              {serialToReturn && (
                <>
                  <strong className="text-foreground">{serialToReturn.serial_number}</strong>
                </>
              )}{' '}
              como devuelto y lo dejará disponible nuevamente en el inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serialToReturn && returnMutation.mutate(serialToReturn.id)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Devolver a Inventario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!serialToMarkDamaged}
        onOpenChange={() => setSerialToMarkDamaged(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como dañado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará el serial{' '}
              {serialToMarkDamaged && (
                <>
                  <strong className="text-foreground">{serialToMarkDamaged.serial_number}</strong>
                </>
              )}{' '}
              como no apto para la venta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                serialToMarkDamaged && markDamagedMutation.mutate({ id: serialToMarkDamaged.id })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Daño
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
