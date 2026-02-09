import { memo } from 'react'
import { Bell, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface MobileNotificationsProps {
    notifications: any[]
    unreadCount: number
    markAsRead: (id: string) => void
    markAllAsRead: () => void
}

const ICON_MAP: Record<string, any> = {
    warning: AlertTriangle,
    success: CheckCircle2,
    error: Info,
    info: Info,
}

const COLOR_MAP: Record<string, string> = {
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    error: 'text-red-600',
    info: 'text-primary',
}

export const MobileNotifications = memo(function MobileNotifications({
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
}: MobileNotificationsProps) {
    return (
        <div className="sm:hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    Notificaciones
                </div>
                {unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-destructive text-[10px] leading-[18px] rounded-full text-white text-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </div>
            {notifications.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-muted-foreground border-b border-border">
                    Sin notificaciones
                </div>
            ) : (
                <div className="max-h-56 overflow-y-auto border-b border-border">
                    {notifications.map(n => {
                        const Icon = ICON_MAP[n.type] || Info
                        const color = COLOR_MAP[n.type] || 'text-primary'
                        return (
                            <button
                                key={n.id}
                                className={cn(
                                    'w-full text-left px-3 py-2 hover:bg-accent transition-colors',
                                    !n.read && 'bg-accent/40'
                                )}
                                onClick={() => markAsRead(n.id)}
                            >
                                <div className="flex gap-2 items-start">
                                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', color)} />
                                    <div className="flex-1 space-y-0.5 min-w-0">
                                        <p className="text-xs font-medium text-foreground line-clamp-2">
                                            {n.title}
                                        </p>
                                        {n.description && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-2">
                                                {n.description}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                            {new Date(n.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    {!n.read && (
                                        <span className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
            {notifications.length > 0 && (
                <div className="px-3 py-2">
                    <Button size="sm" variant="ghost" className="w-full" onClick={markAllAsRead}>
                        Marcar todas como leídas
                    </Button>
                </div>
            )}
        </div>
    )
})
