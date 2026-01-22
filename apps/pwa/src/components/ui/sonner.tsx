"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")

  useEffect(() => {
    // Detectar tema del sistema
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateTheme = () => {
      setTheme(mediaQuery.matches ? "dark" : "light")
    }

    updateTheme()
    mediaQuery.addEventListener("change", updateTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateTheme)
    }
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:bg-green-500/10 group-[.toaster]:text-green-700 group-[.toaster]:border-green-500/50 dark:group-[.toaster]:text-green-400",
          error:
            "group-[.toaster]:bg-destructive/10 group-[.toaster]:text-destructive group-[.toaster]:border-destructive/50",
          warning:
            "group-[.toaster]:bg-yellow-500/10 group-[.toaster]:text-yellow-700 group-[.toaster]:border-yellow-500/50 dark:group-[.toaster]:text-yellow-400",
          info: "group-[.toaster]:bg-blue-500/10 group-[.toaster]:text-blue-700 group-[.toaster]:border-blue-500/50 dark:group-[.toaster]:text-blue-400",
        },
      }}
      position="top-right"
      richColors
      closeButton
      {...props}
    />
  )
}

export { Toaster }
