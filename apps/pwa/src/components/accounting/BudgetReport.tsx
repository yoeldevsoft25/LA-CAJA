import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Plus,
    ArrowLeft,
    Save,
    Trash2,
    AlertCircle
} from 'lucide-react'
import { budgetService } from '@/services/accounting.service'
import { useAuth } from '@/stores/auth.store'
import { formatCurrency } from '@/lib/utils'
import BudgetFormModal from './BudgetFormModal'
import { toast } from 'sonner'
import { AccountingBudget } from '@/types/accounting.types'

export default function BudgetReport() {
    const { user } = useAuth()
    const storeId = user?.store_id
    const queryClient = useQueryClient()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [selectedBudget, setSelectedBudget] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)

    // Local state for editing budget lines
    const [editLines, setEditLines] = useState<Record<string, { bs: number, usd: number, notes?: string }>>({})

    // Fetch Budget List
    const { data: budgets, isLoading: isLoadingList } = useQuery({
        queryKey: ['accounting', 'budgets', storeId],
        queryFn: () => storeId ? budgetService.list(storeId) : Promise.resolve([]),
        enabled: !!storeId && !selectedBudget,
    })

    // Fetch Budget Comparison
    const { data: report, isLoading: isLoadingReport } = useQuery({
        queryKey: ['accounting', 'budget-comparison', storeId, selectedBudget],
        queryFn: () => (storeId && selectedBudget) ? budgetService.getComparison(storeId, selectedBudget) : null,
        enabled: !!storeId && !!selectedBudget,
    })

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: (lines: any[]) => {
            if (!storeId || !selectedBudget) throw new Error('No budget selected')
            return budgetService.updateLines(storeId, selectedBudget, lines)
        },
        onSuccess: () => {
            toast.success('Presupuesto actualizado')
            setIsEditing(false)
            queryClient.invalidateQueries({ queryKey: ['accounting', 'budget-comparison'] })
        },
        onError: (err) => {
            toast.error('Error al actualizar presupuesto')
            console.error(err)
        }
    })

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => {
            if (!storeId) throw new Error('No store')
            return budgetService.delete(storeId, id)
        },
        onSuccess: () => {
            toast.success('Presupuesto eliminado')
            setSelectedBudget(null)
            queryClient.invalidateQueries({ queryKey: ['accounting', 'budgets'] })
        }
    })

    const handleEditToggle = () => {
        if (isEditing) {
            // Cancel edit
            setIsEditing(false)
            setEditLines({})
        } else {
            // Start edit - populate state
            if (report) {
                const initialState: any = {}
                report.comparison.forEach(line => {
                    initialState[line.account_id] = {
                        bs: line.budget_bs,
                        usd: line.budget_usd,
                        notes: '' // notes not in comparison view, strictly speaking
                    }
                })
                setEditLines(initialState)
                setIsEditing(true)
            }
        }
    }

    const handleSave = () => {
        if (!report) return;

        // Construct the payload from all lines in report, using current edit values or originals
        const payload = report.comparison.map(line => {
            const edited = editLines[line.account_id];
            return {
                account_id: line.account_id,
                amount_bs: edited ? edited.bs : line.budget_bs,
                amount_usd: edited ? edited.usd : line.budget_usd,
                notes: ''
            }
        });

        updateMutation.mutate(payload)
    }

    const handleInputChange = (accountId: string, field: 'bs' | 'usd', value: string) => {
        const numValue = parseFloat(value) || 0
        setEditLines(prev => ({
            ...prev,
            [accountId]: {
                ...prev[accountId] || { bs: 0, usd: 0 },
                [field]: numValue
            }
        }))
    }

    if (selectedBudget) {
        if (isLoadingReport) return <div>Cargando reporte...</div>
        if (!report) return <div>Error cargando reporte</div>

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedBudget(null); setIsEditing(false); }}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h2 className="text-xl font-bold">{report.budget.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {new Date(report.budget.period_start).toLocaleDateString()} - {new Date(report.budget.period_end).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button variant="outline" onClick={handleEditToggle}>Cancelar</Button>
                                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Guardar Cambios
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={handleEditToggle}>
                                    Editar Presupuesto
                                </Button>
                                <Button variant="destructive" size="icon" onClick={() => {
                                    if (confirm('¿Eliminar presupuesto?')) deleteMutation.mutate(selectedBudget)
                                }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Comparativa Presupuesto vs Real</CardTitle>
                        <CardDescription>
                            Variaciones positivas en verde (Ingresos &gt; Presupuesto o Gastos &lt; Presupuesto).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cuenta</TableHead>
                                    <TableHead className="text-right">Presupuesto (Bs)</TableHead>
                                    <TableHead className="text-right">Real (Bs)</TableHead>
                                    <TableHead className="text-right">Variación (Bs)</TableHead>
                                    <TableHead className="text-right">%</TableHead>
                                    <TableHead className="text-right">Presupuesto ($)</TableHead>
                                    <TableHead className="text-right">Real ($)</TableHead>
                                    <TableHead className="text-right">Variación ($)</TableHead>
                                    <TableHead className="text-right">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.comparison.map((line) => {
                                    const isRevenue = line.account_code.startsWith('4');

                                    // Logic for color:
                                    // Revenue: Actual > Budget is Good (Green)
                                    // Expense: Actual < Budget is Good (Green)

                                    const varianceBs = line.variance_bs;
                                    const isGoodBs = isRevenue ? varianceBs >= 0 : varianceBs <= 0;

                                    const editValue = editLines[line.account_id];

                                    return (
                                        <TableRow key={line.account_id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{line.account_name}</span>
                                                    <span className="text-xs text-muted-foreground">{line.account_code}</span>
                                                </div>
                                            </TableCell>

                                            {/* BS */}
                                            <TableCell className="text-right bg-slate-50/50">
                                                {isEditing ? (
                                                    <Input
                                                        className="h-8 text-right w-32 ml-auto"
                                                        type="number"
                                                        value={editValue !== undefined ? editValue.bs : line.budget_bs}
                                                        onChange={(e) => handleInputChange(line.account_id, 'bs', e.target.value)}
                                                    />
                                                ) : formatCurrency(line.budget_bs, 'BS')}
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(line.actual_bs, 'BS')}</TableCell>
                                            <TableCell className={`text-right font-medium ${isGoodBs ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(varianceBs, 'BS')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={Math.abs(line.variance_percent_bs) > 10 ? (isGoodBs ? 'outline' : 'destructive') : 'outline'} className={Math.abs(line.variance_percent_bs) > 10 && isGoodBs ? 'text-green-600 border-green-600' : ''}>
                                                    {line.variance_percent_bs.toFixed(1)}%
                                                </Badge>
                                            </TableCell>

                                            {/* USD */}
                                            <TableCell className="text-right bg-slate-50/50">
                                                {isEditing ? (
                                                    <Input
                                                        className="h-8 text-right w-32 ml-auto"
                                                        type="number"
                                                        value={editValue !== undefined ? editValue.usd : line.budget_usd}
                                                        onChange={(e) => handleInputChange(line.account_id, 'usd', e.target.value)}
                                                    />
                                                ) : formatCurrency(line.budget_usd, 'USD')}
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(line.actual_usd, 'USD')}</TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(line.variance_usd, 'USD')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {line.variance_percent_usd.toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold">Presupuestos y Planificación</h2>
                    <p className="text-sm text-muted-foreground">Gestiona y compara presupuestos vs ejecución real</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Presupuesto
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoadingList ? (
                    <div>Cargando presupuestos...</div>
                ) : budgets?.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>No hay presupuestos creados</p>
                    </div>
                ) : (
                    budgets?.map((budget: AccountingBudget) => (
                        <Card key={budget.id} className="hover:border-primary/50 cursor-pointer transition-colors" onClick={() => setSelectedBudget(budget.id)}>
                            <CardHeader>
                                <CardTitle>{budget.name}</CardTitle>
                                <CardDescription>
                                    {new Date(budget.period_start).toLocaleDateString()} - {new Date(budget.period_end).toLocaleDateString()}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Monto Presupuestado:</span>
                                    <span className="font-bold">{formatCurrency(budget.total_amount_usd, 'USD')}</span>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Badge variant={budget.status === 'active' ? 'default' : 'secondary'}>{budget.status}</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <BudgetFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => { }}
            />
        </div>
    )
}
