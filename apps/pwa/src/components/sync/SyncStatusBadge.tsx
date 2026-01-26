import { useEffect, useState } from 'react'
import { syncService, SyncStatus } from '@/services/sync.service'
import { Badge } from '@/components/ui/badge'
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react'

export function SyncStatusBadge() {
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        pendingCount: 0,
        lastSyncAt: null,
        lastError: null,
    })
    const [isOnline, setIsOnline] = useState(navigator.onLine)

    useEffect(() => {
        const updateStats = () => {
            setStatus(syncService.getStatus())
        }

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        const interval = setInterval(updateStats, 2000)
        updateStats()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            clearInterval(interval)
        }
    }, [])

    if (!isOnline) {
        return (
            <Badge variant="outline" className="bg-muted text-muted-foreground gap-1.5 px-3 py-1">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Sin conexión</span>
                {status.pendingCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-muted-foreground/20 rounded-full text-[10px]">
                        {status.pendingCount} pte.
                    </span>
                )}
            </Badge>
        )
    }

    if (status.isSyncing) {
        return (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 px-3 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando...</span>
            </Badge>
        )
    }

    if (status.lastError && status.pendingCount > 0) {
        return (
            <Badge variant="destructive" className="gap-1.5 px-3 py-1 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer" onClick={() => syncService.forceSync()}>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Error de Sync ({status.pendingCount})</span>
            </Badge>
        )
    }

    return (
        <Badge variant="outline" className="bg-success/5 text-success border-success/20 gap-1.5 px-3 py-1">
            <Cloud className="w-3.5 h-3.5" />
            <span>Sincronizado</span>
        </Badge>
    )
}
