import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
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
import { accountingExportsService } from '@/services/accounting.service'
import type { AccountingExport, ExportFormat } from '@/types/accounting.types'
import { Download, FileText } from 'lucide-react'
import toast from '@/lib/toast'

const formatLabels: Record<ExportFormat, string> = {
  csv: 'CSV',
  excel: 'Excel',
  json: 'JSON',
  viotech: 'VioTech',
}

const statusLabels: Record<AccountingExport['status'], string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Fallido',
}

const statusColors: Record<AccountingExport['status'], string> = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export default function ExportsList() {
  const { data: exports, isLoading } = useQuery({
    queryKey: ['accounting', 'exports'],
    queryFn: () => accountingExportsService.getAll(),
  })

  const handleDownload = async (exportId: string) => {
    try {
      const blob = await accountingExportsService.download(exportId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${exportId}.${blob.type.includes('excel') ? 'xlsx' : blob.type.includes('json') ? 'json' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Archivo descargado exitosamente')
    } catch (error: any) {
      toast.error('Error al descargar el archivo')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const exportsList = exports || []

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Formato</TableHead>
            <TableHead>Rango de Fechas</TableHead>
            <TableHead>Estándar</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha de Creación</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exportsList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No hay exportaciones
              </TableCell>
            </TableRow>
          ) : (
            exportsList.map((exp) => (
              <TableRow key={exp.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {formatLabels[exp.format]}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>{format(new Date(exp.start_date), 'dd/MM/yyyy')}</p>
                    <p className="text-muted-foreground">hasta {format(new Date(exp.end_date), 'dd/MM/yyyy')}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {exp.standard ? (
                    <span className="text-sm font-medium">{exp.standard.toUpperCase()}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[exp.status]}>
                    {statusLabels[exp.status]}
                  </Badge>
                  {exp.error_message && (
                    <p className="text-xs text-destructive mt-1">{exp.error_message}</p>
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(exp.created_at), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-right">
                  {exp.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(exp.id)}
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Descargar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

