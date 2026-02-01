import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { VisuallyHidden } from "./visually-hidden"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  // Detectar mobile para optimizar animaciones
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm",
        // Animaciones más simples en mobile para mejor rendimiento
        isMobile
          ? "data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-150"
          : "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      style={{ willChange: 'opacity' }}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const ariaDescribedBy = props['aria-describedby']
  // Detectar mobile para optimizar animaciones
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isBottomSheet = Boolean(className?.includes('bottom-0') || className?.includes('top-auto'))

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Posicionamiento: centrado por defecto o bottom sheet en mobile
          isBottomSheet
            ? "fixed left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-[640px]"
            : "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
          // Tamaño y estilos base - z-index igual que overlay (100) para que el orden del DOM determine el apilamiento (Content > Overlay)
          // Cuando hay modales anidados: Overlay B (z-100) > Content A (z-100) por orden DOM
          isBottomSheet
            ? "z-[100] [&>*]:pointer-events-auto [&_*]:pointer-events-auto gap-4 border bg-background p-4 sm:p-6 shadow-lg rounded-lg"
            : "z-[100] [&>*]:pointer-events-auto [&_*]:pointer-events-auto w-[calc(100%-1.5rem)] sm:w-full max-w-lg gap-4 border bg-background p-4 sm:p-6 shadow-lg rounded-lg",
          // Solo aplicar grid si no hay clases personalizadas
          !className?.includes('flex') && "grid",
          // Animaciones optimizadas para mobile
          isMobile && !className?.includes('bottom-0')
            ? "data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=closed]:scale-95 transition-all duration-150"
            : !className?.includes('bottom-0') && "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          // Para bottom sheet mobile
          isBottomSheet && isMobile && "data-[state=open]:translate-y-0 data-[state=closed]:translate-y-full transition-transform duration-300 ease-out",
          className
        )}
        style={{
          willChange: isMobile ? 'opacity, transform' : undefined,
          pointerEvents: 'auto',
          zIndex: 100,
          bottom: isBottomSheet ? '1rem' : undefined,
          top: isBottomSheet ? 'auto' : undefined,
        }}
        onInteractOutside={(e) => {
          // Permitir cerrar solo si el click es fuera del contenido
          // No prevenir el cierre si el click es en el overlay
          const target = e.target as HTMLElement
          const content = e.currentTarget as HTMLElement
          // Si el target está dentro del contenido, prevenir el cierre
          if (content.contains(target) && target !== content) {
            e.preventDefault()
          }
        }}
        aria-describedby={ariaDescribedBy ?? undefined}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
}
