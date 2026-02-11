import { useQuery } from '@tanstack/react-query'
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
import { accountMappingsService } from '@/services/accounting.service'
import type { AccountMapping, MappingTransactionType } from '@/types/accounting.types'
import { Edit, Trash2, Plus } from 'lucide-react'

const transactionTypeLabels: Record<MappingTransactionType, string> = {
  sale_revenue: 'Venta - Ingresos',
  sale_cost: 'Venta - Costos',
  sale_tax: 'Venta - Impuestos',
  purchase_expense: 'Compra - Gastos',
  purchase_tax: 'Compra - Impuestos',
  inventory_asset: 'Inventario - Activo',
  cash_asset: 'Caja/Banco - Activo',
  accounts_receivable: 'Cuentas por Cobrar',
  accounts_payable: 'Cuentas por Pagar',
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste',
  fx_gain_realized: 'Diferencial Cambiario - Ganancia Realizada',
  fx_loss_realized: 'Diferencial Cambiario - Pérdida Realizada',
  fx_gain_unrealized: 'Diferencial Cambiario - Ganancia No Realizada',
  fx_loss_unrealized: 'Diferencial Cambiario - Pérdida No Realizada',
}

interface AccountMappingsListProps {
  onEdit: (mapping: AccountMapping) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export default function AccountMappingsList({
  onEdit,
  onDelete,
  onAdd,
}: AccountMappingsListProps) {
  const { data: mappings, isLoading } = useQuery({
    queryKey: ['accounting', 'mappings'],
    queryFn: () => accountMappingsService.getAll(),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const mappingsList = mappings || []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Mapeo
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de Transacción</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Por Defecto</TableHead>
              <TableHead>Condiciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappingsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay mapeos configurados
                </TableCell>
              </TableRow>
            ) : (
              mappingsList.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-medium">
                    {transactionTypeLabels[mapping.transaction_type] || mapping.transaction_type}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-mono font-semibold">{mapping.account_code}</p>
                      <p className="text-sm text-muted-foreground">
                        {mapping.account_name || mapping.account_code}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {mapping.is_default ? (
                      <Badge className="bg-green-100 text-green-800">Sí</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {mapping.conditions ? (
                      <span className="text-sm text-muted-foreground">
                        {Object.keys(mapping.conditions).length} condición(es)
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(mapping)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm('¿Estás seguro de eliminar este mapeo?')) {
                            onDelete(mapping.id)
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
