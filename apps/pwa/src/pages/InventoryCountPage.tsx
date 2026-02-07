import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, Barcode, Trash2, History, RotateCcw, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { usePOSScanner } from '@/hooks/pos/usePOSScanner'
import { productsCacheService } from '@la-caja/app-core'
import { inventoryService } from '@/services/inventory.service'
import toast from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/auth.store'
import { Product } from '@la-caja/app-core'

interface CountItem {
    product_id: string
    name: string
    qty: number
    started_at: string // Timestamp of first scan
    last_scanned_at: string
    barcode?: string | null
}

export default function InventoryCountPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const storeId = user?.store_id
    const [searchQuery, setSearchQuery] = useState('')
    const [counts, setCounts] = useState<Record<string, CountItem>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // Persistencia local básica
    useEffect(() => {
        const saved = localStorage.getItem('live_inventory_session')
        if (saved) {
            try {
                setCounts(JSON.parse(saved))
            } catch (e) {
                console.error('Error cargando sesión de inventario', e)
            }
        }
    }, [])

    useEffect(() => {
        localStorage.setItem('live_inventory_session', JSON.stringify(counts))
    }, [counts])

    // Cargar productos (cache)
    const { data: products = [] } = useQuery({
        queryKey: ['products-cache', storeId],
        queryFn: () => storeId ? productsCacheService.getProductsFromCache(storeId) : Promise.resolve([]),
        enabled: !!storeId,
        staleTime: 1000 * 60 * 60, // 1 hora
    })

    // Hook de Scanner
    usePOSScanner({
        storeId,
        onProductFound: async (product: Product) => {
            if (showConfirm || isSubmitting) return
            addProductCount(product)
            toast.success(`Leído: ${product.name}`)
        }
    })

    const addProductCount = (product: Product) => {
        setCounts(prev => {
            const existing = prev[product.id]
            const now = new Date().toISOString()

            if (existing) {
                return {
                    ...prev,
                    [product.id]: {
                        ...existing,
                        qty: existing.qty + 1,
                        last_scanned_at: now
                    }
                }
            } else {
                return {
                    ...prev,
                    [product.id]: {
                        product_id: product.id,
                        name: product.name,
                        qty: 1,
                        started_at: now, // CRÍTICO: Usamos el tiempo del primer scan para la reconciliación
                        last_scanned_at: now,
                        barcode: product.barcode
                    }
                }
            }
        })
    }

    const updateQty = (productId: string, newQty: number) => {
        if (newQty < 0) return
        setCounts(prev => {
            if (newQty === 0) {
                const { [productId]: deleted, ...rest } = prev
                return rest
            }
            return {
                ...prev,
                [productId]: { ...prev[productId], qty: newQty }
            }
        })
    }

    const handleManualAdd = (productId: string) => {
        const product = products.find(p => p.id === productId)
        if (product) addProductCount(product)
    }

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return []
        const lower = searchQuery.toLowerCase()
        return products
            .filter(p =>
                p.name.toLowerCase().includes(lower) ||
                p.barcode?.includes(lower) ||
                p.sku?.toLowerCase().includes(lower)
            )
            .slice(0, 5)
    }, [searchQuery, products])

    const sortedCounts = useMemo(() => {
        return Object.values(counts).sort((a, b) =>
            new Date(b.last_scanned_at).getTime() - new Date(a.last_scanned_at).getTime()
        )
    }, [counts])

    const handleReconcile = async () => {
        setIsSubmitting(true)
        try {
            const payload = Object.values(counts).map(item => ({
                product_id: item.product_id,
                quantity: item.qty,
                counted_at: item.started_at
            }))

            await inventoryService.reconcilePhysicalStock(payload)

            toast.success('Inventario reconciliado exitosamente')
            setCounts({}) // Limpiar sesión
            localStorage.removeItem('live_inventory_session')
            setShowConfirm(false)
            navigate('/app/inventory')
        } catch (error) {
            console.error(error)
            toast.error('Error al reconciliar inventario')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-background">
            {/* Header */}
            <header className="flex-none border-b bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Conteo en Vivo</h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Modo Reconciliación Activo
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            if (confirm('¿Borrar todo el conteo actual?')) {
                                setCounts({})
                                localStorage.removeItem('live_inventory_session')
                            }
                        }}
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reiniciar
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left: Input & List */}
                <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                    {/* Search Bar */}
                    <div className="p-4 bg-muted/30 border-b space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o código..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {/* Search Results Dropdown */}
                            {searchQuery && filteredProducts.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50">
                                    {filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            className="w-full text-left px-4 py-2 hover:bg-muted flex items-center justify-between"
                                            onClick={() => {
                                                handleManualAdd(p.id)
                                                setSearchQuery('')
                                            }}
                                        >
                                            <div>
                                                <p className="text-sm font-medium">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.barcode || 'Sin código'}</p>
                                            </div>
                                            <Check className={cn("w-4 h-4 text-primary opacity-0", counts[p.id] && "opacity-100")} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-md text-sm border border-blue-100 dark:border-blue-900/50 flex gap-2">
                            <History className="w-5 h-5 shrink-0" />
                            <p>
                                <strong>Cómo funciona:</strong> El sistema registra la hora de tu <em>primer escaneo</em> de cada producto.
                                Las ventas que ocurran después de ese momento se restarán automáticamente del conteo final.
                                ¡Puedes contar con la tienda abierta! 🚀
                            </p>
                        </div>
                    </div>

                    {/* Counts List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {sortedCounts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center opacity-50">
                                <Barcode className="w-16 h-16 mb-4" />
                                <p>Escanea productos para empezar el conteo</p>
                            </div>
                        ) : (
                            sortedCounts.map(item => (
                                <Card key={item.product_id} className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold shrink-0">
                                            {item.qty}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{item.name}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>{item.barcode || '---'}</span>
                                                <span>•</span>
                                                <span>{new Date(item.started_at).toLocaleTimeString()}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline" size="icon" className="h-8 w-8"
                                                onClick={() => updateQty(item.product_id, item.qty - 1)}
                                            >
                                                -
                                            </Button>
                                            <Input
                                                className="w-16 h-8 text-center p-1"
                                                type="number"
                                                value={item.qty}
                                                onChange={(e) => updateQty(item.product_id, parseInt(e.target.value) || 0)}
                                            />
                                            <Button
                                                variant="outline" size="icon" className="h-8 w-8"
                                                onClick={() => updateQty(item.product_id, item.qty + 1)}
                                            >
                                                +
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon" className="h-8 w-8 text-destructive ml-2"
                                                onClick={() => updateQty(item.product_id, 0)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t bg-card sticky bottom-0">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-muted-foreground">Productos: {sortedCounts.length}</span>
                            <span className="font-bold text-lg">Total Unidades: {sortedCounts.reduce((acc, i) => acc + i.qty, 0)}</span>
                        </div>
                        <Button
                            className="w-full h-12 text-lg"
                            disabled={Object.keys(counts).length === 0}
                            onClick={() => setShowConfirm(true)}
                        >
                            Finalizar y Reconciliar
                        </Button>
                    </div>
                </div>
            </main>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Reconciliación</DialogTitle>
                        <DialogDescription>
                            Se ajustará el inventario de <strong>{Object.keys(counts).length} productos</strong>.
                            El sistema tendrá en cuenta las ventas ocurridas durante tu conteo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md flex gap-3 text-sm text-yellow-800 dark:text-yellow-200 my-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p>
                            Asegúrate de haber contado <strong>todo el stock físico</strong> de los productos listados.
                            Cualquier stock de estos productos que no hayas contado se considerará perdido.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirm(false)}>
                            Seguir Contando
                        </Button>
                        <Button onClick={handleReconcile} disabled={isSubmitting}>
                            {isSubmitting ? 'Procesando...' : 'Confirmar Ajustes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
