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
 * 
 * Radix UI requiere que cada DialogContent tenga un DialogTitle para que sea accesible
 * para usuarios de lectores de pantalla. Si el título no debe mostrarse visualmente,
 * usa la prop `hidden={true}` para ocultarlo pero mantenerlo accesible.
 * 
 * @example
 * // Título visible
 * <AccessibleDialogTitle>Confirmar acción</AccessibleDialogTitle>
 * 
 * @example
 * // Título oculto visualmente pero accesible
 * <AccessibleDialogTitle hidden>Diálogo de configuración</AccessibleDialogTitle>
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
