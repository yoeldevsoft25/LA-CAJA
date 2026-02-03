import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Edit, Trash2, Calendar, AlertTriangle, History } from 'lucide-react'
import {
  productLotsService,
  ProductLot,
  CreateProductLotRequest,
} from '@/services/product-lots.service'
import toast from '@/lib/toast'
import ProductLotModal from './ProductLotModal'
import LotMovementsList from './LotMovementsList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@la-caja/ui-core'
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
import { format, isBefore, differenceInDays } from 'date-fns'

interface ProductLotsListProps {
  productId: string
}

export default function ProductLotsList({ productId }: ProductLotsListProps) {
  const queryClient = useQueryClient()
  const [selectedLot, setSelectedLot] = useState<ProductLot | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [lotToDelete, setLotToDelete] = useState<ProductLot | null>(null)
  const [lotToViewMovements, setLotToViewMovements] = useState<ProductLot | null>(null)

  const { data: lots, isLoading } = useQuery({
    queryKey: ['product-lots', productId],
    queryFn: () => productLotsService.getLotsByProduct(productId),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProductLotRequest) => productLotsService.createLot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-lots'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Lote creado correctamente')
      setIsModalOpen(false)
      setSelectedLot(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el lote')
    },
  })

  const handleEdit = (lot: ProductLot) => {
    setSelectedLot(lot)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedLot(null)
    setIsModalOpen(true)
  }

  const handleConfirm = (data: CreateProductLotRequest) => {
    createMutation.mutate(data)
  }

  const getExpirationStatus = (lot: ProductLot) => {
    if (!lot.expiration_date) return null

    const expirationDate = new Date(lot.expiration_date)
    const today = new Date()
    const daysUntilExpiration = differenceInDays(expirationDate, today)

    if (isBefore(expirationDate, today)) {
      return { status: 'expired', days: Math.abs(daysUntilExpiration), label: 'Vencido' }
    } else if (daysUntilExpiration <= 7) {
      return { status: 'warning', days: daysUntilExpiration, label: 'Próximo a vencer' }
    } else if (daysUntilExpiration <= 30) {
      return { status: 'info', days: daysUntilExpiration, label: 'Vence pronto' }
    }

    return null
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

  const sortedLots = [...(lots || [])].sort((a, b) => {
    // Ordenar por fecha de recepción (FIFO)
    return new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  })

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg sm:text-xl flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Lotes del Producto ({lots?.length || 0})
          </CardTitle>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Lote
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {lots && lots.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay lotes configurados. Agrega lotes para gestionar productos con fechas de
              vencimiento y aplicar lógica FIFO.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de Lote</TableHead>
                    <TableHead className="hidden sm:table-cell">Cantidad</TableHead>
                    <TableHead className="hidden md:table-cell">Costo Unitario</TableHead>
                    <TableHead className="hidden lg:table-cell">Recepción</TableHead>
                    <TableHead className="hidden sm:table-cell">Vencimiento</TableHead>
                    <TableHead className="hidden md:table-cell">Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLots.map((lot) => {
                    const expirationStatus = getExpirationStatus(lot)
                    const percentageUsed =
                      lot.initial_quantity > 0
                        ? ((lot.initial_quantity - lot.remaining_quantity) / lot.initial_quantity) *
                          100
                        : 0

                    return (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{lot.lot_number}</p>
                            {lot.note && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {lot.note}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-sm">
                            <p className="font-semibold text-foreground">
                              {lot.remaining_quantity} / {lot.initial_quantity}
                            </p>
                            <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${percentageUsed}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            <p className="text-foreground">
                              ${Number(lot.unit_cost_usd).toFixed(2)} USD
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Number(lot.unit_cost_bs).toFixed(2)} Bs
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(lot.received_at), 'dd/MM/yyyy')}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {lot.expiration_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <p className="text-sm text-foreground">
                                {format(new Date(lot.expiration_date), 'dd/MM/yyyy')}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">-</p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <p className="text-sm text-muted-foreground">{lot.supplier || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {lot.remaining_quantity === 0 ? (
                              <Badge variant="secondary">Agotado</Badge>
                            ) : (
                              <Badge variant="default">Disponible</Badge>
                            )}
                            {expirationStatus && (
                              <Badge
                                variant={
                                  expirationStatus.status === 'expired'
                                    ? 'destructive'
                                    : expirationStatus.status === 'warning'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                                className="text-xs"
                              >
                                {expirationStatus.status === 'expired' && (
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                )}
                                {expirationStatus.label}
                                {expirationStatus.days !== undefined &&
                                  expirationStatus.status !== 'expired' &&
                                  ` (${expirationStatus.days}d)`}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLotToViewMovements(lot)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <History className="w-4 h-4 mr-1.5" />
                              Movimientos
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(lot)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Edit className="w-4 h-4 mr-1.5" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLotToDelete(lot)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductLotModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedLot(null)
        }}
        productId={productId}
        lot={selectedLot}
        onConfirm={handleConfirm}
        isLoading={createMutation.isPending}
      />

      {lotToViewMovements && (
        <LotMovementsList
          isOpen={!!lotToViewMovements}
          onClose={() => setLotToViewMovements(null)}
          lot={lotToViewMovements}
        />
      )}

      <AlertDialog open={!!lotToDelete} onOpenChange={() => setLotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el lote{' '}
              {lotToDelete && (
                <>
                  <strong>{lotToDelete.lot_number}</strong>.
                </>
              )}{' '}
              ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Nota: El backend no tiene endpoint DELETE, solo se pueden crear movimientos
                toast.error('Los lotes no se pueden eliminar directamente. Usa movimientos para ajustar.')
                setLotToDelete(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

