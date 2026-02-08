import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, Plus, Edit, RotateCcw, AlertTriangle } from 'lucide-react'
import {
  productSerialsService,
  ProductSerial,
  CreateProductSerialRequest,
  CreateSerialsBatchRequest,
  SerialStatus,
} from '@/services/product-serials.service'
import toast from '@/lib/toast'
import ProductSerialModal from './ProductSerialModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface ProductSerialsListProps {
  productId: string
}

const statusLabels: Record<SerialStatus, string> = {
  available: 'Disponible',
  sold: 'Vendido',
  returned: 'Devuelto',
  damaged: 'Dañado',
}

const statusColors: Record<SerialStatus, string> = {
  available: 'default',
  sold: 'secondary',
  returned: 'default',
  damaged: 'destructive',
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
    staleTime: 1000 * 60 * 5, // 5 minutos
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
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const availableCount = serials?.filter((s) => s.status === 'available').length || 0
  const soldCount = serials?.filter((s) => s.status === 'sold').length || 0
  const returnedCount = serials?.filter((s) => s.status === 'returned').length || 0
  const damagedCount = serials?.filter((s) => s.status === 'damaged').length || 0

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg sm:text-xl flex items-center">
            <Hash className="w-5 h-5 mr-2" />
            Seriales del Producto ({serials?.length || 0})
          </CardTitle>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Serial
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {serials && serials.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay seriales configurados. Agrega seriales para rastrear productos individuales
              por número de serie.
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-6 py-3 border-b border-border">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{availableCount} Disponibles</Badge>
                    <Badge variant="secondary">{soldCount} Vendidos</Badge>
                    <Badge variant="default">{returnedCount} Devueltos</Badge>
                    <Badge variant="destructive">{damagedCount} Dañados</Badge>
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as SerialStatus | 'all')}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="available">Disponibles</SelectItem>
                      <SelectItem value="sold">Vendidos</SelectItem>
                      <SelectItem value="returned">Devueltos</SelectItem>
                      <SelectItem value="damaged">Dañados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número de Serie</TableHead>
                      <TableHead className="hidden sm:table-cell">Recepción</TableHead>
                      <TableHead className="hidden md:table-cell">Venta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serials?.map((serial) => (
                      <TableRow key={serial.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground font-mono">
                              {serial.serial_number}
                            </p>
                            {serial.note && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {serial.note}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(serial.received_at), 'dd/MM/yyyy')}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {serial.sold_at ? (
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(serial.sold_at), 'dd/MM/yyyy')}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">-</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[serial.status] as any}>
                            {statusLabels[serial.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {serial.status === 'sold' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSerialToReturn(serial)}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                title="Devolver"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {serial.status === 'available' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSerialToMarkDamaged(serial)}
                                className="text-amber-600 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
                                title="Marcar como dañado"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(serial)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Edit className="w-4 h-4 mr-1.5" />
                              Editar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                  <strong>{serialToReturn.serial_number}</strong> como devuelto y lo dejará
                  disponible nuevamente.
                </>
              )}{' '}
              ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serialToReturn && returnMutation.mutate(serialToReturn.id)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Devolver
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
                  <strong>{serialToMarkDamaged.serial_number}</strong> como dañado.
                </>
              )}{' '}
              ¿Estás seguro?
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
              Marcar como Dañado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

