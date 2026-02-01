import { FileText, Tag, Users, Split } from 'lucide-react'
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
    // Pago Dividido
    isSplitPayment: boolean
    onToggleSplitPayment: () => void

    // Factura Fiscal
    generateFiscalInvoice: boolean
    hasFiscalConfig: boolean
    onToggleFiscalInvoice: (value: boolean) => void

    // Promoción
    promotions: Promotion[]
    selectedPromotionId: string | null
    onPromotionChange: (id: string | null) => void

    // Cliente
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
    const selectedPromotion = promotions.find(p => p.id === selectedPromotionId)
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

    return (
        <div className={cn("grid grid-cols-4 gap-2 mb-4", className)}>

            {/* 1. Pago Dividido Toggle */}
            <Button
                variant={isSplitPayment ? "default" : "secondary"}
                size="sm"
                onClick={onToggleSplitPayment}
                className={cn(
                    "h-9 px-2 transition-all duration-300 shadow-none",
                    isSplitPayment
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
            >
                <Split className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <span className="font-medium truncate text-xs sm:text-sm">Dividir</span>
            </Button>

            {/* 2. Factura Fiscal Toggle */}
            {hasFiscalConfig ? (
                <Button
                    variant={generateFiscalInvoice ? "default" : "secondary"}
                    size="sm"
                    onClick={() => onToggleFiscalInvoice(!generateFiscalInvoice)}
                    className={cn(
                        "h-9 px-2 transition-all duration-300 shadow-none",
                        generateFiscalInvoice
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <span className="font-medium truncate text-xs sm:text-sm">Fiscal</span>
                </Button>
            ) : (
                <div /> /* Spacer */
            )}

            {/* 3. Promoción Dropdown */}
            {promotions.length > 0 ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="secondary"
                            size="sm"
                            className={cn(
                                "h-9 px-2 transition-all shadow-none justify-between",
                                selectedPromotionId
                                    ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center truncate">
                                <Tag className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                                <span className="truncate text-xs sm:text-sm">
                                    {selectedPromotion ? selectedPromotion.name : "Promo"}
                                </span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuLabel>Seleccionar Promoción</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onPromotionChange(null)}>
                            Sin promoción
                        </DropdownMenuItem>
                        {promotions.map((promo) => (
                            <DropdownMenuItem
                                key={promo.id}
                                onClick={() => onPromotionChange(promo.id)}
                                className="justify-between"
                            >
                                {promo.name}
                                {promo.code && <span className="text-xs text-muted-foreground ml-2 px-1 rounded bg-muted">{promo.code}</span>}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : <div />}

            {/* 4. Cliente Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                            "h-9 px-2 transition-all shadow-none justify-between",
                            selectedCustomerId
                                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center truncate">
                            <Users className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                            <span className="truncate text-xs sm:text-sm">
                                {selectedCustomer ? selectedCustomer.name.split(' ')[0] : "Cliente"}
                            </span>
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px]">
                    <DropdownMenuLabel>Seleccionar Cliente</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onCustomerChange(null)}>
                        Cliente General
                    </DropdownMenuItem>
                    {customers.slice(0, 5).map((customer) => (
                        <DropdownMenuItem
                            key={customer.id}
                            onClick={() => onCustomerChange(customer.id)}
                        >
                            <div className="flex flex-col">
                                <span className="font-medium">{customer.name}</span>
                                <span className="text-xs text-muted-foreground">{customer.document_id}</span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
