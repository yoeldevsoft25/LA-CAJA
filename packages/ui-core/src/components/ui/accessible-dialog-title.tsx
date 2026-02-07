import * as React from "react"
import { DialogTitle } from "./dialog"
import { VisuallyHidden } from "./visually-hidden"

export interface AccessibleDialogTitleProps {
    children: React.ReactNode
    /**
     * Si es true, el título se oculta visualmente pero sigue siendo accesible para lectores de pantalla
     * @default false
     */
    hidden?: boolean
    className?: string
}

/**
 * Componente helper para asegurar que todos los diálogos tengan un título accesible.
 */
export function AccessibleDialogTitle({
    children,
    hidden = false,
    className
}: AccessibleDialogTitleProps) {
    if (hidden) {
        return (
            <VisuallyHidden>
                <DialogTitle>{children}</DialogTitle>
            </VisuallyHidden>
        )
    }

    return <DialogTitle className={className}>{children}</DialogTitle>
}
