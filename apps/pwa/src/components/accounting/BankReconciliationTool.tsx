import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { bankReconciliationService } from '@/services/accounting.service'
import type { BankTransaction } from '@/types/accounting.types'
import { useAuth } from '@/stores/auth.store' // Correct import as per previous files
import { formatCurrency } from '@/lib/utils'
import { Plus, RefreshCw, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import StatementUploadModal from './StatementUploadModal'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function BankReconciliationTool() {
    const { user } = useAuth()
    const storeId = user?.store_id
    const queryClient = useQueryClient()

    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null)

    const { data: statements, isLoading: isLoadingStatements } = useQuery({
        queryKey: ['bank-statements', storeId],
        queryFn: () => storeId ? bankReconciliationService.listStatements(storeId) : Promise.resolve([]),
        enabled: !!storeId
    })

    const { data: activeStatement } = useQuery({
        queryKey: ['bank-statement', selectedStatementId],
        queryFn: () => selectedStatementId ? bankReconciliationService.getStatement(selectedStatementId) : null,
        enabled: !!selectedStatementId
    })

    // Auto-match mutation
    const autoMatchMutation = useMutation({
        mutationFn: async (id: string) => {
            return bankReconciliationService.autoMatch(id)
        },
        onSuccess: (data) => {
            toast.success(`Auto-matched ${data.matched} transactions`)
            queryClient.invalidateQueries({ queryKey: ['bank-statement', selectedStatementId] })
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Conciliación Bancaria</h2>
                    <p className="text-muted-foreground">Gestiona y concilia tus estados de cuenta bancarios.</p>
                </div>
                <Button onClick={() => setIsUploadOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Importar Estado
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar: Statements List */}
                <Card className="col-span-1 h-[calc(100vh-200px)] overflow-hidden flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Estados de Cuenta</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-0">
                        {isLoadingStatements ? (
                            <div className="p-4 text-center">Cargando...</div>
                        ) : (
                            <div className="divide-y">
                                {statements?.map(st => (
                                    <div
                                        key={st.id}
                                        className={`p-4 cursor-pointer hover:bg-accent transition-colors ${selectedStatementId === st.id ? 'bg-accent/50' : ''}`}
                                        onClick={() => setSelectedStatementId(st.id)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium">{st.bank_name}</span>
                                            <Badge variant={st.status === 'reconciled' ? 'default' : 'secondary'}>
                                                {st.status === 'reconciled' ? 'Conciliado' : 'Pendiente'}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground mb-1">
                                            {st.account_number} • {st.currency}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(new Date(st.period_start), 'dd MMM', { locale: es })} - {format(new Date(st.period_end), 'dd MMM yyyy', { locale: es })}
                                        </div>
                                    </div>
                                ))}
                                {statements?.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No hay estados de cuenta.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Main: Statement Detail */}
                <Card className="col-span-1 md:col-span-2 h-[calc(100vh-200px)] overflow-hidden flex flex-col">
                    {selectedStatementId && activeStatement ? (
                        <>
                            <CardHeader className="border-b bg-card pb-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-5 w-5" />
                                            {activeStatement.bank_name} - {activeStatement.account_number}
                                        </CardTitle>
                                        <div className="text-sm text-muted-foreground mt-1 space-x-4">
                                            <span>Debitos: {formatCurrency(activeStatement.total_debits)}</span>
                                            <span>Creditos: {formatCurrency(activeStatement.total_credits)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => autoMatchMutation.mutate(activeStatement.id)}
                                            disabled={autoMatchMutation.isPending || activeStatement.status === 'reconciled'}
                                        >
                                            <RefreshCw className={`mr-2 h-4 w-4 ${autoMatchMutation.isPending ? 'animate-spin' : ''}`} />
                                            Auto Match
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 overflow-auto p-0">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Referencia</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="w-[100px]">Estado</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeStatement.lines?.map((tx: BankTransaction) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {format(new Date(tx.transaction_date), 'dd/MM/yy')}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={tx.description}>
                                                    {tx.description}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {tx.reference_number || '-'}
                                                </TableCell>
                                                <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.type === 'debit' ? '-' : '+'}{formatCurrency(Number(tx.amount))}
                                                </TableCell>
                                                <TableCell>
                                                    {tx.is_reconciled ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                            Conciliado
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground">
                                                            Pendiente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {!tx.is_reconciled && (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8">
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>Selecciona un estado de cuenta para ver los detalles.</p>
                        </div>
                    )}
                </Card>
            </div>

            <StatementUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
            />
        </div>
    )
}
