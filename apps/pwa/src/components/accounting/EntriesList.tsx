import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { accountingEntriesService } from '@/services/accounting.service'
import type { AccountingEntry, EntryType, EntryStatus } from '@/types/accounting.types'
import { Eye, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const entryTypeLabels: Record<EntryType, string> = {
  sale: 'Venta',
  purchase: 'Compra',
  fiscal_invoice: 'Factura Fiscal',
  manual: 'Manual',
  adjustment: 'Ajuste',
  closing: 'Cierre',
}

const entryStatusLabels: Record<EntryStatus, string> = {
  draft: 'Borrador',
  posted: 'Contabilizado',
  cancelled: 'Cancelado',
}

const entryStatusColors: Record<EntryStatus, string> = {
  draft: 'bg-card text-foreground border border-border',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

interface EntriesListProps {
  onViewEntry: (entry: AccountingEntry) => void
}

export default function EntriesList({ onViewEntry }: EntriesListProps) {
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<EntryStatus | 'all'>('all')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date())
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())

  const { data: entries, isLoading } = useQuery({
    queryKey: ['accounting', 'entries', entryTypeFilter, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      accountingEntriesService.getAll({
        entry_type: entryTypeFilter !== 'all' ? entryTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        start_date: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        end_date: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
        limit: 50,
      }),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const entriesList = entries || []

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Tipo de Asiento</label>
          <Select
            value={entryTypeFilter}
            onValueChange={(value) => setEntryTypeFilter(value as EntryType | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(entryTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Estado</label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as EntryStatus | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(entryStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Fecha Desde</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Seleccionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">Fecha Hasta</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Seleccionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tabla de asientos */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Total BS</TableHead>
              <TableHead className="text-right">Total USD</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entriesList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay asientos contables
                </TableCell>
              </TableRow>
            ) : (
              entriesList.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono font-semibold">{entry.entry_number}</TableCell>
                  <TableCell>{format(new Date(entry.entry_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{entryTypeLabels[entry.entry_type]}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(entry.total_debit_bs).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${Number(entry.total_debit_usd).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge className={entryStatusColors[entry.status]}>
                      {entryStatusLabels[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewEntry(entry)}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      Ver
                    </Button>
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
