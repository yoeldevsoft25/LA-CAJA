import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronLeft } from 'lucide-react'

type NavItem = {
    readonly path: string
    readonly label: string
    readonly icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    readonly badge: string | null
}

type NavSection = {
    readonly id: string
    readonly label: string
    readonly icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    readonly items: readonly NavItem[]
    readonly defaultOpen?: boolean
}

interface SidebarContentProps {
    isMobile?: boolean
    sidebarCollapsed: boolean
    setSidebarCollapsed: (collapsed: boolean) => void
    setMobileOpen: (open: boolean) => void
    filteredNavSections: readonly NavSection[]
    isActive: (path: string) => boolean
    openSections: string[]
    setOpenSections: (sections: string[]) => void
    handleNavClick: (path: string) => void
}

export const SidebarContent = React.memo(({
    isMobile = false,
    sidebarCollapsed,
    setSidebarCollapsed,
    setMobileOpen,
    filteredNavSections,
    isActive,
    openSections,
    setOpenSections,
    handleNavClick
}: SidebarContentProps) => {
    // Estado para controlar qué popover está abierto
    const [openPopover, setOpenPopover] = useState<string | null>(null)

    // Cuando está colapsado, mostrar secciones con popovers
    if (sidebarCollapsed && !isMobile) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col h-full min-h-0 bg-background/80 backdrop-blur-xl border-r border-white/10"
            >
                <div className="h-4"></div>
                <div className="h-4"></div>
                <ScrollArea className="flex-1 min-h-0 px-2 py-4">
                    <nav className="space-y-2">
                        {filteredNavSections.map((section) => {
                            const SectionIcon = section.icon
                            const hasActiveItem = section.items.some((item) => isActive(item.path))
                            const isOpen = openPopover === section.id

                            return (
                                <Popover
                                    key={section.id}
                                    open={isOpen}
                                    onOpenChange={(open) => setOpenPopover(open ? section.id : null)}
                                    modal={false}
                                >
                                    <TooltipProvider delayDuration={0}>
                                        <Tooltip delayDuration={300} disableHoverableContent>
                                            <TooltipTrigger asChild>
                                                <PopoverTrigger asChild>
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        className={cn(
                                                            "relative w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                                                            hasActiveItem
                                                                ? "bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgba(99,102,241,0.5)]"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                                                        )}
                                                    >
                                                        <SectionIcon className="w-5 h-5 flex-shrink-0" strokeWidth={hasActiveItem ? 2.5 : 2} />
                                                        {hasActiveItem && (
                                                            <motion.div
                                                                layoutId="active-pill"
                                                                className="absolute inset-0 rounded-xl bg-primary z-[-1]"
                                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                            />
                                                        )}
                                                    </motion.button>
                                                </PopoverTrigger>
                                            </TooltipTrigger>
                                            {!isOpen && (
                                                <TooltipContent side="right" className="bg-popover/90 backdrop-blur-md border-white/10 text-popover-foreground">
                                                    <p className="font-medium">{section.label}</p>
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                    <PopoverContent side="right" align="start" className="w-60 p-2 bg-background/90 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl ml-2">
                                        <div className="space-y-1">
                                            <div className="px-3 py-2 text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                                                {section.label}
                                            </div>
                                            {section.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item.path)

                                                return (
                                                    <motion.button
                                                        key={item.path}
                                                        onClick={() => {
                                                            handleNavClick(item.path)
                                                            setOpenPopover(null)
                                                        }}
                                                        whileHover={{ x: 4 }}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                                            active
                                                                ? "bg-primary/10 text-primary"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                                        )}
                                                    >
                                                        <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                                                        <span className="flex-1 text-left truncate">{item.label}</span>
                                                    </motion.button>
                                                )
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )
                        })}
                    </nav>
                </ScrollArea>

                <div className="p-3 flex-shrink-0 border-t border-white/10">
                    {!isMobile ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="w-full hover:bg-white/5 text-muted-foreground hover:text-foreground justify-center h-10 rounded-xl"
                        >
                            <ChevronLeft className="w-5 h-5 rotate-180 transition-transform" />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMobileOpen(false)}
                            className="w-full hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 h-10 rounded-xl"
                        >
                            <ChevronLeft className="w-5 h-5 transition-transform" />
                            <span className="font-medium">Ocultar Menú</span>
                        </Button>
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 bg-background/80 backdrop-blur-xl border-r border-white/10">
            <div className="h-4"></div>

            <ScrollArea className="flex-1 min-h-0 px-4 py-2">
                <nav className="space-y-4">
                    <Accordion
                        type="multiple"
                        value={openSections}
                        onValueChange={setOpenSections}
                        className="w-full space-y-4"
                    >
                        {filteredNavSections.map((section) => {
                            const SectionIcon = section.icon
                            const hasActiveItem = section.items.some((item) => isActive(item.path))

                            return (
                                <AccordionItem key={section.id} value={section.id} className="border-0">
                                    <AccordionTrigger
                                        className={cn(
                                            "px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:no-underline group",
                                            hasActiveItem
                                                ? "bg-primary/5 text-primary shadow-sm"
                                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <SectionIcon className={cn("w-5 h-5 flex-shrink-0 transition-colors", hasActiveItem ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={2.5} />
                                            <span className="flex-1 text-left">{section.label}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-0">
                                        <div className="space-y-1 pl-4 relative">
                                            <div className="absolute left-6 top-2 bottom-2 w-[1px] bg-border/50" />

                                            {section.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item.path)

                                                return (
                                                    <motion.button
                                                        key={item.path}
                                                        onClick={() => handleNavClick(item.path)}
                                                        whileHover={{ x: 4 }}
                                                        className={cn(
                                                            "relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ml-2",
                                                            active
                                                                ? "bg-primary/10 text-primary"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                                        )}
                                                    >
                                                        <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                                                        <span className="flex-1 text-left">{item.label}</span>
                                                        {active && (
                                                            <motion.div
                                                                layoutId="active-dot"
                                                                className="absolute left-0 w-1 h-5 bg-primary rounded-full -ml-[9px]"
                                                            />
                                                        )}
                                                        {item.badge && (
                                                            <Badge
                                                                variant="secondary"
                                                                className={cn(
                                                                    "text-[10px] h-5 px-1.5 flex-shrink-0",
                                                                    item.badge === 'Nuevo' ? "bg-indigo-500/20 text-indigo-400" : ""
                                                                )}
                                                            >
                                                                {item.badge}
                                                            </Badge>
                                                        )}
                                                    </motion.button>
                                                )
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                </nav>
            </ScrollArea>

            <div className="p-4 flex-shrink-0 border-t border-white/5">
                {!isMobile ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="w-full h-12 rounded-xl border border-border/50 hover:bg-accent/50 hover:border-border transition-all text-muted-foreground group"
                    >
                        <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                        <span className="ml-2 font-medium">Contraer Menú</span>
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMobileOpen(false)}
                        className="w-full h-12 rounded-xl bg-background/50 border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground group flex items-center justify-center gap-2"
                    >
                        <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                        <span className="font-medium">Ocultar Menú</span>
                    </Button>
                )}
            </div>
        </div>
    );
})

SidebarContent.displayName = 'SidebarContent'
