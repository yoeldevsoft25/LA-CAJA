import { useNotificationBadge } from '@/hooks/useNotificationBadge'
import { NotificationsPanel } from './NotificationsPanel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Componente de campana de notificaciones con badge
 */
export function NotificationBell() {
  const { unreadCount } = useNotificationBadge()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute top-0 right-0 h-5 w-5 rounded-full',
                'bg-primary text-primary-foreground text-xs font-semibold',
                'flex items-center justify-center',
                'border-2 border-background',
                unreadCount > 9 ? 'text-[10px] px-0.5' : ''
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationsPanel />
      </PopoverContent>
    </Popover>
  )
}

