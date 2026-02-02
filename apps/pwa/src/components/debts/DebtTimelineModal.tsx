import { useQuery } from '@tanstack/react-query'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { debtsService } from '@/services/debts.service'
import { CheckCircle, Clock, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DebtTimelineModalProps {
    isOpen: boolean
    onClose: () => void
    customerId: string
    customerName: string
}

export default function DebtTimelineModal({
    isOpen,
    onClose,
    customerId,
    customerName,
}: DebtTimelineModalProps) {
    const { data: timelineData, isLoading } = useQuery({
        queryKey: ['debtTimeline', customerId],
        queryFn: () => debtsService.getCustomerDebtTimeline(customerId),
        enabled: isOpen && !!customerId,
    })

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Historial de Deudas de {customerName}</DialogTitle>
                    <DialogDescription>
                        Línea de tiempo de deudas, abonos y cortes.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-8 py-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : !timelineData || timelineData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay historial disponible.
                            </div>
                        ) : (
                            timelineData.map((chain, chainIndex) => (
                                <div key={chainIndex} className="relative border rounded-lg bg-slate-50/50 p-4">
                                    <div className="absolute -left-3 top-4 bg-white border rounded-full p-1 shadow-sm z-10">
                                        <span className="text-xs font-bold text-slate-500 w-6 h-6 flex items-center justify-center">
                                            {timelineData.length - chainIndex}
                                        </span>
                                    </div>

                                    <div className="space-y-4 ml-6">
                                        {chain.items.map((item: any, index: number) => {
                                            const date = new Date(item.data.created_at || item.data.paid_at) // Deudas usan created_at, pagos paid_at
                                            return (
                                                <div key={index} className="flex gap-4 relative">
                                                    {/* Línea conectora */}
                                                    {index < chain.items.length - 1 && (
                                                        <div className="absolute left-[19px] top-8 bottom-[-16px] w-[2px] bg-slate-200" />
                                                    )}

                                                    <div className="mt-1">
                                                        {item.type === 'debt' ? (
                                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200">
                                                                <CreditCard className="w-5 h-5 text-orange-600" />
                                                            </div>
                                                        ) : (
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${item.data.method === 'ROLLOVER' ? 'bg-blue-100 border-blue-200' : 'bg-green-100 border-green-200'}`}>
                                                                {item.data.method === 'ROLLOVER' ? (
                                                                    <Clock className="w-5 h-5 text-blue-600" />
                                                                ) : (
                                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 bg-white p-3 rounded border shadow-sm">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-semibold text-sm">
                                                                    {item.type === 'debt' ? 'Nueva Deuda Generada' : (
                                                                        item.data.method === 'ROLLOVER' ? 'Corte Automático (Rollover)' : 'Abono Recibido'
                                                                    )}
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {format(date, "d 'de' MMM, yyyy - h:mm a", { locale: es })}
                                                                </p>
                                                            </div>
                                                            <Badge variant={item.type === 'debt' ? 'outline' : 'default'} className={
                                                                item.type === 'debt' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                                                    (item.data.method === 'ROLLOVER' ? 'bg-blue-600' : 'bg-green-600')
                                                            }>
                                                                {item.type === 'debt' && `$${Number(item.data.amount_usd).toFixed(2)}`}
                                                                {item.type === 'payment' && `$${Number(item.data.amount_usd).toFixed(2)}`}
                                                            </Badge>
                                                        </div>
                                                        {item.type === 'debt' && (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                <p>{item.data.note || 'Sin nota'}</p>
                                                                <div className="mt-1 flex gap-2">
                                                                    <Badge variant="secondary" className="text-[10px] h-5">Estado: {item.data.status}</Badge>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {item.type === 'payment' && (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                <p>{item.data.note}</p>
                                                                {item.data.method === 'ROLLOVER' && (
                                                                    <p className="mt-1 text-blue-600 font-medium">
                                                                        Saldo trasladado a nueva deuda.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
