import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Calendar, Clock } from 'lucide-react'
import { productLotsService, ProductLot } from '@/services/product-lots.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, differenceInDays, isBefore } from 'date-fns'

export default function LotsPage() {
  const [daysUntilExpiration, setDaysUntilExpiration] = useState<number>(30)

  const { data: expiringLots, isLoading: isLoadingExpiring } = useQuery({
    queryKey: ['product-lots', 'expiring', daysUntilExpiration],
    queryFn: () => productLotsService.getLotsExpiringSoon(daysUntilExpiration),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const { data: expiredLots, isLoading: isLoadingExpired } = useQuery({
    queryKey: ['product-lots', 'expired'],
    queryFn: () => productLotsService.getExpiredLots(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

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

  return (
    <div className="h-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Lotes y Vencimientos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestiona lotes de productos y controla fechas de vencimiento
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expiring" className="space-y-4">
        <TabsList className="bg-card border border-border/60">
          <TabsTrigger value="expiring" className="flex items-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Clock className="w-4 h-4 mr-2" />
            Próximos a Vencer ({expiringLots?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex items-center data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Vencidos ({expiredLots?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expiring" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg sm:text-xl flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Lotes Próximos a Vencer
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="days" className="text-sm whitespace-nowrap">
                    Días:
                  </Label>
                  <Input
                    id="days"
                    type="number"
                    min="1"
                    max="365"
                    value={daysUntilExpiration}
                    onChange={(e) => setDaysUntilExpiration(Number(e.target.value) || 30)}
                    className="w-20"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingExpiring ? (
                <div className="p-6">
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : expiringLots && expiringLots.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No hay lotes próximos a vencer en los próximos {daysUntilExpiration} días
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Número de Lote</TableHead>
                        <TableHead className="hidden sm:table-cell">Cantidad</TableHead>
                        <TableHead className="hidden md:table-cell">Recepción</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="hidden lg:table-cell">Proveedor</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringLots?.map((lot) => {
                        const expirationStatus = getExpirationStatus(lot)
                        return (
                          <TableRow key={lot.id}>
                            <TableCell>
                              <p className="font-medium text-foreground">
                                {lot.product?.name || 'Producto no encontrado'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="font-mono text-sm text-foreground">{lot.lot_number}</p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <p className="text-sm text-foreground">
                                {lot.remaining_quantity} / {lot.initial_quantity}
                              </p>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(lot.received_at), 'dd/MM/yyyy')}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">
                                  {lot.expiration_date
                                    ? format(new Date(lot.expiration_date), 'dd/MM/yyyy')
                                    : '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <p className="text-sm text-muted-foreground">{lot.supplier || '-'}</p>
                            </TableCell>
                            <TableCell>
                              {expirationStatus && (
                                <Badge
                                  variant={
                                    expirationStatus.status === 'expired'
                                      ? 'destructive'
                                      : expirationStatus.status === 'warning'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                >
                                  {expirationStatus.label}
                                  {expirationStatus.days !== undefined &&
                                    expirationStatus.status !== 'expired' &&
                                    ` (${expirationStatus.days}d)`}
                                </Badge>
                              )}
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
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                Lotes Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingExpired ? (
                <div className="p-6">
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : expiredLots && expiredLots.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No hay lotes vencidos
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Número de Lote</TableHead>
                        <TableHead className="hidden sm:table-cell">Cantidad</TableHead>
                        <TableHead className="hidden md:table-cell">Recepción</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="hidden lg:table-cell">Proveedor</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiredLots?.map((lot) => {
                        const expirationStatus = getExpirationStatus(lot)
                        return (
                          <TableRow key={lot.id} className="bg-destructive/5">
                            <TableCell>
                              <p className="font-medium text-foreground">
                                {lot.product?.name || 'Producto no encontrado'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="font-mono text-sm text-foreground">{lot.lot_number}</p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <p className="text-sm text-foreground">
                                {lot.remaining_quantity} / {lot.initial_quantity}
                              </p>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(lot.received_at), 'dd/MM/yyyy')}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-destructive" />
                                <p className="text-sm font-medium text-destructive">
                                  {lot.expiration_date
                                    ? format(new Date(lot.expiration_date), 'dd/MM/yyyy')
                                    : '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <p className="text-sm text-muted-foreground">{lot.supplier || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Vencido
                                {expirationStatus?.days !== undefined && ` (${expirationStatus.days}d)`}
                              </Badge>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
