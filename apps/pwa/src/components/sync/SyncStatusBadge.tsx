import { useEffect, useState } from 'react'
import { syncService, SyncStatus } from '@la-caja/app-core'
import { CircuitState } from '@la-caja/offline-core'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertCircle } from 'lucide-react'

export function SyncStatusBadge() {
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        pendingCount: 0,
        lastSyncAt: null,
        lastError: null,
        isServerAvailable: true,
        serverStatus: CircuitState.CLOSED,
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

    // Variant: Premium Animated Pill
    if (!isOnline) {
        return (
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-2 pl-2 pr-3 py-1.5 h-8 rounded-full transition-all hover:bg-red-500/20">
                <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </div>
                <span className="font-medium">Offline</span>
                {status.pendingCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-bold">
                        {status.pendingCount}
                    </span>
                )}
            </Badge>
        )
    }

    if (status.isSyncing) {
        return (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-2 pl-2 pr-3 py-1.5 h-8 rounded-full transition-all">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="font-medium">Sincronizando...</span>
            </Badge>
        )
    }

    if (status.lastError && status.pendingCount > 0) {
        return (
            <Badge variant="destructive" className="gap-2 pl-2 pr-3 py-1.5 h-8 rounded-full shadow-lg shadow-destructive/20 cursor-pointer hover:scale-105 transition-transform" onClick={() => syncService.forceSync()}>
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="font-medium">Error ({status.pendingCount})</span>
            </Badge>
        )
    }

    // Default: Connected & Synced
    return (
        <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 gap-2 pl-2 pr-3 py-1.5 h-8 rounded-full transition-all hover:bg-emerald-500/10 hover:border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <span className="font-medium">En línea</span>
        </Badge>
    )
}
