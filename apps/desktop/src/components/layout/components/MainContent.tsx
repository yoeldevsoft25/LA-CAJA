import { memo } from 'react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface MainContentProps {
    isPosRoute: boolean
}

export const MainContent = memo(function MainContent({ isPosRoute }: MainContentProps) {
    return (
        <main
            id="main-content"
            className={cn(
                'flex-1 overflow-x-hidden touch-pan-y overscroll-contain min-h-0 scroll-smooth',
                isPosRoute ? 'overflow-hidden' : 'overflow-y-auto'
            )}
            role="main"
            aria-label="Contenido principal"
        >
            {isPosRoute ? (
                <div className="p-0">
                    <Outlet />
                </div>
            ) : (
                <div className="p-4 lg:p-8">
                    <Outlet />
                </div>
            )}
        </main>
    )
})
