import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { bankReconciliationService } from '@/services/accounting.service'
import { useAuth } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'

interface StatementUploadModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function StatementUploadModal({ isOpen, onClose }: StatementUploadModalProps) {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const storeId = user?.store_id

    const [file, setFile] = useState<File | null>(null)
    const [bankName, setBankName] = useState('')
    const [accountNumber, setAccountNumber] = useState('')
    const [currency, setCurrency] = useState<'BS' | 'USD'>('BS')
    const [isProcessing, setIsProcessing] = useState(false)

    const uploadMutation = useMutation({
        mutationFn: async (csvData: any[]) => {
            if (!storeId) throw new Error("No store")

            // 1. Create Statement Header
            // We'll estimate period from data or ask user. For now, let's take min/max date from CSV
            const dates = csvData.map(r => new Date(r.date).getTime()).filter(d => !isNaN(d))
            const minDate = new Date(Math.min(...dates)).toISOString()
            const maxDate = new Date(Math.max(...dates)).toISOString()

            const statement = await bankReconciliationService.createStatement({
                store_id: storeId,
                bank_name: bankName,
                account_number: accountNumber,
                period_start: minDate,
                period_end: maxDate,
                currency: currency,
                filename: file?.name,
            })

            // 2. Upload Lines
            const transactions = csvData.map(r => ({
                transaction_date: r.date,
                description: r.description,
                reference_number: r.reference,
                amount: parseFloat(r.amount), // Signed amount expected
                type: (parseFloat(r.amount) >= 0 ? 'credit' : 'debit') as 'credit' | 'debit'
            }))

            await bankReconciliationService.addTransactions(statement.id, transactions)
            return statement
        },
        onSuccess: () => {
            toast.success('Estado de cuenta importado')
            queryClient.invalidateQueries({ queryKey: ['bank-statements'] })
            onClose()
            setFile(null)
        },
        onError: (e) => {
            console.error(e)
            toast.error('Error al importar')
        }
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const parseCSV = (text: string) => {
        // Simple parser assumption: Date, Description, Reference, Amount
        // Adjust based on real CSV. For now, generic.
        const lines = text.split('\n')
        const data = []
        for (let i = 1; i < lines.length; i++) { // Skip header
            const line = lines[i].trim()
            if (!line) continue
            const cols = line.split(',') // Basic split, risky with quoted commas
            if (cols.length >= 3) {
                data.push({
                    date: cols[0], // YYYY-MM-DD
                    description: cols[1],
                    reference: cols[2],
                    amount: cols[3]
                })
            }
        }
        return data
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) return;

        setIsProcessing(true)
        const text = await file.text()
        try {
            const data = parseCSV(text)
            if (data.length === 0) {
                toast.error('No se encontraron transacciones en el CSV')
                setIsProcessing(false)
                return
            }
            uploadMutation.mutate(data)
        } catch (err) {
            toast.error('Error parseando CSV')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar Estado de Cuenta</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Banco</Label>
                            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ej. Banesco" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Nro Cuenta (4 dígitos)</Label>
                            <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="1234" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={currency} onValueChange={(v: 'BS' | 'USD') => setCurrency(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BS">Bolívares (Bs)</SelectItem>
                                <SelectItem value="USD">Dólares ($)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Archivo CSV</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-card transition-colors cursor-pointer relative">
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                required
                            />
                            <div className="flex flex-col items-center gap-2 pointer-events-none">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {file ? file.name : 'Click para seleccionar CSV'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Formato: Fecha, Descripción, Referencia, Monto
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={!file || isProcessing || uploadMutation.isPending}>
                            {isProcessing || uploadMutation.isPending ? 'Procesando...' : 'Importar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
