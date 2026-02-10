import { memo } from 'react'
import { Bell, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NotificationType = 'warning' | 'success' | 'error' | 'info'

interface Notification {
    id: string
    title: string
    description?: string
    type: NotificationType
    read: boolean
    created_at: string
}

interface NotificationsMenuProps {
    notifications: Notification[]
    unreadCount: number
    markAsRead: (id: string) => void
    markAllAsRead: () => void
}

const ICON_MAP = {
    warning: AlertTriangle,
    success: CheckCircle2,
    error: Info,
    info: Info,
} as const

const COLOR_MAP = {
    warning: 'text-[hsl(var(--warning))]',
    success: 'text-[hsl(var(--success))]',
    error: 'text-destructive',
    info: 'text-primary',
} as const

const NotificationItem = memo(function NotificationItem({
    notification: n,
    onRead,
}: {
    notification: Notification
    onRead: (id: string) => void
}) {
    const Icon = ICON_MAP[n.type] || Info
    const color = COLOR_MAP[n.type] || 'text-primary'

    return (
        <button
            className={cn(
                'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
                !n.read && 'bg-accent/40'
            )}
            onClick={() => onRead(n.id)}
        >
            <div className="flex gap-3 items-start">
                <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', color)} />
                <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
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
})

export const NotificationsMenu = memo(function NotificationsMenu({
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
}: NotificationsMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
                >
                    <Bell className="w-5 h-5" aria-hidden="true" />
                    {unreadCount > 0 && (
                        <span
                            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-destructive text-[10px] leading-[18px] rounded-full text-white text-center"
                            aria-hidden="true"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-80 p-0 flex flex-col max-h-[500px]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <div>
                        <p className="text-sm font-semibold">Notificaciones</p>
                        <p className="text-xs text-muted-foreground">
                            {unreadCount} sin leer · {notifications.length} total
                        </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={markAllAsRead}>
                        Marcar leídas
                    </Button>
                </div>

                {/* Lista */}
                {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Sin notificaciones
                    </div>
                ) : (
                    <div className="overflow-y-auto overflow-x-hidden max-h-[400px]">
                        <div className="divide-y divide-border">
                            {notifications.map(n => (
                                <NotificationItem
                                    key={n.id}
                                    notification={n}
                                    onRead={markAsRead}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
})
