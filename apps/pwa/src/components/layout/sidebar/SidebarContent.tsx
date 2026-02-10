import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'

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
    const [openPopover, setOpenPopover] = useState<string | null>(null)

    // ──────────────────────────────────────
    // COLLAPSED STATE — Icon rail con popovers
    // ──────────────────────────────────────
    if (sidebarCollapsed && !isMobile) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col h-full min-h-0"
            >
                <ScrollArea className="flex-1 min-h-0 px-2 py-3">
                    <nav className="space-y-1">
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
                                                        whileHover={{ scale: 1.08 }}
                                                        whileTap={{ scale: 0.92 }}
                                                        className={cn(
                                                            "relative w-full flex items-center justify-center p-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                                                            hasActiveItem
                                                                ? "bg-primary/15 text-primary shadow-sm"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                        )}
                                                    >
                                                        <SectionIcon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={hasActiveItem ? 2.5 : 1.75} />
                                                        {/* Active indicator dot */}
                                                        {hasActiveItem && (
                                                            <motion.span
                                                                layoutId="collapsed-active"
                                                                className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-primary"
                                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                            />
                                                        )}
                                                    </motion.button>
                                                </PopoverTrigger>
                                            </TooltipTrigger>
                                            {!isOpen && (
                                                <TooltipContent side="right" className="text-xs font-medium">
                                                    {section.label}
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                    <PopoverContent
                                        side="right"
                                        align="start"
                                        className="w-56 p-1.5 shadow-xl rounded-xl ml-1"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                {section.label}
                                            </div>
                                            {section.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item.path)

                                                return (
                                                    <button
                                                        key={item.path}
                                                        onClick={() => {
                                                            handleNavClick(item.path)
                                                            setOpenPopover(null)
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                                                            active
                                                                ? "bg-primary/10 text-primary font-medium"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                        )}
                                                    >
                                                        <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 1.75} />
                                                        <span className="flex-1 text-left truncate">{item.label}</span>
                                                        {item.badge && (
                                                            <Badge
                                                                variant="secondary"
                                                                className={cn(
                                                                    "text-[9px] h-4 px-1 flex-shrink-0",
                                                                    item.badge === 'Nuevo' && "bg-primary/15 text-primary border-0",
                                                                    item.badge === 'Beta' && "bg-[hsl(var(--warning)_/_0.16)] text-[hsl(var(--warning))] border-0"
                                                                )}
                                                            >
                                                                {item.badge}
                                                            </Badge>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )
                        })}
                    </nav>
                </ScrollArea>

                {/* Expand button */}
                <div className="p-2 flex-shrink-0 border-t border-border/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(false)}
                        className="w-full h-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </Button>
                </div>
            </motion.div>
        );
    }

    // ──────────────────────────────────────
    // EXPANDED STATE — Full sidebar con accordion
    // ──────────────────────────────────────
    return (
        <div className="flex flex-col h-full min-h-0">
            <ScrollArea className="flex-1 min-h-0 px-3 py-2">
                <nav className="space-y-1">
                    <Accordion
                        type="multiple"
                        value={openSections}
                        onValueChange={setOpenSections}
                        className="w-full space-y-1"
                    >
                        {filteredNavSections.map((section) => {
                            const SectionIcon = section.icon
                            const hasActiveItem = section.items.some((item) => isActive(item.path))

                            return (
                                <AccordionItem key={section.id} value={section.id} className="border-0">
                                    <AccordionTrigger
                                        className={cn(
                                            "px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:no-underline group",
                                            hasActiveItem
                                                ? "text-primary"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 flex-1">
                                            <SectionIcon
                                                className={cn(
                                                    "w-[18px] h-[18px] flex-shrink-0 transition-colors",
                                                    hasActiveItem ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
                                                )}
                                                strokeWidth={hasActiveItem ? 2.5 : 1.75}
                                            />
                                            <span className="flex-1 text-left text-[13px]">{section.label}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-0.5 pb-1">
                                        <div className="space-y-0.5 ml-3 pl-3 relative">
                                            {/* Vertical guide line */}
                                            <div className="absolute left-0 top-1 bottom-1 w-px bg-border/40" />

                                            {section.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item.path)

                                                return (
                                                    <motion.button
                                                        key={item.path}
                                                        onClick={() => handleNavClick(item.path)}
                                                        whileHover={{ x: 2 }}
                                                        transition={{ duration: 0.15 }}
                                                        className={cn(
                                                            "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all",
                                                            active
                                                                ? "bg-primary/10 text-primary font-medium"
                                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                                        )}
                                                    >
                                                        {/* Active indicator bar */}
                                                        {active && (
                                                            <motion.div
                                                                layoutId="active-indicator"
                                                                className="absolute -left-3 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                            />
                                                        )}
                                                        <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 1.75} />
                                                        <span className="flex-1 text-left truncate">{item.label}</span>
                                                        {item.badge && (
                                                            <Badge
                                                                variant="secondary"
                                                                className={cn(
                                                                    "text-[9px] h-4 px-1.5 flex-shrink-0 font-semibold",
                                                                    item.badge === 'Nuevo' && "bg-primary/15 text-primary border-0",
                                                                    item.badge === 'Beta' && "bg-[hsl(var(--warning)_/_0.16)] text-[hsl(var(--warning))] border-0"
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

            {/* Collapse/Close button */}
            <div className="p-3 flex-shrink-0 border-t border-border/30">
                {!isMobile ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="w-full h-9 rounded-lg border border-border/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground group transition-all text-xs gap-2"
                    >
                        <ChevronsLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                        <span className="font-medium">Contraer</span>
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileOpen(false)}
                        className="w-full h-9 rounded-lg border border-border/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground group transition-all text-xs gap-2"
                    >
                        <ChevronsLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                        <span className="font-medium">Ocultar Menú</span>
                    </Button>
                )}
            </div>
        </div>
    );
})

SidebarContent.displayName = 'SidebarContent'
