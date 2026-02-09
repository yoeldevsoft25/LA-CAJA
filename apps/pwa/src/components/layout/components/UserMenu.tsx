import { memo } from 'react'
import { LogOut, Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MobileNotifications } from './MobileNotifications'

interface UserMenuProps {
    fullName: string | null | undefined
    role: string | undefined
    onLogout: () => void
    // Mobile notifications
    notifications: any[]
    unreadCount: number
    markAsRead: (id: string) => void
    markAllAsRead: () => void
}

function getInitials(name?: string | null): string {
    if (!name) return 'U'
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

export const UserMenu = memo(function UserMenu({
    fullName,
    role,
    onLogout,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
}: UserMenuProps) {
    const initials = getInitials(fullName)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start">
                        <span className="text-sm font-medium leading-none">
                            {fullName || 'Usuario'}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                            {role || 'cashier'}
                        </span>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {/* Mobile-only notifications */}
                <MobileNotifications
                    notifications={notifications}
                    unreadCount={unreadCount}
                    markAsRead={markAsRead}
                    markAllAsRead={markAllAsRead}
                />

                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Configuración
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Bell className="w-4 h-4 mr-2" />
                    Notificaciones
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
})
