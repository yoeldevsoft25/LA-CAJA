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
        <div className={cn('rounded-2xl border border-border bg-card p-3 shadow-sm', className)}>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
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
                        !isSplitPayment && 'border-border bg-card text-foreground/70 hover:bg-card/80',
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
                            !generateFiscalInvoice && 'border-border bg-card text-foreground/70 hover:bg-card/80',
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
                                    'h-10 justify-start gap-2 rounded-xl border-border bg-card text-foreground/70 hover:bg-card/80',
                                    selectedPromotionId && 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20',
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
                                    {promo.code && <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{promo.code}</span>}
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
                                'h-10 justify-start gap-2 rounded-xl border-border bg-card text-foreground/70 hover:bg-card/80',
                                selectedCustomerId && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
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
                                    <p className="truncate text-xs text-muted-foreground">{customer.document_id || 'Sin documento'}</p>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
