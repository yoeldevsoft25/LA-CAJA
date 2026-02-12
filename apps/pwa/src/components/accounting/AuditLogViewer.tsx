import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth.store'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Search, RotateCcw } from 'lucide-react'

interface AuditLog {
    id: string
    user_id: string
    action: string
    entity_type: string
    entity_id: string
    before_value: any
    after_value: any
    metadata: any
    created_at: string
}

export default function AuditLogViewer() {
    const { user } = useAuth()
    const [entityType, setEntityType] = useState<string>('all')
    const [entityId, setEntityId] = useState('')

    const { data: logs, isLoading, refetch } = useQuery({
        queryKey: ['audit-logs', entityType, entityId],
        queryFn: async () => {
            const params: any = {}
            if (entityType !== 'all') params.entity_type = entityType
            if (entityId) params.entity_id = entityId

            const response = await api.get<AuditLog[]>('/accounting/logs', { params })
            return response.data
        },
        enabled: !!user?.store_id
    })

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle>Auditoría de Cambios</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => refetch()}>
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex gap-4 mt-2">
                    <div className="w-[200px]">
                        <Select value={entityType} onValueChange={setEntityType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tipo de Entidad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="JournalEntry">Asiento Contable</SelectItem>
                                <SelectItem value="ChartOfAccount">Cuenta Contable</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por ID de entidad..."
                            className="pl-8"
                            value={entityId}
                            onChange={(e) => setEntityId(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[180px]">Fecha</TableHead>
                            <TableHead>Acción</TableHead>
                            <TableHead>Entidad</TableHead>
                            <TableHead>Detalles</TableHead>
                            <TableHead>Usuario</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                            </TableRow>
                        ) : logs?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay registros de auditoría.</TableCell>
                            </TableRow>
                        ) : (
                            logs?.map((log: AuditLog) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs">
                                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{log.action}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-xs">{log.entity_type}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono truncate w-[100px]" title={log.entity_id}>
                                                {log.entity_id}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <ScrollArea className="h-[60px] w-[300px] rounded border p-2 bg-card">
                                            <pre className="text-[10px]">
                                                {JSON.stringify(log.after_value || log.before_value, null, 2)}
                                            </pre>
                                        </ScrollArea>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {log.user_id}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
