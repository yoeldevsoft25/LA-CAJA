import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

interface PremiumLoaderProps {
    message?: string
    className?: string
    variant?: "full" | "inline" | "overlay"
}

export function PremiumLoader({
    message = "Cargando...",
    className,
    variant = "inline"
}: PremiumLoaderProps) {
    const isFull = variant === "full"
    const isOverlay = variant === "overlay"

    const content = (
        <div className={cn(
            "flex flex-col items-center justify-center gap-4 text-center p-8",
            isFull && "min-h-[60vh]",
            className
        )}>
            <div className="relative">
                {/* Outer Glow Ring */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                />

                {/* Main Spinner */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                >
                    <Loader2 className="w-10 h-10 text-primary relative z-10" />
                </motion.div>
            </div>

            {message && (
                <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-medium text-muted-foreground animate-pulse"
                >
                    {message}
                </motion.p>
            )}
        </div>
    )

    if (isOverlay) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                {content}
            </div>
        )
    }

    return content
}
