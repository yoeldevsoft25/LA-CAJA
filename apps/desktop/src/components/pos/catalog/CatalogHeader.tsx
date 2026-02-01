import { Search, RotateCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import ScannerStatusBadge from '@/components/pos/ScannerStatusBadge'

interface CatalogHeaderProps {
    searchQuery: string
    onSearchChange: (value: string) => void
    scannerStatus: 'idle' | 'scanning' | 'success' | 'error'
    scannerSoundEnabled: boolean
    onToggleScannerSound: () => void
    onRefresh: () => void
    isRefetching: boolean
}

export function CatalogHeader({
    searchQuery,
    onSearchChange,
    scannerStatus,
    scannerSoundEnabled,
    onToggleScannerSound,
    onRefresh,
    isRefetching
}: CatalogHeaderProps) {
    return (
        <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">Punto de Venta</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Busca y agrega productos al carrito
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRefresh}
                        className={isRefetching ? 'animate-spin' : ''}
                        title="Actualizar productos"
                    >
                        <RotateCw className="w-5 h-5" />
                    </Button>
                    <ScannerStatusBadge
                        scannerStatus={scannerStatus}
                        scannerSoundEnabled={scannerSoundEnabled}
                        onSoundToggle={onToggleScannerSound}
                    />
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    placeholder="Buscar producto por nombre, código o categoría... (Alt+F)"
                    className="pl-10 h-11 sm:h-12 text-base sm:text-lg bg-muted/30 border-muted-foreground/20 focus:border-primary/50 focus:ring-primary/20 transition-all font-medium"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>
        </div>
    )
}
