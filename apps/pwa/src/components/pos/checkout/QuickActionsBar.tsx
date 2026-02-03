import { FileText, Tag, Users, Split, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

interface Customer {
    id: string
    name: string
    document_id: string | null
}

interface Promotion {
    id: string
    name: string
    code?: string | null
}

interface QuickActionsBarProps {
    isSplitPayment: boolean
    onToggleSplitPayment: () => void
    generateFiscalInvoice: boolean
    hasFiscalConfig: boolean
    onToggleFiscalInvoice: (value: boolean) => void
    promotions: Promotion[]
    selectedPromotionId: string | null
    onPromotionChange: (id: string | null) => void
    customers: Customer[]
    selectedCustomerId: string | null
    onCustomerChange: (id: string | null) => void
    customerSearchTerm: string
    onCustomerSearchChange: (term: string) => void
    className?: string
}

export function QuickActionsBar({
    isSplitPayment,
    onToggleSplitPayment,
    generateFiscalInvoice,
    hasFiscalConfig,
    onToggleFiscalInvoice,
    promotions,
    selectedPromotionId,
    onPromotionChange,
    customers,
    selectedCustomerId,
    onCustomerChange,
    className,
}: QuickActionsBarProps) {
    const selectedPromotion = promotions.find((promotion) => promotion.id === selectedPromotionId)
    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)

    return (
        <div className={cn('rounded-2xl border border-slate-200 bg-white p-3 shadow-sm', className)}>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Acciones rapidas
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Button
                    type="button"
                    variant={isSplitPayment ? 'default' : 'outline'}
                    size="sm"
                    onClick={onToggleSplitPayment}
                    className={cn(
                        'h-10 justify-start gap-2 rounded-xl',
                        !isSplitPayment && 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                    )}
                    aria-pressed={isSplitPayment}
                >
                    <Split className="h-4 w-4" />
                    <span className="truncate">Dividir pago</span>
                </Button>

                {hasFiscalConfig ? (
                    <Button
                        type="button"
                        variant={generateFiscalInvoice ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onToggleFiscalInvoice(!generateFiscalInvoice)}
                        className={cn(
                            'h-10 justify-start gap-2 rounded-xl',
                            !generateFiscalInvoice && 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                        )}
                        aria-pressed={generateFiscalInvoice}
                    >
                        <FileText className="h-4 w-4" />
                        <span className="truncate">Factura fiscal</span>
                    </Button>
                ) : (
                    <div className="hidden lg:block" />
                )}

                {promotions.length > 0 ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                    'h-10 justify-start gap-2 rounded-xl border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                                    selectedPromotionId && 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
                                )}
                            >
                                <Tag className="h-4 w-4" />
                                <span className="truncate">{selectedPromotion ? selectedPromotion.name : 'Promocion'}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[220px]">
                            <DropdownMenuLabel>Promocion</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onPromotionChange(null)}>Sin promocion</DropdownMenuItem>
                            {promotions.map((promo) => (
                                <DropdownMenuItem
                                    key={promo.id}
                                    onClick={() => onPromotionChange(promo.id)}
                                    className="justify-between"
                                >
                                    <span>{promo.name}</span>
                                    {promo.code && <span className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">{promo.code}</span>}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="hidden lg:block" />
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                                'h-10 justify-start gap-2 rounded-xl border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                                selectedCustomerId && 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                            )}
                        >
                            <Users className="h-4 w-4" />
                            <span className="truncate">{selectedCustomer ? selectedCustomer.name : 'Cliente'}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[240px]">
                        <DropdownMenuLabel>Cliente</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onCustomerChange(null)}>Cliente general</DropdownMenuItem>
                        {customers.slice(0, 8).map((customer) => (
                            <DropdownMenuItem key={customer.id} onClick={() => onCustomerChange(customer.id)}>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{customer.name}</p>
                                    <p className="truncate text-xs text-slate-500">{customer.document_id || 'Sin documento'}</p>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
