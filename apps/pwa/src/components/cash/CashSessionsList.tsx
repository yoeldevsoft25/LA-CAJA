import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, DollarSign, Lock, Unlock, Eye } from 'lucide-react'
import { cashService, CashSession } from '@/services/cash.service'
import { format } from 'date-fns'
import CashSessionDetailModal from './CashSessionDetailModal'
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

export default function CashSessionsList() {
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['cash', 'sessions', currentPage],
    queryFn: () => cashService.listSessions({ limit, offset: (currentPage - 1) * limit }),
  })

  const handleViewDetail = (session: CashSession) => {
    setSelectedSession(session)
    setIsDetailModalOpen(true)
  }

  if (isLoading) {
    return (
      <Card className="border border-border">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const sessions = sessionsData?.sessions || []
  const totalPages = sessionsData ? Math.ceil(sessionsData.total / limit) : 0

  if (sessions.length === 0) {
    return null // No mostrar si no hay sesiones
  }

  return (
    <>
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Historial de Sesiones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
        <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Apertura</TableHead>
                  <TableHead className="hidden lg:table-cell">Cierre</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {sessions.map((session) => {
                const isOpen = session.closed_at === null

                return (
                    <TableRow key={session.id}>
                      <TableCell>
                      <div className="text-sm">
                          <p className="font-medium text-foreground">
                          {format(new Date(session.opened_at), 'dd/MM/yyyy')}
                        </p>
                          <p className="text-xs text-muted-foreground">
                          {format(new Date(session.opened_at), 'HH:mm')}
                        </p>
                      </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                      {isOpen ? (
                          <Badge className="bg-success text-white">
                          <Unlock className="w-3 h-3 mr-1" />
                          Abierta
                          </Badge>
                      ) : (
                          <Badge variant="secondary">
                          <Lock className="w-3 h-3 mr-1" />
                          Cerrada
                          </Badge>
                      )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                      <div className="text-sm">
                          <p className="text-foreground">
                          {Number(session.opening_amount_bs).toFixed(2)} Bs
                        </p>
                          <p className="text-xs text-muted-foreground">
                          ${Number(session.opening_amount_usd).toFixed(2)} USD
                        </p>
                      </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                      {session.closed_at ? (
                        <div className="text-sm">
                            <p className="text-foreground">
                            {format(new Date(session.closed_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          {session.counted && (
                              <p className="text-xs text-muted-foreground">
                              {Number(session.counted.cash_bs).toFixed(2)} Bs / $
                              {Number(session.counted.cash_usd).toFixed(2)} USD
                            </p>
                          )}
                        </div>
                      ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                      )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(session)}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                )
              })}
              </TableBody>
            </Table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
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

      {selectedSession && (
        <CashSessionDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false)
            setSelectedSession(null)
          }}
          session={selectedSession}
        />
      )}
    </>
  )
}
