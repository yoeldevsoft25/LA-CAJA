"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const [theme, setTheme] = useState<"light" | "dark" | "system">("system")

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        const updateTheme = () => setTheme(mediaQuery.matches ? "dark" : "light")
        updateTheme()
        mediaQuery.addEventListener("change", updateTheme)
        return () => mediaQuery.removeEventListener("change", updateTheme)
    }, [])

    return (
        <Sonner
            theme={theme}
            className="toaster group"
            position="top-right"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[0_20px_50px_rgba(0,0,0,0.12)] group-[.toaster]:rounded-2xl group-[.toaster]:p-5 group-[.toaster]:items-center group-[.toaster]:gap-4 group-[.toaster]:border group-[.toaster]:border-border/60",
                    title: "group-[.toast]:text-[15px] group-[.toast]:font-bold group-[.toast]:tracking-tight",
                    description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:px-5 group-[.toast]:py-2 group-[.toast]:text-sm group-[.toast]:font-bold group-[.toast]:transition-all group-[.toast]:hover:brightness-110",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:px-5 group-[.toast]:py-2 group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:transition-all",
                    closeButton:
                        "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground",
                    success: "group-[.toaster]:text-emerald-600 dark:group-[.toaster]:text-emerald-400 group-[.toaster]:border-emerald-500/20",
                    error: "group-[.toaster]:text-destructive group-[.toaster]:border-destructive/20",
                    warning: "group-[.toaster]:text-amber-600 dark:group-[.toaster]:text-amber-400 group-[.toaster]:border-amber-500/20",
                    info: "group-[.toaster]:text-primary group-[.toaster]:border-primary/20",
                },
            }}
            richColors
            closeButton={false}
            {...props}
        />
    )
}

export { Toaster }
