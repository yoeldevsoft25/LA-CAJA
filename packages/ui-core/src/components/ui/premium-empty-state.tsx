import { motion } from "framer-motion"
import { LucideIcon, Package } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"

interface PremiumEmptyStateProps {
    title: string
    description?: string
    icon?: LucideIcon
    action?: {
        label: string
        onClick: () => void
    }
    className?: string
}

export function PremiumEmptyState({
    title,
    description,
    icon: Icon = Package,
    action,
    className
}: PremiumEmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4 text-center",
                className
            )}
        >
            <div className="relative mb-6">
                {/* Background Decorative Element */}
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl transform -translate-y-4 scale-150" />

                {/* Icon Container */}
                <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-background to-muted border border-border/50 flex items-center justify-center shadow-2xl ring-8 ring-muted/20">
                    <Icon className="w-10 h-10 text-muted-foreground/60" />

                    {/* Floating Particles/Bubbles (Decorative) */}
                    <motion.div
                        animate={{ y: [-10, 10, -10], opacity: [0, 0.5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-primary/20 blur-sm"
                    />
                </div>
            </div>

            <h3 className="text-xl font-bold text-foreground mb-2 selection:bg-primary/20">
                {title}
            </h3>

            {description && (
                <p className="text-muted-foreground max-w-sm mx-auto mb-8 leading-relaxed">
                    {description}
                </p>
            )}

            {action && (
                <Button
                    onClick={action.onClick}
                    className="shadow-xl shadow-primary/20 transform hover:scale-105 transition-transform"
                >
                    {action.label}
                </Button>
            )}
        </motion.div>
    )
}
