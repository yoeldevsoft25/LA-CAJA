import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, User, X, CheckCircle2 } from 'lucide-react'
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

    const MIN_SEARCH_LENGTH = 2
    const trimmedSearch = searchValue.trim()
    const canSearch = trimmedSearch.length >= MIN_SEARCH_LENGTH
    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)

    const filteredCustomers = useMemo(() => {
        const normalized = trimmedSearch.toLowerCase()

        // Si no hay búsqueda, mostrar los primeros 10 (ej: clientes frecuentes/recientes)
        if (!normalized) {
            return customers.slice(0, 10)
        }

        return customers
            .filter((customer) => (
                customer.name.toLowerCase().includes(normalized)
                || customer.document_id?.toLowerCase().includes(normalized)
                || customer.phone?.toLowerCase().includes(normalized)
            ))
            .slice(0, 15) // Aumentamos un poco el límite de resultados locales
    }, [customers, trimmedSearch])

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
        setShowResults(false)
    }

    const searchId = 'customer-search'
    const listId = 'customer-search-results'

    return (
        <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <Label htmlFor={searchId} className="text-sm font-bold text-slate-900">
                            Cliente {required && <span className="text-destructive">*</span>}
                        </Label>
                        <p className="text-xs text-slate-500">Asocia la venta para historico y credito</p>
                    </div>
                    {selectedCustomer && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearCustomer}
                            className="h-8 px-2 text-slate-600"
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Limpiar
                        </Button>
                    )}
                </div>

                <div className="relative" ref={searchRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        id={searchId}
                        type="text"
                        role="combobox"
                        aria-expanded={showResults}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        placeholder="Buscar por nombre, cedula o telefono"
                        value={searchValue}
                        onChange={(e) => {
                            onSearchChange(e.target.value)
                            setShowResults(true)
                        }}
                        onFocus={() => setShowResults(true)}
                        className="pl-9 h-10"
                    />

                    {showResults && canSearch && filteredCustomers.length > 0 && (
                        <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-background shadow-lg">
                            {filteredCustomers.map((customer) => (
                                <button
                                    key={customer.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selectedCustomerId === customer.id}
                                    onClick={() => handleSelectCustomer(customer)}
                                    className={cn(
                                        'w-full border-b border-slate-100 px-3 py-2 text-left transition-colors last:border-b-0',
                                        'hover:bg-slate-50 focus-visible:bg-slate-50',
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <User className="mt-0.5 h-4 w-4 text-slate-400" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-slate-900">{customer.name}</p>
                                            <p className="truncate text-xs text-slate-500">
                                                {customer.document_id ? `CI: ${customer.document_id}` : 'Sin documento'}
                                                {customer.phone ? ` - ${customer.phone}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {showResults && trimmedSearch.length > 0 && !canSearch && (
                        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-background p-3 shadow-lg">
                            <p className="text-center text-sm text-slate-500">
                                Escribe al menos {MIN_SEARCH_LENGTH} caracteres
                            </p>
                        </div>
                    )}

                    {showResults && canSearch && filteredCustomers.length === 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-background p-3 shadow-lg">
                            <p className="text-center text-sm text-slate-500">No se encontraron clientes</p>
                        </div>
                    )}
                </div>

                {selectedCustomer && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-emerald-900">{selectedCustomer.name}</p>
                                <p className="text-xs text-emerald-700">
                                    {selectedCustomer.document_id ? `CI: ${selectedCustomer.document_id}` : 'Sin documento'}
                                    {selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ''}
                                </p>
                                {selectedCustomer.note && <p className="mt-1 text-xs text-emerald-700">{selectedCustomer.note}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {required && !selectedCustomer && (
                    <p className="text-xs text-destructive" role="alert">
                        Debes seleccionar un cliente para continuar con este metodo
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
