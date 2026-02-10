import { cva } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] tracking-wide",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm hover:shadow-md hover:shadow-primary/20 bg-gradient-to-b from-white/10 to-transparent",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md hover:shadow-destructive/20 bg-gradient-to-b from-white/10 to-transparent",
                outline:
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/30 shadow-sm transition-colors",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md",
                ghost: "hover:bg-accent/50 hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                gradient: "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] border border-blue-400/20",
                gradientPink: "bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] border border-purple-400/20",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-9 rounded-md px-3 text-xs",
                lg: "h-11 rounded-md px-8 text-base",
                xl: "h-14 rounded-lg px-10 text-lg font-bold",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)
