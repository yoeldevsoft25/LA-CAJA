import { useState, useRef, useEffect } from 'react'
import { Search, User, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Customer {
    id: string
    name: string
    document_id: string | null
    phone: string | null
    note: string | null
}

interface CustomerSearchSectionProps {
    customers: Customer[]
    selectedCustomerId: string | null
    onSelectCustomer: (id: string | null) => void
    searchValue: string
    onSearchChange: (value: string) => void
    required?: boolean
    className?: string
}

export default function CustomerSearchSection({
    customers,
    selectedCustomerId,
    onSelectCustomer,
    searchValue,
    onSearchChange,
    required = false,
    className,
}: CustomerSearchSectionProps) {
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

    // Filtrar clientes por búsqueda
    const filteredCustomers = customers.filter(customer => {
        const search = searchValue.toLowerCase()
        return (
            customer.name.toLowerCase().includes(search) ||
            customer.document_id?.toLowerCase().includes(search) ||
            customer.phone?.toLowerCase().includes(search)
        )
    }).slice(0, 10) // Limitar a 10 resultados

    // Cerrar resultados al hacer click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelectCustomer = (customer: Customer) => {
        onSelectCustomer(customer.id)
        onSearchChange(customer.name)
        setShowResults(false)
    }

    const handleClearCustomer = () => {
        onSelectCustomer(null)
        onSearchChange('')
    }

    return (
        <Card className={className}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="customer-search">
                        Cliente {required && <span className="text-destructive">*</span>}
                    </Label>
                    {selectedCustomer && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearCustomer}
                            className="h-6 px-2"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Limpiar
                        </Button>
                    )}
                </div>

                <div className="relative" ref={searchRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="customer-search"
                            type="text"
                            placeholder="Buscar por nombre, cédula o teléfono..."
                            value={searchValue}
                            onChange={(e) => {
                                onSearchChange(e.target.value)
                                setShowResults(true)
                            }}
                            onFocus={() => setShowResults(true)}
                            className="pl-9"
                        />
                    </div>

                    {/* Resultados de búsqueda */}
                    {showResults && searchValue && filteredCustomers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-auto">
                            {filteredCustomers.map((customer) => (
                                <button
                                    key={customer.id}
                                    onClick={() => handleSelectCustomer(customer)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 hover:bg-muted transition-colors",
                                        "border-b last:border-b-0"
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{customer.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {customer.document_id && (
                                                    <span className="mr-2">CI: {customer.document_id}</span>
                                                )}
                                                {customer.phone && (
                                                    <span>Tel: {customer.phone}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Sin resultados */}
                    {showResults && searchValue && filteredCustomers.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-3">
                            <div className="text-sm text-muted-foreground text-center">
                                No se encontraron clientes
                            </div>
                        </div>
                    )}
                </div>

                {/* Cliente seleccionado */}
                {selectedCustomer && (
                    <div className="bg-muted p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                            <User className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">{selectedCustomer.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {selectedCustomer.document_id && (
                                        <div>CI: {selectedCustomer.document_id}</div>
                                    )}
                                    {selectedCustomer.phone && (
                                        <div>Tel: {selectedCustomer.phone}</div>
                                    )}
                                    {selectedCustomer.note && (
                                        <div className="mt-1 italic">{selectedCustomer.note}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {required && !selectedCustomer && (
                    <div className="text-xs text-destructive">
                        Debes seleccionar un cliente para este método de pago
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
