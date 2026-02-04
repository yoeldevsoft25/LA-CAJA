import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { discountsService } from '@/services/discounts.service'
import { format } from 'date-fns'
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
import { Button } from '@/components/ui/button'

interface DiscountAuthorizationsListProps {
  saleId?: string | null
}

export default function DiscountAuthorizationsList({
  saleId,
}: DiscountAuthorizationsListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  const { data: authorizationsData, isLoading } = useQuery({
    queryKey: ['discounts', 'authorizations', currentPage, saleId],
    queryFn: () =>
      saleId
        ? discountsService.getAuthorizationsBySale(saleId).then((auths) => ({
            authorizations: auths,
            total: auths.length,
          }))
        : discountsService.getAuthorizations({
            limit,
            offset: (currentPage - 1) * limit,
          }),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const authorizations = authorizationsData?.authorizations || []
  const totalPages = authorizationsData ? Math.ceil(authorizationsData.total / limit) : 0

  if (authorizations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No hay autorizaciones registradas
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl flex items-center">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Historial de Autorizaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden sm:table-cell">Porcentaje</TableHead>
                <TableHead className="hidden md:table-cell">Monto Bs</TableHead>
                <TableHead className="hidden lg:table-cell">Monto USD</TableHead>
                <TableHead>Razón</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authorizations.map((auth) => (
                <TableRow key={auth.id}>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {format(new Date(auth.authorized_at), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(auth.authorized_at), 'HH:mm')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      {Number(auth.discount_percentage).toFixed(2)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm font-medium text-foreground">
                      {Number(auth.discount_amount_bs).toFixed(2)} Bs
                    </p>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <p className="text-sm font-medium text-foreground">
                      ${Number(auth.discount_amount_usd).toFixed(2)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-foreground">{auth.reason || '-'}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        {!saleId && totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 sm:px-6 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

