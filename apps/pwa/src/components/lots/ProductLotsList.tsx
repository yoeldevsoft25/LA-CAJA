import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Edit, History, Boxes, Plus } from 'lucide-react'
import {
  productLotsService,
  ProductLot,
  CreateProductLotRequest,
} from '@/services/product-lots.service'
import toast from '@/lib/toast'
import ProductLotModal from './ProductLotModal'
import LotMovementsList from './LotMovementsList'
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
import { cn } from '@/lib/utils'

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
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    )
  }

  const sortedLots = [...(lots || [])].sort((a, b) => {
    return new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center">
            <Package className="w-5 h-5 mr-2 text-primary" />
            Lotes Registrados ({lots?.length || 0})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de inventario por lotes y fechas de vencimiento (FIFO)
          </p>
        </div>
        <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Lote
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
        {lots && lots.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-card border border-border/60 flex items-center justify-center mx-auto mb-4">
              <Boxes className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-medium text-foreground">No hay lotes</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">
              Registra lotes para realizar un seguimiento exacto de vencimientos y costos.
            </p>
            <Button onClick={handleAdd} variant="outline" size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Crear primer lote
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-card">
                <TableRow>
                  <TableHead>Número de Lote</TableHead>
                  <TableHead className="hidden sm:table-cell">Stock / Inicial</TableHead>
                  <TableHead className="hidden md:table-cell">Costo</TableHead>
                  <TableHead className="hidden sm:table-cell">Vencimiento</TableHead>
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
                    <TableRow key={lot.id} className="group hover:bg-muted/20">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{lot.lot_number}</p>
                          {lot.supplier && (
                            <p className="text-[10px] text-muted-foreground uppercase">{lot.supplier}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="w-32 space-y-1.5">
                          <div className="flex justify-between text-[11px] font-medium">
                            <span className="text-foreground">{lot.remaining_quantity} disponibles</span>
                            <span className="text-muted-foreground">{lot.initial_quantity}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                lot.remaining_quantity === 0 ? "bg-muted-foreground/30" : "bg-primary"
                              )}
                              style={{ width: `${100 - percentageUsed}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">
                            ${Number(lot.unit_cost_usd).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {Number(lot.unit_cost_bs).toFixed(2)} Bs
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lot.expiration_date ? (
                          <div className="flex flex-col gap-0.5">
                            <p className={cn(
                              "text-sm font-medium",
                              expirationStatus?.status === 'expired' ? "text-destructive" : "text-foreground"
                            )}>
                              {format(new Date(lot.expiration_date), 'dd/MM/yyyy')}
                            </p>
                            {expirationStatus && (
                              <span className={cn(
                                "text-[10px] uppercase font-bold tracking-tight",
                                expirationStatus.status === 'expired' ? "text-destructive" :
                                  expirationStatus.status === 'warning' ? "text-orange-600 dark:text-orange-400" : "text-primary"
                              )}>
                                {expirationStatus.label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lot.remaining_quantity === 0 ? (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">Agotado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                            Activo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLotToViewMovements(lot)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Ver movimientos"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lot)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
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
      </div>

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
    </div>
  )
}

