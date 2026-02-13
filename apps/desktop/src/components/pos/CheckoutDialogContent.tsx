import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { DialogOverlay, DialogPortal, DialogClose } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export const CheckoutDialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay className="z-[999]" />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "checkout-dialog-content fixed left-1/2 top-1/2 z-[1000] grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200",
                className
            )}
            {...props}
        >
            {children}
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogClose>
        </DialogPrimitive.Content>
    </DialogPortal>
))
CheckoutDialogContent.displayName = DialogPrimitive.Content.displayName
